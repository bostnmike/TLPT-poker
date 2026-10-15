import {paymentKinds,paymentSelection} from './events.mjs';
export function paymentItemAmounts(event,items){
 const selection=paymentSelection(event,items);
 return Object.fromEntries(selection.items.map(kind=>[kind,event.rules[kind]]));
}
export function paymentPortion(payment,kind){
 if(kind==='all')return payment.cents;
 const items=paymentKinds(payment.kind);if(!items.includes(kind))return null;
 try{
  const stored=JSON.parse(payment.item_cents||'null');
  if(stored&&Object.keys(stored).length===items.length&&items.every(item=>Number.isSafeInteger(stored[item])&&stored[item]>=0)&&items.reduce((sum,item)=>sum+stored[item],0)===payment.cents)return stored[kind];
 }catch{}
 if(items.length===1)return payment.cents;
 // Existing combined records already froze food, prize pool, and bounty amounts.
 const {prize_cents:prize,bounty_cents:bounty,food_cents:food}=payment;
 if(![prize,bounty,food].every(n=>Number.isSafeInteger(n)&&n>=0)||prize+bounty+food!==payment.cents)return null;
 if(kind==='food')return food;
 if(kind==='entry'&&!items.includes('rebuy'))return prize+bounty;
 if(kind==='rebuy'&&!items.includes('entry'))return prize;
 // Older entry + rebuy bundles did not store each prize contribution separately.
 return null;
}
