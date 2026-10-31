import {normalizeSchedule,dateKey,easternEpoch,addDay} from './events.mjs';
import {validateLiveRsvps,LIVE_RSVP_URL} from './live-rsvp.mjs';
export function livePaymentSchedule(feed,financials,previous=[],ledgerIds=[],now=Date.now()){
 validateLiveRsvps(feed);
 const active=feed.events.filter(e=>e.rsvpOpen===true&&!/^(?:date\s+)?tbd$/i.test(e.date)&&easternEpoch(addDay(dateKey(e.date)),6)>now);
 const current=normalizeSchedule({events:active},financials,now).map(event=>({...event,savedOnly:false,liveEventId:active.find(e=>e.slot===event.slot&&dateKey(e.date)===event.date).id,sourceUrl:LIVE_RSVP_URL}));
 const ids=new Set(current.map(e=>e.id)),withLedger=new Set(ledgerIds);
 const saved=previous.filter(e=>!ids.has(e.id)&&withLedger.has(e.id)).map(event=>{
  const identity=event.liveEventId||event.slot+'-'+event.date;
  const cancelled=(feed.cancelledEvents||[]).some(e=>e.id===identity);
  const moved=feed.events.some(e=>e.id===identity&&(e.slot!==event.slot||e.date!==event.date));
  return {...event,savedOnly:true,schedulePending:false,receiptImportAllowed:!cancelled&&!moved};
 });
 return [...current,...saved];
}
export function receiptSchedule(events,now=Date.now()){
 return events.filter(e=>!e.historyClearedAt&&(!e.savedOnly||(e.receiptImportAllowed!==false&&now>=e.receiptEnd)));
}
