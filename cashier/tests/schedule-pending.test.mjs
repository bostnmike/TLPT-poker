import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSchedule,refreshScheduleAttendance,stalePaymentPredicate} from '../lib/events.mjs';
import {routeReceipt} from '../lib/receipt.mjs';

const now=Date.parse('2026-10-25T17:00:00Z'),financials={events:{}};
const dated={events:[{slot:'friday',title:'Friday',date:'2026-10-30',rsvps:{red:'yes'}},{slot:'saturday',title:'Saturday',date:'2026-10-31'},{slot:'mtt',title:'Previous MTT',date:'2026-10-24',rsvps:{ahmed:'yes'}}]};
const previous=normalizeSchedule(dated,financials,now);
const pending={events:[...dated.events.slice(0,2),{slot:'mtt',title:'Next MTT',date:'Date TBD',rsvps:{ahmed:'tbd'}}]};

test('a Date TBD placeholder does not block dated slots or invent an event on first load',()=>{
 const events=normalizeSchedule(pending,financials,now);
 assert.deepEqual(events.map(e=>e.id),['friday:2026-10-30','saturday:2026-10-31']);
 assert.ok(events.every(e=>Number.isFinite(e.receiptStart)&&Number.isFinite(e.receiptEnd)));
});
test('TBD retains the previous slot identity, prices, RSVP roster and receipt window for ledger retention',()=>{
 const events=normalizeSchedule(pending,financials,now,previous),old=previous[2],kept=events[2];
 assert.deepEqual(kept,{...old,schedulePending:true});
 const retention=stalePaymentPredicate(events.map(e=>e.id));
 assert.ok(retention.values.includes(old.id),'The existing MTT must remain in the retention keep-list');
 assert.deepEqual(refreshScheduleAttendance(events,pending),events,'Repeated refreshes must not parse Date TBD or erase the saved roster');
 const receipt={cents:old.rules.entry,note:'TLPT mtt entry',receivedAt:'2026-11-01T17:00:00Z'};
 assert.equal(routeReceipt(receipt,events).rejected,'outside-active-events','Future payments cannot route into a retained old event');
});
test('Friday RSVP edits continue while MTT is TBD; a real replacement retires the old MTT normally',()=>{
 const events=normalizeSchedule(pending,financials,now,previous);
 const updated=structuredClone(pending);updated.events[0].rsvps={red:'yes',ahmed:'yes'};
 assert.deepEqual(refreshScheduleAttendance(events,updated)[0].roster,['red','ahmed']);
 const replaced=structuredClone(updated);replaced.events[2].date='2026-11-14';
 const next=normalizeSchedule(replaced,financials,now,events);
 assert.deepEqual(next.map(e=>e.id),['friday:2026-10-30','saturday:2026-10-31','mtt:2026-11-14']);
 assert.equal(next[2].schedulePending,undefined);
 assert.ok(!stalePaymentPredicate(next.map(e=>e.id)).values.includes(previous[2].id));
});
test('only explicit TBD placeholders bypass date validation; cancellation and removal retain their meaning',()=>{
 for(const date of ['TBD',' date tbd '])assert.equal(normalizeSchedule({events:[{slot:'mtt',date}]},financials,now,previous)[0].id,previous[2].id);
 for(const date of ['',null,'November someday','2026-02-30'])assert.throws(()=>normalizeSchedule({events:[{slot:'mtt',title:'Broken',date}]},financials,now,previous));
 assert.deepEqual(normalizeSchedule({events:[{slot:'mtt',date:'Date TBD',cancelled:true}]},financials,now,previous),[]);
 assert.deepEqual(normalizeSchedule({events:[]},financials,now,previous),[]);
});
