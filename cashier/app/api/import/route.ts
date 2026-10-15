import {env} from 'cloudflare:workers';
import {db,json,body} from '@/lib/api';
import {parseReceipt,routeReceipt} from '@/lib/receipt.mjs';
import {RECEIPT_INSERT_SQL} from '@/lib/deletion.mjs';
import {getSchedule} from '@/lib/schedule';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!env.IMPORT_TOKEN||req.headers.get('X-Register-Token')!==env.IMPORT_TOKEN)return json({error:'Unauthorized'},401);
 try{
  const input=await body(req);if(!Array.isArray(input.messages)||input.messages.length>30)return json({error:'Invalid batch'},400);
  const mode=input.mode||'live',now=new Date().toISOString();if(!['live','config','connection-test','armed','receipt-test'].includes(mode))return json({error:'Invalid mode'},400);
  const schedule=await getSchedule();
  if(mode==='config'){if(input.messages.length)return json({error:'Config takes no messages.'},400);return json({ok:true,events:schedule.events,scheduleError:schedule.error,queryAfter:Math.floor((Date.now()-14*86400000)/1000),generation:schedule.events.map((e:any)=>e.id).sort().join('|')});}
  if(['connection-test','armed'].includes(mode)){
   if(input.messages.length)return json({error:'Connection checks take no messages.'},400);
   await db().prepare('INSERT INTO sync_state (id,last_check,matched,rejected,configured_at,armed_at,reader_mode) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET configured_at=excluded.configured_at,armed_at=COALESCE(excluded.armed_at,sync_state.armed_at),reader_mode=excluded.reader_mode').bind('venmo','',0,0,now,mode==='armed'?now:null,input.readerMode==='rolling'?'rolling':'event').run();return json({ok:true,connectionVerified:true,armed:mode==='armed'});
  }
  if(mode==='receipt-test'){
   const diagnostics=input.messages.map((m:any)=>{const p=parseReceipt(m);return {id:String(m.id),accepted:!p.rejected,reason:p.rejected||null,category:p.kind||null};});
   if(diagnostics.some((x:any)=>x.accepted))await db().prepare('UPDATE sync_state SET format_verified=1 WHERE id=?').bind('venmo').run();return json({ok:true,diagnostics,noPaymentRecordsCreated:true});
  }
  let matched=0,rejected=0;const acceptedIds:string[]=[],ignoredIds:string[]=[],receiptEvents:Record<string,string>={};
  for(const message of input.messages){const p=routeReceipt(parseReceipt(message),schedule.events);if(p.rejected){rejected++;if(p.rejected==='outside-active-events')ignoredIds.push(String(message.id));continue;}
   if(await db().prepare('SELECT source_id FROM deleted_payment_sources WHERE source_id=?').bind(p.sourceId).first()){ignoredIds.push(String(message.id));continue;}matched++;
   await db().prepare(RECEIPT_INSERT_SQL).bind(crypto.randomUUID(),p.sourceId,p.eventId,JSON.stringify(p.candidateIds),p.payer,'',p.cents,p.kind,'review','venmo',p.note,p.receivedAt,now,now,p.sourceId).run();acceptedIds.push(String(message.id));receiptEvents[String(message.id)]=p.eventId||p.candidateIds.join('|');
  }
  await db().prepare('INSERT INTO sync_state (id,last_check,matched,rejected,reader_mode) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_check=excluded.last_check,matched=excluded.matched,rejected=excluded.rejected,reader_mode=excluded.reader_mode').bind('venmo',now,matched,rejected,input.readerMode==='rolling'?'rolling':'event').run();return json({ok:true,matched,rejected,acceptedIds,ignoredIds,receiptEvents});
 }catch(error){if(env.CASHIER_ENV==='local')console.error('Local receipt import failed:',error);return json({error:'Import failed; retry the same batch safely.'},503);}
}
