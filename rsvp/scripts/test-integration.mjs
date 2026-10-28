// Disposable actual Cloudflare Worker + D1. Never uses a remote DB.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const wrangler='node_modules/wrangler/bin/wrangler.js',state='.wrangler/test-'+Date.now(),base='http://127.0.0.1:8794',env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'},key='c'.repeat(64),h=createHash('sha256').update(key).digest('hex');let server,output='';
function run(args){const r=spawnSync(process.execPath,[wrangler,...args],{env,encoding:'utf8'});assert.equal(r.status,0,r.stderr+'\n'+r.stdout);return r.stdout;}
const notificationToken='d'.repeat(64),notificationId=createHash('sha256').update(notificationToken).digest('hex');
const fixture={revision:1,sequence:0,updatedAt:new Date().toISOString(),adminHash:h,adminGeneration:1,players:['bostnmike','red'].map(slug=>({slug,name:slug,linkHash:null,generation:0,rosterStatus:slug==='red'?'alumni':'active'})),events:[{id:'fixture-event',capacity:1,open:true,archived:false,metadata:{title:'Disposable QA',date:'2030-10-25',slot:'friday',day:'Friday',format:'40K',structure:'Test',time:'7:00 PM',endTime:'11:30 PM',location:'Room',address:'Cary'},responses:{}}],audit:[]};
try{
 run(['d1','migrations','apply','DB','--local','--config','wrangler.jsonc','--persist-to',state]);
 writeFileSync('integration.local.sql',`INSERT INTO rsvp_state VALUES(1,1,'${JSON.stringify(fixture)}'); INSERT INTO push_subscriptions VALUES('${notificationId}','https://fcm.googleapis.com/disposable-never-sent','{}','red','fixture',1);`);run(['d1','execute','DB','--local','--config','wrangler.jsonc','--persist-to',state,'--file','integration.local.sql']);
 server=spawn(process.execPath,[wrangler,'dev','--local','--config','wrangler.jsonc','--persist-to',state,'--port','8794','--inspector-port','0'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/version')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,output);
 const post=(path,b,cookie,origin=base)=>fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(b)});
 const playerHtml=await(await fetch(base+'/')).text(),commishHtml=await(await fetch(base+'/?commish=1')).text();
 assert.match(playerHtml,/href="\/manifest.webmanifest\?/);assert.match(commishHtml,/href="\/commish.webmanifest\?/);
 const commishManifest=await(await fetch(base+'/commish.webmanifest')).json();assert.equal(commishManifest.start_url,'/?commish=1');assert.equal(commishManifest.id,'/?commish=1');assert.ok(!JSON.stringify(commishManifest).includes('#key='));
 assert.equal((await fetch(base+'/api/me')).status,401);assert.equal((await post('exchange',{key},null,'https://evil.test')).status,403);
 assert.equal((await post('respond',{slug:'red',eventId:'fixture-event',answer:'maybe'})).status,200);
 assert.equal((await post('respond',{slug:'red',eventId:'fixture-event',answer:'yes'},null,'https://evil.test')).status,403);
 assert.equal((await post('respond',{slug:'bostnmike',eventId:'fixture-event',answer:'no'})).status,409);
 let r=await post('exchange',{key});assert.equal(r.status,200);const admin=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
 r=await post('action',{type:'link',slug:'red'},admin);const link=(await r.json()).privateLink;const privateKey=new URL(link).hash.slice(5);r=await post('exchange',{key:privateKey});const red=r.headers.get('set-cookie').split(';')[0];
 assert.equal((await post('action',{type:'respond',eventId:'fixture-event',slug:'bostnmike',answer:'yes'},red)).status,403);
 await Promise.all([post('action',{type:'respond',eventId:'fixture-event',slug:'bostnmike',answer:'yes'},admin),post('respond',{type:'delete',eventId:'fixture-event',slug:'red',answer:'yes'})]);
 let feed=await (await fetch(base+'/api/public/events')).json();assert.equal(feed.events[0].waitlist.length,1);assert.equal(Object.values(feed.events[0].rsvps).filter(x=>x==='yes').length,1);assert.ok(!JSON.stringify(feed).includes(privateKey));
 assert.equal(feed.events[0].rsvps.bostnmike,'yes');
 assert.deepEqual(await(await post('notifications',{action:'status',token:notificationToken})).json(),{enabled:true,slug:'red'});
 assert.equal((await post('notifications',{action:'disable',token:notificationToken},null,'https://evil.test')).status,403);
 const edit={type:'event',eventId:'fixture-event',metadata:fixture.events[0].metadata,capacity:2,open:true};
 assert.equal((await post('action',edit,admin)).status,200);
 const query=sql=>JSON.parse(run(['d1','execute','DB','--local','--config','wrangler.jsonc','--persist-to',state,'--command',sql,'--json']))[0].results;
 // No VAPID key exists in this disposable Worker, so it NEVER contacts a push
 // provider. Inspect the real D1 transaction's durable outbox instead.
 let queued=query('SELECT payload FROM push_jobs');assert.equal(queued.length,1);assert.equal(JSON.parse(queued[0].payload).kind,'seat');
 assert.equal((await post('action',edit,admin)).status,200);assert.equal(query('SELECT payload FROM push_jobs').length,1);
 assert.equal((await post('action',{...edit,open:false},admin)).status,200);
 assert.equal((await post('action',edit,admin)).status,200);queued=query('SELECT payload FROM push_jobs');assert.equal(queued.length,2);assert.equal(queued.filter(j=>JSON.parse(j.payload).kind==='game-open').length,1);
 assert.equal((await post('action',{...edit,capacity:1},admin)).status,200);
 assert.equal((await post('notifications',{action:'disable',token:notificationToken})).status,200);assert.equal(query('SELECT payload FROM push_jobs').length,0);
 assert.deepEqual(await(await post('notifications',{action:'status',token:notificationToken})).json(),{enabled:false,slug:null});
 assert.equal((await post('action',{type:'respond',eventId:'fixture-event',slug:'bostnmike',answer:'no'},admin)).status,409);
 for(const type of ['cancel','delete']){
  assert.equal((await post('action',{type,eventId:'fixture-event'},admin)).status,200);
  feed=await (await fetch(base+'/api/public/events')).json();assert.equal(feed.events.length,0);
  assert.equal((await post('action',{type:'respond',eventId:'fixture-event',answer:'no'},red)).status,404);
  assert.equal((await post('respond',{eventId:'fixture-event',slug:'red',answer:'no'})).status,404);
  assert.equal((await post('action',{type:'restore',eventId:'fixture-event'},admin)).status,200);
  feed=await (await fetch(base+'/api/public/events')).json();assert.equal(feed.events[0].rsvpOpen,false);assert.equal(feed.events[0].waitlist[0].slug,'red');
 }
 await post('action',{type:'link',slug:'red',revoke:true},admin);assert.equal((await fetch(base+'/api/me',{headers:{Cookie:red}})).status,401);assert.equal((await post('exchange',{key:privateKey})).status,401);
 assert.equal((await fetch(base+'/api/backup')).status,401);assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/style.css')).status,200);
 console.log('PASS: actual local Worker/D1 — shared RSVP, notification outbox atomicity, game-opening deduplication, private device opt-out, secure Commish exchange, host lock, last-seat concurrency, cancel/delete/restore, revocation, privacy and CSRF.');
}finally{server?.kill('SIGTERM');rmSync('integration.local.sql',{force:true});setTimeout(()=>rmSync(state,{recursive:true,force:true}),1500);}
