import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSchedule,applyPaymentFormat,allocation,checkoutUrl} from '../lib/events.mjs';
import {parseReceipt,routeReceipt,totals} from '../lib/receipt.mjs';
const base=normalizeSchedule({events:[{slot:'friday',title:'Friday',date:'2026-10-16'},{slot:'mtt',title:'MTT',date:'2026-10-24',tables:2}]},{events:{}},Date.parse('2026-10-14T12:00:00Z'));
test('$30 plus $5 bounty changes the first entry and checkout link only',()=>{
 const e=applyPaymentFormat(base[0],{mode:'bounty',bounty_cents:500});
 assert.equal(e.id,base[0].id);assert.equal(e.rules.entry,3500);assert.equal(e.rules.rebuy,3000);assert.equal(e.rules.food,1500);
 assert.deepEqual(allocation(e,'entry'),{prize:3000,bounty:500,food:0});assert.deepEqual(allocation(e,'rebuy'),{prize:3000,bounty:0,food:0});
 assert.equal(new URL(checkoutUrl(e,'entry')).searchParams.get('amount'),'35.00');assert.equal(new URL(checkoutUrl(e,'rebuy')).searchParams.get('amount'),'30.00');
 const p=parseReceipt({id:'testBountyReceipt',from:'Venmo <venmo@venmo.com>',authenticationResults:'mx.google.com; dkim=pass header.i=@venmo.com;',subject:'Test Player paid you $35.00',body:'TLPT friday 2026-10-16 entry',internalDate:String(Date.parse('2026-10-16T23:00:00Z'))});
 assert.equal(routeReceipt(p,[e]).kind,'entry');
});
test('format changes are scoped to the chosen event and reset uses the schedule',()=>{
 const friday=applyPaymentFormat(base[0],{mode:'bounty',bounty_cents:500}),mtt=applyPaymentFormat(base[1]);
 assert.equal(mtt.rules.entry,5000);assert.equal(mtt.rules.bounty,1000);
 const standard=applyPaymentFormat(base[0],{mode:'standard',bounty_cents:500});assert.equal(standard.rules.entry,3000);assert.equal(standard.rules.bounty,0);assert.equal(standard.bountyOption,500);
 assert.equal(applyPaymentFormat(base[1],{mode:'standard',bounty_cents:1000}).rules.entry,4000);
 assert.equal(applyPaymentFormat(base[0]).formatOverride,false);assert.equal(applyPaymentFormat(base[1]).paymentFormat,'bounty');
});
test('payments collected before and after toggling retain the correct money split',()=>{
 const plain=applyPaymentFormat(base[0]),bounty=applyPaymentFormat(base[0],{mode:'bounty',bounty_cents:500});
 const row=(e,kind)=>{const a=allocation(e,kind);return {status:'confirmed',kind,cents:e.rules[kind],prize_cents:a.prize,bounty_cents:a.bounty,food_cents:a.food};};
 assert.deepEqual(totals([row(plain,'entry'),row(bounty,'entry'),row(bounty,'rebuy')]),{collected:9500,prizePool:9000,bounty:500,food:0,entries:2,rebuys:1,pizzas:0,review:0});
 assert.equal(applyPaymentFormat(base[0],{mode:'bounty',bounty_cents:750}).rules.entry,3750);
 for(const o of [{mode:'other',bounty_cents:500},{mode:'bounty',bounty_cents:0},{mode:'bounty',bounty_cents:501.5},{mode:'bounty',bounty_cents:100001}])assert.throws(()=>applyPaymentFormat(base[0],o));
});
