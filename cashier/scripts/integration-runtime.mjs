// Disposable local-only test infrastructure. Never imported by a Worker.
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
const cli=resolve(root,'node_modules/wrangler/bin/wrangler.js');
export const boundedFetch=(url,options={})=>fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
export async function freePort(){
 const server=createServer();await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
 const port=server.address().port;await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));return port;
}
export async function stopChild(child,graceMs=3000){
 if(child.exitCode!==null||child.signalCode!==null)return;
 await new Promise((done,no)=>{
  const finish=()=>{clearTimeout(timer);clearTimeout(hard);done();};
  let hard;const timer=setTimeout(()=>{child.kill('SIGKILL');hard=setTimeout(()=>no(Error('Local test process did not terminate.')),graceMs);},graceMs);
  child.once('exit',finish);child.kill('SIGTERM');
 });
}
export function createIntegrationRun(label){
 const directory=mkdtempSync(join(tmpdir(),`cashier-${label}-`)),runId=randomUUID(),children=[],configs=new Set();
 const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^CLOUDFLARE_|^CF_API_/.test(k))),CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'};
 let output='';
 const append=d=>{output=(output+d).slice(-16000);};
 function localState(state){if(relative(directory,state).startsWith('..')||resolve(state)===directory)throw Error('Test state must stay inside its disposable run directory.');}
 function config(name,value){
  if(!/^[a-z-]+$/.test(name)||!value.main.startsWith('tests/fixtures/')||relative(resolve(root,'tests/fixtures'),resolve(root,value.main)).startsWith('..')||value.routes||value.env||value.account_id||value.d1_databases?.some(d=>!/^00000000-0000-4000-8000-0000000000[0-9]{2}$/.test(d.database_id)))throw Error('Only disposable fixture configurations are permitted.');
  const normalized={...value,main:resolve(root,value.main),vars:{...value.vars,TEST_RUN_ID:runId},...(value.assets?{assets:{...value.assets,directory:resolve(root,value.assets.directory)}}:{}),...(value.d1_databases?{d1_databases:value.d1_databases.map(d=>({...d,migrations_dir:resolve(root,d.migrations_dir)}))}:{})};
  const file=join(directory,name+'.json');writeFileSync(file,JSON.stringify(normalized));configs.add(file);return file;
 }
 function migrate(file,state){
  localState(state);if(!configs.has(file))throw Error('Test migration requires this run’s generated config.');
  const result=spawnSync(process.execPath,[cli,'d1','migrations','apply','DB','--local','--config',file,'--persist-to',state],{env,encoding:'utf8',timeout:60000});
  if(result.error||result.status!==0)throw Error('Disposable D1 migration failed: '+(result.error?.message||result.stdout+result.stderr).slice(-4000));
 }
 async function start(files,{state=join(directory,'state'),role='register'}={}){
  localState(state);if(!files.length||files.some(f=>!configs.has(f)))throw Error('Test server requires this run’s generated configs.');
  const port=await freePort(),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,[cli,'dev','--local','--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--persist-to',state,...files.flatMap(f=>['--config',f])],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  children.push(child);let failure;child.once('error',e=>{failure=e;});child.stdout.on('data',append);child.stderr.on('data',append);
  await verifyTestServer({base,runId,role,child,failure:()=>failure,logs:()=>failure?.message||output});
  return {base,child};
 }
 return {directory,runId,config,migrate,start,logs:()=>output,async cleanup(){await Promise.all(children.map(c=>stopChild(c)));rmSync(directory,{recursive:true,force:true});}};
}

export async function verifyTestServer({base,runId,role,child,failure=()=>null,logs=()=>'',timeoutMs=45000}){
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){
  if(failure()||child.exitCode!==null||child.signalCode!==null)throw Error('Local Worker exited before readiness: '+logs());
  let response;try{response=await boundedFetch(base+'/__test/ready',{signal:AbortSignal.timeout(1000)});}catch{}
  if(response){
   if(response.status!==200)throw Error('Unexpected server on allocated test port. '+logs());
   const identity=await response.json();if(identity.runId!==runId||identity.role!==role)throw Error('Test server identity mismatch; refusing fixture writes.');
   return;
  }
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('Local Worker readiness timed out: '+logs());
}
