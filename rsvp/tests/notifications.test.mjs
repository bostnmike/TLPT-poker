import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite.mjs';
import {notificationTransitions,notificationStillRelevant,enqueueStatement,subscriptionAction,drainNotifications} from '../notifications.mjs';
import worker,{hash} from '../worker.mjs';
import {applyOperation} from '../model.mjs';
import {encryptedPush,b64url,unbase64,validateSubscription,validPushEndpoint,vapidPublicKey,deriveWebPushKeys} from '../web-push.mjs';
const now=Date.parse('2030-01-01T12:00:00Z'),actor={role:'admin'};
function state(){return {revision:1,sequence:3,updatedAt:new Date(now).toISOString(),players:['bostnmike','red','ahmed'].map(slug=>({slug,name:slug})),audit:[],events:[{id:'e1',metadata:{title:'Test Game',date:'2030-01-04',slot:'friday'},capacity:2,open:true,responses:{red:{answer:'yes',order:1},ahmed:{answer:'yes',order:2}}}]};}
async function keys(){const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),jwk=await crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).privateKey);return {pair,jwk,subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/disposable-test',keys:{p256dh:b64url(await crypto.subtle.exportKey('raw',pair.publicKey)),auth:b64url(crypto.getRandomValues(new Uint8Array(16)))}}};}
test('only newly opened games and actual waitlist-to-seat transitions generate alerts',()=>{
 const before=state(),after=structuredClone(before);applyOperation(after,actor,{type:'respond',eventId:'e1',slug:'red',answer:'no'});
 const jobs=notificationTransitions(before,after,new Date(now));assert.deepEqual(jobs.map(j=>[j.kind,j.slug]),[['seat','ahmed']]);
 assert.deepEqual(notificationTransitions(after,after,new Date(now)),[]);
 const closed=structuredClone(before);closed.events[0].open=false;
 assert.deepEqual(notificationTransitions(before,closed,new Date(now)),[]);
 assert.deepEqual(notificationTransitions(closed,before,new Date(now)).map(j=>j.kind),['game-open']);
 const newGame=structuredClone(before);newGame.events.push({...structuredClone(before.events[0]),id:'e2'});
 assert.deepEqual(notificationTransitions(before,newGame,new Date(now)).map(j=>j.eventId),['e2']);
 const edit=structuredClone(before);edit.events[0].metadata.title='Changed';assert.deepEqual(notificationTransitions(before,edit,new Date(now)),[]);
 for(const date of ['Date TBD','2029-12-31']){newGame.events[1].metadata.date=date;assert.deepEqual(notificationTransitions(before,newGame,new Date(now)),[]);}
 const moreSeats=structuredClone(before);moreSeats.events[0].capacity=3;assert.equal(notificationTransitions(before,moreSeats,new Date(now))[0].slug,'ahmed');
 const priority=structuredClone(before);applyOperation(priority,actor,{type:'promote',eventId:'e1',slug:'ahmed'});assert.equal(notificationTransitions(before,priority,new Date(now))[0].slug,'ahmed');
});
test('push endpoints and keys reject SSRF, redirects through untrusted hosts and malformed EC data',async()=>{
 const {subscription}=await keys();assert.ok(await validateSubscription(subscription));
 for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://evil.test/x','https://user@web.push.apple.com/x','https://web.push.apple.com:444/x'])assert.equal(validPushEndpoint(endpoint),false,endpoint);
 for(const endpoint of ['https://web.push.apple.com/a','https://updates.push.services.mozilla.com/wpush/v2/a','https://wns2.notify.windows.com/w/?token=a'])assert.equal(validPushEndpoint(endpoint),true);
 assert.equal(await validateSubscription({...subscription,keys:{...subscription.keys,auth:'a'}}),null);
 assert.equal(await validateSubscription({...subscription,keys:{...subscription.keys,p256dh:b64url(new Uint8Array(65))}}),null);
});
test('encrypted push decrypts on the recipient key and VAPID signature verifies with the advertised key',async()=>{
 const {pair,jwk,subscription}=await keys(),payload={title:'Seat confirmed',body:'You are In',url:'/?event=e1'};
 const request=await encryptedPush(subscription,payload,jwk,now),bytes=request.body,salt=bytes.slice(0,16),sender=bytes.slice(21,86),ciphertext=bytes.slice(86),receiver=unbase64(subscription.keys.p256dh);
 assert.equal(new DataView(bytes.buffer).getUint32(16),4096);assert.equal(bytes[20],65);assert.equal(request.redirect,'error');
 const shared=await crypto.subtle.deriveBits({name:'ECDH',public:await crypto.subtle.importKey('raw',sender,{name:'ECDH',namedCurve:'P-256'},false,[])},pair.privateKey,256);
 async function derive(secret,salt,info,length){return crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},await crypto.subtle.importKey('raw',secret,'HKDF',false,['deriveBits']),length);}
 const info=new Uint8Array([...new TextEncoder().encode('WebPush: info\0'),...receiver,...sender]);
 const ikm=await derive(shared,unbase64(subscription.keys.auth),info,256),cek=await derive(ikm,salt,new TextEncoder().encode('Content-Encoding: aes128gcm\0'),128),iv=await derive(ikm,salt,new TextEncoder().encode('Content-Encoding: nonce\0'),96);
 const plaintext=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']),ciphertext));
 assert.equal(plaintext.at(-1),2);assert.deepEqual(JSON.parse(new TextDecoder().decode(plaintext.slice(0,-1))),payload);
 const token=request.headers.Authorization.match(/t=([^,]+)/)[1],parts=token.split('.'),claims=JSON.parse(new TextDecoder().decode(unbase64(parts[1])));assert.equal(claims.aud,'https://fcm.googleapis.com');assert.equal(claims.exp,now/1000+3600);
 const pub=await crypto.subtle.importKey('raw',unbase64(vapidPublicKey(jwk)),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);assert.ok(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pub,unbase64(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])));
});
test('private device token controls subscriptions; changing names clears queued alerts without changing RSVPs',async()=>{
 const db=database(),s=state(),{subscription}=await keys(),token='a'.repeat(64),other='b'.repeat(64),before=JSON.stringify(s);
 assert.deepEqual(await subscriptionAction(db,s,{action:'enable',slug:'ahmed',token,subscription},hash),{enabled:true,slug:'ahmed'});
 assert.deepEqual(await subscriptionAction(db,s,{action:'status',token:other},hash),{enabled:false,slug:null});
 await assert.rejects(()=>subscriptionAction(db,s,{action:'enable',slug:'red',token:other,subscription},hash),/Reset/);
 await assert.rejects(()=>subscriptionAction(db,s,{action:'enable',slug:'bostnmike',token,subscription},hash),/name/);
 await subscriptionAction(db,s,{action:'enable',slug:'red',token,subscription},hash);assert.equal((await subscriptionAction(db,s,{action:'status',token},hash)).slug,'red');
 await subscriptionAction(db,s,{action:'disable',token},hash);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,0);assert.equal(JSON.stringify(s),before);
});
async function queueFixture(){const db=database(),before=state(),after=structuredClone(before),{jwk,subscription}=await keys();
 await subscriptionAction(db,before,{action:'enable',slug:'ahmed',token:'a'.repeat(64),subscription},hash);
 db.sql.prepare('INSERT INTO rsvp_state VALUES(1,?,?)').run(before.revision,JSON.stringify(before));applyOperation(after,actor,{type:'respond',eventId:'e1',slug:'red',answer:'no'});
 const jobs=notificationTransitions(before,after,new Date(now));return {db,before,after,jobs,jwk,env:{DB:db,VAPID_PRIVATE_JWK:JSON.stringify(jwk)}};}
