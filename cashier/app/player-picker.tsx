'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,Check,UserPlus} from 'lucide-react';
import PlayerAvatar from './player-avatar';
import type {PlayerProfile} from '@/lib/player-directory';
import {resolvePlayer} from '@/lib/players.mjs';

export default function PlayerPicker({value,onChange,names,players,preferredNames,disabled}:{value:string;onChange:(name:string)=>void;names:string[];players:PlayerProfile[];preferredNames:string[];disabled:boolean}){
 const [open,setOpen]=useState(false),[guest,setGuest]=useState(false),[guestName,setGuestName]=useState('');
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null),id=useId();
 const selected=resolvePlayer({player:value},players);
 const choices=Array.from(new Map(names.map(name=>{const p=resolvePlayer({player:name},players);const choice={name:p?.name||name,image:p?.image};return [choice.name.toLowerCase(),choice] as const;})).values()).sort((a,b)=>a.name.localeCompare(b.name));
 const preferred=new Set(preferredNames.map(name=>resolvePlayer({player:name},players)?.name||name));
 const scheduled=choices.filter(p=>preferred.has(p.name)),other=choices.filter(p=>!preferred.has(p.name));
 function choose(name:string){onChange(name);setOpen(false);}
 useEffect(()=>{
  if(!open)return;
  const background=trigger.current?.closest('main'),wasInert=background?.hasAttribute('inert')||false;
  if(background)background.setAttribute('inert','');
  panel.current?.focus({preventScroll:true});
  function keys(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);return;}
   if(event.key!=='Tab')return;
   const controls=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')||[]).filter(e=>e.getClientRects().length);
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last?.focus({preventScroll:true});}
   else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){event.preventDefault();first?.focus({preventScroll:true});}
  }
  document.addEventListener('keydown',keys,true);
  return()=>{document.removeEventListener('keydown',keys,true);if(background&&!wasInert)background.removeAttribute('inert');trigger.current?.focus({preventScroll:true});};
 },[open]);
 const tiles=(list:typeof choices)=><div className="player-picker-grid">{list.map(p=><button type="button" key={p.name} aria-pressed={(selected?.name||value)===p.name} onClick={()=>choose(p.name)}><PlayerAvatar {...p}/><span>{p.name}</span>{(selected?.name||value)===p.name&&<Check aria-hidden="true"/>}</button>)}</div>;
 return <div className="player-picker-field"><span id={id+'-label'}>TLPT player</span><button ref={trigger} type="button" className="player-picker-trigger" aria-labelledby={id+'-label '+id+'-value'} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={()=>{setGuest(false);setGuestName('');setOpen(true);}}>{value&&<PlayerAvatar name={selected?.name||value} image={selected?.image}/>}<span id={id+'-value'}>{selected?.name||value||'Choose player'}</span><ChevronDown aria-hidden="true"/></button>
 {open&&createPortal(<div className="overlay player-picker-overlay"><section ref={panel} tabIndex={-1} className="modal player-picker-panel" role="dialog" aria-modal="true" aria-labelledby={id+'-title'}><header><p className="eyebrow">CASHIER</p><h2 id={id+'-title'}>{guest?'Add a guest':'Choose TLPT player'}</h2><button type="button" className="close" aria-label="Cancel player selection" onClick={()=>setOpen(false)}>×</button><p>{guest?'Type a name only for someone who isn’t in the player list.':'Tap a player’s photo or name.'}</p></header><div className="player-picker-body">{guest?<><label htmlFor={id+'-guest'}>Guest name</label><input id={id+'-guest'} type="text" value={guestName} onChange={e=>setGuestName(e.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={100} placeholder="Enter guest name" onKeyDown={e=>{if(e.key==='Enter'&&guestName.trim()){e.preventDefault();choose(guestName.trim());}}}/><div className="modalbuttons"><button type="button" onClick={()=>setGuest(false)}>Back to players</button><button type="button" className="primary" disabled={!guestName.trim()} onClick={()=>choose(guestName.trim())}>Use guest name</button></div></>:<>{scheduled.length>0&&<><h3>Event roster</h3>{tiles(scheduled)}</>}<h3>{scheduled.length?'Other TLPT players':'TLPT players'}</h3>{tiles(other)}</>}</div>{!guest&&<footer><button type="button" onClick={()=>setGuest(true)}><UserPlus aria-hidden="true"/>Name not listed? Add guest</button></footer>}</section></div>,document.body)}</div>;
}
