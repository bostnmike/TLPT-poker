import {db} from './api';
import {normalizeSchedule,refreshScheduleAttendance,stalePaymentPredicate,applyPaymentFormat,SCHEDULE_URL,FINANCIALS_URL} from './events.mjs';
export async function getSchedule(force=false):Promise<any>{
 const schedule=await getBaseSchedule(force);
 const overrides=(await db().prepare('SELECT event_id,mode,bounty_cents FROM event_payment_formats').all()).results;
 return {...schedule,events:schedule.events.map((e:any)=>applyPaymentFormat(e,overrides.find((o:any)=>o.event_id===e.id)))};
}
async function getBaseSchedule(force=false):Promise<any>{
 const state:any=await db().prepare('SELECT * FROM schedule_state WHERE id=?').bind('schedule').first();
 const now=Date.now();
 if(!force&&state&&JSON.parse(state.events_json).every((e:any)=>Array.isArray(e.rsvps))&&now-Date.parse(state.attempted_at)<60000)return {events:JSON.parse(state.events_json),checkedAt:state.fetched_at,error:state.error};
 try{
  const responses=await Promise.all([fetch(SCHEDULE_URL,{cache:'no-store',signal:AbortSignal.timeout(8000)}),fetch(FINANCIALS_URL,{cache:'no-store',signal:AbortSignal.timeout(8000)})]);
  if(responses.some(r=>!r.ok))throw Error('Schedule source unavailable');
  const bodies=await Promise.all(responses.map(r=>r.text()));if(bodies.some(s=>s.length>500000))throw Error('Schedule source too large');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bodies.join('\n'))))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const source=JSON.parse(bodies[0]),parsed=normalizeSchedule(source,JSON.parse(bodies[1]),now,state?JSON.parse(state.events_json):[]);
  // Selection rolls only after the published JSON changes, never solely with time.
  const events=state?.source_hash===hash?refreshScheduleAttendance(JSON.parse(state.events_json),source):parsed;
  const at=new Date(now).toISOString(),predicate=stalePaymentPredicate(events.map((e:any)=>e.id));
  const statements=[];
  if(!state||state.source_hash!==hash){
   const ids=events.map((e:any)=>e.id),deleted=stalePaymentPredicate(ids,'deleted_payment_sources');
   statements.push(db().prepare(`DELETE FROM deleted_payment_sources WHERE ${deleted.sql}`).bind(...deleted.values));
   statements.push(db().prepare(ids.length?`DELETE FROM cashier_batches WHERE event_id NOT IN (${ids.map(()=>'?').join(',')})`:'DELETE FROM cashier_batches').bind(...ids));
   statements.push(db().prepare(ids.length?`DELETE FROM event_payment_formats WHERE event_id NOT IN (${ids.map(()=>'?').join(',')})`:'DELETE FROM event_payment_formats').bind(...ids));
   statements.push(db().prepare(`DELETE FROM audit WHERE payment_id IN (SELECT id FROM payments WHERE ${predicate.sql})`).bind(...predicate.values));
   statements.push(db().prepare(`DELETE FROM payments WHERE ${predicate.sql}`).bind(...predicate.values));
   if(ids.length)statements.push(db().prepare(`UPDATE deleted_payment_sources SET candidate_event_ids=(SELECT json_group_array(value) FROM json_each(deleted_payment_sources.candidate_event_ids) WHERE value IN (${ids.map(()=>'?').join(',')})) WHERE event_id IS NULL`).bind(...ids));
   if(ids.length)statements.push(db().prepare(`UPDATE payments SET candidate_event_ids=(SELECT json_group_array(value) FROM json_each(payments.candidate_event_ids) WHERE value IN (${ids.map(()=>'?').join(',')})) WHERE event_id IS NULL`).bind(...ids));
  }
  statements.push(db().prepare('INSERT INTO schedule_state (id,events_json,source_hash,fetched_at,attempted_at,error) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET events_json=excluded.events_json,source_hash=excluded.source_hash,fetched_at=excluded.fetched_at,attempted_at=excluded.attempted_at,error=excluded.error').bind('schedule',JSON.stringify(events),hash,at,at,''));
  await db().batch(statements);return {events,checkedAt:at,error:''};
 }catch{
  if(!state)throw Error('Could not load the live TLPT schedule. Try again shortly.');
  const error='Schedule refresh unavailable. Keeping the last verified events and payments.';
  await db().prepare('UPDATE schedule_state SET attempted_at=?,error=? WHERE id=?').bind(new Date(now).toISOString(),error,'schedule').run();
  return {events:JSON.parse(state.events_json),checkedAt:state.fetched_at,error};
 }
}
