import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paymentItemAmounts,paymentPortion} from '../lib/payment-portions.mjs';
import {paymentSelection} from '../lib/events.mjs';
const event={rules:{entry:5000,entryPrize:4000,bounty:1000,rebuy:3000,food:1500}};
function row(items){const a=paymentSelection(event,items);return {kind:a.kind,cents:a.cents,prize_cents:a.prize,bounty_cents:a.bounty,food_cents:a.food,item_cents:JSON.stringify(paymentItemAmounts(event,items))};}
test('existing $65 bundles show $50 for Buy-ins including bounty, $15 for Pizza, and $65 for All',()=>{
 const p={...row(['entry','food']),item_cents:null};
 assert.equal(paymentPortion(p,'entry'),5000);assert.equal(paymentPortion(p,'food'),1500);assert.equal(paymentPortion(p,'all'),6500);assert.equal(paymentPortion(p,'rebuy'),null);
 assert.equal(p.cents,6500);
});
test('rebuy and pizza filters use the original frozen amounts',()=>{
 const p={...row(['rebuy','food']),item_cents:null};
 assert.equal(paymentPortion(p,'rebuy'),3000);assert.equal(paymentPortion(p,'food'),1500);assert.equal(paymentPortion(p,'all'),4500);
});
test('entry, rebuy, and pizza retain independent amounts even when later event prices change',()=>{
 const p=row(['entry','rebuy','food']);
 assert.deepEqual(JSON.parse(p.item_cents),{entry:5000,rebuy:3000,food:1500});
 assert.deepEqual(['entry','rebuy','food','all'].map(kind=>paymentPortion(p,kind)),[5000,3000,1500,9500]);
 const changed={rules:{...event.rules,entry:6500,bounty:2500,rebuy:4000}};
 assert.equal(paymentItemAmounts(changed,['entry','rebuy','food']).entry,6500);
 assert.equal(paymentPortion(p,'entry'),5000);
});
test('single-item receipts keep their full amount and incomplete historical splits are never guessed',()=>{
 assert.equal(paymentPortion({kind:'food',cents:1500},'food'),1500);
 const p={...row(['entry','rebuy','food']),item_cents:null};
 assert.equal(paymentPortion(p,'entry'),null);assert.equal(paymentPortion(p,'rebuy'),null);assert.equal(paymentPortion(p,'food'),1500);
 assert.equal(paymentPortion({...p,food_cents:null},'food'),null);
 assert.equal(paymentPortion({...row(['entry','food']),item_cents:'{"entry":1,"food":1}'},'entry'),5000);
});
