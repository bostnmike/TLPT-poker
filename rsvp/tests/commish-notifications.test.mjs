import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite.mjs';
import worker,{hash} from '../worker.mjs';
import {applyOperation} from '../model.mjs';
import {notificationTransitions,commishRecipient,subscriptionAction,enqueueStatement,notificationStillRelevant,drainNotifications} from '../notifications.mjs';
import {b64url} from '../web-push.mjs';
const now=Date.parse('2030-01-01T12:00:00Z');
function fixture(){return {revision:1,sequence:0,adminGeneration:1,players:['bostnmike','red','ahmed','li-fo'].map(slug=>({slug,name:slug})),audit:[],events:[{id:'e1',metadata:{title:'Test Game',slot:'friday',date:'2030-01-04'},capacity:2,open:true,responses:{}}]};}
async function keys(){return {jwk:await crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).privateKey),subscription:{endpoint:'https://fcm.googleapis.com/commish-disposable-never-real',keys:{p256dh:b64url(await crypto.subtle.exportKey('raw',(await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits'])).publicKey)),auth:b64url(crypto.getRandomValues(new Uint8Array(16)))}}};}
function response(before,slug,answer,role='shared'){
 const after=structuredClone(before),actor={role,slug},op={type:'respond',eventId:'e1',slug,answer};applyOperation(after,actor,op);return {after,jobs:notificationTransitions(before,after,new Date(now),actor,op)};
}
function commit(db,before,after,jobs){return db.batch([db.prepare('UPDATE rsvp_state SET revision=?,body=? WHERE revision=?').bind(after.revision,JSON.stringify(after),before.revision),enqueueStatement(db,jobs,after.revision,now)]);}
test('Commish gets new and changed player answers, with no repeated-In, self-edit or host spam',()=>{
 const s=fixture(),first=response(s,'red','yes');assert.equal(first.jobs.length,1);assert.equal(first.jobs[0].kind,'response');assert.equal(first.jobs[0].title,'red is In');assert.equal(first.jobs[0].recipient,'@commish:1');assert.equal(first.jobs[0].url,'/?commish=1&event=e1');
 assert.equal(response(first.after,'red','yes').jobs.length,0);
 assert.match(response(first.after,'red','no').jobs[0].title,/changed to Out/);assert.match(response(first.after,'red','maybe').jobs[0].title,/changed to Maybe/);
 assert.equal(response(s,'red','yes','admin').jobs.length,0);assert.equal(response(s,'bostnmike','yes').jobs.length,0);
 assert.match(response(s,'li-fo','yes','player').jobs[0].title,/ButtonMan is In/);
 const past=fixture();past.events[0].metadata.date='2029-12-01';assert.equal(response(past,'red','yes').jobs.length,0);
});
test('player and Commish subscriptions can share a browser endpoint while their audiences and opt-outs stay separate',async()=>{
 const db=database(),s=fixture(),{subscription}=await keys(),token='a'.repeat(64),adminToken='b'.repeat(64),admin={role:'admin',generation:1};
 await subscriptionAction(db,s,{action:'enable',slug:'ahmed',token,subscription},hash);
 await assert.rejects(()=>subscriptionAction(db,s,{action:'enable',token:adminToken,subscription},hash,true),/Commish/);
 await subscriptionAction(db,s,{action:'enable',token:adminToken,subscription},hash,true,admin);
 db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(s));let next=response(s,'red','yes');commit(db,s,next.after,next.jobs);
 const first=db.sql.prepare('SELECT * FROM push_jobs').all();assert.equal(first.length,1);assert.ok(first[0].subscription_id.startsWith('commish:'));
 const closed=structuredClone(next.after);closed.events[0].open=false;closed.revision++;commit(db,next.after,closed,[]);const opened=structuredClone(closed);opened.events[0].open=true;opened.revision++;commit(db,closed,opened,notificationTransitions(closed,opened,new Date(now)));
 const all=db.sql.prepare('SELECT * FROM push_jobs').all();assert.equal(all.length,2);assert.equal(all.filter(j=>!j.subscription_id.startsWith('commish:')).length,1);
 await subscriptionAction(db,s,{action:'disable',token},hash);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,1);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM commish_push_subscriptions').get().n,1);
 await subscriptionAction(db,s,{action:'disable',token:adminToken},hash,true);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
});
test('Commish signup requires a real current admin session; query strings, claimed roles and player sessions cannot enroll',async()=>{
 const db=database(),s=fixture(),{subscription,jwk}=await keys(),env={DB:db,VAPID_PRIVATE_JWK:JSON.stringify(jwk)},origin='https://rsvp.test';db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(s));
 const session='c'.repeat(64);db.sql.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await hash(session),'admin',null,1,Date.now()+60000);
 const post=(body,cookie='',source=origin)=>worker.fetch(new Request(origin+'/api/commish-notifications?commish=1',{method:'POST',headers:{'Content-Type':'application/json',Origin:source,Cookie:cookie},body:JSON.stringify(body)}),env,{});
 const b={action:'enable',token:'b'.repeat(64),subscription,role:'admin',slug:'bostnmike'};assert.equal((await post(b)).status,401);assert.equal((await post(b,'tlpt_rsvp='+session,'https://evil.test')).status,403);
 assert.equal((await post(b,'tlpt_rsvp='+session)).status,200);assert.equal((await(await post({action:'status',token:b.token})).json()).slug,'@commish');
 s.players.find(p=>p.slug==='red').generation=1;s.players.find(p=>p.slug==='red').linkHash='legacy-test-only';db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(s));db.sql.exec("UPDATE sessions SET role='player',slug='red'");assert.equal((await post(b,'tlpt_rsvp='+session)).status,403);
 s.adminGeneration=2;db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(s));assert.equal((await(await post({action:'status',token:b.token})).json()).enabled,false);
});
test('queued Commish alerts drop after credential revocation or a superseding answer; waitlisted In still counts as In',async()=>{
 for(const change of ['revoke','answer','deliver','expired']){
  const db=database(),s=fixture(),{subscription,jwk}=await keys(),token='b'.repeat(64);s.events[0].capacity=1;
  await subscriptionAction(db,s,{action:'enable',token,subscription},hash,true,{role:'admin',generation:1});
  db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(s));const next=response(s,'red','yes');commit(db,s,next.after,next.jobs);assert.equal(notificationStillRelevant(next.jobs[0],next.after,commishRecipient(next.after),new Date(now)),true);
  if(change==='revoke')next.after.adminGeneration++;if(change==='answer')next.after.events[0].responses.red.answer='no';db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(next.after));let sends=0;
  await drainNotifications({DB:db,VAPID_PRIVATE_JWK:JSON.stringify(jwk)},async()=>{sends++;return new Response('',{status:change==='expired'?410:201});},now);
  assert.equal(sends,['deliver','expired'].includes(change)?1:0);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
  if(change==='expired')assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM commish_push_subscriptions').get().n,0);
 }
});
