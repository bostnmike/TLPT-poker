import {db} from './api';
import {getLiveAttendance,LIVE_RSVP_URL,validateLiveRsvps} from './live-rsvp.mjs';
import {livePaymentSchedule} from './live-payment-schedule.mjs';
import {applyPaymentFormat,FINANCIALS_URL} from './events.mjs';
export async function getSchedule(force=false):Promise<any>{
 const schedule=await getBaseSchedule(force);
 const overrides=(await db().prepare('SELECT event_id,mode,bounty_cents FROM event_payment_formats').all()).results;
 const cleared=(await db().prepare('SELECT event_id,cleared_at FROM event_history_clears').all()).results;
 return {...schedule,events:(await getLiveAttendance(db(),schedule.events)).map((e:any)=>({...applyPaymentFormat(e,overrides.find((o:any)=>o.event_id===e.id)),historyClearedAt:cleared.find((c:any)=>c.event_id===e.id)?.cleared_at||null}))};
}
async function getBaseSchedule(force=false):Promise<any>{
 const state:any=await db().prepare('SELECT * FROM schedule_state WHERE id=?').bind('schedule').first();
 const now=Date.now();
 if(!force&&state&&(state.source_hash.startsWith('live-v1:')||state.error)&&now-Date.parse(state.attempted_at)<60000)return {events:JSON.parse(state.events_json).map((e:any)=>state.source_hash.startsWith('live-v1:')?e:{...e,savedOnly:true}),checkedAt:state.fetched_at,error:state.error};
 try{
  const responses=await Promise.all([fetch(LIVE_RSVP_URL,{cache:'no-store',signal:AbortSignal.timeout(8000)}),fetch(FINANCIALS_URL,{cache:'no-store',signal:AbortSignal.timeout(8000)})]);
  if(responses.some(r=>!r.ok))throw Error('Schedule source unavailable');
  const bodies=await Promise.all(responses.map(r=>r.text()));if(bodies.some(s=>s.length>500000))throw Error('Schedule source too large');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bodies.join('\n'))))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const feed=validateLiveRsvps(JSON.parse(bodies[0]));
  const ledgerIds=(await db().prepare("SELECT DISTINCT event_id FROM payments WHERE event_id IS NOT NULL UNION SELECT value AS event_id FROM payments,json_each(payments.candidate_event_ids) WHERE payments.event_id IS NULL").all()).results.map((r:any)=>r.event_id);
  const events=livePaymentSchedule(feed,JSON.parse(bodies[1]),state?JSON.parse(state.events_json):[],ledgerIds,now);
  const at=new Date(now).toISOString();
  // Live RSVP edits select events, but never delete or move financial records.
  await db().batch([
   db().prepare('INSERT INTO schedule_state (id,events_json,source_hash,fetched_at,attempted_at,error) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET events_json=excluded.events_json,source_hash=excluded.source_hash,fetched_at=excluded.fetched_at,attempted_at=excluded.attempted_at,error=excluded.error').bind('schedule',JSON.stringify(events),'live-v1:'+hash,at,at,''),
   db().prepare('INSERT INTO live_rsvp_state(id,body,fetched_at,attempted_at,error) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,fetched_at=excluded.fetched_at,attempted_at=excluded.attempted_at,error=excluded.error').bind('attendance',bodies[0],at,at,'')
  ]);return {events,checkedAt:at,error:''};
 }catch{
  if(!state)throw Error('Could not load the live TLPT schedule. Try again shortly.');
  const error='Schedule refresh unavailable. Keeping the last verified events and payments.';
  await db().prepare('UPDATE schedule_state SET attempted_at=?,error=? WHERE id=?').bind(new Date(now).toISOString(),error,'schedule').run();
  return {events:JSON.parse(state.events_json).map((e:any)=>state.source_hash.startsWith('live-v1:')?e:{...e,savedOnly:true}),checkedAt:state.fetched_at,error};
 }
}
