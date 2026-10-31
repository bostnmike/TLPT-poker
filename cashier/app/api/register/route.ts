import {env} from 'cloudflare:workers';
import {processBatch} from '@/lib/process-batch';
import {db,json,browserAuth,body} from '@/lib/api';
import {totals} from '@/lib/receipt.mjs';
import {paymentKinds,paymentSelection} from '@/lib/events.mjs';
import {paymentItemAmounts} from '@/lib/payment-portions.mjs';
import {paymentDeletionPlan} from '@/lib/deletion.mjs';
import {canClearEventHistory,eventHistoryClearPlan,HISTORY_SCOPE} from '@/lib/event-history.mjs';
import {getSchedule} from '@/lib/schedule';
import {getPlayers} from '@/lib/player-directory';
import {resolvePlayer} from '@/lib/players.mjs';
import {rememberPayerPlan} from '@/lib/venmo-aliases.mjs';
export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=browserAuth(req);if(denied)return denied;try{
 const schedule=await getSchedule(),asked=new URL(req.url).searchParams.get('eventId');
 const state:any=await db().prepare('SELECT * FROM sync_state WHERE id=?').bind('venmo').first();
 const following=new URL(req.url).searchParams.get('follow')==='true';
 const selected=schedule.events.find((e:any)=>e.id===(following?state?.active_event_id:asked))||schedule.events.filter((e:any)=>!e.savedOnly).sort((a:any,b:any)=>a.date.localeCompare(b.date))[0]||schedule.events.filter((e:any)=>e.savedOnly).sort((a:any,b:any)=>b.date.localeCompare(a.date))[0]||null;
 const revision:any=await db().prepare('SELECT revision,history_revision FROM register_revision WHERE id=1').first();
 const etag=JSON.stringify(String(revision?.revision||0)+'-'+(selected?.id||'none'));
 if(req.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{ETag:etag,'Cache-Control':'private, no-store'}});
 const rows=selected?(await db().prepare('SELECT * FROM payments WHERE event_id=? OR event_id IS NULL ORDER BY received_at DESC,created_at DESC LIMIT 2000').bind(selected.id).all()).results:[];
 const venmoAliases=(await db().prepare('SELECT payer_key,payer_name,player_slug,player_name,updated_at FROM venmo_player_aliases ORDER BY payer_name').all()).results;
 const receiptLinks=(await db().prepare('SELECT l.* FROM receipt_links l JOIN payments p ON p.id=l.payment_id WHERE p.event_id=?').bind(selected?.id||'').all()).results;
 const historyCount:any=selected?await db().prepare(`SELECT COUNT(*) AS records FROM payments WHERE ${HISTORY_SCOPE}`).bind(selected.id,selected.id).first():null;
 const result=json({environment:env.CASHIER_ENV,receiptLinks,venmoAliases,events:schedule.events,selectedEventId:selected?.id||null,payments:rows,totals:totals(rows.filter((p:any)=>p.event_id===selected?.id)),clearHistory:{eligible:canClearEventHistory(selected),revision:revision?.history_revision||0,records:historyCount?.records||0},sync:state,scheduleCheckedAt:schedule.checkedAt,scheduleError:schedule.error,serverAt:new Date().toISOString()});result.headers.set('ETag',etag);return result;
 }catch{return json({error:'Could not load the register or live schedule. Saved records remain intact.'},503);}}
