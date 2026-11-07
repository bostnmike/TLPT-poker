import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite.mjs';
import worker, {hash} from '../worker.mjs';
import {applyOperation, publicFeed} from '../model.mjs';
import {coffeeQueue} from '../coffee.mjs';
import {coffeeDescription} from '../public/coffee-menu.mjs';
import {notificationTransitions, notificationStillRelevant, enqueueStatement, drainNotifications} from '../notifications.mjs';
import {b64url} from '../web-push.mjs';

const now = '2030-01-01T12:00:00Z';
const orderId = '11111111-1111-4111-8111-111111111111';
const actor = {role: 'shared', slug: 'red'};
const options = {drink: 'coffee', temperature: 'iced', milk: false, stevia: true, extraShot: false};
const fixture = () => ({revision: 1, sequence: 3, adminGeneration: 1, updatedAt: now, audit: [], players: ['bostnmike','red','li-fo'].map(slug => ({slug, name: slug, generation: 1, linkHash: 'fixture-only'})), events: [{id: 'e1', capacity: 1, open: true, metadata: {title: 'Test game', slot: 'friday', date: '2030-01-04'}, responses: {bostnmike: {answer: 'yes', order: 0, updatedAt: now}, red: {answer: 'yes', order: 1}}}]});
const operation = (overrides = {}) => ({type: 'coffee', eventId: 'e1', orderId, slug: 'red', action: 'save', expectedVersion: 0, requestId: crypto.randomUUID(), order: {...options}, ...overrides});
function change(before, op = operation(), who = actor) {
  const after = structuredClone(before);
  applyOperation(after, who, op, now);
  return {after, jobs: notificationTransitions(before, after, new Date(now), who, op)};
}
function commit(db, before, after, jobs) {
  return db.batch([db.prepare('UPDATE rsvp_state SET revision=?,body=? WHERE revision=?').bind(after.revision, JSON.stringify(after), before.revision), enqueueStatement(db, jobs, after.revision, Date.parse(now))]);
}

