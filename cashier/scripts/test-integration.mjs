import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
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
 const first=await get();assert.equal(first.r.status,200,JSON.stringify(first.data));assert.equal(first.data.scheduleError,'','The live schedule, including Date TBD placeholders, must refresh successfully');const event=first.data.events.find(e=>e.rules.entry>0&&e.rules.food>0);assert.ok(event,'A real TLPT event is required for this integration check');
 assert.equal(first.data.totals.collected,0);const unchanged=await get(first.data.selectedEventId,first.r.headers.get('ETag'));assert.equal(unchanged.r.status,304,'Unchanged polling should avoid rereading the ledger');
 const originFailure=await post({action:'format',eventId:event.id,mode:'standard',bountyCents:500},403,'https://attacker.example');assert.ok(originFailure.error);
 const cents=event.rules.entry+event.rules.food,requestId=crypto.randomUUID();
 const manual={action:'manual',eventId:event.id,player:'QA Combined Payment',items:['entry','food'],cents,method:'venmo',checked:true,requestId};
 await post(manual);await post(manual);let stateNow=(await get(event.id)).data;assert.equal(stateNow.totals.collected,cents);assert.equal(stateNow.totals.entries,1);assert.equal(stateNow.totals.pizzas,1);
 const recorded=stateNow.payments.find(p=>p.source_id==='manual:'+requestId);assert.deepEqual(JSON.parse(recorded.item_cents),{entry:event.rules.entry,food:event.rules.food});
 const receipt=id=>({id,from:'Venmo <venmo@venmo.com>',authenticationResults:'mx.google.com; dkim=pass header.i=@venmo.com; spf=pass',subject:'Sadr Ahmed paid you $'+(cents/100).toFixed(2),body:`TLPT ${event.slot} ${event.date} entry`,internalDate:String(Date.now())});
 const m1=receipt('CFQA_'+crypto.randomUUID().replaceAll('-','')),m2={...receipt('CFQA_'+crypto.randomUUID().replaceAll('-','')),subject:'Test Player paid $'+(cents/100).toFixed(2)+' to your Venmo account. Leave it in Venmo or transfer it to your bank account.'};
 const refused=await intake([{...m2,id:'CFQA_bad_'+crypto.randomUUID().replaceAll('-',''),authenticationResults:'mx.google.com; dkim=fail header.i=@venmo.com'}]);assert.equal(refused.rejectedReasons.authentication,1);assert.equal(refused.acceptedIds.length,0);
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
 { // Batch processing uses only this disposable local database.
 const batchEvent=first.data.events.find(e=>e.slot==='mtt')||event;
 const allocation=(player,items=['entry'],method='venmo')=>({id:crypto.randomUUID(),player,items,method,cents:items.reduce((n,k)=>n+batchEvent.rules[k],0)});
 const batch=(groups)=>({action:'batch',eventId:batchEvent.id,requestId:crypto.randomUUID(),checked:true,groups});
 const manualGroup=allocations=>({id:crypto.randomUUID(),action:'manual',method:'venmo',allocations});
 const five=Array.from({length:5},(_,i)=>allocation('Batch Player '+i,i<3?['entry','food']:['entry'],i===4?'cash':'venmo'));
 const mixed=batch([manualGroup(five)]),beforeBatch=(await get(batchEvent.id)).data.totals.collected;
 await Promise.all([post(mixed),post(mixed)]);
 let batchState=(await get(batchEvent.id)).data;
 const full=five.reduce((n,r)=>n+r.cents,0);assert.equal(batchState.totals.collected,beforeBatch+full,'A concurrent retry must not duplicate five players');
 assert.equal(batchState.payments.filter(p=>five.some(r=>p.id===r.id)).length,5);
 await post({...mixed,groups:[manualGroup([allocation('Changed contents')])]},409);
 assert.equal((await get(batchEvent.id)).data.totals.collected,beforeBatch+full);
 const makeMail=amount=>({id:'BATCH_'+crypto.randomUUID().replaceAll('-',''),from:'Venmo <venmo@venmo.com>',authenticationResults:'mx.google.com; dkim=pass header.i=@venmo.com',subject:'QA Batch Payer paid you $'+(amount/100).toFixed(2),body:`TLPT ${batchEvent.slot} ${batchEvent.date} entry`,internalDate:String(Date.now())});
 const splitPlayers=[allocation('Split Player A',['entry','food']),allocation('Split Player B')],splitAmount=splitPlayers.reduce((n,p)=>n+p.cents,0),splitMail=makeMail(splitAmount);
 await intake([splitMail]);batchState=(await get(batchEvent.id)).data;const splitReceipt=batchState.payments.find(p=>p.source_id==='gmail:'+splitMail.id);
 await post(batch([{id:crypto.randomUUID(),action:'confirm',paymentId:splitReceipt.id,expectedUpdatedAt:splitReceipt.updated_at,allocations:splitPlayers}]));
 batchState=(await get(batchEvent.id)).data;assert.equal(batchState.totals.collected,beforeBatch+full+splitAmount);assert.equal(batchState.receiptLinks.filter(l=>l.receipt_id===splitReceipt.id).length,2);
 await intake([splitMail]);assert.equal((await get(batchEvent.id)).data.totals.collected,beforeBatch+full+splitAmount);
 const recorded=five.map(a=>batchState.payments.find(p=>p.id===a.id));
 const lateAmounts=[recorded[0].cents+recorded[1].cents,batchEvent.rules.entry,batchEvent.rules.food],late=lateAmounts.map(makeMail);
 await intake(late);batchState=(await get(batchEvent.id)).data;
 const linkGroup=(mail,targets)=>{const p=batchState.payments.find(p=>p.source_id==='gmail:'+mail.id);return {id:crypto.randomUUID(),action:'link',paymentId:p.id,expectedUpdatedAt:p.updated_at,targets};};
 const match=(p,amount=p.cents)=>({paymentId:p.id,expectedUpdatedAt:p.updated_at,cents:amount});
 const matches=batch([linkGroup(late[0],[match(recorded[0]),match(recorded[1])]),linkGroup(late[1],[match(recorded[2],batchEvent.rules.entry)]),linkGroup(late[2],[match(recorded[2],batchEvent.rules.food)])]);
 const matched=await post(matches);assert.equal(matched.linkedReceipts,3);await post(matches);
 batchState=(await get(batchEvent.id)).data;assert.equal(batchState.totals.collected,beforeBatch+full+splitAmount,'Late multi-target and partial emails must never add money');
 const over=makeMail(recorded[0].cents);await intake([over]);batchState=(await get(batchEvent.id)).data;
 const existing=batchState.payments.find(p=>p.id===recorded[0].id),extra=allocation('Must not be saved');
 await post(batch([manualGroup([extra]),linkGroup(over,[match(existing)])]),409);
 assert.equal((await get(batchEvent.id)).data.payments.some(p=>p.id===extra.id),false,'Invalid batch must save no rows');
 const staleReceipt=batchState.payments.find(p=>p.source_id==='gmail:'+over.id);
 await post(batch([{id:crypto.randomUUID(),action:'confirm',paymentId:staleReceipt.id,expectedUpdatedAt:'stale',allocations:[allocation('Stale')]}]),409);
 const splitChild=batchState.payments.find(p=>p.id===splitPlayers[0].id);
 await post({action:'delete',eventId:batchEvent.id,id:splitChild.id,expectedUpdatedAt:splitChild.updated_at,checked:true});
 await intake([splitMail]);batchState=(await get(batchEvent.id)).data;assert.equal(batchState.totals.collected,beforeBatch+full+splitPlayers[1].cents);assert.equal(batchState.receiptLinks.filter(l=>l.receipt_id===splitReceipt.id).length,1);
 const voids=recorded.slice(0,2).map(p=>batchState.payments.find(r=>r.id===p.id));
 await post(batch(voids.map(p=>({id:crypto.randomUUID(),action:'void',paymentId:p.id,expectedUpdatedAt:p.updated_at}))));
 assert.equal((await get(batchEvent.id)).data.totals.collected,beforeBatch+full+splitPlayers[1].cents-voids.reduce((n,p)=>n+p.cents,0));
 batchState=(await get(batchEvent.id)).data;
 const removal=batch(voids.map(old=>{const p=batchState.payments.find(p=>p.id===old.id);return {id:crypto.randomUUID(),action:'delete',paymentId:p.id,expectedUpdatedAt:p.updated_at};}));
 await post(removal,409);await post({...removal,deleteAcknowledged:true});await intake([late[0]]);
 batchState=(await get(batchEvent.id)).data;assert.equal(batchState.payments.some(p=>voids.some(v=>v.id===p.id)),false);assert.equal(batchState.payments.some(p=>p.source_id==='gmail:'+late[0].id),false,'Bulk deletion must suppress the shared email');
 console.log('PASS: actual Worker/D1 batch — five mixed-method players, three food allocations, atomic concurrent retries, changed-payload rejection, shared receipts, multi-target and partial late matches, over-coverage rejection, stale protection, shared-receipt deletion suppression and bulk voids.');
 }
 { // Permanent clearing runs only against this separate disposable database.
 const historyState=state+'-history',historyBase='http://127.0.0.1:8792',mttId='mtt:2020-01-01';
 const historyConfig=JSON.parse(readFileSync('wrangler.local.json','utf8'));historyConfig.name='tlpt-cashier-history-test';historyConfig.main='tests/fixtures/history-worker.ts';writeFileSync('wrangler.history.local.json',JSON.stringify(historyConfig));
 const migration=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','wrangler.history.local.json','--persist-to',historyState],{encoding:'utf8',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'}});assert.equal(migration.status,0,migration.stderr);
 start(['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8792','--config','wrangler.history.local.json','--persist-to',historyState,'--inspector-port','0']);await ready(historyBase+'/api/health');
 const hget=async(id=mttId)=>await (await fetch(historyBase+'/api/register?eventId='+encodeURIComponent(id))).json();
 const hpost=async(body,expected=200)=>{const r=await workerFetch(historyBase+'/api/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:historyBase},body:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j;};
 const hintake=async(messages,mode='live')=>{const r=await fetch(historyBase+'/api/import',{method:'POST',headers:{'Content-Type':'application/json','X-Register-Token':secret},body:JSON.stringify({messages,mode,readerMode:'rolling'})});assert.equal(r.status,200);return r.json();};
 const entry=(eventId,items=['entry'])=>({action:'manual',eventId,items,player:'History test player',method:'venmo',cents:items.includes('food')?6500:eventId===mttId?5000:3000,checked:true,requestId:crypto.randomUUID()});
 for(const id of [mttId,'friday:2099-01-02','saturday:2099-01-03'])await hpost(entry(id));
 const mail={id:'CLEAR_'+crypto.randomUUID().replaceAll('-',''),from:'Venmo <venmo@venmo.com>',authenticationResults:'mx.google.com; dkim=pass header.i=@venmo.com',subject:'Test Payer paid you $50.00',body:'TLPT mtt 2020-01-01 entry',internalDate:String(Date.parse('2020-01-01T18:00:00Z'))};
 await hintake([mail]);let h=await hget();assert.equal(h.clearHistory.eligible,true);
 const receipt=h.payments.find(p=>p.source_id==='gmail:'+mail.id),target=h.payments.find(p=>p.source_id.startsWith('manual:'));
 await hpost({action:'link',eventId:mttId,id:receipt.id,linkId:target.id,player:target.player,checked:true,requestId:crypto.randomUUID()});h=await hget();
 const clear={action:'clear-history',eventId:mttId,checked:true,confirmationDate:'2020-01-01',expectedRevision:h.clearHistory.revision};
 await hpost({...clear,checked:false},400);await hpost({...clear,confirmationDate:'2099-01-02'},400);await hpost({...clear,eventId:'friday:2099-01-02'},400);
 await hpost(entry(mttId,['entry','food']));await hpost(clear,409);assert.equal((await hget()).payments.length,3,'Stale clearing must preserve accounting rows and the receipt');
 h=await hget();await hpost({...clear,expectedRevision:h.clearHistory.revision});h=await hget();
 assert.equal(h.payments.length,0);assert.equal(h.totals.collected,0);assert.equal(h.receiptLinks.length,0);assert.equal(h.clearHistory.eligible,false);assert.ok(h.events.find(e=>e.id===mttId).historyClearedAt);
 await hpost(entry(mttId),409);await hpost({action:'batch',eventId:mttId,requestId:crypto.randomUUID(),checked:true,groups:[]},409);
 const ignored=await hintake([mail,{...mail,id:'CLEAR_NEW_'+crypto.randomUUID().replaceAll('-','')}]);assert.equal(ignored.ignoredIds.length,2);assert.equal((await hget()).payments.length,0);
 const reader=await hintake([],'config');assert.ok(!reader.events.some(e=>e.id===mttId),'Reader configuration must exclude the cleared event');
 for(const id of ['friday:2099-01-02','saturday:2099-01-03']){const other=await hget(id);assert.equal(other.totals.collected,3000);assert.equal(other.payments.length,1);}
 console.log('PASS: isolated Worker/D1 history clearing — finished MTT only, exact-date confirmation, stale-ledger rollback, receipt cleanup, zero totals, other events preserved, reader exclusion and no stale manual/batch or email resurrection.');
 }
 const config=JSON.parse(readFileSync('wrangler.local.json','utf8'));config.name='tlpt-cashier-locked-test';config.vars={...config.vars,CASHIER_ENV:'staging',CF_ACCESS_TEAM_DOMAIN:'https://tlpt-test.cloudflareaccess.com',CF_ACCESS_AUD:'test-audience'};writeFileSync('wrangler.locked.local.json',JSON.stringify(config));
 start(['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8789','--config','wrangler.locked.local.json','--persist-to',state,'--inspector-port','0']);await ready('http://127.0.0.1:8789/api/health');
 for(const headers of [{},{'oai-authenticated-user-id':'fake'},{'x-tlpt-authenticated-user-id':'fake'},{'Cf-Access-Jwt-Assertion':'fake.jwt.value'}])assert.equal((await fetch('http://127.0.0.1:8789/api/register',{headers})).status,401);
 assert.equal((await fetch('http://127.0.0.1:8789/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"messages":[]}'})).status,401);
 assert.equal((await fetch('http://127.0.0.1:8789/api/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8789','x-tlpt-authenticated-user-id':'fake'},body:JSON.stringify({action:'batch',groups:[]})})).status,401);
 assert.equal((await fetch('http://127.0.0.1:8789/api/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8789'},body:JSON.stringify({action:'clear-history',eventId:'mtt:2020-01-01',checked:true,confirmationDate:'2020-01-01',expectedRevision:0})})).status,401);
 console.log('PASS: deployed-mode Worker rejects anonymous access, spoofed identity headers, forged Access JWTs, and unauthenticated import requests; loopback development identity cannot bypass staging auth.');
 const password='disposable integration password',salt=randomBytes(16);config.name='tlpt-cashier-password-test';config.vars={...config.vars,AUTH_MODE:'password',CASHIER_PASSWORD_HASH:`v1:100000:${salt.toString('base64url')}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64url')}`,SESSION_SECRET:randomBytes(32).toString('base64url')};
 config.assets.run_worker_first=JSON.parse(readFileSync('wrangler.jsonc','utf8')).assets.run_worker_first;
 writeFileSync('wrangler.password.local.json',JSON.stringify(config));const passwordBase='http://127.0.0.1:8791';
 start(['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8791','--config','wrangler.password.local.json','--persist-to',state,'--inspector-port','0']);await ready(passwordBase+'/auth/login');
 const version=await fetch(passwordBase+'/api/version');assert.equal(version.status,200);assert.deepEqual(Object.keys(await version.json()).sort(),['app','revision','versionId']);
 const landing=await fetch(passwordBase+'/');assert.equal(landing.status,200,'Public sign-in page must permit Home Screen metadata lookup');assert.match(await landing.text(),/apple-touch-icon[^>]+cashier-home-chip-180/);
 const install=await fetch(passwordBase+'/install.html');assert.equal(install.status,200);assert.match(install.headers.get('Content-Type'),/text\/html/);assert.match(await install.text(),/Add to Home Screen/);
 const manifestResponse=await fetch(passwordBase+'/cashier-home.webmanifest');assert.equal(manifestResponse.status,200);assert.match(manifestResponse.headers.get('Content-Type'),/manifest|json/);const homeManifest=await manifestResponse.json();assert.equal(homeManifest.display,'standalone');assert.equal(homeManifest.start_url,'/');
 for(const size of [152,167,180,192,512]){const icon=await fetch(passwordBase+`/cashier-home-chip-${size}.png`);assert.equal(icon.status,200);assert.match(icon.headers.get('Content-Type'),/image\/png/);const bytes=Buffer.from(await icon.arrayBuffer());assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
 const launchScript=await fetch(passwordBase+'/cashier-install.mjs');assert.equal(launchScript.status,200);assert.match(launchScript.headers.get('Content-Type'),/javascript/);
 console.log('PASS: anonymous iPad installation page, standalone manifest, launch script and all five exact-size poker-chip PNGs are served without exposing the private register.');
 const webclipPage=await fetch(passwordBase+'/webclip.html');assert.equal(webclipPage.status,200);assert.match(await webclipPage.text(),/Download TLPT Cashier setup/);
 const profile=await fetch(passwordBase+'/TLPT-Cashier.mobileconfig');assert.equal(profile.status,200);assert.equal(profile.headers.get('Content-Type'),'application/x-apple-aspen-config');assert.match(profile.headers.get('Content-Disposition'),/attachment; filename="TLPT-Cashier.mobileconfig"/);assert.equal(profile.headers.get('Cache-Control'),'no-store');assert.equal(profile.headers.get('X-Content-Type-Options'),'nosniff');assert.deepEqual(Buffer.from(await profile.arrayBuffer()),readFileSync('public/TLPT-Cashier.mobileconfig'));
 console.log('PASS: exact one-Web-Clip iPad profile is anonymously downloadable with Apple MIME type, filename, no-store and nosniff headers; no private data is included.');
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
 rmSync(state+'-history',{recursive:true,force:true});
 rmSync('wrangler.history.local.json',{force:true});
 rmSync('wrangler.password.local.json',{force:true});
}
