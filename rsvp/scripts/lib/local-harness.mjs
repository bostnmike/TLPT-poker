import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {sanitized} from './diagnostics.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function localEnvironment(source = process.env) {
  const env = {...source, CI:'true', WRANGLER_SEND_METRICS:'false', WRANGLER_WRITE_LOGS:'false'};
  for (const key of Object.keys(env)) if (/^(?:CLOUDFLARE_|CF_API_|WRANGLER_API_)/.test(key)) delete env[key];
  return env;
}
function signalProcess(child, signal) {
  try { process.platform === 'win32' ? child.kill(signal) : process.kill(-child.pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}
function finished(child) {
  return (child.exitCode !== null || child.signalCode !== null) &&
    (!child.stdout || child.stdout.destroyed) && (!child.stderr || child.stderr.destroyed);
}
function waitForExit(child, ms) {
  if (finished(child)) return Promise.resolve(true);
  const event = child.stdout || child.stderr ? 'close' : 'exit';
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); child.removeListener(event, done); resolve(true); };
    const timer = setTimeout(() => { child.removeListener(event, done); resolve(false); }, ms);
    child.once(event, done);
  });
}
export async function stopProcess(child, {graceMs = 4000, forceMs = 2000, signal = signalProcess} = {}) {
  if (!child || finished(child)) return;
  signal(child, 'SIGTERM');
  if (await waitForExit(child, graceMs)) return;
  signal(child, 'SIGKILL');
  if (!await waitForExit(child, forceMs)) throw Error('Local Worker did not exit after forced shutdown; temporary files were retained.');
}
export function boundedCommand(command, args, {cwd, env = localEnvironment(), timeoutMs = 60000} = {}) {
  const result = spawnSync(command, args, {cwd, env, encoding:'utf8', timeout:timeoutMs, killSignal:'SIGKILL', detached:process.platform !== 'win32', maxBuffer:8 * 1024 * 1024});
  if (result.error || result.signal || result.status !== 0) {
    if (result.pid && (result.error || result.signal)) signalProcess({pid:result.pid, kill:()=>{}}, 'SIGKILL');
    throw Error(sanitized(`Local command failed (${result.error?.code || result.signal || result.status}): ${result.stderr || ''}\n${result.stdout || ''}`).slice(-12000));
  }
  return result.stdout;
}
export async function managedCommand(command, args, {cwd, env = localEnvironment(), timeoutMs = 180000} = {}) {
  let child, output = '', errors = '', timer, timedOut = false, stopping;
  const completed = new Promise(resolve => {
    child = spawn(command, args, {cwd, env, detached:process.platform !== 'win32', stdio:['ignore','pipe','pipe']});
    child.stdout.on('data', data => { output = (output + sanitized(data)).slice(-8000000); });
    child.stderr.on('data', data => { errors = (errors + sanitized(data)).slice(-16000); });
    child.once('error', error => resolve({error}));
    child.once('close', (code, signal) => resolve({code, signal}));
  });
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => {
      timedOut = true;
      stopping = stopProcess(child, {graceMs:8000,forceMs:2000});
      void stopping.then(() => resolve({timeout:true}), error => resolve({error}));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([completed, deadline]);
    if (stopping) await stopping;
    if (timedOut || result.error || result.signal || result.code !== 0) throw Error(sanitized(`Command ${timedOut ? 'exceeded its ' + timeoutMs + 'ms deadline' : 'failed (' + (result.error?.message || result.signal || result.code) + ')'}\n${errors}\n${output.slice(-12000)}`));
    return sanitized(output);
  } finally { clearTimeout(timer); }
}
export async function boundedFetch(input, init = {}, {timeoutMs = 10000, fetcher = fetch} = {}) {
  const controller = new AbortController(); let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(Error('Local HTTP request exceeded its ' + timeoutMs + 'ms deadline.')); }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetcher(input, {...init, redirect:'manual', signal:controller.signal});
      const body = await response.arrayBuffer();
      if (body.byteLength > 2 * 1024 * 1024) throw Error('Local HTTP response exceeded the fixture limit.');
      return new Response([204,205,304].includes(response.status) ? null : body, {status:response.status, statusText:response.statusText, headers:response.headers});
    })()]);
  } finally { clearTimeout(timer); }
}
async function unusedPort() {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? reject(error) : resolve(port)); });
  });
}

