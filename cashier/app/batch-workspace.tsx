'use client';
import {useEffect,useRef,useState} from 'react';
import {Plus,Layers,ArrowLeft,Trash2,Mail} from 'lucide-react';
import PlayerPicker from './player-picker';
import PlayerAvatar from './player-avatar';
import BatchPlayerSelector from './batch-player-selector';
import type {Event,Payment,VenmoAlias} from '@/lib/register-types';
import type {PlayerProfile} from '@/lib/player-directory';
import {paymentKinds,paymentSelection} from '@/lib/events.mjs';
import {resolvePaymentPlayer} from '@/lib/venmo-aliases.mjs';
import {resolvePlayer} from '@/lib/players.mjs';
import {batchPlan,remainingCoverage,MAX_BATCH_GROUPS} from '@/lib/batch-payments.mjs';
export type ReceiptLink={receipt_id:string;payment_id:string;cents:number};
type Allocation={id:string;player:string;items:string[];method?:string};
type Target={paymentId:string;expectedUpdatedAt:string;amount:string};
type Group={id:string;action:string;method:string;paymentId?:string;expectedUpdatedAt?:string;allocations:Allocation[];targets:Target[];rememberPayer:boolean};
type Props={event:Event;payments:Payment[];links:ReceiptLink[];players:PlayerProfile[];aliases:VenmoAlias[];initialPayments:Payment[];onClose:()=>void;onRefresh:()=>Promise<void>;onSaved:(result:any,id:string)=>Promise<void>;onPrepare:()=>void};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:n%100?2:0}).format(n/100);
const kinds=['entry','rebuy','food'];
const storageKey='tlpt:pending-batch';
const newRow=(player=''):Allocation=>({id:crypto.randomUUID(),player,items:['entry']});
function centsFromAmount(value:string){const text=value.trim();if(!/^(?:\d+|\d*\.\d{1,2})$/.test(text)||Number(text)<=0)throw Error('Enter positive matching amounts with up to two decimal places.');return Math.round(Number(text)*100);}
function pendingBatch(){try{return JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{return null;}}
export default function BatchWorkspace({event,payments,links,players,aliases,initialPayments,onClose,onRefresh,onSaved,onPrepare}:Props){
 const [prices]=useState(event),requestId=useRef(crypto.randomUUID()),submission=useRef<any>(null),saving=useRef(false),heading=useRef<HTMLHeadingElement>(null);
 const name=(p:Payment)=>resolvePaymentPlayer(p,players,aliases)?.name||p.player||p.payer;
 const manualTargets=payments.filter(p=>p.event_id===event.id&&p.status==='confirmed'&&p.method==='venmo'&&p.source_id.startsWith('manual:')&&remainingCoverage(p,links)>0);
 function receiptGroup(p:Payment):Group{
  const player=name(p),possible=manualTargets.filter(t=>t.player===player&&remainingCoverage(t,links)===p.cents);
  return {id:crypto.randomUUID(),action:possible.length===1?'link':'confirm',method:'venmo',paymentId:p.id,expectedUpdatedAt:p.updated_at,allocations:[{...newRow(player),items:paymentKinds(p.kind).length?paymentKinds(p.kind):['entry']}],targets:possible.length===1?[{paymentId:possible[0].id,expectedUpdatedAt:possible[0].updated_at,amount:String(p.cents/100)}]:[],rememberPayer:false};
 }
 const [groups,setGroups]=useState<Group[]>(()=>{
  const saved=pendingBatch();if(saved?.eventId===event.id){requestId.current=saved.requestId;submission.current=saved;return saved.groups.map((g:any)=>({...g,method:g.method||'venmo',allocations:g.allocations||[],targets:(g.targets||[]).map((t:any)=>({...t,amount:String(t.cents/100)}))}));}
  return initialPayments.length?initialPayments.slice(0,MAX_BATCH_GROUPS).map(receiptGroup):[{id:crypto.randomUUID(),action:'manual',method:'venmo',allocations:[],targets:[],rememberPayer:false}];
 });
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(!!submission.current),[checked,setChecked]=useState(!!submission.current?.checked),[deleteChecked,setDeleteChecked]=useState(!!submission.current?.deleteAcknowledged),[error,setError]=useState(''),[rosterGroup,setRosterGroup]=useState(()=>!submission.current&&groups[0]?.action==='manual'?groups[0].id:''),[recordSelected,setRecordSelected]=useState<string[]>([]);
 const locked=busy||uncertain;
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});},[]);
 const names=Array.from(new Set([...players.map(p=>p.name),...event.roster.map(slug=>players.find(p=>p.slug===slug)?.name||slug),...payments.map(p=>p.player).filter(Boolean)]));
 const preferred=event.roster.map(slug=>players.find(p=>p.slug===slug)?.name||slug);
 const paidNames=new Set(payments.filter(p=>p.event_id===event.id&&p.status==='confirmed'&&paymentKinds(p.kind).includes('entry')).map(name));
 const pending=payments.filter(p=>p.status==='review'&&!groups.some(g=>g.paymentId===p.id));
 const records=payments.filter(p=>p.event_id===event.id&&['confirmed','void','ignored'].includes(p.status)&&!groups.some(g=>g.paymentId===p.id));
 const priceChanged=JSON.stringify(prices.rules)!==JSON.stringify(event.rules);
 const label=(kind:string)=>kind==='entry'?(prices.rules.bounty?'Buy-in + bounty':'Buy-in'):kind==='rebuy'?'Rebuy':'Food';
 const total=(rows:Allocation[])=>rows.reduce((n,row)=>{try{return n+paymentSelection(prices,row.items).cents;}catch{return n;}},0);
 function edit(update:(list:Group[])=>Group[]){if(locked)return;setGroups(update);setChecked(false);setDeleteChecked(false);setError('');requestId.current=crypto.randomUUID();}
 function patch(id:string,values:Partial<Group>){edit(list=>list.map(g=>g.id===id?{...g,...values}:g));}
 function patchRow(group:Group,id:string,values:Partial<Allocation>){patch(group.id,{allocations:group.allocations.map(r=>r.id===id?{...r,...values}:r)});}
 function payload(){return {action:'batch',eventId:event.id,requestId:requestId.current,checked:true,deleteAcknowledged:deleteChecked,groups:groups.map(g=>({...g,allocations:['manual','confirm'].includes(g.action)?g.allocations.map(row=>({...row,cents:paymentSelection(prices,row.items).cents})):[],targets:g.action==='link'?g.targets.map(t=>({paymentId:t.paymentId,expectedUpdatedAt:t.expectedUpdatedAt,cents:centsFromAmount(t.amount)})):[]}))};}
 let validation='',summary:any=null;
 try{if(priceChanged)throw Error('Event prices changed. Close this workspace and reopen it to review the new amounts.');summary=batchPlan({input:payload(),event:prices,payments,links,players,actor:'preview',now:'preview'}).result;}catch(e){validation=e instanceof Error?e.message:'Review this batch.';}
 const deletions=groups.filter(g=>g.action==='delete').length;
 const credited=groups.filter(g=>['manual','confirm'].includes(g.action)).flatMap(g=>g.allocations),entryCount=credited.filter(r=>r.items.includes('entry')).length,foodCount=credited.filter(r=>r.items.includes('food')).length;
 async function save(){
  if(saving.current||(!uncertain&&(!checked||validation||deletions&&!deleteChecked)))return;
  saving.current=true;setBusy(true);setError('');onPrepare();
  const input=submission.current||payload();submission.current=input;
  try{sessionStorage.setItem(storageKey,JSON.stringify(input));}catch{/* In-memory request identity still protects retries in this tab. */}
  try{
   const response=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   const result:any=await response.json();
   if(!response.ok){
    if(response.status===409||response.status===400||response.status===403){submission.current=null;setUncertain(false);try{sessionStorage.removeItem(storageKey);}catch{}requestId.current=crypto.randomUUID();setChecked(false);setDeleteChecked(false);await onRefresh();}
    else setUncertain(true);
    throw Error(result.error||'Could not confirm the batch. Retry this same batch safely.');
   }
   try{sessionStorage.removeItem(storageKey);}catch{}submission.current=null;setUncertain(false);await onSaved(result,input.requestId);
  }catch(e){if(submission.current)setUncertain(true);setError(e instanceof Error?e.message:'Connection interrupted. Retry this same batch safely.');}
  finally{saving.current=false;setBusy(false);}
 }
 function addReceipts(list:Payment[]){edit(current=>[...current,...list.slice(0,MAX_BATCH_GROUPS-current.length).map(receiptGroup)]);}
 function addManagement(action:string){edit(current=>[...current,...records.filter(p=>recordSelected.includes(p.id)&&(action==='delete'||p.status==='confirmed')).slice(0,MAX_BATCH_GROUPS-current.length).map(p=>({id:crypto.randomUUID(),action,method:p.method,paymentId:p.id,expectedUpdatedAt:p.updated_at,allocations:[],targets:[],rememberPayer:false}))]);setRecordSelected([]);}
 function addManualGroup(){const group:Group={id:crypto.randomUUID(),action:'manual',method:'venmo',allocations:[],targets:[],rememberPayer:false};edit(list=>[...list,group]);setRosterGroup(group.id);}
 return <section className="batch-workspace" aria-label="Batch payments">
  <header className="batch-heading"><div><p className="eyebrow"><Layers size={16} aria-hidden="true"/> AT THE REGISTER</p><h2 ref={heading} tabIndex={-1}>Batch payments</h2><p>{event.title} · {event.dateLabel}</p></div><button disabled={locked} onClick={onClose}><ArrowLeft aria-hidden="true"/>Back to register</button></header>
  <p className="batch-help">Choose each player’s items, then save everything together. Match emails to recorded payments to keep totals unchanged.</p>
  {uncertain&&<p className="banner" role="status">This batch may already be saved. Retry the same batch to check safely. Editing is paused until its result is confirmed. If your session expired, <a href="/auth/login" target="_blank" rel="noreferrer">sign in in another tab</a>, then retry here.</p>}
  <div className="batch-tools"><button disabled={locked||groups.length>=MAX_BATCH_GROUPS} onClick={addManualGroup}><Plus aria-hidden="true"/>Add manual payments</button>{pending.length>0&&<button disabled={locked||groups.length>=MAX_BATCH_GROUPS} onClick={()=>addReceipts(pending)}><Mail aria-hidden="true"/>Add open receipts ({pending.length})</button>}<span>{groups.length} of {MAX_BATCH_GROUPS} groups</span></div>
  <div className="batch-groups">{groups.map((group,index)=>{
   const receipt=payments.find(p=>p.id===group.paymentId),isNew=['manual','confirm'].includes(group.action),groupTotal=group.action==='link'?group.targets.reduce((n,t)=>n+Math.round(Number(t.amount)*100||0),0):total(group.allocations);
   const distinct=Array.from(new Set(group.action==='link'?group.targets.map(t=>payments.find(p=>p.id===t.paymentId)?.player||''):group.allocations.map(r=>r.player))),rememberProfile=distinct.length===1?resolvePlayer({player:distinct[0]},players):null;
   return <article className="batch-group" key={group.id} aria-label={'Payment group '+(index+1)}>
    <header><div><p className="eyebrow">{group.action==='manual'?'MANUAL PAYMENTS':'PAYMENT '+(index+1)}</p><h3>{receipt?name(receipt):'Cash / Venmo entries'}</h3>{receipt&&<p>{money(receipt.cents)} · {receipt.payer} · {receipt.note||'No note'}</p>}</div><button disabled={locked} aria-label={'Remove payment group '+(index+1)} onClick={()=>edit(list=>list.filter(g=>g.id!==group.id))}>Remove</button></header>
    <div className="batch-group-options">{receipt?.status==='review'?<label>Handle receipt<select disabled={locked} value={group.action} onChange={e=>patch(group.id,{action:e.target.value,rememberPayer:false})}><option value="confirm">Confirm as new payment</option><option value="link">Match recorded payments</option><option value="ignore">Exclude from this event</option><option value="delete">Delete transaction</option></select></label>:group.action==='manual'?<label>Default payment method<select disabled={locked} value={group.method} onChange={e=>patch(group.id,{method:e.target.value,allocations:group.allocations.map(r=>({...r,method:e.target.value}))})}><option value="venmo">Venmo — verified</option><option value="cash">Cash — received</option></select></label>:<b>{group.action==='void'?'Void accounting record':'Delete transaction'} · {receipt?money(receipt.cents):''}</b>}
    {isNew&&<><button className="primary" disabled={locked} aria-expanded={rosterGroup===group.id} onClick={()=>setRosterGroup(rosterGroup===group.id?'':group.id)}>Select players</button><button disabled={locked} onClick={()=>patch(group.id,{allocations:[...group.allocations,newRow()],rememberPayer:false})}><Plus aria-hidden="true"/>Add guest / one player</button></>}</div>
    {rosterGroup===group.id&&isNew&&<BatchPlayerSelector key={group.id} names={names} players={players} preferredNames={preferred} addedNames={group.allocations.map(r=>r.player).filter(Boolean)} paidNames={paidNames} disabled={locked} onAdd={selected=>{patch(group.id,{allocations:[...group.allocations.filter(r=>r.player),...selected.filter(player=>!group.allocations.some(r=>r.player===player)).map(player=>({...newRow(player),items:group.action==='manual'&&paidNames.has(player)?['rebuy']:['entry']}))],rememberPayer:false});setRosterGroup('');}}/>}
    {isNew&&<div className="batch-allocations">{group.allocations.map((row,rowIndex)=>{let cents=0;try{cents=paymentSelection(prices,row.items).cents;}catch{}return <div className="batch-player-row" key={row.id} aria-label={'Player allocation '+(rowIndex+1)+' in group '+(index+1)}><PlayerPicker value={row.player} onChange={player=>{patchRow(group,row.id,{player});}} names={names} players={players} preferredNames={preferred} disabled={locked}/><div className="batch-item-buttons" role="group" aria-label={'Items for '+(row.player||'player '+(rowIndex+1))}>{kinds.map(kind=><button disabled={locked||!(prices.rules as any)[kind]} aria-pressed={row.items.includes(kind)} key={kind} onClick={()=>patchRow(group,row.id,{items:row.items.includes(kind)?row.items.filter(k=>k!==kind):[...row.items,kind]})}><span>{row.items.includes(kind)?'✓ ':''}{label(kind)}</span><b>{money((prices.rules as any)[kind])}</b></button>)}</div>{group.action==='manual'&&<label>Method<select disabled={locked} value={row.method||group.method} onChange={e=>patchRow(group,row.id,{method:e.target.value})}><option value="venmo">Venmo</option><option value="cash">Cash</option></select></label>}<strong>{money(cents)}</strong><button disabled={locked} aria-label={'Remove '+(row.player||'player '+(rowIndex+1))+' allocation'} onClick={()=>patch(group.id,{allocations:group.allocations.filter(r=>r.id!==row.id),rememberPayer:false})}>×</button></div>;})}</div>}
    {group.action==='link'&&<div className="batch-match-list"><p>Select the recorded payment(s) covered by this email. Adjust amounts when separate emails cover parts of one record. <b>No new money is added.</b></p><button disabled={locked||!group.targets.length} onClick={()=>patch(group.id,{targets:[],rememberPayer:false})}>Clear matches</button>{manualTargets.length?manualTargets.map(target=>{
     const selected=group.targets.find(t=>t.paymentId===target.id),other=groups.filter(g=>g.id!==group.id&&g.action==='link').flatMap(g=>g.targets).filter(t=>t.paymentId===target.id).reduce((n,t)=>n+Math.round(Number(t.amount)*100||0),0),remaining=remainingCoverage(target,links)-other;
     return <div className="batch-match-row" key={target.id}><label className="check"><input type="checkbox" disabled={locked||!selected&&(remaining<=0||groupTotal>=(receipt?.cents||0))} checked={!!selected} onChange={()=>patch(group.id,{rememberPayer:false,targets:selected?group.targets.filter(t=>t.paymentId!==target.id):[...group.targets,{paymentId:target.id,expectedUpdatedAt:target.updated_at,amount:String(Math.min(remaining,Math.max(0,(receipt?.cents||0)-groupTotal))/100)}]})}/><PlayerAvatar name={target.player} image={resolvePlayer({player:target.player},players)?.image}/><span><b>{target.player}</b><small>{money(Math.max(0,remaining))} unmatched · {money(target.cents)} recorded</small></span></label>{selected&&<label>Amount ($)<input aria-label={'Match amount for '+target.player+' in receipt '+(index+1)} disabled={locked} type="text" inputMode="decimal" autoComplete="off" value={selected.amount} onChange={e=>patch(group.id,{targets:group.targets.map(t=>t.paymentId===target.id?{...t,amount:e.target.value}:t)})}/></label>}</div>;
    }):<p>No unmatched manual Venmo payments for this event. Record them first, or confirm this as a new payment.</p>}</div>}
    {receipt&&['confirm','link'].includes(group.action)&&rememberProfile&&<label className="check batch-remember"><input type="checkbox" disabled={locked} checked={group.rememberPayer} onChange={e=>patch(group.id,{rememberPayer:e.target.checked})}/>Remember {receipt.payer} as {rememberProfile.name}</label>}
    {isNew||group.action==='link'?<footer className={receipt&&groupTotal!==receipt.cents?'batch-unbalanced':''}><b>{group.action==='link'?'Matched':'Allocated'} {money(groupTotal)}</b>{receipt&&<span>of {money(receipt.cents)} receipt · {groupTotal===receipt.cents?'Balanced':money(receipt.cents-groupTotal)+' remaining'}</span>}</footer>:<p className="batch-action-note">{group.action==='delete'?'Permanently removes this transaction and its allocations. This cannot be undone and sends no refund.':group.action==='void'?'Removes this amount from totals and retains a voided record. No refund is sent.':'Keeps this receipt outside event totals.'}</p>}
   </article>;
  })}</div>
  {pending.length>0&&<details className="batch-source-list"><summary>Open receipts not yet in this batch ({pending.length})</summary>{pending.map(p=><div key={p.id}><span><b>{name(p)}</b> · {money(p.cents)}<small>{p.note||'No note'}</small></span><button disabled={locked||groups.length>=MAX_BATCH_GROUPS} onClick={()=>addReceipts([p])}>Add to batch</button></div>)}</details>}
  <details className="batch-source-list"><summary>Void or delete several recorded transactions</summary><p>Select records, then choose an action. Nothing changes until you save the batch below.</p><div className="batch-tools"><button disabled={locked||!recordSelected.length} onClick={()=>addManagement('void')}>Stage voids</button><button disabled={locked||!recordSelected.length} onClick={()=>addManagement('delete')}><Trash2 aria-hidden="true"/>Stage deletions</button></div>{records.map(p=><label className="check" key={p.id}><input disabled={locked} type="checkbox" checked={recordSelected.includes(p.id)} onChange={()=>setRecordSelected(list=>list.includes(p.id)?list.filter(id=>id!==p.id):[...list,p.id])}/><span>{name(p)} · {money(p.cents)} · {p.status}</span></label>)}</details>
  <section className="batch-save" aria-label="Batch review"><div><h3>Review & save together</h3><p>{groups.length} {groups.length===1?'group':'groups'} · {summary?<>Entries {entryCount} · Food {foodCount} · Add {money(summary.addedCents)} · Remove {money(summary.removedCents)} · {summary.linkedReceipts} receipt matches</>:'Complete the selections above.'}</p></div>{validation&&!uncertain&&<p className="banner" role="status">{validation}</p>}{error&&<p className="banner error" role="alert">{error}</p>}<label className="check"><input type="checkbox" checked={checked} disabled={locked} onChange={e=>setChecked(e.target.checked)}/>I reviewed every selected payment and verified Venmo receipts or received the cash.</label>{deletions>0&&<label className="check"><input type="checkbox" checked={deleteChecked} disabled={locked} onChange={e=>setDeleteChecked(e.target.checked)}/>Permanently delete {deletions} selected transactions. I understand this cannot be undone and sends no refunds.</label>}<button className="primary" disabled={busy||!uncertain&&(!checked||!!validation||deletions>0&&!deleteChecked)} onClick={()=>void save()}>{busy?'Saving batch…':uncertain?'Retry same batch safely':'Save batch · '+groups.length+(groups.length===1?' group':' groups')}</button><p className="batch-help">One save. Each player keeps their own buy-in, bounty, rebuy and food breakdown. Receipt matches never add the payment twice.</p></section>
 </section>;
}
