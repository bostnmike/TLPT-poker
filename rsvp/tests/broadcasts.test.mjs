import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite.mjs';
import worker,{hash} from '../worker.mjs';
import {sendBroadcast,broadcastOverview,publicPolls,vote,closePoll} from '../broadcasts.mjs';
import {drainNotifications,notificationStillRelevant} from '../notifications.mjs';
import {b64url} from '../web-push.mjs';
const now=Date.parse('2030-01-01T12:00:00Z'),id='11111111-1111-4111-8111-111111111111';
const message={id,kind:'announcement',title:'From The Commish',body:'Bring your questionable reads.'};
function setup(){const db=database(),state={revision:1,adminGeneration:1,players:['bostnmike','red','blue'].map(slug=>({slug,name:slug,generation:1,linkHash:'legacy'})),events:[],audit:[]};db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(state));return {db,state};}
function subscribe(db,id,slug,endpoint=id){const table=id.startsWith('commish:')?'commish_push_subscriptions':'push_subscriptions';db.sql.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?)`).run(id,'https://fcm.googleapis.com/'+endpoint,'{}',slug,'binding',now);}
test('broadcasts target opted-in current players and current Commish devices, with one copy per endpoint',async()=>{
 const {db,state}=setup();subscribe(db,'red-phone','red');subscribe(db,'red-mac','red');subscribe(db,'blue','blue','shared');subscribe(db,'commish:mac','@commish:1','shared');subscribe(db,'commish:old','@commish:0');subscribe(db,'removed','gone');subscribe(db,'host','bostnmike');
 const before=JSON.stringify(state),result=await sendBroadcast(db,state,message,now);assert.equal(result.devices,3);assert.equal(JSON.stringify(state),before);
 const jobs=db.sql.prepare('SELECT * FROM push_jobs').all();assert.equal(jobs.length,3);assert.deepEqual(jobs.map(j=>j.subscription_id).sort(),['commish:mac','red-mac','red-phone']);
 const commish=JSON.parse(jobs.find(j=>j.subscription_id==='commish:mac').payload);assert.equal(commish.url,'/?commish=1');assert.equal(commish.commish,true);assert.equal(commish.recipient,'@commish:1');
 assert.deepEqual((await broadcastOverview(db,state)).audience,{devices:3,players:1,commishDevices:1});
});
test('safe resend and concurrent duplicate requests never enqueue a second copy, even after delivery',async()=>{
 const {db,state}=setup();subscribe(db,'red','red');await Promise.all([sendBroadcast(db,state,message,now),sendBroadcast(db,state,message,now)]);
 assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM broadcasts').get().n,1);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,1);
 db.sql.exec('DELETE FROM push_jobs');assert.equal((await sendBroadcast(db,state,message,now)).duplicate,true);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
 await assert.rejects(()=>sendBroadcast(db,state,{...message,body:'changed'},now),/different message/);
});
test('broadcast validation bounds all text, IDs and choices before writing anything',async()=>{
 const {db,state}=setup();for(const bad of [{id:'bad'},{title:' '},{title:'a'.repeat(81)},{body:''},{body:'a'.repeat(301)},{kind:'other'},{kind:'poll',options:['Only one']},{kind:'poll',options:['Yes','yes']},{kind:'poll',options:['A','B','C','D','E']},{kind:'poll',options:['a'.repeat(61),'B']}])await assert.rejects(()=>sendBroadcast(db,state,{...message,...bad},now));
 assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM broadcasts').get().n,0);
 // A failed outbox insert must roll back the announcement too.
 subscribe(db,'red','red');db.sql.exec('DROP TABLE push_jobs');await assert.rejects(()=>sendBroadcast(db,state,message,now));assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM broadcasts').get().n,0);
});
test('polls keep one editable vote per roster identity; closing a poll atomically stops votes and preserves results',async()=>{
 const {db,state}=setup(),poll={...message,kind:'poll',body:'',options:['Friday','Sunday']};await sendBroadcast(db,state,poll,now);
 await vote(db,state,{pollId:id,slug:'red',choice:0},now);await vote(db,state,{pollId:id,slug:'red',choice:1},now+1);await vote(db,state,{pollId:id,slug:'blue',choice:1},now+2);
 let p=(await publicPolls(db,state)).polls[0];assert.deepEqual(p.counts,[0,2]);assert.equal(p.votes.length,2);assert.equal(p.devices,undefined);
 const overview=await broadcastOverview(db,state);assert.equal(overview.recent[0].votes[0].name,'blue');assert.deepEqual(overview.audience,{devices:0,players:0,commishDevices:0});
 await assert.rejects(()=>vote(db,state,{pollId:id,slug:'unknown',choice:0}),/name/);await assert.rejects(()=>vote(db,state,{pollId:id,slug:'red',choice:2}),/closed or unavailable/);await assert.rejects(()=>vote(db,state,{pollId:id,slug:'red',choice:'1'}),/option/);
 await closePoll(db,id);await assert.rejects(()=>vote(db,state,{pollId:id,slug:'red',choice:0}),/closed/);p=(await publicPolls(db,state)).polls[0];assert.equal(p.closed,true);assert.deepEqual(p.counts,[0,2]);
});
test('announcement delivery works without an event and reuses retry, badge IDs, and current subscription binding',async()=>{
 const {db,state}=setup(),jwk=await crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).privateKey),receiver=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),subscription={endpoint:'https://fcm.googleapis.com/disposable-never-sent',keys:{p256dh:b64url(await crypto.subtle.exportKey('raw',receiver.publicKey)),auth:b64url(crypto.getRandomValues(new Uint8Array(16)))}};
 subscribe(db,'red','red');db.sql.prepare('UPDATE push_subscriptions SET endpoint=?,subscription=?').run(subscription.endpoint,JSON.stringify(subscription));await sendBroadcast(db,state,message,now);
 let calls=0;const env={DB:db,VAPID_PRIVATE_JWK:JSON.stringify(jwk)};await drainNotifications(env,async()=>{calls++;return new Response('',{status:503});},now);assert.equal(calls,1);assert.equal(db.sql.prepare('SELECT attempts FROM push_jobs').get().attempts,1);
 const payload=JSON.parse(db.sql.prepare('SELECT payload FROM push_jobs').get().payload);assert.equal(payload.url,'/');assert.equal(notificationStillRelevant(payload,state,'red',new Date(now)),true);assert.equal(notificationStillRelevant(payload,state,'blue',new Date(now)),false);
 await drainNotifications(env,async()=>{calls++;return new Response('',{status:201});},now+60000);assert.equal(calls,2);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
 assert.equal(notificationStillRelevant({...payload,commish:true,recipient:'@commish:0'},state,'@commish:0',new Date(now)),false);
});
test('closed polls, removed players and replaced subscriptions discard queued broadcasts',async()=>{
 for(const reason of ['closed','removed','binding']){
  const {db,state}=setup(),jwk=await crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).privateKey);
  subscribe(db,'red','red');await sendBroadcast(db,state,{...message,kind:'poll',options:['A','B']},now);
  if(reason==='closed')await closePoll(db,id);if(reason==='binding')db.sql.exec("UPDATE push_subscriptions SET binding='new-device'");if(reason==='removed'){state.players=state.players.filter(p=>p.slug!=='red');db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(state));}
  await drainNotifications({DB:db,VAPID_PRIVATE_JWK:JSON.stringify(jwk)},async()=>assert.fail('obsolete poll must not send'),now);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
 }
});
test('broadcast API protects send, audience, history and close actions; shared votes retain same-origin validation',async()=>{
 const {db,state}=setup(),origin='https://rsvp.test',admin='a'.repeat(64),player='b'.repeat(64),jwk=await crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).privateKey),env={DB:db,VAPID_PRIVATE_JWK:JSON.stringify(jwk)},ctx={waitUntil(p){p.catch(()=>{});}};
 for(const [token,role,slug] of [[admin,'admin',null],[player,'player','red']])db.sql.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await hash(token),role,slug,1,Date.now()+60000);
 const call=(path,data,token='',source=origin)=>worker.fetch(new Request(origin+'/api/'+path,{method:data?'POST':'GET',headers:{Origin:source,'Content-Type':'application/json',Cookie:'tlpt_rsvp='+token},...(data?{body:JSON.stringify(data)}:{})}),env,ctx);
 assert.equal((await call('broadcasts')).status,401);assert.equal((await call('broadcasts',null,player)).status,403);assert.equal((await call('broadcasts',message,player)).status,403);assert.equal((await call('broadcasts',message,admin,'https://evil.test')).status,403);
 assert.equal((await call('broadcasts',{...message,kind:'poll',options:['Yes','No']},admin)).status,200);
 assert.equal((await call('poll-vote',{pollId:id,slug:'red',choice:0},'', 'https://evil.test')).status,403);assert.equal((await call('poll-vote',{pollId:id,slug:'red',choice:0})).status,200);
 const publicData=await(await call('public/polls')).json();assert.equal(publicData.polls.length,1);for(const forbidden of ['endpoint','subscription','binding','adminGeneration','devices'])assert.ok(!JSON.stringify(publicData).includes(forbidden));
 assert.equal((await call('broadcasts',{action:'close',id},player)).status,403);assert.equal((await call('broadcasts',{action:'close',id},admin)).status,200);
 state.adminGeneration=2;db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(state));assert.equal((await call('broadcasts',message,admin)).status,401);
});
