// Match only an exact TLPT name, slug, or alias; never guess from a first name.
const key=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function resolvePlayer(payment,players){
 const name=key(payment.player||payment.payer);if(!name)return null;
 const matches=players.filter(p=>[p.name,p.slug,...(p.aliases||[])].some(alias=>key(alias)===name));
 return matches.length===1?matches[0]:null;
}
export function playerInitials(name){return String(name||'?').trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>[...word][0]).join('').toUpperCase()||'?';}
export function newestPayments(payments){
 const at=value=>Date.parse(value)||0;
 return [...payments].sort((a,b)=>at(b.received_at)-at(a.received_at)||at(b.created_at)-at(a.created_at)||String(b.id).localeCompare(String(a.id)));
}
