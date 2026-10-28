import {publicFeed,requireValue,HOST} from './model.mjs';
import {encryptedPush,validateSubscription,vapidPublicKey} from './web-push.mjs';
export function pushConfiguration(env){try{const jwk=JSON.parse(env.VAPID_PRIVATE_JWK);if(jwk.kty!=='EC'||jwk.crv!=='P-256'||!jwk.d)return null;return {jwk,publicKey:vapidPublicKey(jwk)};}catch{return null;}}
const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const eventDate=e=>new Date(e.date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric'});
export function notificationTransitions(before,after,now=new Date()){
 const previous=publicFeed(before).events,result=[];
 for(const e of publicFeed(after).events){
  if(!e.rsvpOpen||e.date==='Date TBD'||e.date<day(now))continue;
  const old=previous.find(x=>x.id===e.id),common={eventId:e.id,url:'/?event='+encodeURIComponent(e.id)};
  if(!old?.rsvpOpen)result.push({...common,kind:'game-open',slug:null,title:'A game is open. Call your shot.',body:`${e.title} · ${eventDate(e)}. Tap to RSVP.`});
  else for(const w of old.waitlist)if(w.slug!==HOST&&e.rsvps[w.slug]==='yes')result.push({...common,kind:'seat',slug:w.slug,title:'You’re off the waitlist. You’re In!',body:`Your seat is confirmed for ${e.title} · ${eventDate(e)}.`});
 }
 return result;
}
// A single INSERT follows the state UPDATE in the SAME D1 transaction. changes()
// gates every job on the successful compare-and-swap, including simultaneous RSVPs.
export function enqueueStatement(db,jobs,revision,now){return db.prepare(`INSERT OR IGNORE INTO push_jobs(id,subscription_id,binding,payload,created_at,next_attempt)
 SELECT ? || ':' || json_extract(j.value,'$.eventId') || ':' || json_extract(j.value,'$.kind') || ':' || s.id,
 s.id,s.binding,j.value,?,? FROM push_subscriptions s,json_each(?) j
 WHERE changes()>0 AND (json_extract(j.value,'$.slug') IS NULL OR json_extract(j.value,'$.slug')=s.slug)`)
 .bind(String(revision),now,now,JSON.stringify(jobs));}
export async function subscriptionAction(db,state,b,hash){
 requireValue(typeof b?.token==='string'&&/^[a-f0-9]{64}$/.test(b.token),'Notification settings need to be reset.');
 const id=await hash(b.token),current=await db.prepare('SELECT slug FROM push_subscriptions WHERE id=?').bind(id).first();
 if(b.action==='status')return {enabled:!!current,slug:current?.slug||null};
 if(b.action==='disable'){
  await db.batch([db.prepare('DELETE FROM push_jobs WHERE subscription_id=?').bind(id),db.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(id)]);return {enabled:false};
 }
 requireValue(b.action==='enable','Choose notification settings.');
 requireValue(state.players.some(p=>p.slug===b.slug&&p.slug!==HOST),'Choose your player name first.');
 const subscription=await validateSubscription(b.subscription);requireValue(subscription,'This browser’s notification subscription is unsupported.');
 const owner=await db.prepare('SELECT id FROM push_subscriptions WHERE endpoint=?').bind(subscription.endpoint).first();requireValue(!owner||owner.id===id,'Reset this browser’s notifications and try again.',409);
 const count=await db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').first();requireValue(current||count.n<500,'Notifications are full. Contact The Commish.',503);
 const binding=crypto.randomUUID();
 await db.batch([db.prepare('DELETE FROM push_jobs WHERE subscription_id=?').bind(id),db.prepare(`INSERT INTO push_subscriptions(id,endpoint,subscription,slug,binding,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET endpoint=excluded.endpoint,subscription=excluded.subscription,slug=excluded.slug,binding=excluded.binding,updated_at=excluded.updated_at`).bind(id,subscription.endpoint,JSON.stringify(subscription),b.slug,binding,Date.now())]);
 return {enabled:true,slug:b.slug};
}
const relevant=(payload,event,slug,today)=>!!event?.rsvpOpen&&event.date>=today&&(payload.kind==='game-open'||payload.kind==='seat'&&payload.slug===slug&&event.rsvps[slug]==='yes');
export function notificationStillRelevant(payload,state,slug,now=new Date()){return relevant(payload,publicFeed(state).events.find(e=>e.id===payload.eventId),slug,day(now));}
export async function drainNotifications(env,send=fetch,now=Date.now()){
 const config=pushConfiguration(env);if(!config)return;
 // Lease each small batch atomically so request/cron overlap cannot double-send.
 const {results:jobs}=await env.DB.prepare(`UPDATE push_jobs SET lease_until=? WHERE id IN
 (SELECT id FROM push_jobs WHERE next_attempt<=? AND lease_until<? ORDER BY created_at,id LIMIT 20) RETURNING *`).bind(now+60000,now,now).all();
 if(!jobs.length)return;
 const row=await env.DB.prepare('SELECT body FROM rsvp_state WHERE id=1').first(),state=row&&JSON.parse(row.body),events=state?publicFeed(state).events:[],today=day(new Date(now));
 const {results:subscriptions}=await env.DB.prepare('SELECT * FROM push_subscriptions WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(jobs.map(j=>j.subscription_id))).all();
 const statements=[];let cursor=0;
 async function work(){while(cursor<jobs.length){const job=jobs[cursor++],s=subscriptions.find(s=>s.id===job.subscription_id);let done=!s||s.binding!==job.binding||!state||now-job.created_at>3600000||job.attempts>=5,expired=false;
  if(!done){const payload=JSON.parse(job.payload);done=!relevant(payload,events.find(e=>e.id===payload.eventId),s.slug,today);
   if(!done)try{const response=await send(s.endpoint,await encryptedPush(JSON.parse(s.subscription),{...payload,tag:`${payload.kind}:${payload.eventId}`},config.jwk,now));expired=[404,410].includes(response.status);done=response.ok||expired||response.status>=400&&response.status<500&&![408,429].includes(response.status);}catch{/* Retry transient network failures without affecting a saved RSVP. */}
  }
  if(expired)statements.push(env.DB.prepare('DELETE FROM push_subscriptions WHERE id=? AND binding=?').bind(s.id,s.binding));
  statements.push(done?env.DB.prepare('DELETE FROM push_jobs WHERE id=?').bind(job.id):env.DB.prepare('UPDATE push_jobs SET attempts=attempts+1,next_attempt=?,lease_until=0 WHERE id=?').bind(now+Math.min(900000,30000*2**job.attempts),job.id));
 }}
 await Promise.all(Array.from({length:4},work));if(statements.length)await env.DB.batch(statements);
}
export function scheduleNotifications(ctx,env){ctx.waitUntil(drainNotifications(env).catch(()=>console.error('Notification delivery will retry.')));}
