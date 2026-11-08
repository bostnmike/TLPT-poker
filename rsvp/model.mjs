import {canCloseOutEvent, validCloseoutRequestId} from './lib/event-closeout.mjs';
import {coffeeDrinks, coffeeCaffeine} from './public/coffee-menu.mjs';
import {eventPoster,validPosterFile} from './posters.mjs';
export {eventPoster} from './posters.mjs';
import {noGameDays} from './schedule-notices.mjs';
// No contact, financial, or historical result data belongs in this service.
export class Rejected extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function requireValue(ok,message,status=400){if(!ok)throw new Rejected(message,status);}
export const HOST='bostnmike';
export const liveEvent=e=>!e.archived&&!e.cancelled&&!e.deletedAt;
export function compareEvents(a,b){
 const x=a.metadata||a,y=b.metadata||b,date=m=>m.date==='Date TBD'?'9999-99-99':m.date;
 const minutes=m=>{const t=m.time?.match(/^(\d{1,2}):(\d{2}) ([AP])M$/);return t?(Number(t[1])%12+(t[3]==='P'?12:0))*60+Number(t[2]):0;};
 return date(x).localeCompare(date(y))||minutes(x)-minutes(y)||a.id.localeCompare(b.id);
}
// Display-only rename: saved responses, private links and player IDs stay intact.
export const publicPlayer=p=>({slug:p.slug,name:p.slug==='li-fo'?'ButtonMan':p.name,image:p.image,rosterStatus:p.rosterStatus});
export function comparePlayers(a,b){const rank=p=>p.slug===HOST?-1:p.rosterStatus==='alumni'?1:0;return rank(a)-rank(b)||publicPlayer(a).name.localeCompare(publicPlayer(b).name,'en',{sensitivity:'base'});}
export function eventResponses(state,event){const responses={...event.responses};if(state.players.some(p=>p.slug===HOST))responses[HOST]={...(responses[HOST]||{}),answer:'yes',order:0};return responses;}
export function publicFeed(state, now = new Date(), posters=[]){
 const players=[...state.players].sort(comparePlayers);
  return {schemaVersion:1,revision:state.revision,updatedAt:state.updatedAt,noGameDays:noGameDays([...state.events,...(state.closeouts||[]).map(receipt=>({metadata:{date:receipt.eventId.slice(-10)}}))],now),players:players.map(publicPlayer),cancelledEvents:state.events.filter(e=>e.cancelled&&!e.deletedAt).map(e=>({id:e.id,title:e.metadata.title,date:e.metadata.date})),events:state.events.filter(liveEvent).sort(compareEvents).map(e=>{
  const responses=eventResponses(state,e);
  const queue=Object.entries(responses).filter(([,r])=>r.answer==='yes').sort((a,b)=>a[0]===HOST?-1:b[0]===HOST?1:a[1].order-b[1].order||a[0].localeCompare(b[0]));
  const confirmed=new Set(queue.slice(0,e.capacity).map(([s])=>s));
  const waitlist=queue.slice(e.capacity).map(([slug],i)=>({slug,position:i+1}));
  return {...e.metadata,poster:eventPoster(e.metadata,posters),id:e.id,capacity:e.capacity,rsvpOpen:e.open,hostLocked:state.players.some(p=>p.slug===HOST),rsvp_url:`https://tlpt-rsvp.tlpt-bostnmike.workers.dev/?event=${encodeURIComponent(e.id)}`,rsvps:Object.fromEntries(players.map(p=>[p.slug,responses[p.slug]?.answer==='yes'?(confirmed.has(p.slug)?'yes':'maybe'):(responses[p.slug]?.answer||'tbd')])),waitlist,requestedIn:queue.map(([slug])=>slug),rsvpUpdatedAt:state.updatedAt};
 })};
}
export function playerView(state,slug,posters=[]){return {player:state.players.find(p=>p.slug===slug)&&publicPlayer(state.players.find(p=>p.slug===slug)),...publicFeed(state,new Date(),posters),responses:Object.fromEntries(state.events.filter(liveEvent).map(e=>[e.id,eventResponses(state,e)[slug]?.answer||'tbd']))};}
export function validateMetadata(raw){
 const fields=['title','format','slot','day','date','time','endTime','location','address','structure'];const m={};
 for(const k of fields){requireValue(typeof raw[k]==='string'&&raw[k].length<=250,`Invalid ${k}.`);m[k]=raw[k].trim();}
 requireValue(m.title&&['friday','saturday','sunday','mtt'].includes(m.slot),'Choose a title and event type.');
 requireValue(m.date==='Date TBD'||/^\d{4}-\d{2}-\d{2}$/.test(m.date)&&Number.isFinite(Date.parse(m.date+'T12:00:00Z'))&&new Date(m.date+'T12:00:00Z').toISOString().slice(0,10)===m.date,'Choose a calendar date or Date TBD.');
 requireValue(/^(?:1[0-2]|[1-9]):[0-5]\d [AP]M$/.test(m.time)&&/^(?:1[0-2]|[1-9]):[0-5]\d [AP]M$/.test(m.endTime),'Use times such as 7:00 PM.');
 const poster=raw.poster||'auto';requireValue(poster==='auto'||poster==='none'||validPosterFile(poster),'Choose a poster from the TLPT gallery.');
 m.poster=poster;m.tables=m.slot==='mtt'?2:1;if(m.slot==='sunday'){m.startingStack=50000;m.blindStructure='40k';}return m;
}
export function coffeeEvent(state, eventId, now = new Date().toISOString(), requireOpen = true) {
 const event = state.events.find(e => e.id === eventId);
 const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(now));
 requireValue(event && liveEvent(event) && event.metadata.date !== 'Date TBD' && event.metadata.date >= today, 'This game is unavailable for coffee orders.', 409);
 requireValue(!event.closeoutPending, 'This game is being closed out.', 409);
 requireValue(!requireOpen || event.open, 'Coffee pre-orders are closed for this game.', 409);
 return event;
}

