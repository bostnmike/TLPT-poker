'use client';
import {useState} from 'react';
import PlayerAvatar from './player-avatar';
import type {PlayerProfile} from '@/lib/player-directory';
import {resolvePlayer} from '@/lib/players.mjs';

export default function BatchPlayerSelector({names,players,preferredNames,addedNames,paidNames,disabled,onAdd}:{names:string[];players:PlayerProfile[];preferredNames:string[];addedNames:string[];paidNames:Set<string>;disabled:boolean;onAdd:(names:string[])=>void}){
 const canonical=(name:string)=>resolvePlayer({player:name},players)?.name||name;
 const preferred=new Set(preferredNames.map(canonical)),added=new Set(addedNames.map(canonical));
 const [scope,setScope]=useState(preferred.size?'rsvp':'all'),[selected,setSelected]=useState<string[]>([]);
 const choices=Array.from(new Set(names.map(canonical))).sort((a,b)=>Number(paidNames.has(a))-Number(paidNames.has(b))||a.localeCompare(b));
 const shown=choices.filter(name=>scope==='all'||preferred.has(name)),available=shown.filter(name=>!added.has(name));
 const picked=selected.filter(name=>!added.has(name));
 function toggle(name:string){setSelected(list=>list.includes(name)?list.filter(n=>n!==name):[...list,name]);}
 return <fieldset className="batch-roster" disabled={disabled}>
  <legend>Select several players</legend>
  <p>Tap each player’s circle, then add them together. Choose food and payment methods on their rows below.</p>
  <div className="batch-roster-tools">
   <div role="group" aria-label="Player list"><button type="button" aria-pressed={scope==='rsvp'} disabled={!preferred.size} onClick={()=>setScope('rsvp')}>Event RSVPs ({preferred.size})</button><button type="button" aria-pressed={scope==='all'} onClick={()=>setScope('all')}>All TLPT players</button></div>
   <div><button type="button" disabled={!available.length||available.every(name=>picked.includes(name))} onClick={()=>setSelected(list=>Array.from(new Set([...list,...available])))}>Select all shown</button><button type="button" disabled={!picked.length} onClick={()=>setSelected([])}>Clear selection</button></div>
  </div>
  <div className="batch-roster-grid">{shown.map(name=>{
   const profile=resolvePlayer({player:name},players),alreadyAdded=added.has(name);
   return <label className={'batch-roster-choice'+(alreadyAdded?' already-added':'')} key={name}>
    <input type="checkbox" aria-label={'Select '+name} disabled={alreadyAdded} checked={alreadyAdded||picked.includes(name)} onChange={()=>toggle(name)}/>
    <PlayerAvatar name={name} image={profile?.image}/><span>{name}<small>{alreadyAdded?'Already in this group':paidNames.has(name)?'Buy-in paid':'Buy-in needed'}</small></span>
   </label>;
  })}</div>
  <div className="batch-roster-footer"><span role="status">{picked.length} selected</span><button type="button" className="primary" disabled={!picked.length} onClick={()=>onAdd(picked)}>Add {picked.length} {picked.length===1?'player':'players'} together</button></div>
 </fieldset>;
}
