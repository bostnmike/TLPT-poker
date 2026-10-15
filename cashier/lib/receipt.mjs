import {paymentKinds} from './events.mjs';
export function classify(cents,note,event){const n=String(note).trim();const r=event?.rules||{entry:5000,rebuy:4000,food:1500,bounty:1000};const tag=n.match(/^TLPT\s+(?:friday|saturday|mtt)\s+(?:\d{4}-\d{2}-\d{2}\s+)?(entry|rebuy|food)$/i);if(tag)return r[tag[1].toLowerCase()]===cents?tag[1].toLowerCase():'unknown';if(cents===r.entry&&/\bMTT\b/i.test(n)&&r.bounty>0)return 'entry';if(cents===r.rebuy&&/try\s+again|\brebuy\b/i.test(n))return 'rebuy';if(cents===r.food&&/🍕|\bpizza\b/i.test(n))return 'food';return 'unknown';}
export function parseReceipt(mail){
 if(!/(?:<|\s|^)[\w.+-]+@(?:[\w-]+\.)*venmo\.com>?$/i.test(String(mail.from||'')))return {rejected:'sender'};
 const auth=String(mail.authenticationResults||'');if(!/^mx\.google\.com;/i.test(auth.trim())||!/dkim=pass[^;]*header\.(?:i|d)=@?(?:[\w-]+\.)*venmo\.com(?:\s|;|$)/i.test(auth))return {rejected:'authentication'};
 const at=Number(mail.internalDate);if(!Number.isFinite(at)||at<=0)return {rejected:'timestamp'};
 const m=String(mail.subject||'').trim().match(/^(.{1,100}?)\s+paid you\s+\$([\d,]+\.\d{2})[.!]?$/i);if(!m)return {rejected:'not-receipt'};
 const cents=Math.round(Number(m[2].replaceAll(',',''))*100);if(!Number.isSafeInteger(cents)||cents<=0||cents>1000000)return {rejected:'amount'};
 const candidates=[String(mail.note||''),...String(mail.body||'').slice(0,30000).split(/\r?\n/).map(x=>x.trim().replace(/^Note:\s*/i,'').replace(/^['"]|['"]$/g,''))];
 const note=candidates.find(x=>/^(?:MTT|Try Again|🍕|pizza|TLPT|TLPT\s+(?:friday|saturday|mtt)\s+(?:\d{4}-\d{2}-\d{2}\s+)?(?:entry|rebuy|food))$/i.test(x))||'';
 if(!/^[a-zA-Z0-9_-]{5,100}$/.test(String(mail.id)))return {rejected:'id'};
 return {sourceId:`gmail:${mail.id}`,payer:m[1],cents,kind:classify(cents,note),note,receivedAt:new Date(at).toISOString()};
}
export function routeReceipt(p,events){
 if(p.rejected)return p;
 const tag=p.note.match(/^TLPT\s+(friday|saturday|mtt)\s+(\d{4}-\d{2}-\d{2})\s+(entry|rebuy|food)$/i);
 const reusable=p.note.match(/^TLPT\s+(friday|saturday|mtt)\s+(entry|rebuy|food)$/i);
 const at=Date.parse(p.receivedAt);
 let candidates=tag?events.filter(e=>e.slot===tag[1].toLowerCase()&&e.date===tag[2]):events.filter(e=>at>=e.receiptStart&&at<e.receiptEnd);
 // Undated poster notes use the receipt's event window, so old payments cannot move to a replacement date.
 if(reusable)candidates=candidates.filter(e=>e.slot===reusable[1].toLowerCase());
 if(!tag&&/^MTT$/i.test(p.note))candidates=candidates.filter(e=>e.slot==='mtt');
 if(!candidates.length)return {rejected:'outside-active-events'};
 const e=candidates.length===1?candidates[0]:null;
 return {...p,eventId:e?.id||null,candidateIds:candidates.map(e=>e.id),kind:e?classify(p.cents,p.note,e):'unknown'};
}
export function totals(rows){const t={collected:0,prizePool:0,bounty:0,food:0,entries:0,rebuys:0,pizzas:0,review:0};for(const p of rows){if(p.status==='review'){t.review++;continue;}if(p.status!=='confirmed')continue;t.collected+=p.cents;const legacy=p.prize_cents===null||p.prize_cents===undefined;t.prizePool+=legacy?(p.kind==='entry'||p.kind==='rebuy'?4000:0):p.prize_cents;t.bounty+=legacy?(p.kind==='entry'?1000:0):p.bounty_cents;t.food+=legacy?(p.kind==='food'?1500:0):p.food_cents;const items=paymentKinds(p.kind);if(items.includes('entry'))t.entries++;if(items.includes('rebuy'))t.rebuys++;if(items.includes('food'))t.pizzas++;}return t;}
