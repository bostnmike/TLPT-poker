import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currentEventSlots,applyPaymentFormat,reusableCheckoutUrl} from '../lib/events.mjs';
import {validateLiveRsvps,overlayLiveRsvps} from '../lib/live-rsvp.mjs';
import {livePaymentSchedule,receiptSchedule} from '../lib/live-payment-schedule.mjs';
import {parseReceipt,routeReceipt} from '../lib/receipt.mjs';
import {canClearEventHistory} from '../lib/event-history.mjs';
const now=Date.parse('2026-10-31T17:00:00Z'),financials={events:{}};
const sunday={id:'stable-sunday-id',slot:'sunday',day:'Sunday',title:'Sunday 50K',date:'2026-11-08',format:'50K Format',tables:1,startingStack:50000,blindStructure:'40k',capacity:9,rsvpOpen:false,rsvps:{bostnmike:'yes',ahmed:'maybe'},waitlist:[{slug:'ahmed',position:1}]};
const friday={id:'friday-id',slot:'friday',title:'Friday',date:'2026-11-06',tables:1,rsvpOpen:true,rsvps:{},waitlist:[]};
const feed=(open=false)=>({schemaVersion:1,revision:1,events:[friday,{...sunday,rsvpOpen:open}]});
const mail=note=>({id:'Sunday_Receipt_123',from:'Venmo <venmo@venmo.com>',authenticationResults:'mx.google.com; dkim=pass header.i=@venmo.com',subject:'Test Player paid you $30.00',body:note,internalDate:String(Date.parse('2026-11-08T18:00:00Z'))});
test('absent or closed Sunday stays off without invalidating the rest of the public feed',()=>{
 assert.equal(validateLiveRsvps(feed()).events.length,2);
 const events=livePaymentSchedule(feed(),financials,[],[],now);
 assert.deepEqual(events.map(e=>e.id),['friday:2026-11-06']);
 assert.deepEqual(currentEventSlots(events),['friday','saturday','mtt']);
 assert.deepEqual(currentEventSlots(),['friday','saturday','mtt']);
});
test('explicitly open Sunday is a stable single-table 50K event with regular payment defaults',()=>{
 const events=livePaymentSchedule(feed(true),financials,[],[],now),e=events.find(e=>e.slot==='sunday');
 assert.equal(e.id,'sunday:2026-11-08');assert.equal(e.liveEventId,sunday.id);assert.equal(e.tables,1);assert.equal(e.capacity,9);
 assert.equal(e.startingStack,50000);assert.equal(e.format,'50K Format');assert.equal(e.blindStructure,'40k');
 assert.deepEqual(e.rules,{entry:3000,rebuy:3000,food:1500,entryPrize:3000,bounty:0});
 assert.deepEqual(currentEventSlots(events),['friday','saturday','sunday','mtt']);
 const attendance=overlayLiveRsvps(events,feed(true)).find(e=>e.slot==='sunday');assert.deepEqual(attendance.roster,['bostnmike']);assert.equal(attendance.rsvpWaitlist[0].slug,'ahmed');
 assert.equal(applyPaymentFormat(e,{mode:'bounty',bounty_cents:500}).rules.entry,3500);
});
test('closing or canceling Sunday hides its current tab and intake but keeps the original ledger identity',()=>{
 const opened=livePaymentSchedule(feed(true),financials,[],[],now),id='sunday:2026-11-08',original=structuredClone(opened);
 const closed=livePaymentSchedule(feed(false),financials,opened,[id],now),saved=closed.find(e=>e.id===id);
 assert.ok(saved.savedOnly);assert.deepEqual(saved.rules,opened.find(e=>e.id===id).rules);assert.equal(saved.liveEventId,sunday.id);
 assert.ok(!currentEventSlots(closed).includes('sunday'));assert.ok(!receiptSchedule(closed,now).some(e=>e.id===id));
 const reopened=livePaymentSchedule(feed(true),financials,closed,[id],now);assert.equal(reopened.find(e=>e.slot==='sunday').id,id);assert.ok(!reopened.find(e=>e.slot==='sunday').savedOnly);
 const canceled=livePaymentSchedule({...feed(),events:[friday],cancelledEvents:[{id:sunday.id,date:sunday.date}]},financials,opened,[id],Date.parse('2026-11-10T12:00:00Z'));
 assert.ok(!receiptSchedule(canceled,Date.parse('2026-11-10T12:00:00Z')).some(e=>e.id===id));assert.deepEqual(opened,original);
});
test('Sunday dated and reusable notes route only to the Sunday ledger, including Saturday overnight overlap',()=>{
 const events=livePaymentSchedule(feed(true),financials,[],[],now);
 for(const note of ['TLPT sunday 2026-11-08 entry','TLPT sunday entry']){const p=routeReceipt(parseReceipt(mail(note)),events);assert.equal(p.eventId,'sunday:2026-11-08');assert.equal(p.kind,'entry');}
 const url=new URL(reusableCheckoutUrl('sunday','entry',3000));assert.equal(url.searchParams.get('note'),'TLPT sunday entry');
 const other={...friday,id:'sat-id',slot:'saturday',date:'2026-11-07'};
 const overlap=livePaymentSchedule({...feed(true),events:[other,{...sunday,rsvpOpen:true}]},financials,[],[],now);
 const receipt={...mail('TLPT sunday food'),subject:'Test Player paid you $15.00',internalDate:String(Date.parse('2026-11-08T05:30:00Z'))};
 assert.equal(routeReceipt(parseReceipt(receipt),overlap).eventId,'sunday:2026-11-08');
 assert.equal(canClearEventHistory(events.find(e=>e.slot==='sunday'),Date.parse('2026-11-09T11:00:00Z')),true);
});
test('invalid multi-table or over-capacity Sunday cannot silently become an MTT',()=>{
 for(const extra of [{tables:2},{capacity:10}])assert.throws(()=>validateLiveRsvps({...feed(),events:[{...sunday,...extra}]}));
});
