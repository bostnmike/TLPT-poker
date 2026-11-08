import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite.mjs';
import worker,{hash} from '../worker.mjs';
import {publicFeed,applyOperation} from '../model.mjs';
import {canCloseOutEvent} from '../lib/event-closeout.mjs';

const date='2020-11-07',revision='a'.repeat(40),origin='https://rsvp.test';
const evidence={revision,date,title:'Finished game',sourceFile:'Event Report '+date+'.html',rawSha256:'b'.repeat(64),parsedSha256:'c'.repeat(64),completedAt:'2020-11-08T04:00:00Z'};
async function fixture(options={}){
 const db=database(),adminToken='a'.repeat(64),playerToken='b'.repeat(64);
 const metadata={date,title:evidence.title,slot:'saturday',day:'Saturday',format:'500K',time:'7:00 PM',endTime:'11:30 PM',structure:'Test',location:'Room',address:'Cary'};
 const state={revision:1,sequence:3,updatedAt:new Date().toISOString(),adminGeneration:1,audit:[],players:['bostnmike','red','ahmed'].map(slug=>({slug,name:slug,generation:1,linkHash:'fixture'})),events:[{id:'finished',metadata,open:true,capacity:2,responses:{bostnmike:{answer:'yes',order:0},red:{answer:'yes',order:1},ahmed:{answer:'yes',order:2}},coffeeOrders:{red:{order:{drink:'coffee',temperature:'hot',milk:false,stevia:false,extraShot:false,caffeine:'decaf',status:'active',version:1}}}},{id:'future',metadata:{...metadata,title:'Future game',date:'2099-11-14'},open:true,capacity:9,responses:{}}]};
 db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(state));
 for(const [token,role,slug] of [[adminToken,'admin',null],[playerToken,'player','red']])db.sql.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await hash(token),role,slug,1,Date.now()+60000);
 let receipt=null,historyRevision=7,proof={...evidence},closeCalls=0,previewCalls=0,onClose=null;
 const cashier={async preview(input){previewCalls++;if(options.previewFailure)return{ok:false,protocol:1,code:'results-unverified',error:'Results checks are not passing.'};if(receipt)return{ok:true,protocol:1,eventId:'saturday:'+date,rsvpEventId:'finished',confirmationDate:date,alreadyClosed:true,receipt};return{ok:true,protocol:1,eventId:'saturday:'+date,rsvpEventId:'finished',confirmationDate:date,alreadyClosed:false,historyRevision,records:4,review:1,evidence:proof};},async close(input){closeCalls++;assert.equal(input.payoutsConfirmed,true);assert.equal(input.receiptsReviewed,true);assert.equal(input.resultsConfirmed,true);assert.equal(current().events.find(e=>e.id==='finished').open,false);assert.ok(current().events.find(e=>e.id==='finished').closeoutPending);if(onClose)await onClose();if(options.closeFailure)return{ok:false,protocol:1,code:'unavailable',error:'Synthetic Cashier outage.'};receipt ||= {protocol:1,eventId:'saturday:'+date,rsvpEventId:'finished',requestId:input.requestId,closed:true,receiptId:input.requestId,closedAt:new Date().toISOString(),resultsRevision:proof.revision};if(options.lostReply){options.lostReply=false;throw Error('Lost response');}return{ok:true,receipt:options.badReceipt?{...receipt,rsvpEventId:'different-game'}:receipt};}};
 const env={DB:db,CASHIER_CLOSEOUT:cashier,GALLERY_FETCH:async()=>Response.json({folder:'images/fw',files:[]})};
 function current(){return JSON.parse(db.sql.prepare('SELECT body FROM rsvp_state').get().body);}
 async function call(path,body,token=adminToken,source=origin){const response=await worker.fetch(new Request(origin+'/api/'+path,{headers:{Cookie:token?'tlpt_rsvp='+token:'',...(body?{'Content-Type':'application/json',Origin:source}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})}),env,{waitUntil(){}});return {status:response.status,body:await response.json()};}
 async function preview(id='finished'){return call('closeout?'+new URLSearchParams({eventId:id}));}
 function confirmation(plan){return{eventId:plan.event.id,confirmationDate:date,requestId:plan.requestId,rsvpRevision:plan.rsvpRevision,expectedRevision:plan.cashier.historyRevision,expectedResultsRevision:plan.cashier.evidence?.revision||plan.cashier.receipt?.resultsRevision,payoutsConfirmed:true,receiptsReviewed:true,resultsConfirmed:true};}
 return{db,state,env,call,preview,confirmation,current,options,adminToken,playerToken,set onClose(fn){onClose=fn;},get receipt(){return receipt;},get closeCalls(){return closeCalls;},get previewCalls(){return previewCalls;},changeLedger(){historyRevision++;},changeResults(){proof={...proof,revision:'d'.repeat(40)};},setProof(value){proof={...proof,...value};}};
}

