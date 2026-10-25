// Outputs SQL for an isolated new database. No private links are generated here.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dateKey} from '../../cashier/lib/events.mjs';
const events=JSON.parse(readFileSync(new URL('../../data/events.json',import.meta.url))).events;
const players=JSON.parse(readFileSync(new URL('../../data/player-metadata.json',import.meta.url))).players.map(p=>({slug:p.slug,name:p.name,image:p.image,rosterStatus:p.rosterStatus||'active',generation:0,linkHash:null}));
let seq=0;
const state={revision:1,updatedAt:new Date().toISOString(),sequence:0,adminHash:null,adminGeneration:0,players,events:events.map(e=>{
 const metadata={...e};delete metadata.rsvps;delete metadata.apple_invite_url;
 if(!/tbd/i.test(e.date))metadata.date=dateKey(e.date);
 return {id:`${e.slot}-${/tbd/i.test(e.date)?'pending-2026':dateKey(e.date)}`,metadata,capacity:e.capacity||(e.slot==='mtt'?18:9),open:!/tbd/i.test(e.date),archived:false,responses:Object.fromEntries(Object.entries(e.rsvps).map(([slug,answer])=>[slug,{answer,order:++seq,updatedAt:new Date().toISOString()}]))};}),audit:[]};
state.sequence=seq;
console.log(`INSERT INTO rsvp_state(id,revision,body) VALUES(1,1,'${JSON.stringify(state).replaceAll("'","''")}') ON CONFLICT(id) DO NOTHING;`);
