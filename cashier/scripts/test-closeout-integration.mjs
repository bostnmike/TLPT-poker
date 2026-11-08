import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const state='.wrangler/closeout-integration-'+Date.now(),client='wrangler.closeout-client.local.json',service='wrangler.closeout-service.local.json',base='http://127.0.0.1:8794';
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false',CI:'true'};
let child,output='';
try{
 writeFileSync(service,JSON.stringify({name:'cashier-closeout-fixture',main:'tests/fixtures/closeout-service.ts',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],vars:{CASHIER_ENV:'local'},d1_databases:[{binding:'DB',database_name:'closeout-fixture',database_id:'00000000-0000-4000-8000-000000000014',migrations_dir:'drizzle'}]}));
 writeFileSync(client,JSON.stringify({name:'cashier-closeout-client',main:'tests/fixtures/closeout-client.mjs',compatibility_date:'2026-05-15',services:[{binding:'CLOSEOUT',service:'cashier-closeout-fixture',entrypoint:'EventCloseout'},{binding:'INSPECT',service:'cashier-closeout-fixture'}]}));
 const migrations=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config',service,'--persist-to',state],{env,encoding:'utf8'});assert.equal(migrations.status,0,migrations.stderr);
 child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8794','--inspector-port','0','--persist-to',state,'--config',client,'--config',service],{env,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,output.slice(-4000));
 const call=async(path,input)=>await(await fetch(base+path,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{})).json();
 await call('/seed');const before=await call('/state');
 const input={protocol:1,eventId:'mtt:2020-01-01',rsvpEventId:'stable-mtt',title:'Close-out test',confirmationDate:'2020-01-01',payoutsConfirmed:false,receiptsReviewed:false,resultsConfirmed:false};
 const p=await call('/preview',input);assert.equal(p.ok,true,JSON.stringify(p));assert.equal(p.records,1);assert.deepEqual(await call('/state'),before,'RPC preview must not write');
 const close={...input,payoutsConfirmed:true,receiptsReviewed:true,resultsConfirmed:true,expectedRevision:p.historyRevision,expectedResultsRevision:p.evidence.revision,requestId:crypto.randomUUID()};
 assert.equal((await call('/close',close)).code,'event-open');await call('/freeze');
 assert.equal((await call('/close',{...close,expectedRevision:p.historyRevision-1})).code,'ledger-changed');
 const closed=await call('/close',close);assert.equal(closed.ok,true,JSON.stringify(closed));assert.equal(closed.receipt.closed,true);
 const after=await call('/state');assert.deepEqual(after.payments,before.payments.filter(p=>p.event_id!=='mtt:2020-01-01'));assert.equal(after.markers.length,1);assert.equal(after.receipts.length,1);
 assert.equal((await fetch(base+'/late')).status,409,'Actual D1 trigger must block stale intake');
 await call('/offline');const replay=await call('/close',close);assert.equal(replay.alreadyClosed,true);assert.deepEqual(replay.receipt,closed.receipt);
 const previewAgain=await call('/preview',input);assert.equal(previewAgain.alreadyClosed,true);assert.deepEqual(previewAgain.receipt,closed.receipt);
 console.log('PASS: actual private Worker RPC and disposable D1 — read-only preview, open/stale denial, verified pre-6am closure, exact-event clearing, future ledger unchanged, database replay guard, and stable lost-response recovery while results are offline.');
}finally{
 if(child&&!child.killed){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
 rmSync(client,{force:true});rmSync(service,{force:true});rmSync(state,{recursive:true,force:true});
}
