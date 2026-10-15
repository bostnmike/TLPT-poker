import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSchedule,applyPaymentFormat,reusableCheckoutUrl} from '../lib/events.mjs';
import {parseReceipt,routeReceipt} from '../lib/receipt.mjs';
const when=Date.parse('2026-10-14T17:00:00Z');
function schedule(friday='2026-10-16',saturday='2026-10-17'){
 return normalizeSchedule({events:[{slot:'friday',date:friday,title:'Friday'},{slot:'saturday',date:saturday,title:'Saturday'},{slot:'mtt',date:saturday,title:'MTT',tables:2}]},{events:{}},when);
}
function payment(note,cents,at){return parseReceipt({id:'reusableReceipt123',from:'Venmo <venmo@venmo.com>',authenticationResults:'mx.google.com; dkim=pass header.i=@venmo.com;',subject:`Test Player paid you $${(cents/100).toFixed(2)}`,body:'Payment received\n'+note+'\nThanks',internalDate:String(Date.parse(at))});}
test('reusable QR links omit dates and identify first-entry versus rebuy at the same $30 price',()=>{
 for(const slot of ['friday','saturday'])for(const cents of [3000,3500]){const url=new URL(reusableCheckoutUrl(slot,'entry',cents));assert.equal(url.pathname,'/BostnMike');assert.equal(url.searchParams.get('amount'),(cents/100).toFixed(2));assert.equal(url.searchParams.get('note'),`TLPT ${slot} entry`);assert.ok(!url.href.includes('2026'));}
 const events=schedule();assert.equal(routeReceipt(payment('TLPT friday entry',3000,'2026-10-16T23:00:00Z'),events).kind,'entry');assert.equal(routeReceipt(payment('TLPT friday rebuy',3000,'2026-10-16T23:00:00Z'),events).kind,'rebuy');
});
test('the same note routes correctly after Friday is replaced without reassigning last week’s receipt',()=>{
 const old=payment('TLPT friday entry',3000,'2026-10-16T23:00:00Z');const next=schedule('2026-10-23','2026-10-24');
 assert.equal(routeReceipt(old,next).rejected,'outside-active-events');assert.equal(routeReceipt(payment('TLPT friday entry',3000,'2026-10-23T23:00:00Z'),next).eventId,'friday:2026-10-23');
});
test('slot-specific notes disambiguate overnight and same-day regular/MTT payments',()=>{
 const events=schedule();const overnight='2026-10-17T05:00:00Z';
 assert.equal(routeReceipt(payment('TLPT friday food',1500,overnight),events).eventId,'friday:2026-10-16');assert.equal(routeReceipt(payment('TLPT saturday food',1500,overnight),events).eventId,'saturday:2026-10-17');assert.equal(routeReceipt(payment('TLPT mtt food',1500,overnight),events).eventId,'mtt:2026-10-17');
 assert.equal(routeReceipt(payment('TLPT friday entry',3000,'2026-10-17T10:00:00Z'),events).rejected,'outside-active-events');
});
test('bounty poster needs the configured $35 amount and does not become a $30 rebuy',()=>{
 const events=schedule();events[0]=applyPaymentFormat(events[0],{mode:'bounty',bounty_cents:500});
 assert.equal(routeReceipt(payment('TLPT friday entry',3500,'2026-10-16T23:00:00Z'),events).kind,'entry');
 assert.equal(routeReceipt(payment('TLPT friday entry',3000,'2026-10-16T23:00:00Z'),events).kind,'unknown');
 assert.equal(routeReceipt(payment('TLPT friday rebuy',3000,'2026-10-16T23:00:00Z'),events).kind,'rebuy');
 assert.equal(routeReceipt(payment('TLPT friday entry',3500,'2026-10-15T23:00:00Z'),events).rejected,'outside-active-events');
});