test('preview is read-only, includes exact game/counts/proof and supports Cashier slot/date deep links',async()=>{
 const f=await fixture(),before=f.current(),result=await f.preview('saturday:'+date);
 assert.equal(result.status,200);assert.equal(result.body.event.id,'finished');assert.equal(result.body.responses,3);assert.equal(result.body.waitlist,1);assert.equal(result.body.coffeeOrders,1);assert.equal(result.body.cashier.records,4);assert.equal(result.body.cashier.evidence.revision,revision);assert.deepEqual(f.current(),before);
 assert.equal((await f.preview('future')).status,409);assert.equal(f.previewCalls,1);
});
test('only current Commish sessions can preview or close; same-origin and all three confirmations are mandatory',async()=>{
 const f=await fixture(),plan=(await f.preview()).body,body=f.confirmation(plan);
 assert.equal((await f.call('closeout?eventId=finished',null,'')).status,401);
 assert.equal((await f.call('closeout?eventId=finished',null,f.playerToken)).status,403);
 assert.equal((await f.call('closeout',body,f.adminToken,'https://evil.test')).status,403);
 for(const key of ['payoutsConfirmed','receiptsReviewed','resultsConfirmed'])assert.equal((await f.call('closeout',{...body,[key]:false})).status,400);
 for(const type of ['closeout-prepare','closeout-finalize'])assert.equal((await f.call('action',{type,eventId:'finished',receipt:{closed:true}})).status,403);
 assert.equal(f.closeCalls,0);assert.equal(f.current().events[0].open,true);
});
test('verified close-out clears only its RSVP/coffee data and queued alerts after a matching Cashier receipt, preserving future games and cancel markers',async()=>{
 const f=await fixture(),state=f.current();state.events.push({...structuredClone(state.events[0]),id:'cancelled',cancelled:true,open:false});f.db.sql.prepare('UPDATE rsvp_state SET body=?').run(JSON.stringify(state));
 const before=f.current(),plan=(await f.preview()).body;
 for(const [id,eventId] of [['old-alert','finished'],['future-alert','future']])f.db.sql.prepare('INSERT INTO push_jobs(id,subscription_id,binding,payload,created_at,next_attempt) VALUES(?,?,?,?,0,0)').run(id,'test','binding',JSON.stringify({kind:'coffee',eventId}));
 const body=f.confirmation(plan),result=await f.call('closeout',body);assert.equal(result.status,200);assert.equal(result.body.complete,true);
 const final=f.current();assert.ok(!final.events.some(e=>e.id==='finished'));assert.deepEqual(final.events.find(e=>e.id==='future').metadata,before.events.find(e=>e.id==='future').metadata);assert.deepEqual(publicFeed(final).cancelledEvents,publicFeed(before).cancelledEvents);
 assert.equal(final.closeouts.length,1);assert.deepEqual(final.closeouts[0],f.receipt);assert.ok(!JSON.stringify(final.closeouts).includes('coffeeOrders'));assert.ok(!JSON.stringify(final.closeouts).includes('responses'));
 assert.deepEqual(f.db.sql.prepare('SELECT id FROM push_jobs ORDER BY id').all().map(row=>row.id),['future-alert']);
 const again=await f.call('closeout',body);assert.equal(again.status,200);assert.equal(f.closeCalls,1);assert.deepEqual(f.current(),final);
 assert.equal((await f.call('closeout',{...body,requestId:crypto.randomUUID()})).status,409);
 assert.equal((await f.preview()).body.complete,true);
});
test('failed evidence, stale event state, changed ledger or changed results cannot freeze or clear the game',async()=>{
 for(const change of ['evidence','rsvp','date','ledger','results']){
  const f=await fixture(),plan=(await f.preview()).body,body=f.confirmation(plan);
  if(change==='evidence')f.options.previewFailure=true;
  if(change==='rsvp')await f.call('respond',{eventId:'finished',slug:'red',answer:'no'},'');
  if(change==='date')body.confirmationDate='2020-11-06';
  if(change==='ledger')f.changeLedger();
  if(change==='results')f.changeResults();
  const result=await f.call('closeout',body);assert.equal(result.status,409,change);assert.equal(f.closeCalls,0);assert.equal(f.current().events[0].open,true);assert.ok(!f.current().events[0].closeoutPending);
 }
});
test('failure after freeze stays visibly pending and blocks RSVP, coffee, metadata, cancellation, deletion and restore until resumed',async()=>{
 const f=await fixture({closeFailure:true}),plan=(await f.preview()).body,body=f.confirmation(plan);
 const result=await f.call('closeout',body);assert.equal(result.status,503);assert.equal(result.body.pending,true);
 const frozen=f.current();assert.equal(frozen.events[0].open,false);assert.equal(frozen.events[0].closeoutPending.requestId,body.requestId);assert.deepEqual(frozen.events[0].coffeeOrders,f.state.events[0].coffeeOrders);
 const me=await f.call('me');assert.equal(me.body.allEvents.find(e=>e.id==='finished').closeoutPending,true);
 assert.equal((await f.call('respond',{eventId:'finished',slug:'red',answer:'no'},'')).status,409);
 const metadata=frozen.events[0].metadata;
 for(const type of ['archive','cancel','delete','restore'])assert.equal((await f.call('action',{type,eventId:'finished'})).status,409);
 assert.equal((await f.call('action',{type:'event',eventId:'finished',metadata,capacity:2,open:true})).status,409);
 assert.equal((await f.call('coffee',{slug:'red',eventId:'finished',action:'cancel',requestId:crypto.randomUUID(),orderId:'11111111-1111-4111-8111-111111111111',expectedVersion:1},'')).status,409);
 f.options.closeFailure=false;const retry=(await f.preview()).body;assert.equal(retry.requestId,body.requestId);assert.equal(retry.event.pending,true);
 assert.equal((await f.call('closeout',f.confirmation(retry))).status,200);assert.ok(!f.current().events.some(e=>e.id==='finished'));
});
test('a lost Cashier response resumes with its durable receipt without clearing Cashier twice or refetching unavailable results',async()=>{
 const f=await fixture({lostReply:true}),plan=(await f.preview()).body;
 assert.equal((await f.call('closeout',f.confirmation(plan))).body.pending,true);assert.ok(f.receipt);
 const retry=(await f.preview()).body;assert.equal(retry.cashier.alreadyClosed,true);assert.equal(retry.requestId,f.receipt.requestId);
 const result=await f.call('closeout',f.confirmation(retry));assert.equal(result.status,200);assert.equal(f.closeCalls,1);assert.deepEqual(f.current().closeouts[0],f.receipt);
});
test('pending close-out renews changed results and ledger proof only after fresh review, preserving its request and frozen records',async()=>{
 const f=await fixture({closeFailure:true}),plan=(await f.preview()).body,original=f.confirmation(plan);
 assert.equal((await f.call('closeout',original)).body.pending,true);
 const frozen=f.current().events.find(e=>e.id==='finished'),pending=structuredClone(frozen.closeoutPending);
 f.changeResults();f.changeLedger();
 const stale=await f.call('closeout',original);assert.equal(stale.status,409);assert.equal(stale.body.pending,true);assert.equal(f.closeCalls,1);
 assert.deepEqual(f.current().events.find(e=>e.id==='finished').closeoutPending,pending);
 const reviewed=(await f.preview()).body;assert.equal(reviewed.requestId,pending.requestId);assert.equal(reviewed.cashier.historyRevision,pending.historyRevision+1);assert.notEqual(reviewed.cashier.evidence.revision,pending.resultsRevision);
 assert.equal((await f.call('closeout',f.confirmation(reviewed))).body.pending,true);
 const renewed=f.current().events.find(e=>e.id==='finished');assert.equal(renewed.closeoutPending.requestId,pending.requestId);assert.equal(renewed.closeoutPending.startedAt,pending.startedAt);assert.equal(renewed.closeoutPending.resultsRevision,reviewed.cashier.evidence.revision);assert.equal(renewed.closeoutPending.historyRevision,reviewed.cashier.historyRevision);assert.deepEqual(renewed.responses,frozen.responses);assert.deepEqual(renewed.coffeeOrders,frozen.coffeeOrders);assert.equal(renewed.open,false);
 f.options.closeFailure=false;const retry=(await f.preview()).body;
 assert.equal((await f.call('closeout',f.confirmation(retry))).status,200);assert.equal(f.receipt.requestId,pending.requestId);assert.equal(f.receipt.resultsRevision,reviewed.cashier.evidence.revision);assert.ok(!f.current().events.some(e=>e.id==='finished'));assert.ok(f.current().events.some(e=>e.id==='future'));
});
test('a mismatched Cashier receipt never permits RSVP finalization',async()=>{
 const f=await fixture({badReceipt:true}),plan=(await f.preview()).body;
 const result=await f.call('closeout',f.confirmation(plan));assert.equal(result.status,502);assert.equal(result.body.pending,true);assert.ok(f.current().events[0].coffeeOrders);assert.equal(f.current().closeouts,undefined);
});
test('RSVP finalization failure rolls back its purge and remains resumable after Cashier has already cleared',async()=>{
 const f=await fixture(),plan=(await f.preview()).body;
 const batch=f.db.batch;
 f.onClose=async()=>{f.db.batch=statements=>{f.db.batch=batch;f.db.sql.exec('BEGIN');try{statements[0].run();throw Error('Synthetic finalize failure');}finally{f.db.sql.exec('ROLLBACK');}};};
 assert.equal((await f.call('closeout',f.confirmation(plan))).body.pending,true);
 assert.ok(f.receipt);assert.ok(f.current().events.find(e=>e.id==='finished').coffeeOrders);
 const retry=(await f.preview()).body;assert.equal((await f.call('closeout',f.confirmation(retry))).status,200);assert.equal(f.closeCalls,1);
});
test('a competing close-out request cannot replace the prepared action or clear another event',async()=>{
 const f=await fixture({closeFailure:true}),plan=(await f.preview()).body;
 await f.call('closeout',f.confirmation(plan));
 const retry=(await f.preview()).body;assert.equal((await f.call('closeout',{...f.confirmation(retry),requestId:crypto.randomUUID()})).status,409);assert.equal(f.closeCalls,1);
 assert.equal((await f.call('closeout',{...f.confirmation(retry),eventId:'future'})).status,409);assert.equal(f.closeCalls,1);
});
test('final close-out prevents recreating the cleared payment identity and does not produce a false no-game notice on the finished day',async()=>{
 const f=await fixture(),plan=(await f.preview()).body;await f.call('closeout',f.confirmation(plan));
 assert.equal((await f.call('action',{type:'event',metadata:f.state.events[0].metadata,capacity:2,open:true})).status,409);
 const view=publicFeed(f.current(),new Date(date+'T23:59:59Z'));assert.ok(!view.noGameDays.some(day=>day.date===date));
 assert.equal(canCloseOutEvent(f.state.events[0],new Date(date+'T12:00:00Z')),true);
 assert.equal(canCloseOutEvent({...f.state.events[0],metadata:{date:'Date TBD'}},new Date()),false);
});
test('concurrent RSVP after preparation cannot alter the frozen event or affect future dates',async()=>{
 const f=await fixture(),plan=(await f.preview()).body;
 f.onClose=async()=>{assert.equal((await f.call('respond',{eventId:'finished',slug:'red',answer:'no'},'')).status,409);assert.equal((await f.call('respond',{eventId:'future',slug:'red',answer:'yes'},'')).status,200);};
 assert.equal((await f.call('closeout',f.confirmation(plan))).status,200);assert.equal(f.current().events.find(e=>e.id==='future').responses.red.answer,'yes');
});


test('canonical title permits only the recognized capacity decoration and rejects another game',async()=>{
 const f=await fixture();f.setProof({title:'Finished game | 9-Max'});assert.equal((await f.preview()).status,200);
 f.setProof({title:'Another finished game | 9-Max'});assert.equal((await f.preview()).status,409);
});
