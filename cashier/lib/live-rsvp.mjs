import {eventAttendance} from './rsvp-attendance.mjs';
export const LIVE_RSVP_URL='https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/public/events';
export function validateLiveRsvps(feed){
 if(feed?.schemaVersion!==1||!Array.isArray(feed.events)||feed.events.length>100||!Number.isSafeInteger(feed.revision))throw Error('Invalid live RSVP feed');
 const identities=new Set();
 for(const e of feed.events){
  const identity=e.slot+':'+e.date;
  if(identities.has(identity)||typeof e.id!=='string'||!['friday','saturday','mtt'].includes(e.slot)||typeof e.date!=='string'||!e.rsvps||Array.isArray(e.rsvps)||Object.values(e.rsvps).some(a=>!['yes','no','maybe','tbd'].includes(a))||!Array.isArray(e.waitlist))throw Error('Invalid live RSVP event');
  identities.add(identity);
 }
 return feed;
}
// No schedule normalization, payment retention predicate, or ledger write here.
export function overlayLiveRsvps(events,feed,{stale=false,checkedAt=null}={}){
 validateLiveRsvps(feed);
 return events.map(event=>{
  const live=feed.events.find(e=>e.slot===event.slot&&e.date===event.date);
  if(!live)return {...event,rsvps:[],roster:[],rsvpWaitlist:[],rsvpStale:true,rsvpCheckedAt:checkedAt,rsvpMessage:'No live RSVP lineup for this saved payment event.'};
  const waiting=new Set(live.waitlist.map(w=>w.slug));
  const attendance=eventAttendance({...live,rsvps:Object.fromEntries(Object.entries(live.rsvps).filter(([slug])=>!waiting.has(slug)))});
  return {...event,...attendance,rsvpWaitlist:live.waitlist,rsvpStale:stale,rsvpCheckedAt:checkedAt,rsvpMessage:stale?'RSVP refresh unavailable. Showing the last verified lineup.':''};
 });
}
export async function getLiveAttendance(database,events,fetcher=fetch,now=Date.now()){
 let saved;
 try{
  saved=await database.prepare('SELECT * FROM live_rsvp_state WHERE id=?').bind('attendance').first();
  if(saved&&now-Date.parse(saved.attempted_at)<60000)return overlayLiveRsvps(events,JSON.parse(saved.body),{stale:!!saved.error,checkedAt:saved.fetched_at});
  const response=await fetcher(LIVE_RSVP_URL,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('RSVP unavailable');
  const text=await response.text();if(text.length>500000)throw Error('RSVP feed too large');const feed=validateLiveRsvps(JSON.parse(text)),at=new Date(now).toISOString();
  await database.prepare('INSERT INTO live_rsvp_state(id,body,fetched_at,attempted_at,error) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,fetched_at=excluded.fetched_at,attempted_at=excluded.attempted_at,error=excluded.error').bind('attendance',text,at,at,'').run();
  return overlayLiveRsvps(events,feed,{checkedAt:at});
 }catch{
  if(saved){try{await database.prepare('UPDATE live_rsvp_state SET attempted_at=?,error=? WHERE id=?').bind(new Date(now).toISOString(),'RSVP refresh unavailable','attendance').run();}catch{}return overlayLiveRsvps(events,JSON.parse(saved.body),{stale:true,checkedAt:saved.fetched_at});}
  return events.map(e=>({...e,rsvps:[],roster:[],rsvpWaitlist:[],rsvpStale:true,rsvpMessage:'Live RSVP lineup unavailable. Payments remain available.'}));
 }
}
