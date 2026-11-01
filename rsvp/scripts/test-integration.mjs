// Disposable actual Cloudflare Worker + D1. Never uses a remote DB.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const wrangler='node_modules/wrangler/bin/wrangler.js',state='.wrangler/test-'+Date.now(),base='http://127.0.0.1:8794',env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'},key='c'.repeat(64),h=createHash('sha256').update(key).digest('hex');let server,output='';
function run(args){const r=spawnSync(process.execPath,[wrangler,...args],{env,encoding:'utf8'});assert.equal(r.status,0,r.stderr+'\n'+r.stdout);return r.stdout;}
const notificationToken='d'.repeat(64),notificationId=createHash('sha256').update(notificationToken).digest('hex'),commishNotificationToken='e'.repeat(64),commishNotificationId='commish:'+createHash('sha256').update(commishNotificationToken).digest('hex');
const fixture={revision:1,sequence:0,updatedAt:new Date().toISOString(),adminHash:h,adminGeneration:1,players:['bostnmike','red'].map(slug=>({slug,name:slug,linkHash:null,generation:0,rosterStatus:slug==='red'?'alumni':'active'})),events:[{id:'fixture-event',capacity:1,open:true,archived:false,metadata:{title:'Disposable QA',date:'2030-10-25',slot:'friday',day:'Friday',format:'40K',structure:'Test',time:'7:00 PM',endTime:'11:30 PM',location:'Room',address:'Cary'},responses:{}}],audit:[]};
try{
 run(['d1','migrations','apply','DB','--local','--config','wrangler.jsonc','--persist-to',state]);
 writeFileSync('integration.local.sql',`INSERT INTO rsvp_state VALUES(1,1,'${JSON.stringify(fixture)}'); INSERT INTO push_subscriptions VALUES('${notificationId}','https://fcm.googleapis.com/disposable-never-sent','{}','red','fixture',1); INSERT INTO commish_push_subscriptions VALUES('${commishNotificationId}','https://fcm.googleapis.com/commish-never-sent','{}','@commish:1','fixture',1);`);run(['d1','execute','DB','--local','--config','wrangler.jsonc','--persist-to',state,'--file','integration.local.sql']);
 // Exercise the actual Workers Request constructor with a synthetic encrypted
 // push. Node accepts redirect:'error'; Workers rejects it before any network I/O.
 // This generated route exists only in this disposable integration entry point.
 writeFileSync('integration.local.mjs',`import worker from './worker.mjs';
 import {encryptedPush,b64url} from './web-push.mjs';
 export default {...worker,async fetch(request,env,ctx){
 if(new URL(request.url).pathname!=='/__push-runtime-test')return worker.fetch(request,{...env,...(new URL(request.url).pathname==='/api/broadcasts'?{VAPID_PRIVATE_JWK:JSON.stringify({kty:'EC',crv:'P-256',d:'disposable-invalid-key',x:'AA',y:'AA'})}:{}),GALLERY_FETCH:async()=>Response.json({folder:'images/fw',files:['fw30-10-25.jpg','fw30-11-03.png']})},ctx);
 const receiver=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const jwk=await crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).privateKey);
 const subscription={endpoint:'https://fcm.googleapis.com/disposable-never-sent',keys:{p256dh:b64url(await crypto.subtle.exportKey('raw',receiver.publicKey)),auth:b64url(crypto.getRandomValues(new Uint8Array(16)))}};
 const init=await encryptedPush(subscription,{title:'Disposable runtime check'},jwk);
 const pushRequest=new Request(subscription.endpoint,init);
 return Response.json({method:pushRequest.method,redirect:pushRequest.redirect,encoding:pushRequest.headers.get('Content-Encoding'),bytes:(await pushRequest.arrayBuffer()).byteLength});
 }};`);
 server=spawn(process.execPath,[wrangler,'dev','integration.local.mjs','--local','--config','wrangler.jsonc','--persist-to',state,'--port','8794','--inspector-port','0'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/version')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,output);
 const pushRuntime=await fetch(base+'/__push-runtime-test');assert.equal(pushRuntime.status,200);const pushRequest=await pushRuntime.json();assert.equal(pushRequest.method,'POST');assert.equal(pushRequest.redirect,'manual');assert.equal(pushRequest.encoding,'aes128gcm');assert.ok(pushRequest.bytes>86);
 const post=(path,b,cookie,origin=base)=>fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(b)});
 const playerHtml=await(await fetch(base+'/')).text(),commishHtml=await(await fetch(base+'/?commish=1')).text();
 assert.match(playerHtml,/href="\/manifest.webmanifest\?/);assert.match(commishHtml,/href="\/commish.webmanifest\?/);
 const commishManifest=await(await fetch(base+'/commish.webmanifest')).json();assert.equal(commishManifest.start_url,'/?commish=1');assert.equal(commishManifest.id,'/?commish=1');assert.ok(!JSON.stringify(commishManifest).includes('#key='));
 assert.equal((await post('commish-notifications',{action:'enable',token:commishNotificationToken,subscription:{}})).status,401);
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
 // Ordinary RSVP requests have no VAPID key in this disposable Worker and never
 // contact a push provider. Inspect the real D1 transaction's durable outbox instead.
 let queued=query("SELECT payload FROM push_jobs WHERE json_extract(payload,'$.kind')!='response'");assert.equal(queued.length,1);assert.equal(JSON.parse(queued[0].payload).kind,'seat');
 assert.equal((await post('action',edit,admin)).status,200);assert.equal(query("SELECT payload FROM push_jobs WHERE json_extract(payload,'$.kind')!='response'").length,1);
 assert.equal((await post('action',{...edit,open:false},admin)).status,200);
 assert.equal((await post('action',edit,admin)).status,200);queued=query("SELECT payload FROM push_jobs WHERE json_extract(payload,'$.kind')!='response'");assert.equal(queued.length,2);assert.equal(queued.filter(j=>JSON.parse(j.payload).kind==='game-open').length,1);
 assert.equal((await post('action',{...edit,capacity:1},admin)).status,200);
 assert.equal((await post('notifications',{action:'disable',token:notificationToken})).status,200);assert.equal(query("SELECT payload FROM push_jobs WHERE json_extract(payload,'$.kind')!='response'").length,0);
 assert.deepEqual(await(await post('notifications',{action:'status',token:notificationToken})).json(),{enabled:false,slug:null});
 assert.deepEqual(await(await post('commish-notifications',{action:'status',token:commishNotificationToken})).json(),{enabled:true,slug:'@commish'});
 let adminJobs=query("SELECT payload,subscription_id FROM push_jobs WHERE json_extract(payload,'$.kind')='response'");assert.equal(adminJobs.length,2);assert.ok(adminJobs.every(j=>j.subscription_id===commishNotificationId));
 // Synthetic subscription bodies are {}, so encryption fails before any provider
 // request. The generated wrapper supplies an invalid test-only VAPID key solely
 // to exercise the authenticated broadcast endpoint and real D1 transaction.
 const broadcast={id:'11111111-1111-4111-8111-111111111111',kind:'poll',title:'Disposable question',body:'Local QA only',options:['Friday','Sunday']};
 assert.equal((await post('broadcasts',broadcast)).status,401);assert.equal((await post('broadcasts',broadcast,red)).status,403);
 assert.equal((await post('broadcasts',broadcast,admin)).status,200);assert.equal((await post('broadcasts',broadcast,admin)).status,200);
 assert.equal(query('SELECT COUNT(*) n FROM broadcasts')[0].n,1);assert.equal(query("SELECT COUNT(*) n FROM push_jobs WHERE json_extract(payload,'$.kind')='announcement'")[0].n,1);
 assert.equal((await post('poll-vote',{pollId:broadcast.id,slug:'red',choice:0})).status,200);assert.equal((await post('poll-vote',{pollId:broadcast.id,slug:'red',choice:1})).status,200);
 let poll=(await(await fetch(base+'/api/public/polls')).json()).polls[0];assert.deepEqual(poll.counts,[0,1]);assert.equal(poll.votes.length,1);
 assert.equal((await post('broadcasts',{action:'close',id:broadcast.id},admin)).status,200);assert.equal((await post('poll-vote',{pollId:broadcast.id,slug:'red',choice:0})).status,409);
 poll=(await(await fetch(base+'/api/public/polls')).json()).polls[0];assert.equal(poll.closed,true);assert.deepEqual(poll.counts,[0,1]);
 assert.equal((await post('commish-notifications',{action:'disable',token:commishNotificationToken})).status,200);assert.equal(query('SELECT payload FROM push_jobs').length,0);
 assert.equal((await post('action',{type:'respond',eventId:'fixture-event',slug:'bostnmike',answer:'no'},admin)).status,409);
 for(const type of ['cancel','delete']){
  assert.equal((await post('action',{type,eventId:'fixture-event'},admin)).status,200);
  feed=await (await fetch(base+'/api/public/events')).json();assert.equal(feed.events.length,0);
  assert.equal((await post('action',{type:'respond',eventId:'fixture-event',answer:'no'},red)).status,404);
  assert.equal((await post('respond',{eventId:'fixture-event',slug:'red',answer:'no'})).status,404);
  assert.equal((await post('action',{type:'restore',eventId:'fixture-event'},admin)).status,200);
  feed=await (await fetch(base+'/api/public/events')).json();assert.equal(feed.events[0].rsvpOpen,false);assert.equal(feed.events[0].waitlist[0].slug,'red');
 }
 const sundayMetadata={...fixture.events[0].metadata,title:'Disposable Sunday',slot:'sunday',day:'Sunday',date:'2030-11-03',format:'50K Format',structure:'50K starting stack • Friday blinds start 50/100 • 20 min levels'};
 assert.equal((await post('action',{type:'event',metadata:sundayMetadata,capacity:9,open:false},admin)).status,200);
 let sunday=(await(await fetch(base+'/api/public/events')).json()).events.find(e=>e.slot==='sunday');assert.equal(sunday.rsvpOpen,false);assert.equal(sunday.startingStack,50000);assert.equal(sunday.blindStructure,'40k');assert.equal(sunday.tables,1);assert.equal(sunday.poster.file,'fw30-11-03.png');assert.ok((await(await fetch(base+'/api/public/posters')).json()).posters.some(p=>p.file==='fw30-11-03.png'));
 assert.equal((await post('respond',{eventId:sunday.id,slug:'red',answer:'yes'})).status,409);
 const sundayEdit={type:'event',eventId:sunday.id,metadata:sundayMetadata,capacity:9,open:true};assert.equal((await post('action',sundayEdit,admin)).status,200);
 assert.equal((await post('respond',{eventId:sunday.id,slug:'red',answer:'yes'})).status,200);
 assert.equal((await post('action',{...sundayEdit,open:false},admin)).status,200);
 sunday=(await(await fetch(base+'/api/public/events')).json()).events.find(e=>e.slot==='sunday');assert.equal(sunday.rsvpOpen,false);assert.equal(sunday.rsvps.red,'yes');assert.equal(sunday.rsvps.bostnmike,'yes');
 await post('action',{type:'link',slug:'red',revoke:true},admin);assert.equal((await fetch(base+'/api/me',{headers:{Cookie:red}})).status,401);assert.equal((await post('exchange',{key:privateKey})).status,401);
 assert.equal((await fetch(base+'/api/backup')).status,401);assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/style.css')).status,200);
 console.log('PASS: actual local Worker/D1 — encrypted push Request compatibility without provider contact, shared RSVP, player/Commish notification audience isolation and outbox atomicity, game-opening deduplication, private device opt-out, announcement/poll authorization, atomic send deduplication, editable voting and closing, secure Commish exchange, host lock, last-seat concurrency, cancel/delete/restore, revocation, privacy and CSRF.');
}finally{server?.kill('SIGTERM');rmSync('integration.local.sql',{force:true});rmSync('integration.local.mjs',{force:true});setTimeout(()=>rmSync(state,{recursive:true,force:true}),1500);}
