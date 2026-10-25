// No contact, financial, or historical result data belongs in this service.
export class Rejected extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function requireValue(ok,message,status=400){if(!ok)throw new Rejected(message,status);}
export function publicFeed(state){
 return {schemaVersion:1,revision:state.revision,updatedAt:state.updatedAt,players:state.players.map(publicPlayer),events:state.events.filter(e=>!e.archived).map(e=>{
  const queue=Object.entries(e.responses).filter(([,r])=>r.answer==='yes').sort((a,b)=>a[1].order-b[1].order||a[0].localeCompare(b[0]));
  const confirmed=new Set(queue.slice(0,e.capacity).map(([s])=>s));
  const waitlist=queue.slice(e.capacity).map(([slug],i)=>({slug,position:i+1}));
  return {...e.metadata,id:e.id,capacity:e.capacity,rsvpOpen:e.open,rsvp_url:`https://tlpt-rsvp.tlpt-bostnmike.workers.dev/?event=${encodeURIComponent(e.id)}`,rsvps:Object.fromEntries(state.players.map(p=>[p.slug,e.responses[p.slug]?.answer==='yes'?(confirmed.has(p.slug)?'yes':'maybe'):(e.responses[p.slug]?.answer||'tbd')])),waitlist,requestedIn:queue.map(([slug])=>slug),rsvpUpdatedAt:state.updatedAt};
 })};
}
export function playerView(state,slug){return {player:state.players.find(p=>p.slug===slug)&&publicPlayer(state.players.find(p=>p.slug===slug)),...publicFeed(state),responses:Object.fromEntries(state.events.map(e=>[e.id,e.responses[slug]?.answer||'tbd']))};}
export const publicPlayer=p=>({slug:p.slug,name:p.name,image:p.image,rosterStatus:p.rosterStatus});
export function validateMetadata(raw){
 const fields=['title','format','slot','day','date','time','endTime','location','address','structure'];const m={};
 for(const k of fields){requireValue(typeof raw[k]==='string'&&raw[k].length<=250,`Invalid ${k}.`);m[k]=raw[k].trim();}
 requireValue(m.title&&['friday','saturday','mtt'].includes(m.slot),'Choose a title and event type.');
 requireValue(m.date==='Date TBD'||/^\d{4}-\d{2}-\d{2}$/.test(m.date)&&Number.isFinite(Date.parse(m.date+'T12:00:00Z'))&&new Date(m.date+'T12:00:00Z').toISOString().slice(0,10)===m.date,'Use YYYY-MM-DD or Date TBD.');
 requireValue(/^(?:1[0-2]|[1-9]):[0-5]\d [AP]M$/.test(m.time)&&/^(?:1[0-2]|[1-9]):[0-5]\d [AP]M$/.test(m.endTime),'Use times such as 7:00 PM.');
 m.tables=m.slot==='mtt'?2:1;return m;
}
export function applyOperation(state,actor,op,now=new Date().toISOString()){
 const admin=actor.role==='admin';
 if(op.type==='respond'){
  const slug=admin?op.slug:actor.slug;
  requireValue(admin||!op.slug||op.slug===actor.slug,'This link belongs to another player.',403);
  requireValue(state.players.some(p=>p.slug===slug),'Unknown player.');
  const e=state.events.find(e=>e.id===op.eventId);requireValue(e&&!e.archived,'Event unavailable.',404);
  requireValue(admin||e.open,'RSVPs are closed. Contact The Commish.',409);
  requireValue(['yes','maybe','no','tbd'].includes(op.answer),'Choose In, Maybe or Out.');
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
    requireValue(e.metadata.slot===metadata.slot&&e.metadata.date===metadata.date,'Event date/type cannot change. Create a new event to protect ledger identities.');
    e.metadata={...e.metadata,...metadata};e.capacity=op.capacity;e.open=op.open;
   }else{
    requireValue(!op.eventId,'Unknown event.');requireValue(state.events.length<100,'Event archive is full. Export a backup and contact maintenance.');
    requireValue(!state.events.some(e=>!e.archived&&e.metadata.slot===metadata.slot&&e.metadata.date===metadata.date),'This event type and date already exist.');
    state.events.push({id:op.newId,metadata,responses:{},capacity:op.capacity,open:op.open,archived:false});
   }
  }else if(op.type==='archive'){
   const e=state.events.find(e=>e.id===op.eventId);requireValue(e,'Unknown event.');
   requireValue(!e.archived||!state.events.some(other=>other!==e&&!other.archived&&other.metadata.slot===e.metadata.slot&&other.metadata.date===e.metadata.date),'Another event already uses this date and type.',409);
   e.archived=!e.archived;e.open=false;
  }else if(op.type==='promote'){
   const e=state.events.find(e=>e.id===op.eventId);requireValue(e&&e.responses[op.slug]?.answer==='yes','Player must request In.');
   const orders=Object.values(e.responses).filter(r=>r.answer==='yes').map(r=>r.order);e.responses[op.slug].order=Math.min(0,...orders)-1;
  }else throw new Rejected('Unknown operation.');
 }
 state.revision++;state.updatedAt=now;
 state.audit.push({at:now,actor:admin?'commish':actor.slug,type:op.type,eventId:op.eventId||null,slug:op.slug||actor.slug||null});state.audit=state.audit.slice(-500);
 return state;
}