function commit(db,before,after,jobs){return db.batch([db.prepare('UPDATE rsvp_state SET revision=?,body=? WHERE id=1 AND revision=?').bind(after.revision,JSON.stringify(after),before.revision),enqueueStatement(db,jobs,after.revision,now)]);}
test('state compare-and-swap and outbox are atomic; stale saves cannot enqueue and retry cannot duplicate',async()=>{
 const {db,before,after,jobs}=await queueFixture();commit(db,before,after,jobs);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,1);
 db.sql.exec('DELETE FROM push_jobs');commit(db,before,after,jobs);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
 const next=structuredClone(after);next.revision++;db.sql.exec('DROP TABLE push_jobs');assert.throws(()=>commit(db,after,next,jobs));assert.equal(db.sql.prepare('SELECT revision FROM rsvp_state').get().revision,after.revision);
});
test('delivery retries transient failures, consumes successes once and expires revoked subscriptions',async()=>{
 const {db,before,after,jobs,env}=await queueFixture();commit(db,before,after,jobs);let calls=0;
 await drainNotifications(env,async()=>{calls++;return new Response('',{status:503});},now);assert.equal(calls,1);assert.equal(db.sql.prepare('SELECT attempts FROM push_jobs').get().attempts,1);
 await drainNotifications(env,async()=>{assert.fail('not due');},now+1000);
 await drainNotifications(env,async()=>{calls++;return new Response('',{status:201});},now+60000);assert.equal(calls,2);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
 await drainNotifications(env,async()=>{assert.fail('already sent');},now+120000);
 db.sql.exec('UPDATE rsvp_state SET revision=1');commit(db,before,after,jobs);await drainNotifications(env,async()=>new Response('',{status:410}),now);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,0);
});
test('queued seat alerts disappear if the player loses the seat, the game closes, or the device changes names',async()=>{
 for(const change of ['out','closed','binding']){const {db,before,after,jobs,env}=await queueFixture();commit(db,before,after,jobs);
  if(change==='binding')db.sql.exec("UPDATE push_subscriptions SET binding='changed'");else{if(change==='closed')after.events[0].open=false;else after.events[0].responses.ahmed.answer='no';db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(after));}
  await drainNotifications(env,async()=>{assert.fail('stale alert');},now);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
 }
 const s=state();assert.equal(notificationStillRelevant({kind:'seat',eventId:'e1',slug:'ahmed'},s,'ahmed',new Date(now)),false);
});

