import {paymentSelection} from './events.mjs';
import {paymentItemAmounts} from './payment-portions.mjs';
import {paymentDeletionPlan} from './deletion.mjs';
import {rememberPayerPlan,payerKey} from './venmo-aliases.mjs';
import {resolvePlayer} from './players.mjs';
export const MAX_BATCH_GROUPS=30,MAX_BATCH_PLAYERS=80;
const idPattern=/^[\w-]{20,80}$/;
export class BatchError extends Error {}
export function remainingCoverage(payment,links){return payment.cents-links.filter(l=>l.payment_id===payment.id).reduce((sum,l)=>sum+l.cents,0);}
export function batchPlan({input,event,payments,links,players,actor,now,uuid=()=>crypto.randomUUID()}){
 const fail=message=>{throw new BatchError(message);};
 if(!idPattern.test(input.requestId||'')||input.checked!==true)fail('Review and verify every selected payment before saving the batch.');
 if(!Array.isArray(input.groups)||!input.groups.length||input.groups.length>MAX_BATCH_GROUPS)fail('Choose between 1 and 30 payment groups.');
 if(input.groups.some(g=>g?.action==='delete')&&input.deleteAcknowledged!==true)fail('Confirm permanent deletion of the selected transactions.');
 const rows=new Map(payments.map(p=>[p.id,p])),used=new Set(),allocated=new Map(),guards=[],writes=[],remembered=new Map();let people=0;
 const result={ok:true,eventId:event.id,addedCents:0,removedCents:0,manualRecords:0,confirmedReceipts:0,linkedReceipts:0,excluded:0,voided:0,deleted:0,remembered:false};
 const step=(sql,...values)=>({sql,values});
 const guard=(sql,values=[])=>guards.push(step(`INSERT INTO cashier_batch_checks (id,batch_id,ok) SELECT ?,?,CASE WHEN (${sql}) THEN 1 ELSE 0 END`,uuid(),input.requestId,...values));
 const audit=(id,action,details)=>writes.push(step('INSERT INTO audit (id,payment_id,action,actor,details,at) VALUES (?,?,?,?,?,?)',uuid(),id,action,actor,JSON.stringify({...details,batchId:input.requestId}),now));
 function snapshot(id,expected){
  const p=rows.get(id);if(!p||p.event_id&&p.event_id!==event.id||!p.event_id&&!JSON.parse(p.candidate_event_ids||'[]').includes(event.id))fail('A selected payment is no longer in this event. Refresh and review the batch.');
  if(typeof expected!=='string'||expected!==p.updated_at)fail('A selected payment changed. Refresh and review the batch.');
  guard('EXISTS(SELECT 1 FROM payments WHERE id=? AND updated_at=? AND status=?)',[p.id,p.updated_at,p.status]);return p;
 }
 function allocations(group){
  if(!Array.isArray(group.allocations)||!group.allocations.length)fail('Add at least one player to each new payment.');
  people+=group.allocations.length;if(people>MAX_BATCH_PLAYERS)fail('A batch can include up to 80 player allocations.');
  return group.allocations.map(row=>{
   if(!idPattern.test(row.id||'')||used.has('row:'+row.id))fail('A player row was repeated. Reopen the batch.');used.add('row:'+row.id);
   const player=String(row.player||'').trim();if(!player||player.length>100)fail('Choose a player for every allocation.');
   let a;try{a=paymentSelection(event,row.items);}catch{fail('Choose available payment items for every player.');}
   if(row.cents!==a.cents)fail('An event price changed. Refresh and review the batch.');
   return {...a,id:row.id,player,method:row.method,itemCents:JSON.stringify(paymentItemAmounts(event,a.items))};
  });
 }
 function addPayment(a,method,payer,receivedAt,note){
  const source='manual:'+a.id;
  guard('NOT EXISTS(SELECT 1 FROM payments WHERE source_id=?) AND NOT EXISTS(SELECT 1 FROM deleted_payment_sources WHERE source_id=?)',[source,source]);
  writes.push(step('INSERT INTO payments (id,source_id,event_id,candidate_event_ids,payer,player,cents,kind,status,method,note,received_at,created_at,updated_at,prize_cents,bounty_cents,food_cents,item_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',a.id,source,event.id,'[]',payer||a.player,a.player,a.cents,a.kind,'confirmed',method,note,receivedAt,now,now,a.prize,a.bounty,a.food,a.itemCents));
  audit(a.id,'manual',{player:a.player,cents:a.cents,items:a.items,method});result.addedCents+=a.cents;
 }
 function remember(p,group,names){
  if(group.rememberPayer!==true)return;
  const unique=[...new Set(names)];if(unique.length!==1)fail('Do not remember one Venmo payer as several different players.');
  const profile=resolvePlayer({player:unique[0]},players),plan=rememberPayerPlan(p,profile,actor,now);
  if(!plan)fail('Choose a TLPT player before remembering a Venmo name.');
  const key=payerKey(p.payer);if(remembered.has(key)&&remembered.get(key)!==profile.slug)fail('This batch assigns the same Venmo name to different players.');
  remembered.set(key,profile.slug);writes.push(plan);
 }
 for(const group of input.groups){
  if(!group||!idPattern.test(group.id||'')||used.has('group:'+group.id))fail('A payment group was repeated.');used.add('group:'+group.id);
  if(group.action==='manual'){
   if(!['cash','venmo'].includes(group.method))fail('Choose Cash or Venmo for every manual payment.');
   for(const a of allocations(group)){const method=a.method||group.method;if(!['cash','venmo'].includes(method))fail('Choose Cash or Venmo for every player.');addPayment(a,method,String(group.payer||'').trim().slice(0,100),now,'Cashier batch verified');result.manualRecords++;}continue;
  }
  if(used.has('payment:'+group.paymentId))fail('The same payment cannot be handled twice in a batch.');used.add('payment:'+group.paymentId);
  const p=snapshot(group.paymentId,group.expectedUpdatedAt);
  if(['confirm','link','ignore'].includes(group.action)&&p.status!=='review')fail('A receipt was already handled. Refresh and review the batch.');
  if(group.action==='confirm'){
   const list=allocations(group);if(list.reduce((sum,a)=>sum+a.cents,0)!==p.cents)fail('Player allocations must equal the entire receipt amount.');
   remember(p,group,list.map(a=>a.player));
   if(list.length===1){const a=list[0];writes.push(step('UPDATE payments SET event_id=?,player=?,kind=?,status=\'confirmed\',updated_at=?,prize_cents=?,bounty_cents=?,food_cents=?,item_cents=? WHERE id=?',event.id,a.player,a.kind,now,a.prize,a.bounty,a.food,a.itemCents,p.id));result.addedCents+=p.cents;}
   else{
    for(const a of list){addPayment(a,'venmo',p.payer,p.received_at,'Allocated from Venmo receipt '+p.id);writes.push(step('INSERT INTO receipt_links (receipt_id,payment_id,cents) VALUES (?,?,?)',p.id,a.id,a.cents));}
    writes.push(step('UPDATE payments SET event_id=?,status=\'linked\',updated_at=?,player=?,note=? WHERE id=?',event.id,now,list.map(a=>a.player).join(', ').slice(0,100),'Allocated to '+list.length+' players',p.id));
   }
   audit(p.id,'confirmed',{allocations:list.map(a=>({player:a.player,cents:a.cents,items:a.items}))});result.confirmedReceipts++;
  }else if(group.action==='link'){
   if(!Array.isArray(group.targets)||!group.targets.length||group.targets.length>MAX_BATCH_PLAYERS)fail('Choose recorded payments to match this receipt.');
   people+=group.targets.length;if(people>MAX_BATCH_PLAYERS)fail('A batch can include up to 80 player allocations or receipt matches.');
   const targetIds=new Set(),names=[];let sum=0;
   for(const target of group.targets){
    if(targetIds.has(target.paymentId))fail('A recorded payment was repeated in one receipt.');targetIds.add(target.paymentId);
    const t=snapshot(target.paymentId,target.expectedUpdatedAt);
    if(t.status!=='confirmed'||t.method!=='venmo'||!t.source_id.startsWith('manual:'))fail('Receipts can only match confirmed manual Venmo payments.');
    if(!Number.isSafeInteger(target.cents)||target.cents<=0)fail('Enter a positive amount for each receipt match.');
    const amount=(allocated.get(t.id)||0)+target.cents;if(amount>remainingCoverage(t,links))fail('A recorded payment is already covered by another receipt.');allocated.set(t.id,amount);
    if(used.has('payment:'+t.id))fail('Do not change or delete a payment while matching it in the same batch.');
    names.push(t.player);sum+=target.cents;writes.push(step('INSERT INTO receipt_links (receipt_id,payment_id,cents) VALUES (?,?,?)',p.id,t.id,target.cents));
   }
   if(sum!==p.cents)fail('Matched amounts must equal the entire receipt amount.');remember(p,group,names);
   writes.push(step('UPDATE payments SET event_id=?,status=\'linked\',player=?,updated_at=?,note=? WHERE id=?',event.id,names.join(', ').slice(0,100),now,'Matched to recorded payment(s)',p.id));
   audit(p.id,'linked',{targets:group.targets});result.linkedReceipts++;
  }else if(group.action==='ignore'||group.action==='void'){
   if(group.action==='void'&&p.status!=='confirmed')fail('Only confirmed payments can be voided.');
   if(allocated.has(p.id))fail('Do not change a payment while matching it in the same batch.');
   writes.push(step('UPDATE payments SET event_id=?,status=?,updated_at=? WHERE id=?',event.id,group.action==='void'?'void':'ignored',now,p.id));audit(p.id,group.action,{cents:p.cents});
   if(group.action==='void'){result.voided++;result.removedCents+=p.cents;}else result.excluded++;
  }else if(group.action==='delete'){
   if(!['review','confirmed','void','ignored'].includes(p.status)||allocated.has(p.id))fail('This transaction cannot be deleted in this batch.');
   writes.push(...paymentDeletionPlan(p));result.deleted++;if(p.status==='confirmed')result.removedCents+=p.cents;
  }else fail('Choose an action for every payment group.');
 }
 for(const [id] of allocated){
  if(used.has('payment:'+id))fail('Do not change a payment while matching it in the same batch.');
  const p=rows.get(id);guard('COALESCE((SELECT SUM(cents) FROM receipt_links WHERE payment_id=?),0)=?',[id,p.cents-remainingCoverage(p,links)]);
  writes.push(step('UPDATE payments SET updated_at=? WHERE id=?',now,id));
 }
 result.remembered=remembered.size>0;
 return {steps:[...guards,...writes,step('DELETE FROM cashier_batch_checks WHERE batch_id=?',input.requestId)],result};
}
