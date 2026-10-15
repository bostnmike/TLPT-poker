import {resolvePlayer,newestPayments} from './players.mjs';
import {resolvePaymentPlayer} from './venmo-aliases.mjs';
import {paymentKinds} from './events.mjs';
import {paymentPortion} from './payment-portions.mjs';
const key=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const displayName=slug=>String(slug).split('-').map(word=>word[0]?.toUpperCase()+word.slice(1)).join(' ');
export function paymentCanBelongTo(payment,eventId){
 if(payment.event_id)return payment.event_id===eventId;
 try{return JSON.parse(payment.candidate_event_ids||'[]').includes(eventId);}catch{return false;}
}
export function buildRsvpChecklist(event,payments,players,aliases=[]){
 const members=new Map();
 for(const rsvp of event.rsvps||[]){
  if(rsvp.answer!=='yes')continue;
  const profile=resolvePlayer({player:rsvp.player},players),id=profile?.slug||key(rsvp.player);
  if(!id||members.has(id))continue;
  members.set(id,{id,name:profile?.name||displayName(rsvp.player),image:profile?.image,slug:rsvp.player,known:!!profile,confirmed:[],pending:[]});
 }
 const eligible=newestPayments(payments.filter(p=>paymentCanBelongTo(p,event.id))),unmatched=[];
 for(const payment of eligible){
  if(!['confirmed','review'].includes(payment.status))continue;
  if(payment.status==='confirmed'&&payment.event_id!==event.id)continue;
  const profile=resolvePaymentPlayer(payment,players,aliases),identity=payment.player||payment.payer;
  const ambiguous=!profile&&players.some(p=>[p.name,p.slug,...(p.aliases||[])].some(alias=>key(alias)===key(identity)));
  // An explicit cashier assignment wins over the sender's name. Ambiguous matches stay open.
  const matches=ambiguous?[]:[...members.values()].filter(member=>profile?member.id===profile.slug:!member.known&&[member.slug,member.name].some(name=>key(name)===key(identity)));
  if(matches.length!==1){if(payment.status==='review')unmatched.push(payment);continue;}
  matches[0][payment.status==='confirmed'?'confirmed':'pending'].push(payment);
 }
 const rows=[...members.values()].map(member=>{
  const entries=member.confirmed.filter(p=>paymentKinds(p.kind).includes('entry'));
  const entryPending=member.pending.some(p=>!paymentKinds(p.kind).length||paymentKinds(p.kind).includes('entry'));
  return {...member,entryPaid:entries.length>0,status:entries.length?'paid':entryPending?'review':'unpaid',entryCents:entries.reduce((sum,p)=>sum+(paymentPortion(p,'entry')||0),0),foodCents:member.confirmed.reduce((sum,p)=>sum+(paymentPortion(p,'food')||0),0),rebuys:member.confirmed.filter(p=>paymentKinds(p.kind).includes('rebuy')).length};
 }).sort((a,b)=>({review:0,unpaid:1,paid:2}[a.status]-{review:0,unpaid:1,paid:2}[b.status])||a.name.localeCompare(b.name));
 return {rows,unmatched,pending:eligible.filter(p=>p.status==='review'),expected:rows.length,paid:rows.filter(p=>p.entryPaid).length};
}