export async function localHarness({prefix, wrangler, requestMs = 10000, commandMs = 60000, startupMs = 45000}) {
  const temp = mkdtempSync(join(tmpdir(), prefix));
  let port;
  try { port = await unusedPort(); } catch (error) { rmSync(temp, {recursive:true,force:true}); throw error; }
  const runId = randomUUID(), base = 'http://127.0.0.1:' + port, env = localEnvironment();
  let child, output = '', requests = '', spawnError, closing;
  const append = text => { output = (output + sanitized(text)).slice(-16000); };
  const harness = {
    temp, base, port, env, runId,
    run(args) {
      if (closing) throw Error('This local fixture is closed.');
      if (args[0] !== 'd1' || !args.includes('--local') || args.some(arg => /^--remote(?:=|$)|^--no-local$|^--local=false$/.test(arg)) || args[args.indexOf('--local') + 1] === 'false') throw Error('Fixture commands must use local D1 only.');
      return boundedCommand(process.execPath, [wrangler, ...args], {env, timeoutMs:commandMs});
    },
    async fetch(input, init = {}, timeoutMs = requestMs) {
      if (closing) throw Error('This local fixture is closed.');
      const url = new URL(input);
      if (url.origin !== base) throw Error('The local harness refuses requests outside its own fixture origin.');
      const response = await boundedFetch(url, init, {timeoutMs});
      if (response.status >= 400) requests = (requests + `\n${init.method || 'GET'} ${url.pathname} -> ${response.status}: ${sanitized(await response.clone().text()).slice(0,700)}`).slice(-8000);
      return response;
    },
    async start(args) {
      if (closing) throw Error('This local fixture is closed.');
      if (child) throw Error('This fixture already has a Worker process.');
      if (args[0] !== 'dev' || !args.includes('--local') || args.some(arg => /^--remote(?:=|$)|^--no-local$|^--local=false$/.test(arg)) || args[args.indexOf('--local') + 1] === 'false') throw Error('Fixture Worker must run locally.');
      child = spawn(process.execPath, [wrangler, ...args, '--ip','127.0.0.1','--port',String(port),'--inspector-port','0'], {env, detached:process.platform !== 'win32', stdio:['ignore','pipe','pipe']});
      child.stdout.on('data', data => append(data)); child.stderr.on('data', data => append(data));
      child.once('error', error => { spawnError = error; });
      child.once('exit', (code, signal) => append(`\nWorker exited: code=${code}, signal=${signal}\n`));
      const until = Date.now() + startupMs; let last = '';
      while (Date.now() < until) {
        if (spawnError || child.exitCode !== null || child.signalCode !== null) throw Error('Local Worker exited before becoming ready. ' + (spawnError?.message || ''));
        try {
          const response = await harness.fetch(base + '/__harness/ready', {}, Math.min(1000, Math.max(1, until - Date.now())));
          if (response.ok) {
            const ready = await response.json();
            if (ready.runId !== runId) throw Error('Fixture identity mismatch: another server owns this port.');
            return;
          }
          last = 'HTTP ' + response.status;
        } catch (error) { if (error.message.startsWith('Fixture identity mismatch')) throw error; last = sanitized(error.message); }
        await sleep(100);
      }
      throw Error('Local Worker startup exceeded its ' + startupMs + 'ms deadline. Last probe: ' + last);
    },
    diagnostics(error) { return sanitized(`${error?.stack || error}\nRecent local HTTP errors:${requests || ' none'}\nLocal Worker output:\n${output || '(no output)'}`); },
    close() {
      if (!closing) closing = (async () => {
        process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', terminated);
        await stopProcess(child); rmSync(temp, {recursive:true,force:true});
      })();
      return closing;
    }
  };
  const exit = code => { void harness.close().then(() => process.exit(code), error => { console.error(sanitized(error.message)); process.exit(1); }); };
  const interrupted = () => exit(130), terminated = () => exit(143);
  process.once('SIGINT', interrupted); process.once('SIGTERM', terminated);
  return harness;
}
