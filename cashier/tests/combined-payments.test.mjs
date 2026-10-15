import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSchedule,applyPaymentFormat,paymentSelection,paymentKinds} from '../lib/events.mjs';
import {parseReceipt,routeReceipt,totals} from '../lib/receipt.mjs';
const events=normalizeSchedule({events:[{slot:'friday',title:'Friday',date:'Friday, October 16, 2026'},{slot:'mtt',title:'Re-Buy Hard',date:'Saturday, October 24, 2026',tables:2}]},{events:{}},Date.parse('2026-10-14T12:00:00Z'));
const mtt=events[1];
const stored=(selection,status='confirmed')=>({kind:selection.kind,cents:selection.cents,prize_cents:selection.prize,bounty_cents:selection.bounty,food_cents:selection.food,status});
test('October 24 $65 buy-in and pizza is one collection, one entry, and one pizza',()=>{
 const s=paymentSelection(mtt,['food','entry']);
 assert.deepEqual(s,{items:['entry','food'],kind:'entry+food',cents:6500,prize:4000,bounty:1000,food:1500});
 assert.deepEqual(totals([stored(s)]),{collected:6500,prizePool:4000,bounty:1000,food:1500,entries:1,rebuys:0,pizzas:1,review:0});
 assert.deepEqual(paymentKinds(s.kind),['entry','food']);
});
test('rebuy plus pizza does not add a bounty; combined allocations survive format changes',()=>{
 const row=stored(paymentSelection(mtt,['food','rebuy']));
 assert.equal(row.cents,5500);assert.equal(row.bounty_cents,0);
 const changed=applyPaymentFormat(mtt,{mode:'bounty',bounty_cents:500});
 assert.equal(paymentSelection(changed,['entry','food']).cents,6000);
 assert.deepEqual(totals([row]),{collected:5500,prizePool:4000,bounty:0,food:1500,entries:0,rebuys:1,pizzas:1,review:0});
});
test('regular and bounty formats use the configured price for every selected item',()=>{
 assert.equal(paymentSelection(events[0],['entry','food']).cents,4500);
 const bounty=applyPaymentFormat(events[0],{mode:'bounty',bounty_cents:500});
 const s=paymentSelection(bounty,['entry','food']);assert.equal(s.cents,5000);assert.equal(s.bounty,500);
 assert.equal(paymentSelection(mtt,['entry','rebuy','food']).cents,10500);
});
test('empty, duplicate, unknown, or unavailable items are rejected before saving',()=>{
 for(const items of [[],['entry','entry'],['bounty'],['entry','other'],null,'entry'])assert.throws(()=>paymentSelection(mtt,items));
 assert.throws(()=>paymentSelection({...mtt,rules:{...mtt.rules,food:0}},['food']));
 assert.throws(()=>paymentSelection({...mtt,rules:{...mtt.rules,entry:5100}},['entry']));
 for(const kind of ['entry+entry','entry+other','unknown',''])assert.deepEqual(paymentKinds(kind),[]);
});
test('review, linked, ignored, and voided combined transactions never inflate totals',()=>{
 const s=paymentSelection(mtt,['entry','food']);
 assert.deepEqual(totals([stored(s),...['linked','ignored','void','review'].map(status=>stored(s,status))]),{collected:6500,prizePool:4000,bounty:1000,food:1500,entries:1,rebuys:0,pizzas:1,review:1});
 assert.equal(totals([stored(s,'void')]).collected,0);
});
test('a $65 receipt is retained for manual item assignment without splitting or auto-crediting',()=>{
 const receipt=routeReceipt(parseReceipt({id:'combined65receipt',from:'Venmo <venmo@venmo.com>',authenticationResults:'mx.google.com; dkim=pass header.i=@venmo.com; spf=pass',subject:'Example Player paid you $65.00',body:'MTT',internalDate:String(Date.parse('2026-10-24T17:00:00Z'))}),events);
 assert.equal(receipt.eventId,mtt.id);assert.equal(receipt.cents,6500);assert.equal(receipt.kind,'unknown');
 assert.equal(paymentSelection(mtt,['entry','food']).cents,receipt.cents);
 assert.equal(totals([{...receipt,status:'review'}]).collected,0);
});
