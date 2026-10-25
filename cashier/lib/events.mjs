import {eventAttendance} from './rsvp-attendance.mjs';
export const SLOTS=['friday','saturday','mtt'];
export const SCHEDULE_URL='https://tlpt.org/data/events.json';
export const FINANCIALS_URL='https://tlpt.org/data/event-financials.json';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function easternDay(ms=Date.now()){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));const get=t=>p.find(x=>x.type===t).value;return `${get('year')}-${get('month')}-${get('day')}`;}
export function dateKey(value){const s=String(value||'');let y,m,d;let x=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(x){[,y,m,d]=x.map(Number);}else{x=s.match(/^(?:\w+,\s*)?(\w+)\s+(\d{1,2}),\s*(\d{4})$/);if(!x)throw Error('Invalid event date');m=months.indexOf(x[1])+1;d=+x[2];y=+x[3];}const dt=new Date(Date.UTC(y,m-1,d));if(!m||dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)throw Error('Invalid event date');return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
export function addDay(day,n=1){return new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function easternEpoch(day,hour=0,minute=0){const [y,m,d]=day.split('-').map(Number),target=Date.UTC(y,m-1,d,hour,minute);let guess=target;for(let i=0;i<3;i++){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));const get=t=>Number(p.find(x=>x.type===t).value);const observed=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));guess+=target-observed;}return guess;}
function cents(v,fallback){if(v===undefined||v===null)return fallback;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>10000||Math.abs(v*100-Math.round(v*100))>1e-7)throw Error('Invalid event payment amount');return Math.round(v*100);}
function datePending(raw){return /^(?:date\s+)?tbd$/i.test(String(raw.date||'').trim());}
export function normalizeSchedule(source,financials,now=Date.now(),previous=[]){
 if(!source||!Array.isArray(source.events)||source.events.length>500||!financials||typeof financials.events!=='object'||Array.isArray(financials.events))throw Error('Invalid schedule source');
 const today=easternDay(now),groups={friday:[],saturday:[],mtt:[]},pending=new Set();
 for(const raw of source.events){if(!SLOTS.includes(raw.slot))continue;if(raw.active===false||raw.cancelled===true||/^(cancelled|canceled|inactive)$/i.test(raw.status||''))continue;if(datePending(raw)){pending.add(raw.slot);continue;}const date=dateKey(raw.date);if(typeof raw.title!=='string'||!raw.title.trim())throw Error('Missing event title');groups[raw.slot].push({...raw,key:date});}
 const selected=[];
 for(const slot of SLOTS){const list=groups[slot].sort((a,b)=>a.key.localeCompare(b.key));const e=list.find(x=>x.key>=today)||list.at(-1);if(!e){
   // A placeholder is not a dated replacement: keep that slot's ledger and
   // receipt window until a real date is published. Never invent a date.
   const saved=pending.has(slot)&&previous.find(event=>event.slot===slot);
   if(saved)selected.push({...saved,schedulePending:true});
   continue;
  }
  const f={...(financials.events[e.key]||{}),...(e.payments||{})},mtt=slot==='mtt'||Number(e.tables)>1;
  const prize=cents(f.entryAmount,mtt?4000:3000),bounty=cents(f.bounty?.amount,mtt?1000:0),rebuy=cents(f.rebuyAmount,prize),food=cents(f.foodAmount,1500);
  const rules={entry:prize+bounty,rebuy,food,entryPrize:prize,bounty};if(rules.entry<=0||rules.rebuy<=0)throw Error('Missing entry price');
  selected.push({id:`${slot}:${e.key}`,slot,date:e.key,dateLabel:e.date,title:e.title,time:e.time||'',endTime:e.endTime||'',tables:Number(e.tables)||(mtt?2:1),capacity:e.capacity||(mtt?18:9),rules,...eventAttendance(e),receiptStart:easternEpoch(e.key),receiptEnd:easternEpoch(addDay(e.key),6),sourceUrl:SCHEDULE_URL});
 }
 return selected;
}
// Refresh RSVP metadata even when an unchanged source keeps the selected event dates pinned.
export function refreshScheduleAttendance(events,source){
 return events.map(event=>{
  const raw=source.events.find(raw=>raw.slot===event.slot&&!datePending(raw)&&dateKey(raw.date)===event.date);
  return raw?{...event,...eventAttendance(raw)}:event;
 });
}
export function allocation(event,kind){const r=event.rules;if(kind==='entry')return {prize:r.entryPrize,bounty:r.bounty,food:0};if(kind==='rebuy')return {prize:r.rebuy,bounty:0,food:0};if(kind==='food')return {prize:0,bounty:0,food:r.food};throw Error('Unknown payment type');}
export const PAYMENT_KINDS=['entry','rebuy','food'];
export function paymentKinds(kind){const items=String(kind||'').split('+');return items.length<=3&&new Set(items).size===items.length&&items.every(k=>PAYMENT_KINDS.includes(k))?PAYMENT_KINDS.filter(k=>items.includes(k)):[];}
export function paymentSelection(event,items){
 if(!Array.isArray(items)||!items.length||items.length>3||new Set(items).size!==items.length||items.some(k=>!PAYMENT_KINDS.includes(k)))throw Error('Select at least one payment item.');
 const selected=PAYMENT_KINDS.filter(k=>items.includes(k)),result={items:selected,kind:selected.join('+'),cents:0,prize:0,bounty:0,food:0};
 for(const kind of selected){const cents=event.rules[kind],a=allocation(event,kind);if(!Number.isSafeInteger(cents)||cents<=0||Object.values(a).some(v=>!Number.isSafeInteger(v)||v<0)||a.prize+a.bounty+a.food!==cents)throw Error('This payment item is unavailable.');result.cents+=cents;result.prize+=a.prize;result.bounty+=a.bounty;result.food+=a.food;}
 return result;
}
export function applyPaymentFormat(event,override){
 const scheduledBounty=event.rules.bounty;
 if(!override)return {...event,paymentFormat:scheduledBounty?'bounty':'standard',formatOverride:false,scheduledBounty};
 if(!['standard','bounty'].includes(override.mode)||!Number.isSafeInteger(override.bounty_cents)||override.bounty_cents<1||override.bounty_cents>100000)throw Error('Invalid bounty settings');
 const bounty=override.mode==='bounty'?override.bounty_cents:0;
 return {...event,rules:{...event.rules,entry:event.rules.entryPrize+bounty,bounty},paymentFormat:override.mode,formatOverride:true,scheduledBounty,bountyOption:override.bounty_cents};
}
export function checkoutNote(event,kind){return `TLPT ${event.slot} ${event.date} ${kind}`;}
export function checkoutUrl(event,kind){return 'https://venmo.com/BostnMike?'+new URLSearchParams({txn:'pay',amount:(event.rules[kind]/100).toFixed(2),note:checkoutNote(event,kind)});}
export function reusableCheckoutUrl(slot,kind,cents){
 if(!SLOTS.includes(slot)||!['entry','rebuy','food'].includes(kind)||!Number.isSafeInteger(cents)||cents<=0||cents>1000000)throw Error('Invalid poster payment');
 return 'https://venmo.com/BostnMike?'+new URLSearchParams({txn:'pay',amount:(cents/100).toFixed(2),note:`TLPT ${slot} ${kind}`});
}
export function stalePaymentPredicate(ids,table='payments'){if(!['payments','deleted_payment_sources'].includes(table))throw Error('Unknown retention table');if(!ids.length)return {sql:'1=1',values:[]};const marks=ids.map(()=>'?').join(',');return {sql:`(event_id IS NOT NULL AND event_id NOT IN (${marks})) OR (event_id IS NULL AND NOT EXISTS (SELECT 1 FROM json_each(${table}.candidate_event_ids) WHERE value IN (${marks})))`,values:[...ids,...ids]};}
