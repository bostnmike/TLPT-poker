// Read-only acceptance smoke, separate from deterministic payment tests.
import {validateLiveRsvps,LIVE_RSVP_URL} from '../lib/live-rsvp.mjs';
import {livePaymentSchedule} from '../lib/live-payment-schedule.mjs';
import {FINANCIALS_URL} from '../lib/events.mjs';
const urls=[LIVE_RSVP_URL,FINANCIALS_URL,'https://tlpt.org/data/player-metadata.json'];
const data=await Promise.all(urls.map(async url=>{
 const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
 if(!r.ok)throw Error('Live public source unavailable: '+new URL(url).pathname+' ('+r.status+'). Payment integration uses isolated fixtures.');
 const text=await r.text();if(text.length>500000)throw Error('Live public source exceeds contract size.');return JSON.parse(text);
}));
validateLiveRsvps(data[0]);livePaymentSchedule(data[0],data[1]);
if(!Array.isArray(data[2].players)||!data[2].players.length||data[2].players.some(p=>typeof p.name!=='string'||typeof p.slug!=='string'))throw Error('Invalid live player directory.');
console.log('PASS: read-only live RSVP, financial and player contracts (an empty payable schedule is valid).');