test('coffee menu normalizes milk for espresso drinks without changing seats or the waitlist', () => {
  for (const drink of ['coffee','latte','cappuccino','macchiato']) for (const temperature of ['hot','iced']) {
    const before = fixture(), {after} = change(before, operation({order: {...options, drink, temperature, extraShot: true}}));
    const order = after.events[0].coffeeOrders.red[orderId];
    assert.equal(order.drink, drink); assert.equal(order.temperature, temperature); assert.equal(order.milk, drink !== 'coffee');
    assert.equal(order.version, 1); assert.equal(order.status, 'active');
    assert.equal(after.sequence, before.sequence); assert.deepEqual(after.events[0].responses, before.events[0].responses);
    assert.deepEqual(publicFeed(after).events[0].waitlist, publicFeed(before).events[0].waitlist);
    assert.ok(!JSON.stringify(publicFeed(after)).includes('coffeeOrders'));
    assert.match(coffeeDescription(order), /Stevia in the Raw/); assert.match(coffeeDescription(order), /\+1 espresso shot/);
  }
});
test('orders reject invalid identities, menu fields and unavailable events', () => {
  for (const overrides of [{slug:'li-fo'}, {action:'complete'}, {requestId:'invalid'}, {orderId:'invalid'}, {expectedVersion:-1}, {order:{...options,drink:'mocha'}}, {order:{...options,temperature:'warm'}}, {order:{...options,milk:'false'}}, {order:{...options,stevia:1}}, {order:{...options,extraShot:null}}]) assert.throws(() => change(fixture(), operation(overrides)));
  for (const who of [{role:'shared',slug:'bostnmike'}, {role:'shared',slug:'unknown'}]) assert.throws(() => change(fixture(), operation({slug:who.slug}), who));
  for (const edit of [e => e.open=false, e => e.metadata.date='2029-12-31', e => e.metadata.date='Date TBD', e => e.cancelled=true, e => e.archived=true, e => e.deletedAt=now]) {
    const s=fixture(); edit(s.events[0]); assert.throws(() => change(s), /closed|unavailable/);
  }
});
test('updates, retries, cancellations and reorders produce one version and one alert per real change', () => {
  const s=fixture(), op=operation(), first=change(s,op); assert.equal(first.jobs.length,1);
  const retry=change(first.after,op); assert.deepEqual(retry.after,first.after); assert.deepEqual(retry.jobs,[]);
  const unchanged=change(first.after,operation({expectedVersion:1})); assert.deepEqual(unchanged.after,first.after); assert.deepEqual(unchanged.jobs,[]);
  assert.throws(() => change(first.after,{...op,order:{...options,milk:true}}), /already used/);
  assert.throws(() => change(first.after,operation({order:{...options,milk:true}})), /another device/);
  const updated=change(first.after,operation({expectedVersion:1,order:{...options,milk:true}})); assert.equal(updated.jobs.length,1); assert.match(updated.jobs[0].title,/changed/);
  assert.equal(updated.after.events[0].coffeeOrders.red[orderId].version,2);
  const cancelled=change(updated.after,operation({action:'cancel',expectedVersion:2})); assert.match(cancelled.jobs[0].title,/cancelled/);
  assert.equal(cancelled.after.events[0].coffeeOrders.red[orderId].status,'cancelled');
  const reordered=change(cancelled.after,operation({expectedVersion:3})); assert.equal(reordered.after.events[0].coffeeOrders.red[orderId].version,4);
  assert.match(reordered.jobs[0].title,/Coffee order from/);
  assert.throws(() => change(fixture(),operation({action:'cancel'})),/no coffee order/);
  const closed=structuredClone(first.after);closed.events[0].open=false;
  assert.equal(change(closed,operation({action:'cancel',expectedVersion:1})).after.events[0].coffeeOrders.red[orderId].status,'cancelled');
});
test('Commish queue includes closed-game orders, uses current display names, and excludes old or removed games', () => {
  const s=change(fixture(),operation({slug:'li-fo'}),{role:'shared',slug:'li-fo'}).after;
  s.events[0].open=false;
  const queue=coffeeQueue(s,new Date(now)); assert.equal(queue.orders[0].name,'ButtonMan'); assert.equal(queue.events[0].open,false);
  assert.ok(!JSON.stringify(queue).includes('requestId'));
  for (const edit of [e=>e.cancelled=true,e=>e.metadata.date='2029-12-31',e=>e.metadata.date='Date TBD']) { const copy=structuredClone(s);edit(copy.events[0]);assert.deepEqual(coffeeQueue(copy,new Date(now)).orders,[]); }
});
test('coffee alerts are scoped to current Commish devices, versioned and dropped if superseded or revoked', () => {
  const first=change(fixture()), payload=first.jobs[0];
  assert.equal(payload.recipient,'@commish:1');assert.match(payload.url,/activity=coffee/);
  assert.equal(notificationStillRelevant(payload,first.after,'@commish:1',new Date(now)),true);
  assert.equal(notificationStillRelevant(payload,first.after,'red',new Date(now)),false);
  const closed=structuredClone(first.after);closed.events[0].open=false;assert.equal(notificationStillRelevant(payload,closed,'@commish:1',new Date(now)),true);
  for(const edit of [s=>s.adminGeneration++,s=>s.events[0].coffeeOrders.red[orderId].version++,s=>s.events[0].cancelled=true,s=>s.events[0].metadata.date='2029-12-31']) {
    const copy=structuredClone(first.after);edit(copy);assert.equal(notificationStillRelevant(payload,copy,'@commish:1',new Date(now)),false);
  }
});
test('coffee transaction only enqueues Commish devices, preserves atomicity and cannot duplicate retries', () => {
  const db=database(), before=fixture(), next=change(before);
  db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(before));
  db.sql.exec("INSERT INTO push_subscriptions VALUES('player','https://fcm.googleapis.com/player','{}','red','binding',1); INSERT INTO commish_push_subscriptions VALUES('commish:phone','https://web.push.apple.com/phone','{}','@commish:1','binding',1),('commish:mac','https://fcm.googleapis.com/mac','{}','@commish:1','binding',1),('commish:old','https://fcm.googleapis.com/old','{}','@commish:0','binding',1)");
  commit(db,before,next.after,next.jobs);
  assert.deepEqual(db.sql.prepare('SELECT subscription_id FROM push_jobs ORDER BY subscription_id').all().map(row=>row.subscription_id),['commish:mac','commish:phone']);
  db.sql.exec('DELETE FROM push_jobs');commit(db,before,next.after,next.jobs);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
  const updated=change(next.after,operation({expectedVersion:1,order:{...options,milk:true}}));
  db.sql.exec('DROP TABLE push_jobs');assert.throws(()=>commit(db,next.after,updated.after,updated.jobs));
  assert.equal(db.sql.prepare('SELECT revision FROM rsvp_state').get().revision,next.after.revision);
});
test('coffee drain delivers current changes to Commish and consumes superseded jobs without sending', async () => {
  const db=database(), before=fixture(), first=change(before);
  const receiver=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const jwk=await crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).privateKey);
  const subscription={endpoint:'https://fcm.googleapis.com/coffee-disposable',keys:{p256dh:b64url(await crypto.subtle.exportKey('raw',receiver.publicKey)),auth:b64url(crypto.getRandomValues(new Uint8Array(16)))}};
  db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(before));
  db.sql.prepare('INSERT INTO commish_push_subscriptions VALUES(?,?,?,?,?,1)').run('commish:mac',subscription.endpoint,JSON.stringify(subscription),'@commish:1','binding');
  commit(db,before,first.after,first.jobs);
  const second=change(first.after,operation({expectedVersion:1,order:{...options,drink:'latte'}}));commit(db,first.after,second.after,second.jobs);
  let sends=0;await drainNotifications({DB:db,VAPID_PRIVATE_JWK:JSON.stringify(jwk)},async()=>{sends++;return new Response('',{status:201});},Date.parse(now));
  assert.equal(sends,1);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM push_jobs').get().n,0);
});
test('shared coffee API validates origin and canonical names; queue requires current Commish sign-in', async () => {
  const db=database(),s=fixture(),origin='https://coffee.test';db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(s));
  const env={DB:db},ctx={waitUntil:()=>{}},call=(path,body,cookie='',source=origin)=>worker.fetch(new Request(origin+'/api/'+path,{headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:source}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})}),env,ctx);
  const token='b'.repeat(64);db.sql.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await hash(token),'admin',null,1,Date.now()+60000);
  assert.equal((await call('coffee-orders')).status,401);
  db.sql.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await hash('c'.repeat(64)),'player','red',1,Date.now()+60000);
  assert.equal((await call('coffee-orders',null,'tlpt_rsvp='+'c'.repeat(64))).status,403);
  const op=operation();assert.equal((await call('coffee',op,'','https://evil.test')).status,403);
  for(const slug of ['bostnmike','unknown'])assert.equal((await call('coffee',{...op,slug})).status,400);
  const result=await call('coffee',op);assert.equal(result.status,200);assert.equal((await result.json()).order.version,1);
  assert.equal((await call('coffee',op)).status,200);
  assert.equal((await call('coffee',{...op,orderId:crypto.randomUUID(),requestId:crypto.randomUUID()})).status,409);
  const order=await(await call('coffee?slug=red&eventId=e1')).json();assert.equal(order.orders[0].status,'active');assert.ok(!JSON.stringify(order).includes('requestId'));
  const queue=await(await call('coffee-orders',null,'tlpt_rsvp='+token)).json();assert.equal(queue.orders.length,1);
  assert.equal((await call('coffee',{...operation(),expectedVersion:0,order:{...options,milk:true}})).status,409);
  assert.ok(!JSON.stringify(await(await call('me',null,'tlpt_rsvp='+'c'.repeat(64))).json()).includes('coffeeOrders'));
});


test('a player has one editable pre-order; a stale second form cannot create an extra drink', () => {
  const first = change(fixture());
  const otherId = crypto.randomUUID();
  assert.throws(() => change(first.after, operation({orderId: otherId, order: {...options, drink: 'latte'}})), /another device/);
  const edited = change(first.after, operation({expectedVersion:1, order: {...options, drink:'latte'}}));
  assert.equal(coffeeQueue(edited.after,new Date(now)).orders.length,1);
  assert.equal(edited.jobs.length,1);
  const cancelled = change(edited.after, operation({action:'cancel',expectedVersion:2}));
  const restarted = change(cancelled.after,operation({orderId:otherId}));
  assert.equal(coffeeQueue(restarted.after,new Date(now)).orders.filter(order=>order.status==='active').length,1);
});
