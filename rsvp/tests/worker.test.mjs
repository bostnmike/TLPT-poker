import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite.mjs';
import {readFileSync} from 'node:fs';
import worker,{hash} from '../worker.mjs';
import {publicFeed,applyOperation,eventPoster} from '../model.mjs';
import {overlayLiveRsvps} from '../../cashier/lib/live-rsvp.mjs';
const origin='https://rsvp.test',key='a'.repeat(64),adminKey='b'.repeat(64);

async function fixture(){const db=database(),state={revision:1,sequence:1,updatedAt:'2026-10-25T00:00:00Z',adminHash:await hash(adminKey),adminGeneration:1,players:['bostnmike','red','ahmed'].map(slug=>({slug,name:slug,image:'images/players/'+slug+'.jpg',rosterStatus:slug==='red'?'alumni':'active',generation:1,linkHash:null})),events:[{id:'stable-1',capacity:2,open:true,archived:false,metadata:{title:'Test',date:'2026-10-30',slot:'friday'},responses:{}}],audit:[]};state.players[0].linkHash=await hash(key);db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(state));return {db,state,env:{DB:db,REVISION:'test',ASSETS:{fetch:()=>new Response('test')}}};}
async function call(env,path,data,cookie,extra={}){const r=await worker.fetch(new Request(origin+'/api/'+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...extra},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil(p){p.catch(()=>{});}});return {r,body:await r.json()};}
async function login(env,k=key){const {r}=await call(env,'exchange',{key:k});assert.equal(r.status,200);return r.headers.get('Set-Cookie').split(';')[0];}
test('Commish installs have a separate credential-free launch page while the shared Player install stays at root',async()=>{
 const {env}=await fixture();env.ASSETS.fetch=async req=>{
  const manifest=new URL(req.url).pathname==='/manifest.webmanifest';
  return new Response(readFileSync(new URL(manifest?'../public/manifest.webmanifest':'../public/index.html',import.meta.url)),{headers:{'Content-Type':manifest?'application/manifest+json':'text/html',ETag:'original'}});
 };
 const get=path=>worker.fetch(new Request(origin+path),env,{});
 const player=await(await get('/')).text(),commish=await get('/?commish=1'),html=await commish.text();
 assert.match(player,/href="\/manifest.webmanifest\?/);assert.match(html,/href="\/commish.webmanifest\?/);assert.match(html,/<body class="is-commish-entry">/);assert.equal(commish.headers.get('ETag'),null);assert.equal(commish.headers.get('Cache-Control'),'private, no-store');
 const base=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url))),manifest=await(await get('/commish.webmanifest')).json();
 assert.equal(base.start_url,'/');assert.equal(manifest.start_url,'/?commish=1');assert.equal(manifest.id,'/?commish=1');assert.notEqual(manifest.id,base.id);assert.equal(manifest.name,'TLPT RSVP');assert.deepEqual(manifest.icons,base.icons);assert.ok(!JSON.stringify(manifest).includes('#key='));
 assert.equal((await call(env,'me')).r.status,401);assert.equal((await call(env,'action',{type:'delete',eventId:'stable-1'})).r.status,401);
});
test('private endpoints deny anonymous access, forged origin and cross-player changes',async()=>{const {env}=await fixture();for(const path of ['me','backup']){const {r,body}=await call(env,path,null,null,{'X-Player':'bostnmike','X-Admin':'true'});assert.equal(r.status,401);assert.deepEqual(Object.keys(body),['error']);assert.equal(r.headers.get('Cache-Control'),'private, no-store');}assert.equal((await call(env,'exchange',{key},null,{Origin:'https://evil.test'})).r.status,403);const cookie=await login(env);assert.equal((await call(env,'action',{type:'respond',eventId:'stable-1',slug:'red',answer:'yes'},cookie)).r.status,403);assert.equal((await call(env,'action',{type:'link',slug:'red'},cookie)).r.status,403);assert.equal((await call(env,'backup',null,cookie)).r.status,403);});
test('revocation invalidates private links and existing sessions, including alumni',async()=>{const {env}=await fixture(),admin=await login(env,adminKey);const issued=await call(env,'action',{type:'link',slug:'red'},admin);const redKey=new URL(issued.body.privateLink).hash.slice(5),red=await login(env,redKey);assert.equal((await call(env,'action',{type:'respond',eventId:'stable-1',answer:'yes'},red)).r.status,200);await call(env,'action',{type:'link',slug:'red',revoke:true},admin);assert.equal((await call(env,'me',null,red)).r.status,401);assert.equal((await call(env,'exchange',{key:redKey})).r.status,401);assert.equal((await call(env,'action',{type:'respond',eventId:'stable-1',answer:'no'},red)).r.status,401);});
test('simultaneous last-seat requests commit one confirmation, cancellation promotes, rejoin loses position',async()=>{const {env}=await fixture(),admin=await login(env,adminKey);const replies=await Promise.all(['bostnmike','red','ahmed'].map(slug=>call(env,'action',{type:'respond',eventId:'stable-1',slug,answer:'yes'},admin)));assert.ok(replies.every(x=>x.r.status===200));let feed=(await call(env,'public/events')).body,e=feed.events[0];assert.equal(Object.values(e.rsvps).filter(x=>x==='yes').length,2);assert.equal(e.waitlist.length,1);const first=e.requestedIn[1],second=e.requestedIn[2];await call(env,'action',{type:'respond',eventId:e.id,slug:first,answer:'no'},admin);e=(await call(env,'public/events')).body.events[0];assert.equal(e.rsvps[second],'yes');await call(env,'action',{type:'respond',eventId:e.id,slug:first,answer:'yes'},admin);e=(await call(env,'public/events')).body.events[0];assert.equal(e.waitlist.at(-1).slug,first);const order=e.requestedIn;await call(env,'action',{type:'respond',eventId:e.id,slug:first,answer:'yes'},admin);assert.deepEqual((await call(env,'public/events')).body.events[0].requestedIn,order);});
test('public feed and backups exclude link/session credentials and private audit from feed',async()=>{const {env}=await fixture();const feed=await call(env,'public/events');assert.equal(feed.r.headers.get('Access-Control-Allow-Origin'),'*');const text=JSON.stringify(feed.body);for(const forbidden of ['linkHash','adminHash','generation','audit','session',await hash(key),key])assert.ok(!text.includes(forbidden),forbidden);const admin=await login(env,adminKey);const backup=(await call(env,'backup',null,admin)).body;assert.equal(backup.adminHash,undefined);assert.ok(backup.players.every(p=>!p.linkHash));});
test('closed event and revoked session cannot write; failed save not reported as successful',async()=>{const {db,env,state}=await fixture();const cookie=await login(env);state.events[0].open=false;db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(state));assert.equal((await call(env,'action',{type:'respond',eventId:'stable-1',answer:'yes'},cookie)).r.status,409);db.sql.exec('DROP TABLE rsvp_state');const {r,body}=await call(env,'action',{type:'respond',eventId:'stable-1',answer:'yes'},cookie);assert.equal(r.status,503);assert.match(body.error,/not saved/);});
test('capacity changes, priority overrides, archive and dated identity rules',async()=>{const {state}=await fixture(),actor={role:'admin'};for(const slug of ['bostnmike','red','ahmed'])applyOperation(state,actor,{type:'respond',slug,eventId:'stable-1',answer:'yes'});applyOperation(state,actor,{type:'promote',slug:'ahmed',eventId:'stable-1'});assert.equal(publicFeed(state).events[0].rsvps.ahmed,'yes');state.events[0].capacity=2;assert.equal(publicFeed(state).events[0].waitlist.length,1);applyOperation(state,actor,{type:'archive',eventId:'stable-1'});assert.equal(publicFeed(state).events.length,0);applyOperation(state,actor,{type:'archive',eventId:'stable-1'});assert.equal(publicFeed(state).events[0].rsvpOpen,false);const metadata={title:'New',format:'40K',slot:'friday',day:'Friday',date:'Date TBD',time:'7:00 PM',endTime:'11:30 PM',location:'Room',address:'Cary',structure:'Test'};assert.throws(()=>applyOperation(state,actor,{type:'event',metadata,capacity:9,open:true,newId:'x'}),/undated/);applyOperation(state,actor,{type:'event',metadata,capacity:9,open:false,newId:'x'});assert.equal(publicFeed(state).events.at(-1).date,'Date TBD');});
test('random malformed keys are rejected and login attempts are bounded',async()=>{const {env}=await fixture();assert.equal((await call(env,'exchange',{key:'not-a-key'})).r.status,401);for(let i=0;i<60;i++)await call(env,'exchange',{key:'f'.repeat(64)});assert.equal((await call(env,'exchange',{key})).r.status,429);});
test('logout and Commish rotation invalidate sessions without changing player links',async()=>{const {db,env,state}=await fixture();const player=await login(env),admin=await login(env,adminKey);assert.equal((await call(env,'logout',{},player)).r.status,200);assert.equal((await call(env,'me',null,player)).r.status,401);state.adminGeneration++;db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(state));assert.equal((await call(env,'me',null,admin)).r.status,401);assert.equal((await call(env,'action',{type:'link',slug:'red'},admin)).r.status,401);assert.equal((await call(env,'exchange',{key})).r.status,200);});
test('malformed event dates and injected metadata fail validation or stay outside public fields',async()=>{const {state}=await fixture();const metadata={title:'<script>bad</script>',format:'40K',slot:'friday',day:'Friday',date:'2026-99-99',time:'7:00 PM',endTime:'11:30 PM',location:'Room',address:'Cary',structure:'Test',email:'private@example.test'};assert.throws(()=>applyOperation(state,{role:'admin'},{type:'event',metadata,capacity:9,open:false,newId:'new'}),/calendar date/);metadata.date='2026-11-06';applyOperation(state,{role:'admin'},{type:'event',metadata,capacity:9,open:true,newId:'new'});assert.equal(publicFeed(state).events.at(-1).email,undefined);});
test('restoring an archived duplicate cannot create competing event identities',async()=>{const {state}=await fixture();state.events[0].archived=true;state.events.push({...structuredClone(state.events[0]),id:'other',archived:false});assert.throws(()=>applyOperation(state,{role:'admin'},{type:'archive',eventId:'stable-1'}),/already uses/);});
test('seat indicator uses native progress values compatible with the strict content policy',()=>{const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');assert.match(source,/<progress class="meter"[^>]+max="\$\{e.capacity\}" value="\$\{count\}"/);assert.ok(!source.includes('style="width:'),'CSP blocks inline style attributes and would make a decorative bar appear full');});
test('host stays confirmed at capacity one and neither player nor Commish can change the lock',async()=>{
 const {env,state}=await fixture(),admin=await login(env,adminKey),host=await login(env);
 for(const cookie of [admin,host])for(const answer of ['maybe','no','tbd'])assert.equal((await call(env,'action',{type:'respond',eventId:'stable-1',slug:'bostnmike',answer},cookie)).r.status,409);
 state.events[0].capacity=1;state.events[0].responses.bostnmike={answer:'no',order:10};
 applyOperation(state,{role:'admin'},{type:'respond',eventId:'stable-1',slug:'red',answer:'yes'});
 applyOperation(state,{role:'admin'},{type:'promote',eventId:'stable-1',slug:'red'});
 const e=publicFeed(state).events[0];assert.equal(e.requestedIn[0],'bostnmike');assert.equal(e.rsvps.bostnmike,'yes');assert.equal(e.waitlist[0].slug,'red');
 assert.deepEqual(publicFeed(state).players.map(p=>p.slug),['bostnmike','ahmed','red']);
});
test('cancel, delete and restore retain answers and payment-event identity without accepting removed responses',async()=>{
 const {env}=await fixture(),admin=await login(env,adminKey),id='stable-1';
 await call(env,'action',{type:'respond',eventId:id,slug:'red',answer:'yes'},admin);
 const paymentEvent={id:'payment-1',slot:'friday',date:'2026-10-30',payments:[{player:'red',amount:40}]};
 for(const type of ['cancel','delete']){
  assert.equal((await call(env,'action',{type,eventId:id},admin)).r.status,200);
  let feed=(await call(env,'public/events')).body;assert.equal(feed.events.length,0);
  assert.equal(feed.cancelledEvents.length,type==='cancel'?1:0);
  const overlay=overlayLiveRsvps([paymentEvent],feed)[0];assert.deepEqual(overlay.payments,paymentEvent.payments);assert.equal(overlay.id,'payment-1');assert.deepEqual(overlay.rsvps,[]);
  assert.equal((await call(env,'action',{type:'respond',eventId:id,slug:'red',answer:'no'},admin)).r.status,404);
  const backup=(await call(env,'backup',null,admin)).body;assert.equal(backup.events[0].responses.red.answer,'yes');assert.equal(backup.events[0].id,id);
  assert.equal((await call(env,'action',{type:'restore',eventId:id},admin)).r.status,200);
  feed=(await call(env,'public/events')).body;assert.equal(feed.events[0].rsvps.red,'yes');assert.equal(feed.events[0].rsvpOpen,false);
 }
});
test('removed events cannot be restored over a replacement with the same date and type',async()=>{
 const {state}=await fixture(),actor={role:'admin'};applyOperation(state,actor,{type:'delete',eventId:'stable-1'});
 state.events.push({...structuredClone(state.events[0]),id:'replacement',deletedAt:null});
 assert.throws(()=>applyOperation(state,actor,{type:'restore',eventId:'stable-1'}),/already uses/);
});
test('gallery matching handles automatic, override, none and undated choices without arbitrary paths',async()=>{
 assert.equal(eventPoster({date:'2026-10-30'}).url,'https://tlpt.org/images/fw/fw26-10-30.jpg');
 assert.equal(eventPoster({date:'Date TBD'}),null);assert.equal(eventPoster({date:'2026-10-30',poster:'none'}),null);
 assert.equal(eventPoster({date:'Date TBD',poster:'fw26-10-31.jpg'}).file,'fw26-10-31.jpg');
 assert.equal(eventPoster({poster:'../../private'}),null);
 const {state}=await fixture();assert.throws(()=>applyOperation(state,{role:'admin'},{type:'event',capacity:9,open:false,metadata:{title:'Test',format:'40K',slot:'friday',day:'Friday',date:'2026-11-06',time:'7:00 PM',endTime:'11:30 PM',location:'Room',address:'Cary',structure:'Test',poster:'https://evil.test/a.jpg'}}),/gallery/);
});
test('shared-name RSVP accepts canonical players without sign-in and cannot grant Commish powers',async()=>{
 const {env,db}=await fixture();
 for(const answer of ['yes','maybe','no'])assert.equal((await call(env,'respond',{slug:'red',eventId:'stable-1',answer,type:'event',open:false,capacity:90,role:'admin'})).r.status,200);
 const saved=JSON.parse(db.sql.prepare('SELECT body FROM rsvp_state').get().body);assert.equal(saved.events[0].capacity,2);assert.equal(saved.events[0].open,true);assert.equal(saved.events[0].responses.red.answer,'no');assert.equal(saved.audit.at(-1).actor,'shared:red');
 assert.equal((await call(env,'action',{type:'delete',eventId:'stable-1'})).r.status,401);
 for(const data of [{slug:'missing',answer:'yes'},{slug:'red',answer:'tbd'},{slug:'red',answer:'admin'}])assert.equal((await call(env,'respond',{eventId:'stable-1',...data})).r.status,400);
 assert.equal((await call(env,'respond',{eventId:'stable-1',slug:'red',answer:'yes'},null,{Origin:'https://evil.test'})).r.status,403);
 assert.equal((await call(env,'respond',{eventId:'stable-1',slug:'bostnmike',answer:'no'})).r.status,409);
});
test('shared-name concurrent requests retain host, last-seat queue and closed/removed event protections',async()=>{
 const {env}=await fixture();
 const results=await Promise.all(['red','ahmed'].map(slug=>call(env,'respond',{eventId:'stable-1',slug,answer:'yes'})));assert.ok(results.every(x=>x.r.status===200));
 const event=(await call(env,'public/events')).body.events[0];assert.equal(event.rsvps.bostnmike,'yes');assert.equal(event.waitlist.length,1);
 const admin=await login(env,adminKey);await call(env,'action',{type:'cancel',eventId:event.id},admin);
 assert.equal((await call(env,'respond',{eventId:event.id,slug:'red',answer:'no'})).r.status,404);
 await call(env,'action',{type:'restore',eventId:event.id},admin);assert.equal((await call(env,'respond',{eventId:event.id,slug:'red',answer:'no'})).r.status,409);
});
test('correcting a date retains event ID and responses, updates its poster and keeps payment records on the old date',async()=>{
 const {state}=await fixture(),actor={role:'admin'},event=state.events[0];
 event.metadata={title:'Platoon of Rebuys',format:'40K',slot:'friday',day:'Friday',date:'2026-09-06',time:'7:00 PM',endTime:'11:30 PM',location:'Room',address:'Cary',structure:'Test'};
 applyOperation(state,actor,{type:'respond',eventId:event.id,slug:'red',answer:'yes'});const answers=structuredClone(event.responses);
 const paymentEvent={id:'payment-old',slot:'friday',date:'2026-09-06',payments:[{player:'red',amount:40}]};
 applyOperation(state,actor,{type:'event',eventId:event.id,metadata:{...event.metadata,date:'2026-11-06'},capacity:2,open:true});
 assert.equal(event.id,'stable-1');assert.deepEqual(event.responses,answers);assert.equal(publicFeed(state).events[0].poster.file,'fw26-11-06.jpg');
 const retained=overlayLiveRsvps([paymentEvent],publicFeed(state))[0];assert.deepEqual(retained.payments,paymentEvent.payments);assert.equal(retained.date,'2026-09-06');assert.deepEqual(retained.rsvps,[]);
 state.events.push({...structuredClone(event),id:'other',metadata:{...event.metadata,date:'2026-11-13'}});
 assert.throws(()=>applyOperation(state,actor,{type:'event',eventId:event.id,metadata:{...event.metadata,date:'2026-11-13'},capacity:2,open:true}),/already exist/);
});
test('MTT stays last while undated and joins chronological date/time order once scheduled',async()=>{
 const {state,db,env}=await fixture(),template=state.events[0];
 state.events=[['late','friday','2026-12-04','7:00 PM'],['pending','mtt','Date TBD','1:00 PM'],['first','friday','2026-11-06','7:00 PM'],['saturday','saturday','2026-11-07','7:00 PM'],['dated-mtt','mtt','2026-11-07','1:00 PM']].map(([id,slot,date,time])=>({...structuredClone(template),id,metadata:{...template.metadata,slot,date,time}}));
 assert.deepEqual(publicFeed(state).events.map(e=>e.id),['first','dated-mtt','saturday','late','pending']);
 db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(state));const admin=await login(env,adminKey);
 assert.deepEqual((await call(env,'me',null,admin)).body.allEvents.map(e=>e.id),['first','dated-mtt','saturday','late','pending']);
 state.events.find(e=>e.id==='pending').metadata.date='2026-11-20';
 assert.deepEqual(publicFeed(state).events.map(e=>e.id),['first','dated-mtt','saturday','pending','late']);
});

test('changing an existing game day preserves identity and answers, recalculates seats, and blocks duplicate day/date combinations',async()=>{
 const {env}=await fixture(),admin=await login(env,adminKey),id='stable-1';
 for(const slug of ['red','ahmed'])assert.equal((await call(env,'action',{type:'respond',eventId:id,slug,answer:'yes'},admin)).r.status,200);
 const before=(await call(env,'me',null,admin)).body.allEvents[0],answers=structuredClone(before.responses);
 const metadata={...before.metadata,title:'Keep this title',day:'MTT',slot:'mtt',format:'50K Deep Stack',structure:'25 minute levels',time:'1:00 PM',endTime:'10:30 PM',location:'Room',address:'Cary',poster:'none'};
 assert.equal((await call(env,'action',{type:'event',eventId:id,metadata,capacity:18,open:true},admin)).r.status,200);
 const after=(await call(env,'me',null,admin)).body.allEvents[0];
 assert.equal(after.id,id);assert.deepEqual(after.responses,answers);assert.equal(after.metadata.slot,'mtt');assert.equal(after.metadata.date,before.metadata.date);assert.equal(after.metadata.title,metadata.title);assert.equal(after.metadata.poster,'none');
 let event=(await call(env,'public/events')).body.events[0];assert.equal(event.waitlist.length,0);assert.deepEqual(event.requestedIn,['bostnmike','red','ahmed']);assert.equal(event.format,'50K Deep Stack');
 assert.equal((await call(env,'action',{type:'event',eventId:id,metadata:{...metadata,slot:'saturday',day:'Saturday'},capacity:2,open:true},admin)).r.status,200);
 event=(await call(env,'public/events')).body.events[0];assert.equal(event.waitlist[0].slug,'ahmed');assert.equal(event.rsvps.bostnmike,'yes');
 assert.equal((await call(env,'action',{type:'event',metadata,capacity:18,open:true},admin)).r.status,200);
 const collision=await call(env,'action',{type:'event',eventId:id,metadata,capacity:18,open:true},admin);assert.equal(collision.r.status,409);assert.match(collision.body.error,/already exist/);
 assert.equal((await call(env,'me',null,admin)).body.allEvents.find(e=>e.id===id).metadata.slot,'saturday');
});

test('Sunday saves as a 50K single table, stays off until opened, and retains answers through open/close and day changes',async()=>{
 const {env}=await fixture(),admin=await login(env,adminKey),metadata={title:'Sunday Test',date:'2030-11-03',slot:'sunday',day:'Sunday',format:'50K Format',structure:'50K starting stack • Friday blinds start 50/100 • 20 min levels',time:'7:00 PM',endTime:'11:30 PM',location:'Room',address:'Cary'};
 let r=await call(env,'action',{type:'event',metadata,capacity:9,open:false},admin);assert.equal(r.r.status,200);
 let feed=(await call(env,'public/events')).body,event=feed.events.find(e=>e.slot==='sunday'),id=event.id;assert.equal(event.rsvpOpen,false);assert.equal(event.tables,1);assert.equal(event.startingStack,50000);assert.equal(event.blindStructure,'40k');assert.equal(event.capacity,9);
 assert.equal((await call(env,'respond',{eventId:id,slug:'red',answer:'yes'})).r.status,409);
 const edit={type:'event',eventId:id,metadata,capacity:9,open:true};assert.equal((await call(env,'action',edit,admin)).r.status,200);
 assert.equal((await call(env,'respond',{eventId:id,slug:'red',answer:'yes'})).r.status,200);
 assert.equal((await call(env,'action',{...edit,capacity:10},admin)).r.status,400);
 assert.equal((await call(env,'action',{...edit,open:false},admin)).r.status,200);
 event=(await call(env,'public/events')).body.events.find(e=>e.id===id);assert.equal(event.rsvpOpen,false);assert.equal(event.rsvps.red,'yes');assert.equal(event.rsvps.bostnmike,'yes');
 assert.equal((await call(env,'action',{...edit,metadata:{...metadata,slot:'friday',day:'Friday'},open:false},admin)).r.status,200);
 event=(await call(env,'public/events')).body.events.find(e=>e.id===id);assert.equal(event.startingStack,undefined);assert.equal(event.blindStructure,undefined);assert.equal(event.tables,1);assert.equal(event.rsvps.red,'yes');
});