export function publicCoffeeOrder(order) {
 if (!order) return null;
 const {drink, temperature, milk, stevia, extraShot, status, version, createdAt, updatedAt} = order;
 return {drink, temperature, caffeine: order.caffeine ?? 'high-octane', milk, stevia, extraShot, status, version, createdAt, updatedAt};
}

function applyCoffeeOrder(state, actor, op, now) {
 const slug = actor.role === 'admin' ? op.slug : actor.slug;
 requireValue(!op.slug || op.slug === slug, 'Choose your player name.', 403);
 requireValue(slug !== HOST && state.players.some(p => p.slug === slug), 'Choose your player name.');
 requireValue(['save', 'cancel'].includes(op.action), 'Choose save or cancel.');
 requireValue(typeof op.requestId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(op.requestId), 'Reopen the coffee form and try again.');
 requireValue(Number.isSafeInteger(op.expectedVersion) && op.expectedVersion >= 0, 'Reload your coffee order.');
 const event = coffeeEvent(state, op.eventId, now, op.action !== 'cancel');
 requireValue(typeof op.orderId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(op.orderId), 'Reopen the coffee form and try again.');
 const old = event.coffeeOrders?.[slug]?.[op.orderId];
 let options;
 if (op.action === 'save') {
  const raw = op.order;
  requireValue(raw && Object.hasOwn(coffeeDrinks, raw.drink) && ['hot', 'iced'].includes(raw.temperature), 'Choose your drink and Hot or Iced.');
  requireValue(['milk', 'stevia', 'extraShot'].every(key => typeof raw[key] === 'boolean'), 'Choose your coffee extras.');
  requireValue(raw.caffeine === undefined || Object.hasOwn(coffeeCaffeine, raw.caffeine), 'Choose DeCaf or Regular.');
  options = {drink: raw.drink, temperature: raw.temperature, caffeine: raw.caffeine ?? old?.caffeine ?? 'high-octane', milk: raw.drink === 'coffee' ? raw.milk : true, stevia: raw.stevia, extraShot: raw.extraShot};
 } else {
  requireValue(old, 'There is no coffee order to cancel.', 409);
  options = {drink: old.drink, temperature: old.temperature, caffeine: old.caffeine ?? 'high-octane', milk: old.milk, stevia: old.stevia, extraShot: old.extraShot};
 }
 const status = op.action === 'cancel' ? 'cancelled' : 'active';
 const same = old && old.status === status && Object.keys(options).every(key => (key === 'caffeine' ? old[key] ?? 'high-octane' : old[key]) === options[key]);
 if (old?.requestId === op.requestId) {
  requireValue(same, 'This request was already used for a different coffee order.', 409);
  return false;
 }
 requireValue((old?.version || 0) === op.expectedVersion, 'Your coffee order changed on another device. Reopen the form to review it.', 409);
 if (same) return false;
 requireValue(status !== 'active' || old?.status === 'active' || !Object.entries(event.coffeeOrders?.[slug] || {}).some(([id, order]) => id !== op.orderId && order.status === 'active'), 'Your coffee pre-order was saved on another device. Reopen the form to make changes.', 409);
 event.coffeeOrders ||= {};
 event.coffeeOrders[slug] ||= {};
 event.coffeeOrders[slug][op.orderId] = {...options, status, version: (old?.version || 0) + 1, requestId: op.requestId, createdAt: old?.createdAt || now, updatedAt: now};
 return true;
}

