import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sanitized, diagnosticDb} from '../scripts/lib/diagnostics.mjs';
import {boundedCommand, managedCommand, boundedFetch, stopProcess, localEnvironment, localHarness} from '../scripts/lib/local-harness.mjs';

test('failure diagnostics redact credentials while retaining useful database and status information', () => {
  const secret = 'a'.repeat(64);
  const message = sanitized(`D1.batch SQLITE_BUSY ${secret}\nCookie: tlpt_rsvp=${secret}\nAuthorization: Bearer private\n{"token":"keep-private","error":"HTTP 503"}\nhttps://name:password@example.test/#key=also-private`);
  for (const value of [secret,'keep-private','Bearer private','name:password','also-private']) assert.ok(!message.includes(value));
  assert.match(message,/SQLITE_BUSY/);assert.match(message,/HTTP 503/);
});
test('test-only database diagnostics preserve statement identity, bind behavior and batch atomicity boundary', async () => {
  const messages = [], bound = {first:async()=>({ok:true})};
  const prepared = {bind(...args){assert.equal(this,prepared);assert.deepEqual(args,[7]);return bound;}};
  const real = {prepare(sql){assert.equal(this,real);assert.equal(sql,'fixture');return prepared;},async batch(statements){assert.equal(this,real);assert.deepEqual(statements,[bound]);return [{meta:{changes:1}}];}};
  const db=diagnosticDb(real, message=>messages.push(message)), statement=db.prepare('fixture').bind(7);
  assert.deepEqual(await statement.first(),{ok:true});assert.deepEqual(await db.batch([statement]),[{meta:{changes:1}}]);assert.equal(messages.length,0);
  bound.first=async()=>{throw Error('SQLITE_BUSY token=private-value');};await assert.rejects(statement.first(),/SQLITE_BUSY/);
  assert.equal(messages.length,1);assert.match(messages[0],/D1.first/);assert.ok(!messages[0].includes('private-value'));
});
test('local command deadlines fail instead of hanging and sanitize their captured output', () => {
  assert.equal(boundedCommand(process.execPath,['-e',"process.stdout.write('ok')"]),'ok');
  assert.throws(()=>boundedCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:50}),/ETIMEDOUT|SIGKILL/);
  assert.throws(()=>boundedCommand(process.execPath,['-e',"console.error('token=private-value');process.exit(2)"]),error=>error.message.includes('[redacted]')&&!error.message.includes('private-value'));
});
test('HTTP deadlines bound both response acquisition and a stalled response body; redirects stay manual', async () => {
  let signal;
  await assert.rejects(boundedFetch('http://127.0.0.1/',{}, {timeoutMs:20,fetcher:(_url,init)=>{signal=init.signal;assert.equal(init.redirect,'manual');return new Promise(()=>{});}}),/deadline/);
  assert.equal(signal.aborted,true);
  await assert.rejects(boundedFetch('http://127.0.0.1/',{}, {timeoutMs:20,fetcher:async()=>({arrayBuffer:()=>new Promise(()=>{})})}),/deadline/);
  const response=await boundedFetch('http://127.0.0.1/',{}, {fetcher:async()=>new Response(null,{status:204})});assert.equal(response.status,204);
});
test('shutdown waits for real exit and escalates once when a process ignores SIGTERM', async () => {
  const child=new EventEmitter();child.exitCode=null;child.signalCode=null;const signals=[];
  await stopProcess(child,{graceMs:10,forceMs:100,signal:(target,signal)=>{signals.push(signal);if(signal==='SIGKILL')setTimeout(()=>{target.signalCode=signal;target.emit('exit',null,signal);},1);}});
  assert.deepEqual(signals,['SIGTERM','SIGKILL']);
  await stopProcess(child,{signal:()=>assert.fail('Already-exited child must not be signalled')});
});
test('shutdown reports failure instead of deleting files while a child remains alive', async () => {
  const child=new EventEmitter();child.exitCode=null;child.signalCode=null;
  await assert.rejects(stopProcess(child,{graceMs:5,forceMs:5,signal:()=>{}}),/temporary files were retained/);
});
test('shutdown also waits for inherited pipes after the parent process has exited', async () => {
  const child=new EventEmitter();child.exitCode=0;child.signalCode=null;child.stdout={destroyed:false};child.stderr={destroyed:false};const signals=[];
  await stopProcess(child,{graceMs:100,signal:(target,signal)=>{signals.push(signal);setTimeout(()=>{target.stdout.destroyed=true;target.stderr.destroyed=true;target.emit('close',0,null);},1);}});
  assert.deepEqual(signals,['SIGTERM']);assert.equal(child.stdout.destroyed,true);
});
test('fixture processes do not inherit Cloudflare credential environment variables', () => {
  const env=localEnvironment({PATH:'/fixture',CLOUDFLARE_API_TOKEN:'private',CF_API_KEY:'private',WRANGLER_API_TOKEN:'private',CI:'false'});
  assert.equal(env.PATH,'/fixture');assert.equal(env.CI,'true');assert.equal(env.WRANGLER_SEND_METRICS,'false');
  assert.ok(!Object.values(env).includes('private'));
});
test('a foreign readiness identity fails closed; remote commands and off-origin requests are refused', async () => {
  const outer=mkdtempSync(join(tmpdir(),'tlpt-harness-unit-')),entry=join(outer,'fake-wrangler.mjs');
  writeFileSync(entry,`import{createServer}from'node:http';const port=Number(process.argv[process.argv.indexOf('--port')+1]);createServer((_q,r)=>{r.setHeader('Content-Type','application/json');r.end(JSON.stringify({runId:'foreign'}));}).listen(port,'127.0.0.1');`);
  const harness=await localHarness({prefix:'tlpt-harness-unit-',wrangler:entry,startupMs:3000});
  try {
    assert.throws(()=>harness.run(['d1','export','DB','--remote']),/local D1 only/);
    assert.throws(()=>harness.run(['d1','export','DB','--local','--remote=true']),/local D1 only/);
    assert.throws(()=>harness.run(['d1','export','DB','--local','--local=false']),/local D1 only/);
    await assert.rejects(harness.fetch('https://example.test/'),/own fixture origin/);
    await assert.rejects(harness.start(['dev','--local']),/identity mismatch/);
  } finally {await harness.close();rmSync(outer,{recursive:true,force:true});}
  assert.equal(existsSync(harness.temp),false);await assert.rejects(harness.fetch(harness.base),/closed/);
});

test('managed release-check processes have a hard deadline without accepting a timed-out success',async()=>{
 assert.equal(await managedCommand(process.execPath,['-e',"process.stdout.write('ok')"]),'ok');
 await assert.rejects(managedCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:30}),/deadline/);
});
