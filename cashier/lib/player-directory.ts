import fallback from './player-directory.json';
export type PlayerProfile={name:string;slug:string;image:string;aliases:string[];venmoNames?:string[];venmoUsername?:string};
let cached:PlayerProfile[]=fallback,checkedAt=0;
export async function getPlayers():Promise<PlayerProfile[]>{
 if(Date.now()-checkedAt<300000)return cached;
 checkedAt=Date.now();
 try{
  const response=await fetch('https://tlpt.org/data/player-metadata.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Player directory unavailable');
  const text=await response.text();if(text.length>500000)throw Error('Player directory too large');
  const data=JSON.parse(text);if(!Array.isArray(data.players)||!data.players.length)throw Error('Invalid player directory');
  cached=data.players.filter((p:any)=>typeof p.name==='string'&&typeof p.slug==='string').map((p:any)=>({name:p.name,slug:p.slug,image:/^images\/players\/[\w.-]+\.(?:jpg|jpeg|png|webp)$/i.test(p.image)?'https://tlpt.org/'+p.image:'',aliases:Array.isArray(p.aliases)?p.aliases.filter((a:any)=>typeof a==='string'):[],venmoNames:Array.isArray(p.venmoNames)?p.venmoNames.filter((n:any)=>typeof n==='string'&&n.trim()):[],venmoUsername:typeof p.venmoUsername==='string'?p.venmoUsername:''}));
 }catch{/* Keep the last known TLPT directory if its public source is unavailable. */}
 return cached;
}
