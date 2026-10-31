import {test} from 'node:test';
import assert from 'node:assert/strict';
import {livePaymentSchedule,receiptSchedule} from '../lib/live-payment-schedule.mjs';
import {normalizeSchedule} from '../lib/events.mjs';
const now=Date.parse('2026-10-31T17:00:00Z'),financials={events:{}};
const game=(id,slot,date,extra={})=>({id,slot,date,title:id,rsvpOpen:true,rsvps:{bostnmike:'yes'},waitlist:[],...extra});
const feed={schemaVersion:1,revision:140,cancelledEvents:[{id:'friday-2026-10-30',date:'2026-10-30'}],events:[game('fri-new','friday','2026-11-06'),game('sat-new','saturday','2026-11-07'),game('later','friday','2026-11-13',{rsvpOpen:false}),game('saturday-2026-10-31','friday','2026-12-11',{rsvpOpen:false}),game('mtt-pending','mtt','Date TBD',{rsvpOpen:false})]};
const previous=normalizeSchedule({events:[{slot:'friday',date:'2026-10-30',title:'Past Friday'},{slot:'saturday',date:'2026-10-31',title:'Removed Saturday'},{slot:'mtt',date:'2026-10-24',title:'Past MTT'}]},financials,now);
test('live open dates replace the static schedule, ignoring closed, canceled, moved and undated games',()=>{
 const events=livePaymentSchedule(feed,financials,previous,[],now);
 assert.deepEqual(events.map(e=>e.id),['friday:2026-11-06','saturday:2026-11-07']);
 assert.deepEqual(events.map(e=>e.rules.entry),[3000,3000]);assert.equal(events[0].liveEventId,'fri-new');
});
test('schedule changes retain dated ledgers separately without moving their identities, rules or receipts',()=>{
 const events=livePaymentSchedule(feed,financials,previous,previous.map(e=>e.id),now);
 assert.equal(events.length,5);const old=events.find(e=>e.id===previous[2].id);assert.ok(old.savedOnly);assert.deepEqual(old.rules,previous[2].rules);assert.equal(old.receiptStart,previous[2].receiptStart);
 const intake=receiptSchedule(events,now).map(e=>e.id);
 assert.ok(!intake.includes('saturday:2026-10-31'));assert.ok(!intake.includes('friday:2026-10-30'));assert.ok(intake.includes('mtt:2026-10-24'));
 assert.ok(!receiptSchedule(events.map(e=>({...e,historyClearedAt:'cleared'})),now).length);
});
test('RSVP-only edits keep payment identity and prices; published financials and same-event format choices remain scoped',()=>{
 const changed=structuredClone(feed);changed.events[0].rsvps.red='yes';changed.events[0].title='Edited title';
 const priced=livePaymentSchedule(changed,{events:{'2026-11-06':{entryAmount:30,bounty:{amount:5},foodAmount:10}}},[],[],now);
 assert.equal(priced[0].id,'friday:2026-11-06');assert.equal(priced[0].title,'Edited title');assert.equal(priced[0].rules.entry,3500);assert.equal(priced[0].rules.food,1000);
});
test('an unavailable or invalid live feed cannot fall back to old static active dates',()=>{
 assert.throws(()=>livePaymentSchedule({},financials,previous,[],now));
 const empty=livePaymentSchedule({...feed,events:[]},financials,previous,[previous[2].id],now);assert.equal(empty.length,1);assert.ok(empty[0].savedOnly);
});
