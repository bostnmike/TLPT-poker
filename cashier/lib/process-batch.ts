import {db,json} from './api';
import {getPlayers} from './player-directory';
import {batchPlan,BatchError} from './batch-payments.mjs';
export async function processBatch(input:any,event:any,actor:string,now:string){
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(input))))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const existing=async()=>db().prepare('SELECT payload_hash,result_json FROM cashier_batches WHERE id=?').bind(String(input.requestId||'')).first<{payload_hash:string;result_json:string}>();
 const replay=(saved:{payload_hash:string;result_json:string})=>saved.payload_hash===hash?json({...JSON.parse(saved.result_json),replayed:true}):json({error:'This batch was already submitted with different contents. Refresh before starting a new batch.'},409);
 const saved=await existing();if(saved)return replay(saved);
 try{
  const [payments,links,players]=await Promise.all([
   db().prepare('SELECT * FROM payments WHERE event_id=? OR event_id IS NULL').bind(event.id).all(),
   db().prepare('SELECT l.* FROM receipt_links l JOIN payments p ON p.id=l.payment_id WHERE p.event_id=?').bind(event.id).all(),getPlayers()
  ]);
  const plan=batchPlan({input,event,payments:payments.results,links:links.results,players,actor,now});
  await db().batch([
   db().prepare('INSERT INTO cashier_batches (id,event_id,payload_hash,result_json,created_at) VALUES (?,?,?,?,?)').bind(input.requestId,event.id,hash,JSON.stringify(plan.result),now),
   ...plan.steps.map((s:any)=>db().prepare(s.sql).bind(...s.values))
  ]);
  return json(plan.result);
 }catch(error){
  const completed=await existing();if(completed)return replay(completed);
  if(error instanceof BatchError)return json({error:error.message},409);
  const message=String(error);
  if(/CHECK constraint|UNIQUE constraint|FOREIGN KEY constraint/i.test(message))return json({error:'A payment changed while this batch was saving. Nothing in this batch was saved. Refresh and review it again.'},409);
  return json({error:'The batch result could not be confirmed. Retry this same batch safely; do not enter it again.'},503);
 }
}