export function applyOperation(state,actor,op,now=new Date().toISOString()){
 const admin=actor.role==='admin';
 if(op.type==='coffee'){
  if (!applyCoffeeOrder(state, actor, op, now)) return state;
 }else if(op.type==='respond'){
  const slug=admin?op.slug:actor.slug;
  requireValue(admin||!op.slug||op.slug===actor.slug,'This link belongs to another player.',403);
  requireValue(state.players.some(p=>p.slug===slug),'Unknown player.');
  const e=state.events.find(e=>e.id===op.eventId);requireValue(e&&liveEvent(e),'Event unavailable.',404);
  requireValue(!e.closeoutPending,'This game is being closed out.',409);
  requireValue(admin||e.open,'RSVPs are closed. Contact The Commish.',409);
  requireValue(['yes','maybe','no','tbd'].includes(op.answer),'Choose In, Maybe or Out.');
  requireValue(slug!==HOST||op.answer==='yes','The host’s response stays In.',409);
  const old=e.responses[slug];e.responses[slug]={answer:op.answer,order:op.answer==='yes'&&old?.answer==='yes'?old.order:++state.sequence,updatedAt:now};
 }else{
  requireValue(admin,'Commish sign-in required.',403);
  if(op.type==='closeout-prepare'){
   const e=state.events.find(e=>e.id===op.eventId);
   if(!e&&state.closeouts?.some(receipt=>receipt.rsvpEventId===op.eventId&&receipt.requestId===op.requestId))return state;
   requireValue(e&&canCloseOutEvent(e,now),'Event cannot be closed out.',409);
   requireValue(e.metadata.date===op.confirmationDate&&e.metadata.slot===op.slot&&e.metadata.title===op.title,'Event details changed. Review the preview again.',409);
   requireValue(validCloseoutRequestId(op.requestId)&&op.payoutsConfirmed===true&&op.receiptsReviewed===true&&op.resultsConfirmed===true&&/^[a-f0-9]{40}$/.test(op.resultsRevision||'')&&Number.isSafeInteger(op.historyRevision)&&op.historyRevision>=0,'Invalid close-out preparation.');
   requireValue(e.closeoutPending?e.closeoutPending.requestId===op.requestId:state.revision===op.expectedStateRevision,'Event changed or another close-out is pending. Review the preview again.',409);
   if(e.closeoutPending?.requestId===op.requestId&&e.closeoutPending.historyRevision===op.historyRevision&&e.closeoutPending.resultsRevision===op.resultsRevision)return state;
   e.closeoutPending={requestId:op.requestId,historyRevision:op.historyRevision,resultsRevision:op.resultsRevision,evidence:op.evidence,startedAt:e.closeoutPending?.startedAt||now,payoutsConfirmed:true,receiptsReviewed:true,resultsConfirmed:true};e.open=false;
  }else if(op.type==='closeout-finalize'){
   if(state.closeouts?.some(receipt=>receipt.rsvpEventId===op.eventId&&receipt.requestId===op.requestId))return state;
   const e=state.events.find(e=>e.id===op.eventId),pending=e?.closeoutPending,r=op.receipt;
   requireValue(e&&pending&&pending.requestId===op.requestId&&r?.protocol===1&&r.closed===true&&r.eventId===e.metadata.slot+':'+e.metadata.date&&r.rsvpEventId===e.id&&r.requestId===pending.requestId&&r.receiptId===pending.requestId&&r.resultsRevision===pending.resultsRevision&&typeof r.closedAt==='string'&&Number.isFinite(Date.parse(r.closedAt)),'Cashier completion receipt did not match the pending game.',409);
   const receipt={protocol:1,eventId:r.eventId,rsvpEventId:r.rsvpEventId,requestId:r.requestId,closed:true,receiptId:r.receiptId,closedAt:r.closedAt,resultsRevision:r.resultsRevision};
   state.closeouts=[...(state.closeouts||[]),receipt].slice(-500);state.events=state.events.filter(item=>item.id!==e.id);
  }else if(op.type==='link'){
   const p=state.players.find(p=>p.slug===op.slug);requireValue(p,'Unknown player.');p.linkHash=op.hash;p.generation++;
  }else if(op.type==='event'){
   requireValue(Number.isInteger(op.capacity)&&op.capacity>=1&&op.capacity<=90,'Capacity must be 1–90.');
   requireValue(typeof op.open==='boolean','Choose open or closed.');
   const metadata=validateMetadata(op.metadata);
   requireValue(!(state.closeouts||[]).some(receipt=>receipt.eventId===metadata.slot+':'+metadata.date),'This dated game was permanently closed out. Choose a new date.',409);
   requireValue(metadata.slot!=='sunday'||op.capacity<=9,'Sunday is a single table with up to 9 seats.');
   requireValue(metadata.date!=='Date TBD'||!op.open,'Keep undated events closed until a date is confirmed.');
   let e=state.events.find(e=>e.id===op.eventId);
   if(e){
    requireValue(liveEvent(e),'Restore this event before editing it.',409);requireValue(!e.closeoutPending,'Resume this event’s pending close-out first.',409);
    requireValue(!state.events.some(other=>other!==e&&liveEvent(other)&&other.metadata.slot===metadata.slot&&other.metadata.date===metadata.date),'This event type and date already exist.',409);
    e.metadata={...e.metadata,...metadata};if(metadata.slot!=='sunday'){delete e.metadata.startingStack;delete e.metadata.blindStructure;}e.capacity=op.capacity;e.open=op.open;
   }else{
    requireValue(!op.eventId,'Unknown event.');requireValue(state.events.length<100,'Event archive is full. Export a backup and contact maintenance.');
    requireValue(!state.events.some(e=>liveEvent(e)&&e.metadata.slot===metadata.slot&&e.metadata.date===metadata.date),'This event type and date already exist.');
    state.events.push({id:op.newId,metadata,responses:{},capacity:op.capacity,open:op.open,archived:false});
   }
  }else if(['archive','cancel','delete','restore'].includes(op.type)){
   const e=state.events.find(e=>e.id===op.eventId);requireValue(e,'Unknown event.');requireValue(!e.closeoutPending,'Resume this event’s pending close-out first.',409);
   const restoring=op.type==='restore'||op.type==='archive'&&e.archived;
   requireValue(!restoring||!(state.closeouts||[]).some(receipt=>receipt.eventId===e.metadata.slot+':'+e.metadata.date),'This dated game was permanently closed out.',409);
   requireValue(!restoring||!state.events.some(other=>other!==e&&liveEvent(other)&&other.metadata.slot===e.metadata.slot&&other.metadata.date===e.metadata.date),'Another event already uses this date and type.',409);
   if(restoring){e.archived=false;e.cancelled=false;e.deletedAt=null;}
   else if(op.type==='cancel'){requireValue(!e.deletedAt,'Restore this event first.',409);e.cancelled=true;e.cancelledAt=now;}
   else if(op.type==='delete')e.deletedAt=now;
   else e.archived=true;
   e.open=false;
  }else if(op.type==='promote'){
   const e=state.events.find(e=>e.id===op.eventId);requireValue(e&&liveEvent(e)&&!e.closeoutPending&&e.responses[op.slug]?.answer==='yes','Player must request In.');
   const orders=Object.values(e.responses).filter(r=>r.answer==='yes').map(r=>r.order);e.responses[op.slug].order=Math.min(0,...orders)-1;
  }else throw new Rejected('Unknown operation.');
 }
 // Host reservation is enforced on every successful save, including legacy records.
 if(state.players.some(p=>p.slug===HOST))for(const e of state.events.filter(e=>liveEvent(e)&&!e.closeoutPending))e.responses[HOST]={...(e.responses[HOST]||{}),answer:'yes',order:0,updatedAt:e.responses[HOST]?.answer==='yes'?e.responses[HOST].updatedAt:now};
 state.revision++;state.updatedAt=now;
 state.audit.push({at:now,actor:admin?'commish':actor.role==='shared'?'shared:'+actor.slug:actor.slug,type:op.type,eventId:op.eventId||null,slug:op.slug||actor.slug||null});state.audit=state.audit.slice(-500);
 return state;
}
