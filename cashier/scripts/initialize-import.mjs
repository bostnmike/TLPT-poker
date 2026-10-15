// Creates the first reader secret without exposing its value in logs or files.
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const config=process.argv[2]||'wrangler.deploy.local.json';
if(!/^wrangler\.[a-z-]+\.local\.json$/.test(config))throw Error('Use the ignored cashier deployment config.');
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'},cli='node_modules/wrangler/bin/wrangler.js';
const existing=spawnSync(process.execPath,[cli,'secret','list','--config',config],{env,encoding:'utf8'});
if(existing.status!==0)throw Error('Could not check existing reader settings.');
if(JSON.parse(existing.stdout).some(s=>s.name==='IMPORT_TOKEN'))throw Error('Reader secret already exists; left it unchanged.');
const child=spawn(process.execPath,[cli,'secret','bulk','--config',config],{env,stdio:['pipe','ignore','ignore']});
const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',c=>c===0?resolve():reject(Error('Reader secret setup failed')));});
child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({IMPORT_TOKEN:randomBytes(32).toString('base64url')}));await done;
console.log('Private reader secret configured. Its value is available only after owner sign-in on the reader setup page.');
