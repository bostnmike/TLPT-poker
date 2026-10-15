import {resolvePlayer} from './players.mjs';
// Receipt display names are not account IDs, so keep punctuation intact.
export const payerKey=name=>String(name||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
export function rememberedPayer(name,aliases=[]){const matches=aliases.filter(a=>a.payer_key===payerKey(name));return matches.length===1?matches[0]:null;}
function directoryVenmoMatches(payment,players){
 if(payment.method!=='venmo')return [];
 const name=payerKey(payment.payer);if(!name)return [];
 const handle=name.replace(/^@/,'');
 return players.filter(p=>(p.venmoNames||[]).some(n=>payerKey(n)===name)||(p.venmoUsername&&payerKey(p.venmoUsername).replace(/^@/,'')===handle));
}
export function resolveDirectoryVenmoPlayer(payment,players){const matches=directoryVenmoMatches(payment,players);return matches.length===1?matches[0]:null;}
export function resolvePaymentPlayer(payment,players,aliases=[]){
 if(String(payment.player||'').trim())return resolvePlayer({player:payment.player},players);
 const alias=rememberedPayer(payment.payer,aliases);
 if(alias){const matches=players.filter(p=>p.slug===alias.player_slug);return matches.length===1?matches[0]:null;}
 const matches=directoryVenmoMatches(payment,players);
 if(matches.length)return matches.length===1?matches[0]:null;
 return resolvePlayer(payment,players);
}
export function rememberPayerPlan(payment,profile,actor,at){
 if(payment.method!=='venmo'||!String(payment.source_id).startsWith('gmail:')||!payerKey(payment.payer)||!profile?.slug)return null;
 return {sql:`INSERT INTO venmo_player_aliases (payer_key,payer_name,player_slug,player_name,updated_at,actor) SELECT ?,?,?,?,?,? FROM payments WHERE id=? AND status='review' ON CONFLICT(payer_key) DO UPDATE SET payer_name=excluded.payer_name,player_slug=excluded.player_slug,player_name=excluded.player_name,updated_at=excluded.updated_at,actor=excluded.actor`,values:[payerKey(payment.payer),payment.payer,profile.slug,profile.name,at,actor,payment.id]};
}