test('key derivation matches the published RFC 8291 Appendix A interoperability vector',async()=>{
 const receiver=unbase64('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');
 const sender=unbase64('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
 const {cek,nonce}=await deriveWebPushKeys(unbase64('kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs'),unbase64('BTBZMqHH6r4Tts7J_aSIgg'),unbase64('DGv6ra1nlYgDCS1FRnbzlw'),receiver,sender);
 assert.equal(b64url(cek),'oIhVW04MRdy2XN9CiKLxTg');assert.equal(b64url(nonce),'4h_95klXJ5E_qnoN');
});
test('notification API exposes only the public signing key and protects device ownership and same-origin opt-in',async()=>{
 const db=database(),s=state(),{jwk,subscription}=await keys(),env={DB:db,VAPID_PRIVATE_JWK:JSON.stringify(jwk)};db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(s));
 const origin='https://rsvp.test',call=(data,source=origin)=>worker.fetch(new Request(origin+'/api/notifications',{method:'POST',headers:{'Content-Type':'application/json',Origin:source},body:JSON.stringify(data)}),env,{});
 const config=await(await worker.fetch(new Request(origin+'/api/notifications/config'),env,{})).json();assert.deepEqual(Object.keys(config).sort(),['available','publicKey']);assert.equal(config.publicKey,vapidPublicKey(jwk));
 const data={action:'enable',token:'a'.repeat(64),slug:'red',subscription};assert.equal((await call(data,'https://evil.test')).status,403);assert.equal((await call({...data,slug:'missing'})).status,400);assert.equal((await call(data)).status,200);
 assert.deepEqual(await(await call({action:'status',token:'b'.repeat(64)})).json(),{enabled:false,slug:null});
 const feed=await(await worker.fetch(new Request(origin+'/api/public/events'),env,{})).json();for(const secret of [jwk.d,subscription.endpoint,data.token])assert.ok(!JSON.stringify(feed).includes(secret));
 assert.equal((await call({action:'disable',token:data.token})).status,200);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,0);
});

test('notification setup has its own rate allowance so a shared Wi-Fi cannot exhaust RSVP saves',async()=>{
 const db=database(),s=state(),env={DB:db};db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(s));
 const post=(path,body)=>worker.fetch(new Request('https://rsvp.test/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rsvp.test'},body:JSON.stringify(body)}),env,{waitUntil(){}});
 for(let i=0;i<120;i++)assert.equal((await post('notifications',{action:'status',token:'a'.repeat(64)})).status,200);
 assert.equal((await post('notifications',{action:'status',token:'a'.repeat(64)})).status,429);
 assert.equal((await post('respond',{slug:'red',eventId:'e1',answer:'maybe'})).status,200);
});
