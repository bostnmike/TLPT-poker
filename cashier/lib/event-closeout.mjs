import {dateKey,easternDay,easternEpoch,addDay,SLOTS} from './events.mjs';
import {eventHistoryClearPlan,HISTORY_SCOPE} from './event-history.mjs';

export const CLOSEOUT_PROTOCOL=1;
const REPOSITORY='https://raw.githubusercontent.com/bostnmike/TLPT-poker/';
const titleKey=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().replace(/\s*[|·–—-]\s*(?:9|18)\s*[- ]?max\s*$/i,'').trim().toLowerCase();
export class CloseoutError extends Error {
 constructor(code,message){super(message);this.code=code;}
}
const requireValue=(value,code,message)=>{if(!value)throw new CloseoutError(code,message);};
export function closeoutIdentity(input,now=Date.now()){
 requireValue(input?.protocol===CLOSEOUT_PROTOCOL,'protocol','Refresh Commish before closing out.');
 const match=String(input.eventId||'').match(/^(friday|saturday|sunday|mtt):(\d{4}-\d{2}-\d{2})$/);
 requireValue(match&&SLOTS.includes(match[1]),'identity','Choose one dated event.');
 const date=dateKey(match[2]);
 requireValue(input.confirmationDate===date&&typeof input.rsvpEventId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(input.rsvpEventId)&&typeof input.title==='string'&&input.title.trim()&&input.title.length<=250,'identity','Review the exact event and date before closing out.');
 requireValue(date<=easternDay(now),'not-finished','Future games cannot be closed out.');
 return {id:input.eventId,slot:match[1],date,title:input.title.trim(),liveEventId:input.rsvpEventId};
}
async function readText(fetcher,url,max=2000000){
 const response=await fetcher(url,{cache:'no-store',redirect:'manual',headers:{'User-Agent':'TLPT-Cashier-Closeout','Accept':'application/json'},signal:AbortSignal.timeout(10000)});
 requireValue(response.ok,'results-unavailable','Saved results could not be verified. Nothing was cleared; try again later.');
 const value=await response.text();requireValue(value.length<=max,'results-unavailable','The saved results response is too large. Nothing was cleared.');return value;
}
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function verifyCloseoutResults(event,fetcher=fetch,now=Date.now()){
 const head=JSON.parse(await readText(fetcher,'https://api.github.com/repos/bostnmike/TLPT-poker/commits/main',500000));
 requireValue(/^[a-f0-9]{40}$/.test(head.sha||''),'results-unavailable','The canonical results revision could not be verified.');
 const root=REPOSITORY+head.sha+'/',path='data/parsed/events/'+event.date+'.json';
 const [parsedText,historyText,validationText,integrityText,publishedText]=await Promise.all([
  readText(fetcher,root+path),readText(fetcher,root+'data/generated/event-history.json',12000000),
  readText(fetcher,root+'data/generated/validation-report.json'),readText(fetcher,root+'data/generated/integrity-report.json'),
  readText(fetcher,'https://tlpt.org/'+path)
 ]);
 const parsed=JSON.parse(parsedText),history=JSON.parse(historyText),validation=JSON.parse(validationText),integrity=JSON.parse(integrityText);
 const results=(history.events||[]).filter(e=>e.eventId===event.date&&e.date===event.date);
 requireValue(parsed.eventId===event.date&&parsed.date===event.date&&titleKey(parsed.title)===titleKey(event.title)&&results.length===1&&titleKey(results[0].title)===titleKey(event.title),'results-mismatch','The saved results do not match this event’s date and title. Nothing was cleared.');
 requireValue(parsed.sourceFile===`Event Report ${event.date}.html`&&results[0].sourceFile===parsed.sourceFile&&results[0].summary?.endTimeIso===parsed.summary?.endTimeIso&&Array.isArray(parsed.winners)&&parsed.winners.length>0&&Array.isArray(parsed.actions)&&JSON.stringify(results[0].winners)===JSON.stringify(parsed.winners),'results-mismatch','The completed results and original report are not fully linked. Nothing was cleared.');
 const ended=String(parsed.summary?.endTimeIso||'').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
 requireValue(ended&&ended[1]>=event.date&&ended[1]<=addDay(event.date)&&+ended[2]<24&&+ended[3]<60&&+ended[4]<60,'results-mismatch','The finished game time could not be verified.');
 const completedAt=easternEpoch(dateKey(ended[1]),+ended[2],+ended[3])+(+ended[4])*1000;
 requireValue(completedAt<=now,'not-finished','The published game finish time is still in the future.');
 requireValue(validation.status==='PASS'&&validation.errorCount===0&&integrity.status==='PASS'&&integrity.errorCount===0,'results-unverified','The canonical data checks have not passed. Nothing was cleared.');
 requireValue(await digest(publishedText)===await digest(parsedText),'results-unpublished','The verified results are not yet published on TLPT. Nothing was cleared.');
 const raw=await readText(fetcher,root+'data/raw/events/'+encodeURIComponent(parsed.sourceFile));
 requireValue(/<html\b|<!doctype html/i.test(raw)&&raw.length>200,'results-mismatch','The original event report could not be verified.');
 return {revision:head.sha,date:event.date,title:parsed.title,sourceFile:parsed.sourceFile,rawSha256:await digest(raw),parsedSha256:await digest(parsedText),completedAt:new Date(completedAt).toISOString()};
}
function receipt(row){return {protocol:CLOSEOUT_PROTOCOL,eventId:row.event_id,rsvpEventId:row.rsvp_event_id,requestId:row.request_id,closed:true,receiptId:row.request_id,closedAt:row.closed_at,resultsRevision:row.results_revision};}
async function existing(database,event){
 const row=await database.prepare('SELECT * FROM event_closeouts WHERE event_id=?').bind(event.id).first();
 if(row)requireValue(row.rsvp_event_id===event.liveEventId,'identity','This date was already closed for another RSVP event.');
 return row;
}
async function preview(database,event,fetcher,now){
 const identity={protocol:CLOSEOUT_PROTOCOL,eventId:event.id,rsvpEventId:event.liveEventId,confirmationDate:event.date};
 const done=await existing(database,event);if(done)return {ok:true,...identity,alreadyClosed:true,receipt:receipt(done)};
 const [evidence,revision,counts,marker]=await Promise.all([
  verifyCloseoutResults(event,fetcher,now),database.prepare('SELECT history_revision FROM register_revision WHERE id=1').first(),
  database.prepare(`SELECT COUNT(*) AS records,COALESCE(SUM(CASE WHEN status='review' THEN 1 ELSE 0 END),0) AS review FROM payments WHERE ${HISTORY_SCOPE}`).bind(event.id,event.id).first(),
  database.prepare('SELECT cleared_at FROM event_history_clears WHERE event_id=?').bind(event.id).first()
 ]);
 return {ok:true,...identity,alreadyClosed:false,alreadyCleared:!!marker,historyRevision:revision.history_revision,records:counts.records,review:counts.review,evidence};
}
export async function previewEventCloseout(database,input,fetcher=fetch,now=Date.now()){
 try{return await preview(database,closeoutIdentity(input,now),fetcher,now);}catch(error){return failure(error);}
}
function failure(error){return {ok:false,protocol:CLOSEOUT_PROTOCOL,code:error instanceof CloseoutError?error.code:'unavailable',error:error instanceof CloseoutError?error.message:'Close-out could not be confirmed. Nothing further was cleared. Refresh and retry the same event.'};}
export async function closeOutEvent(database,input,fetcher=fetch,now=Date.now()){
 try{
  const event=closeoutIdentity(input,now);
  requireValue(input.payoutsConfirmed===true&&input.receiptsReviewed===true&&input.resultsConfirmed===true,'confirmation','Confirm payouts and reviewed receipts before clearing this event.');
  requireValue(typeof input.requestId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.requestId)&&Number.isSafeInteger(input.expectedRevision)&&input.expectedRevision>=0,'confirmation','Refresh the close-out preview before confirming.');
  const done=await existing(database,event);if(done){requireValue(done.request_id===input.requestId,'action-conflict','This event was already closed by another action. Refresh Commish.');return {ok:true,alreadyClosed:true,receipt:receipt(done)};}
  const checked=await preview(database,event,fetcher,now);if(checked.alreadyClosed){requireValue(checked.receipt.requestId===input.requestId,'action-conflict','This event was already closed by another action. Refresh Commish.');return checked;}
  requireValue(checked.historyRevision===input.expectedRevision,'ledger-changed','Cashier changed after the preview. Review the event again before clearing.');
  requireValue(checked.evidence.revision===input.expectedResultsRevision,'results-changed','The canonical results changed. Review the event again before clearing.');
  const feed=JSON.parse(await readText(fetcher,'https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/public/events'));
  requireValue(feed.schemaVersion===1&&Array.isArray(feed.events)&&Number.isSafeInteger(feed.revision),'schedule-unavailable','The event’s closed RSVP state could not be verified.');
  requireValue(!feed.events.some(e=>(e.id===event.liveEventId||(e.slot===event.slot&&e.date===event.date))&&e.rsvpOpen===true),'event-open','Close the event to new RSVPs before clearing its Cashier ledger.');
  const plan=checked.alreadyCleared?[
   {sql:'INSERT INTO cashier_batch_checks(id,batch_id,ok) SELECT ?,?,CASE WHEN (SELECT history_revision FROM register_revision WHERE id=1)=? AND EXISTS(SELECT 1 FROM event_history_clears WHERE event_id=?) THEN 1 ELSE 0 END',values:[input.requestId,input.requestId,input.expectedRevision,event.id]},
   {sql:'DELETE FROM cashier_batch_checks WHERE id=?',values:[input.requestId]}
  ]:eventHistoryClearPlan({event,expectedRevision:input.expectedRevision,confirmationDate:event.date,checked:true,now,requestId:input.requestId,verifiedCompletedAt:Date.parse(checked.evidence.completedAt)});
  plan.push(
   {sql:'DELETE FROM event_payment_formats WHERE event_id=?',values:[event.id]},
   {sql:"UPDATE schedule_state SET events_json=(SELECT json_group_array(json(value)) FROM json_each(events_json) WHERE json_extract(value,'$.id')<>?) WHERE id='schedule'",values:[event.id]},
   {sql:"UPDATE live_rsvp_state SET body=json_set(body,'$.events',json((SELECT json_group_array(json(value)) FROM json_each(body,'$.events') WHERE NOT(json_extract(value,'$.slot')=? AND json_extract(value,'$.date')=?)))) WHERE id='attendance'",values:[event.slot,event.date]},
   {sql:'INSERT INTO event_closeouts(event_id,rsvp_event_id,request_id,results_revision,raw_sha256,parsed_sha256,closed_at) VALUES(?,?,?,?,?,?,?)',values:[event.id,event.liveEventId,input.requestId,checked.evidence.revision,checked.evidence.rawSha256,checked.evidence.parsedSha256,new Date(now).toISOString()]}
  );
  try{await database.batch(plan.map(s=>database.prepare(s.sql).bind(...s.values)));}catch(error){const completed=await existing(database,event);if(completed&&completed.request_id===input.requestId)return {ok:true,alreadyClosed:true,receipt:receipt(completed)};throw error;}
  const completed=await existing(database,event);return {ok:true,alreadyClosed:false,receipt:receipt(completed)};
 }catch(error){return failure(error);}
}
