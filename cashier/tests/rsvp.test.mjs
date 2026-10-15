import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSchedule,refreshScheduleAttendance} from '../lib/events.mjs';
import {eventAttendance} from '../lib/rsvp-attendance.mjs';
import {buildRsvpChecklist,paymentCanBelongTo} from '../lib/rsvp.mjs';
const players=[{name:'Ahmed',slug:'ahmed',aliases:[]},{name:'A.I. Dave',slug:'ai-dave',aliases:['AI Dave']},{name:'Bob',slug:'rob-f',aliases:['rob f']}];
const source={events:[{slot:'friday',date:'2026-10-16',title:'Friday',rsvps:{ahmed:'yes','ai-dave':'yes','rob-f':'yes',maybe:'maybe',declined:'no',unanswered:'tbd',tbd:'yes'},seatAssignments:[['declined','tbd','ahmed']]}]};
const event=normalizeSchedule(source,{events:{}},Date.parse('2026-10-15T12:00:00Z'))[0];
const payment=(extra={})=>({id:'receipt',event_id:event.id,candidate_event_ids:'[]',player:'',payer:'Ahmed',status:'confirmed',kind:'entry+food',cents:4500,prize_cents:3000,bounty_cents:0,food_cents:1500,received_at:'2026-10-16T23:00:00Z',...extra});
test('only Yes RSVPs enter the roster; Maybe, No, undecided and seat placeholders stay out',()=>{
 assert.deepEqual(event.roster,['ahmed','ai-dave','rob-f']);
 assert.equal(event.rsvps.find(r=>r.player==='maybe').answer,'maybe');
 assert.deepEqual(eventAttendance({}).roster,[]);
});
test('unchanged source refreshes attendance without rolling a pinned event or changing its prices',()=>{
 const old={...event,roster:['declined']};delete old.rsvps;
 const refreshed=refreshScheduleAttendance([old],source)[0];
 assert.deepEqual(refreshed.roster,event.roster);assert.equal(refreshed.id,event.id);assert.deepEqual(refreshed.rules,event.rules);
 const next={events:[{...source.events[0],date:'2026-10-23'}]};assert.deepEqual(refreshScheduleAttendance([old],next),[old]);
});
test('cash/manual and combined confirmed payments check off one buy-in and track pizza and rebuys separately',()=>{
 const rows=buildRsvpChecklist(event,[payment({player:'Ahmed',payer:'Different Venmo Name'}),payment({id:'rebuy',player:'Ahmed',kind:'rebuy',cents:3000,prize_cents:3000,food_cents:0}),payment({id:'food',payer:'AI Dave',kind:'food',cents:1500,prize_cents:0,food_cents:1500})],players).rows;
 const ahmed=rows.find(r=>r.name==='Ahmed'),dave=rows.find(r=>r.name==='A.I. Dave');
 assert.equal(ahmed.entryPaid,true);assert.equal(ahmed.entryCents,3000);assert.equal(ahmed.foodCents,1500);assert.equal(ahmed.rebuys,1);
 assert.equal(dave.entryPaid,false);assert.equal(dave.foodCents,1500);
});
test('matching receipts stay in review and never register a player as paid until confirmed',()=>{
 const model=buildRsvpChecklist(event,[payment({status:'review',payer:'AI Dave',kind:'unknown'}),payment({id:'unmatched',status:'review',payer:'Ahmed Smith'})],players);
 assert.equal(model.paid,0);assert.equal(model.expected,3);assert.equal(model.rows.find(r=>r.name==='A.I. Dave').status,'review');
 assert.equal(model.unmatched.length,1);assert.equal(model.rows.find(r=>r.name==='Ahmed').pending.length,0);
});
test('cashier-assigned player wins over payer; voids, deletions, linked and ignored receipts do not keep an RSVP paid',()=>{
 const p=payment({payer:'Ahmed',player:'Bob'});
 let model=buildRsvpChecklist(event,[p],players);assert.equal(model.rows.find(r=>r.name==='Bob').entryPaid,true);assert.equal(model.rows.find(r=>r.name==='Ahmed').entryPaid,false);
 for(const rows of [[],...['void','linked','ignored'].map(status=>[{...p,status}])])assert.equal(buildRsvpChecklist(event,rows,players).paid,0);
});
test('another event or unrelated ambiguous receipt cannot complete or enter the current event checklist',()=>{
 assert.equal(paymentCanBelongTo(payment({event_id:null,candidate_event_ids:JSON.stringify([event.id])}),event.id),true);
 const other=payment({event_id:'saturday:2026-10-17'}),ambiguous=payment({event_id:null,candidate_event_ids:'["saturday:2026-10-17"]',status:'review'});
 const model=buildRsvpChecklist(event,[other,ambiguous],players);assert.equal(model.paid,0);assert.equal(model.pending.length,0);
});
test('duplicate RSVP aliases and duplicate seats do not create extra registrations; uncertain aliases do not auto-match',()=>{
 const duplicate={...event,rsvps:[...event.rsvps,{player:'AI Dave',answer:'yes'}]};
 assert.equal(buildRsvpChecklist(duplicate,[],players).expected,3);
 const uncertain=[...players,{name:'Other Dave',slug:'other',aliases:['AI Dave']}];
 assert.equal(buildRsvpChecklist(event,[payment({payer:'AI Dave'})],uncertain).paid,0);
});
