'use client';
import {useState} from 'react';
import {playerInitials} from '@/lib/players.mjs';
export default function PlayerAvatar({name,image}:{name:string;image?:string}){
 const [failed,setFailed]=useState('');
 return <span className="player-avatar" aria-hidden="true">{image&&failed!==image?<img src={image} width="44" height="44" alt="" loading="lazy" decoding="async" onError={()=>setFailed(image)}/>:<span>{playerInitials(name)}</span>}</span>;
}
