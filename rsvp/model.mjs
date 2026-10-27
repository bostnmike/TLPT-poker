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
export const publicPlayer=p=>({slug:p.slug,name:p.slug==='li-fo'?'ButtonMan: fka LiFo':p.name,image:p.image,rosterStatus:p.rosterStatus});
export function comparePlayers(a,b){const rank=p=>p.slug===HOST?-1:p.rosterStatus==='alumni'?1:0;return rank(a)-rank(b)||publicPlayer(a).name.localeCompare(publicPlayer(b).name,'en',{sensitivity:'base'});}
export function eventResponses(state,event){const responses={...event.responses};if(state.players.some(p=>p.slug===HOST))responses[HOST]={...(responses[HOST]||{}),answer:'yes',order:0};return responses;}
export function eventPoster(metadata){
 const choice=metadata.poster||'auto';if(choice==='none')return null;
 const file=choice==='auto'?(/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)?`fw${metadata.date.slice(2)}.jpg`:null):choice;
 return file&&/^fw\d{2}-\d{2}-\d{2}\.jpg$/.test(file)?{file,url:`https://tlpt.org/images/fw/${file}`,thumbnailUrl:`https://tlpt.org/images/fw/thumbs/${file}`}:null;
}
export function publicFeed(state, now = new Date()){
 const players=[...state.players].sort(comparePlayers);
  return {schemaVersion:1,revision:state.revision,updatedAt:state.updatedAt,noGameDays:noGameDays(state.events,now),players:players.map(publicPlayer),cancelledEvents:state.events.filter(e=>e.cancelled&&!e.deletedAt).map(e=>({id:e.id,title:e.metadata.title,date:e.metadata.date})),events:state.events.filter(liveEvent).sort(compareEvents).map(e=>{
  const responses=eventResponses(state,e);
  const queue=Object.entries(responses).filter(([,r])=>r.answer==='yes').sort((a,b)=>a[0]===HOST?-1:b[0]===HOST?1:a[1].order-b[1].order||a[0].localeCompare(b[0]));
  const confirmed=new Set(queue.slice(0,e.capacity).map(([s])=>s));
  const waitlist=queue.slice(e.capacity).map(([slug],i)=>({slug,position:i+1}));
  return {...e.metadata,poster:eventPoster(e.metadata),id:e.id,capacity:e.capacity,rsvpOpen:e.open,hostLocked:state.players.some(p=>p.slug===HOST),rsvp_url:`https://tlpt-rsvp.tlpt-bostnmike.workers.dev/?event=${encodeURIComponent(e.id)}`,rsvps:Object.fromEntries(players.map(p=>[p.slug,responses[p.slug]?.answer==='yes'?(confirmed.has(p.slug)?'yes':'maybe'):(responses[p.slug]?.answer||'tbd')])),waitlist,requestedIn:queue.map(([slug])=>slug),rsvpUpdatedAt:state.updatedAt};
 })};
}
export function playerView(state,slug){return {player:state.players.find(p=>p.slug===slug)&&publicPlayer(state.players.find(p=>p.slug===slug)),...publicFeed(state),responses:Object.fromEntries(state.events.filter(liveEvent).map(e=>[e.id,eventResponses(state,e)[slug]?.answer||'tbd']))};}
export function validateMetadata(raw){
 const fields=['title','format','slot','day','date','time','endTime','location','address','structure'];const m={};
 for(const k of fields){requireValue(typeof raw[k]==='string'&&raw[k].length<=250,`Invalid ${k}.`);m[k]=raw[k].trim();}
 requireValue(m.title&&['friday','saturday','mtt'].includes(m.slot),'Choose a title and event type.');
 requireValue(m.date==='Date TBD'||/^\d{4}-\d{2}-\d{2}$/.test(m.date)&&Number.isFinite(Date.parse(m.date+'T12:00:00Z'))&&new Date(m.date+'T12:00:00Z').toISOString().slice(0,10)===m.date,'Choose a calendar date or Date TBD.');
 requireValue(/^(?:1[0-2]|[1-9]):[0-5]\d [AP]M$/.test(m.time)&&/^(?:1[0-2]|[1-9]):[0-5]\d [AP]M$/.test(m.endTime),'Use times such as 7:00 PM.');
 const poster=raw.poster||'auto';requireValue(typeof poster==='string'&&/^(auto|none|fw\d{2}-\d{2}-\d{2}\.jpg)$/.test(poster),'Choose a poster from the TLPT gallery.');
 m.poster=poster;m.tables=m.slot==='mtt'?2:1;return m;
}
export function applyOperation(state,actor,op,now=new Date().toISOString()){
 const admin=actor.role==='admin';
 if(op.type==='respond'){
  const slug=admin?op.slug:actor.slug;
  requireValue(admin||!op.slug||op.slug===actor.slug,'This link belongs to another player.',403);
  requireValue(state.players.some(p=>p.slug===slug),'Unknown player.');
  const e=state.events.find(e=>e.id===op.eventId);requireValue(e&&liveEvent(e),'Event unavailable.',404);
  requireValue(admin||e.open,'RSVPs are closed. Contact The Commish.',409);
  requireValue(['yes','maybe','no','tbd'].includes(op.answer),'Choose In, Maybe or Out.');
  requireValue(slug!==HOST||op.answer==='yes','No Bostn, No Party. The host is always In.',409);
  const old=e.responses[slug];e.responses[slug]={answer:op.answer,order:op.answer==='yes'&&old?.answer==='yes'?old.order:++state.sequence,updatedAt:now};
 }else{
  requireValue(admin,'Commish sign-in required.',403);
  if(op.type==='link'){
   const p=state.players.find(p=>p.slug===op.slug);requireValue(p,'Unknown player.');p.linkHash=op.hash;p.generation++;
  }else if(op.type==='event'){
   requireValue(Number.isInteger(op.capacity)&&op.capacity>=1&&op.capacity<=90,'Capacity must be 1–90.');
   requireValue(typeof op.open==='boolean','Choose open or closed.');
   const metadata=validateMetadata(op.metadata);
   requireValue(metadata.date!=='Date TBD'||!op.open,'Keep undated events closed until a date is confirmed.');
   let e=state.events.find(e=>e.id===op.eventId);
   if(e){
    requireValue(liveEvent(e),'Restore this event before editing it.',409);
    requireValue(e.metadata.slot===metadata.slot,'Event type cannot change. Create a new event for a different game type.');
    requireValue(!state.events.some(other=>other!==e&&liveEvent(other)&&other.metadata.slot===metadata.slot&&other.metadata.date===metadata.date),'This event type and date already exist.',409);
    e.metadata={...e.metadata,...metadata};e.capacity=op.capacity;e.open=op.open;
   }else{
    requireValue(!op.eventId,'Unknown event.');requireValue(state.events.length<100,'Event archive is full. Export a backup and contact maintenance.');
    requireValue(!state.events.some(e=>liveEvent(e)&&e.metadata.slot===metadata.slot&&e.metadata.date===metadata.date),'This event type and date already exist.');
    state.events.push({id:op.newId,metadata,responses:{},capacity:op.capacity,open:op.open,archived:false});
   }
  }else if(['archive','cancel','delete','restore'].includes(op.type)){
   const e=state.events.find(e=>e.id===op.eventId);requireValue(e,'Unknown event.');
   const restoring=op.type==='restore'||op.type==='archive'&&e.archived;
   requireValue(!restoring||!state.events.some(other=>other!==e&&liveEvent(other)&&other.metadata.slot===e.metadata.slot&&other.metadata.date===e.metadata.date),'Another event already uses this date and type.',409);
   if(restoring){e.archived=false;e.cancelled=false;e.deletedAt=null;}
   else if(op.type==='cancel'){requireValue(!e.deletedAt,'Restore this event first.',409);e.cancelled=true;e.cancelledAt=now;}
   else if(op.type==='delete')e.deletedAt=now;
   else e.archived=true;
   e.open=false;
  }else if(op.type==='promote'){
   const e=state.events.find(e=>e.id===op.eventId);requireValue(e&&liveEvent(e)&&e.responses[op.slug]?.answer==='yes','Player must request In.');
   const orders=Object.values(e.responses).filter(r=>r.answer==='yes').map(r=>r.order);e.responses[op.slug].order=Math.min(0,...orders)-1;
  }else throw new Rejected('Unknown operation.');
 }
 // Host reservation is enforced on every successful save, including legacy records.
 if(state.players.some(p=>p.slug===HOST))for(const e of state.events.filter(liveEvent))e.responses[HOST]={...(e.responses[HOST]||{}),answer:'yes',order:0,updatedAt:e.responses[HOST]?.answer==='yes'?e.responses[HOST].updatedAt:now};
 state.revision++;state.updatedAt=now;
 state.audit.push({at:now,actor:admin?'commish':actor.role==='shared'?'shared:'+actor.slug:actor.slug,type:op.type,eventId:op.eventId||null,slug:op.slug||actor.slug||null});state.audit=state.audit.slice(-500);
 return state;
}
