import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const state='.wrangler/integration-'+Date.now(),base='http://127.0.0.1:8788',secret='local-test-import-token-not-for-deployment';
let output='';const children=[];
function start(args){const child=spawn(process.execPath,args,{env:{...process.env,CASHIER_LOCAL_STATE:state,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'},stdio:['ignore','pipe','pipe']});children.push(child);child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);return child;}
async function ready(url){for(let i=0;i<100;i++){try{const r=await fetch(url);if(r.status<500)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Local Worker did not start: '+output.slice(-3000));}
async function get(eventId,etag){const r=await fetch(base+'/api/register'+(eventId?'?eventId='+encodeURIComponent(eventId):''),{headers:etag?{'If-None-Match':etag}:{}});return {r,data:r.status===304?null:await r.json()};}
async function workerFetch(url,options){for(let n=0;;n++){const response=await fetch(url,options);if(n>=3||response.status!==503||!(await response.clone().text()).startsWith('Your worker restarted mid-request.'))return response;await new Promise(r=>setTimeout(r,250));}}
async function post(body,expected=200,origin=base){const r=await workerFetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j;}
async function intake(messages,mode='live'){const r=await fetch(base+'/api/import',{method:'POST',headers:{'Content-Type':'application/json','X-Register-Token':secret},body:JSON.stringify({messages,mode,readerMode:'rolling'})});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;}
try{
 start(['scripts/local-dev.mjs','--api-only']);await ready(base+'/api/health');
 const first=await get();assert.equal(first.r.status,200,JSON.stringify(first.data));const event=first.data.events.find(e=>e.rules.entry>0&&e.rules.food>0);assert.ok(event,'A real TLPT event is required for this integration check');
 assert.equal(first.data.totals.collected,0);const unchanged=await get(first.data.selectedEventId,first.r.headers.get('ETag'));assert.equal(unchanged.r.status,304,'Unchanged polling should avoid rereading the ledger');
 const originFailure=await post({action:'format',eventId:event.id,mode:'standard',bountyCents:500},403,'https://attacker.example');assert.ok(originFailure.error);
 const cents=event.rules.entry+event.rules.food,requestId=crypto.randomUUID();
 const manual={action:'manual',eventId:event.id,player:'QA Combined Payment',items:['entry','food'],cents,method:'venmo',checked:true,requestId};
 await post(manual);await post(manual);let stateNow=(await get(event.id)).data;assert.equal(stateNow.totals.collected,cents);assert.equal(stateNow.totals.entries,1);assert.equal(stateNow.totals.pizzas,1);
 const recorded=stateNow.payments.find(p=>p.source_id==='manual:'+requestId);assert.deepEqual(JSON.parse(recorded.item_cents),{entry:event.rules.entry,food:event.rules.food});
 const receipt=id=>({id,from:'Venmo <venmo@venmo.com>',authenticationResults:'mx.google.com; dkim=pass header.i=@venmo.com; spf=pass',subject:'Sadr Ahmed paid you $'+(cents/100).toFixed(2),body:`TLPT ${event.slot} ${event.date} entry`,internalDate:String(Date.now())});
 const m1=receipt('CFQA_'+crypto.randomUUID().replaceAll('-','')),m2=receipt('CFQA_'+crypto.randomUUID().replaceAll('-',''));
 const dry=await intake([m1],'receipt-test');assert.equal(dry.diagnostics[0].accepted,true);assert.equal((await get(event.id)).data.payments.length,1,'Receipt-format test must not create a payment');
 await intake([m1]);await intake([m1]);stateNow=(await get(event.id)).data;assert.equal(stateNow.payments.filter(p=>p.source_id==='gmail:'+m1.id).length,1);assert.equal(stateNow.totals.collected,cents);
 const imported=stateNow.payments.find(p=>p.source_id==='gmail:'+m1.id);assert.equal(imported.status,'review');assert.equal(imported.player,'');
 await post({action:'link',eventId:event.id,id:imported.id,linkId:recorded.id,player:'QA Combined Payment',checked:true,requestId:crypto.randomUUID()});assert.equal((await get(event.id)).data.totals.collected,cents,'Linking a receipt must not count twice');
 await intake([m2]);stateNow=(await get(event.id)).data;const second=stateNow.payments.find(p=>p.source_id==='gmail:'+m2.id);
 const confirm={action:'confirm',eventId:event.id,id:second.id,player:'Ahmed',items:['entry','food'],cents,checked:true,requestId:crypto.randomUUID()};
 await post(confirm);await post(confirm,409);stateNow=(await get(event.id)).data;assert.equal(stateNow.totals.collected,cents*2);
 await post({...confirm,action:'void'});assert.equal((await get(event.id)).data.totals.collected,cents);
 stateNow=(await get(event.id)).data;const latest=stateNow.payments.find(p=>p.id===recorded.id);await post({action:'delete',eventId:event.id,id:latest.id,expectedUpdatedAt:latest.updated_at,checked:true});
 await intake([m1]);stateNow=(await get(event.id)).data;assert.equal(stateNow.totals.collected,0);assert.equal(stateNow.payments.some(p=>p.source_id==='gmail:'+m1.id),false,'Deleted receipts must not reappear');
 const players=await (await fetch(base+'/api/players')).json();assert.ok(players.players.some(p=>p.venmoUsername==='dmichaelson'),'Central Venmo identities should survive the migration');
 console.log('PASS: real local Cloudflare Worker/D1 — current TLPT events, ETags, origin protection, combined allocations, idempotent manual entry, receipt dry run, duplicate suppression, link, confirm, void, delete, and public player mappings.');
 const config=JSON.parse(readFileSync('wrangler.local.json','utf8'));config.name='tlpt-cashier-locked-test';config.vars={...config.vars,CASHIER_ENV:'staging',CF_ACCESS_TEAM_DOMAIN:'https://tlpt-test.cloudflareaccess.com',CF_ACCESS_AUD:'test-audience'};writeFileSync('wrangler.locked.local.json',JSON.stringify(config));
 start(['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8789','--config','wrangler.locked.local.json','--persist-to',state,'--inspector-port','0']);await ready('http://127.0.0.1:8789/api/health');
 for(const headers of [{},{'oai-authenticated-user-id':'fake'},{'x-tlpt-authenticated-user-id':'fake'},{'Cf-Access-Jwt-Assertion':'fake.jwt.value'}])assert.equal((await fetch('http://127.0.0.1:8789/api/register',{headers})).status,401);
 assert.equal((await fetch('http://127.0.0.1:8789/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"messages":[]}'})).status,401);
 console.log('PASS: deployed-mode Worker rejects anonymous access, spoofed identity headers, forged Access JWTs, and unauthenticated import requests; loopback development identity cannot bypass staging auth.');
 const password='disposable integration password',salt=randomBytes(16);config.name='tlpt-cashier-password-test';config.vars={...config.vars,AUTH_MODE:'password',CASHIER_PASSWORD_HASH:`v1:100000:${salt.toString('base64url')}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64url')}`,SESSION_SECRET:randomBytes(32).toString('base64url')};
 config.assets.run_worker_first=JSON.parse(readFileSync('wrangler.jsonc','utf8')).assets.run_worker_first;
 writeFileSync('wrangler.password.local.json',JSON.stringify(config));const passwordBase='http://127.0.0.1:8791';
 start(['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8791','--config','wrangler.password.local.json','--persist-to',state,'--inspector-port','0']);await ready(passwordBase+'/auth/login');
 const version=await fetch(passwordBase+'/api/version');assert.equal(version.status,200);assert.deepEqual(Object.keys(await version.json()).sort(),['app','revision','versionId']);
 const landing=await fetch(passwordBase+'/');assert.equal(landing.status,200,'Public sign-in page must permit Home Screen metadata lookup');assert.match(await landing.text(),/apple-touch-icon[^>]+tlpt-cashier-yellow-180/);
 const logIn=(value,origin=passwordBase)=>workerFetch(passwordBase+'/auth/login',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:value})});
 assert.equal((await fetch(passwordBase+'/api/register')).status,401);
 assert.equal((await fetch(passwordBase+'/api/reader-setup')).status,401,'Reader credentials must require owner sign-in');
 assert.equal((await fetch(passwordBase+'/auth/login')).headers.get('Referrer-Policy'),'same-origin','Native sign-in forms must preserve their same-origin Origin header');
 assert.equal((await logIn(password,'https://attacker.example')).status,403);
 assert.equal((await logIn('incorrect integration password')).status,401);
 const loggedIn=await logIn(password);assert.equal(loggedIn.status,303,await loggedIn.clone().text());const cookie=loggedIn.headers.get('Set-Cookie').split(';')[0];
 assert.equal((await fetch(passwordBase+'/api/register',{headers:{Cookie:cookie}})).status,200);
 const privateSettings=await fetch(passwordBase+'/api/reader-setup',{headers:{Cookie:cookie}});assert.equal(privateSettings.status,200);assert.equal(privateSettings.headers.get('Cache-Control'),'private, no-store');assert.equal((await privateSettings.json()).importToken,secret);
 assert.equal((await fetch(passwordBase+'/api/register',{headers:{Cookie:cookie+'x'}})).status,401);
 for(let i=0;i<3;i++)assert.equal((await logIn('incorrect integration password')).status,401);
 assert.equal((await logIn(password)).status,429,'The sixth attempt must be blocked even with a correct password');
 assert.equal((await fetch(passwordBase+'/auth/logout')).status,405);
 const loggedOut=await fetch(passwordBase+'/auth/logout',{method:'POST',redirect:'manual',headers:{Origin:passwordBase,Cookie:cookie}});assert.equal(loggedOut.status,303);assert.ok(loggedOut.headers.get('Set-Cookie').includes('Max-Age=0'));
 console.log('PASS: actual Worker password hashing, secure session login, protected ledger, forged-cookie rejection, same-origin checks, D1 failed-login limits, and logout.');
}catch(error){console.error(output.slice(-4000));throw error;}finally{
 for(const child of children)child.kill('SIGTERM');
 await Promise.all(children.map(c=>c.exitCode===null?new Promise(resolve=>{c.once('exit',resolve);setTimeout(()=>{c.kill('SIGKILL');resolve();},3000).unref();}):Promise.resolve()));
 rmSync(state,{recursive:true,force:true});
 rmSync('wrangler.password.local.json',{force:true});
}