export async function POST(req:Request){const denied=browserAuth(req,true);if(denied)return denied;try{
 const input=await body(req),now=new Date().toISOString(),actor=req.headers.get('x-tlpt-authenticated-user-id')!,schedule=await getSchedule();
 const event=schedule.events.find((e:any)=>e.id===input.eventId);if(!event)return json({error:'This event has been replaced in the schedule. Reopen the current tab.'},409);
 if(input.action==='clear-history'){
  let plan;try{plan=eventHistoryClearPlan({event,expectedRevision:input.expectedRevision,confirmationDate:input.confirmationDate,checked:input.checked,requestId:crypto.randomUUID()});}catch(error){return json({error:error instanceof Error?error.message:'Confirm the past MTT to clear.'},400);}
  try{await db().batch(plan.map((s:any)=>db().prepare(s.sql).bind(...s.values)));}catch{return json({error:'The ledger changed or clearing could not be confirmed. Refresh and review the event again before retrying.'},409);}
  return json({ok:true,eventId:event.id,historyCleared:true});
 }
 if(event.historyClearedAt&& !['select','forget-alias'].includes(input.action))return json({error:'History for this event has been cleared and the event is closed. Use a newly dated event for new payments.'},409);
 if(event.savedOnly&&(input.action==='manual'||input.action==='format'||(input.action==='batch'&&input.groups?.some((g:any)=>g.action==='manual'))))return json({error:'This is saved payment history, not an active game. Choose a current game to record new payments.'},409);
 if(input.action==='batch')return processBatch(input,event,actor,now);
 if(input.action==='forget-alias'){
  if(typeof input.payerKey!=='string'||!input.payerKey||input.payerKey.length>200)return json({error:'Choose a remembered Venmo name.'},400);
  await db().prepare('DELETE FROM venmo_player_aliases WHERE payer_key=?').bind(input.payerKey).run();return json({ok:true});
 }
 if(input.action==='select'){await db().prepare('INSERT INTO sync_state (id,last_check,matched,rejected,active_event_id) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET active_event_id=excluded.active_event_id').bind('venmo','',0,0,event.id).run();return json({ok:true,eventId:event.id});}
 if(input.action==='format'){
  if(!['standard','bounty','scheduled'].includes(input.mode))return json({error:'Choose a payment format.'},400);
  if(input.mode==='scheduled')await db().prepare('DELETE FROM event_payment_formats WHERE event_id=?').bind(event.id).run();
  else{
   if(!Number.isSafeInteger(input.bountyCents)||input.bountyCents<1||input.bountyCents>100000)return json({error:'Enter a bounty between $0.01 and $1,000.'},400);
   await db().prepare('INSERT INTO event_payment_formats (event_id,mode,bounty_cents,updated_at,actor) VALUES (?,?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET mode=excluded.mode,bounty_cents=excluded.bounty_cents,updated_at=excluded.updated_at,actor=excluded.actor').bind(event.id,input.mode,input.bountyCents,now,actor).run();
  }
  return json({ok:true,eventId:event.id});
 }
 if(input.action==='delete'){
  if(!input.checked||typeof input.id!=='string'||typeof input.expectedUpdatedAt!=='string')return json({error:'Confirm the transaction you want to permanently delete.'},400);
  const p:any=await db().prepare('SELECT * FROM payments WHERE id=?').bind(input.id).first();
  if(!p)return json({error:'This transaction is no longer in the register. Close this window and refresh.'},409);
  if(p.event_id?p.event_id!==event.id:!JSON.parse(p.candidate_event_ids||'[]').includes(event.id))return json({error:'This transaction belongs to another event.'},409);
  if(p.updated_at!==input.expectedUpdatedAt)return json({error:'This transaction changed. Close this window and review the latest record before deleting.'},409);
  const deletion=paymentDeletionPlan(p);
  const results=await db().batch(deletion.map((step:any)=>db().prepare(step.sql).bind(...step.values)));
  if(!results[deletion.findIndex((step:any)=>step.primary)]?.meta.changes)return json({error:'This transaction changed. Refresh the register before deleting.'},409);
  return json({ok:true,eventId:event.id,deleted:true});
 }
 const player=String(input.player||'').trim();
 if(!['manual','confirm','link','ignore','void'].includes(input.action))return json({error:'Unknown action'},400);
 if(!player||player.length>100||!/^[\w-]{20,80}$/.test(input.requestId||''))return json({error:'Choose a player and reopen the payment form.'},400);
 let selection:ReturnType<typeof paymentSelection>|null=null;
 if(['manual','confirm'].includes(input.action)){
  try{selection=paymentSelection(event,input.items===undefined?paymentKinds(input.kind):input.items);}catch{return json({error:'Select one or more available payment items.'},400);}
 }
 if(input.action==='manual'){
  const a=selection!;
  if(input.cents!==a.cents)return json({error:'The event price changed. Reopen the payment form.'},409);
  if(!['cash','venmo'].includes(input.method)||!input.checked)return json({error:'Verify payment and choose a method.'},400);
  const id=crypto.randomUUID(),sourceId=`manual:${input.requestId}`;
  if(await db().prepare('SELECT source_id FROM deleted_payment_sources WHERE source_id=?').bind(sourceId).first())return json({error:'This transaction was deleted. Open a new payment form to record a new payment.'},409);
  await db().batch([
   db().prepare('INSERT OR IGNORE INTO payments (id,source_id,event_id,candidate_event_ids,payer,player,cents,kind,status,method,note,received_at,created_at,updated_at,prize_cents,bounty_cents,food_cents,item_cents) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM deleted_payment_sources WHERE source_id=?)').bind(id,sourceId,event.id,'[]',player,player,a.cents,a.kind,'confirmed',input.method,'Cashier verified',now,now,now,a.prize,a.bounty,a.food,JSON.stringify(paymentItemAmounts(event,a.items)),sourceId),
   db().prepare('INSERT INTO audit (id,payment_id,action,actor,details,at) SELECT ?,id,?,?,?,? FROM payments WHERE id=?').bind(crypto.randomUUID(),'manual',actor,JSON.stringify({eventId:event.id,player,items:a.items,kind:a.kind,cents:a.cents,method:input.method}),now,id)
  ]);return json({ok:true,eventId:event.id});
 }
 const p:any=await db().prepare('SELECT * FROM payments WHERE id=?').bind(String(input.id)).first();
 if(!p)return json({error:'This payment is no longer active.'},409);
 if(p.event_id&&p.event_id!==event.id)return json({error:'This payment belongs to another event.'},409);
 if(!p.event_id&&!JSON.parse(p.candidate_event_ids||'[]').includes(event.id))return json({error:'Select one of this receipt’s possible events.'},400);
 async function aliasPlan(name:string){
  if(input.rememberPayer!==true)return null;
  const profile=resolvePlayer({player:name},await getPlayers());
  return rememberPayerPlan(p,profile,actor,now);
 }
 if(input.action==='link'){
  const target:any=await db().prepare('SELECT * FROM payments WHERE id=?').bind(String(input.linkId)).first();
  if(!input.checked||p.status!=='review'||!target||target.event_id!==event.id||target.status!=='confirmed'||target.method!=='venmo'||!String(target.source_id).startsWith('manual:')||p.cents!==target.cents)return json({error:'Choose a manual Venmo record from this event with the same amount.'},400);
  return processBatch({action:'batch',eventId:event.id,requestId:input.requestId,checked:input.checked,groups:[{id:input.requestId,action:'link',paymentId:p.id,expectedUpdatedAt:p.updated_at,rememberPayer:input.rememberPayer===true,targets:[{paymentId:target.id,cents:target.cents,expectedUpdatedAt:target.updated_at}]}]},event,actor,now);
 }
 if(['confirm','ignore','void'].includes(input.action)){
  const expected=input.action==='void'?'confirmed':'review';if(p.status!==expected)return json({error:'This payment has already been handled.'},409);
  if(input.action==='confirm'&&(p.cents!==selection!.cents||!input.checked))return json({error:'Verify receipt in Venmo; the selected items must match the full payment amount.'},400);
  if(input.action==='void'&&!input.checked)return json({error:'Confirm the correction.'},400);
  const status=input.action==='confirm'?'confirmed':input.action==='void'?'void':'ignored';
  const remembered=input.action==='confirm'?await aliasPlan(player):null;
  if(input.action==='confirm'&&input.rememberPayer===true&&!remembered)return json({error:'Choose a TLPT player to remember this Venmo name.'},400);
  const auditId=crypto.randomUUID(),a=selection;
  const kind=a?.kind||p.kind,cents=p.cents;
  const results=await db().batch([
   ...(remembered?[db().prepare(remembered.sql).bind(...remembered.values)]:[]),
   db().prepare('INSERT INTO audit (id,payment_id,action,actor,details,at) SELECT ?,id,?,?,?,? FROM payments WHERE id=? AND status=?').bind(auditId,status,actor,JSON.stringify({eventId:event.id,player,kind,items:paymentKinds(kind),cents,previous:p.status}),now,p.id,expected),
   db().prepare('UPDATE payments SET event_id=?,player=?,kind=?,status=?,updated_at=?,prize_cents=?,bounty_cents=?,food_cents=?,item_cents=? WHERE id=? AND status=?').bind(event.id,player,kind,status,now,a?a.prize:p.prize_cents,a?a.bounty:p.bounty_cents,a?a.food:p.food_cents,a?JSON.stringify(paymentItemAmounts(event,a.items)):p.item_cents,p.id,expected)
  ]);if(!results.at(-1)?.meta.changes)return json({error:'This payment changed. Reopen it before saving.'},409);return json({ok:true,eventId:event.id,remembered:!!remembered});
 }
 return json({error:'Unknown action'},400);
 }catch{return json({error:'Payment could not be saved. Check the register before retrying.'},503);}}
