import {Rejected, requireValue, publicFeed} from './model.mjs';
import {canCloseOutEvent, validCloseoutRequestId} from './lib/event-closeout.mjs';

const titleKey=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().replace(/\s*[|·–—-]\s*(?:9|18)\s*[- ]?max\s*$/i,'').trim().toLowerCase();
const sameTitle=(a,b)=>typeof a==='string'&&typeof b==='string'&&titleKey(a)===titleKey(b);
const revision = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identity = event => ({protocol:1,eventId:event.metadata.slot+':'+event.metadata.date,rsvpEventId:event.id,title:event.metadata.title,confirmationDate:event.metadata.date});

async function cashierCall(env,method,args) {
  requireValue(env.CASHIER_CLOSEOUT,'Cashier close-out is unavailable. Nothing has been cleared in RSVP.',503);
  let result;
  try { result = method === 'preview' ? await env.CASHIER_CLOSEOUT.preview(args) : await env.CASHIER_CLOSEOUT.close(args); }
  catch { throw new Rejected('Cashier did not confirm close-out. Return to this event and resume close-out.',503); }
  requireValue(result && typeof result === 'object','Cashier returned an invalid close-out response.',502);
  if(result.ok !== true) {
    const status=['unavailable','schedule-unavailable','results-unavailable'].includes(result.code)?503:409;
    throw new Rejected(typeof result.error==='string'?result.error.slice(0,350):'Cashier could not verify this close-out.',status);
  }
  return result;
}
export function validCloseoutReceipt(receipt,event,requestId,resultsRevision) {
  return !!receipt && receipt.protocol===1 && receipt.closed===true &&
    receipt.eventId===event.metadata.slot+':'+event.metadata.date && receipt.rsvpEventId===event.id &&
    receipt.requestId===requestId && receipt.receiptId===requestId && validCloseoutRequestId(requestId) &&
    revision(receipt.resultsRevision) && receipt.resultsRevision===resultsRevision &&
    typeof receipt.closedAt==='string' && Number.isFinite(Date.parse(receipt.closedAt));
}
function validatePreview(result,event,now) {
  const args=identity(event);
  requireValue(result.protocol===1 && result.eventId===args.eventId && result.rsvpEventId===event.id && result.confirmationDate===args.confirmationDate,'Cashier close-out identity did not match this event.',502);
  if(result.alreadyClosed) {
    const receipt=result.receipt;
    requireValue(validCloseoutReceipt(receipt,event,receipt?.requestId,receipt?.resultsRevision),'Cashier completion receipt did not match this event.',502);
    if(event.closeoutPending)requireValue(receipt.requestId===event.closeoutPending.requestId&&receipt.resultsRevision===event.closeoutPending.resultsRevision,'Another close-out request owns this event.',409);
    return result;
  }
  const proof=result.evidence;
  requireValue(Number.isSafeInteger(result.historyRevision)&&result.historyRevision>=0&&Number.isSafeInteger(result.records)&&result.records>=0&&Number.isSafeInteger(result.review)&&result.review>=0,'Cashier close-out preview was incomplete.',502);
  requireValue(proof && revision(proof.revision) && proof.date===args.confirmationDate && sameTitle(proof.title,args.title) && proof.sourceFile==='Event Report '+args.confirmationDate+'.html' && sha256(proof.rawSha256) && sha256(proof.parsedSha256) && typeof proof.completedAt==='string' && Number.isFinite(Date.parse(proof.completedAt)) && Date.parse(proof.completedAt)<=new Date(now).getTime(),'Published event results did not match this finished game.',409);
  return result;
}
export async function closeoutPreview(env,state,eventId,now=new Date()) {
  const event=state.events.find(event=>event.id===eventId || (!event.archived&&!event.cancelled&&!event.deletedAt&&event.metadata.slot+':'+event.metadata.date===eventId));
  if(!event) {
    const receipt=state.closeouts?.find(receipt=>receipt.rsvpEventId===eventId||receipt.eventId===eventId);
    requireValue(receipt,'Event unavailable.',404);
    return {ok:true,complete:true,receipt};
  }
  requireValue(canCloseOutEvent(event,now),'Close out is only available for a dated, finished game. Cancel future games instead.',409);
  const result=validatePreview(await cashierCall(env,'preview',{...identity(event),payoutsConfirmed:false,receiptsReviewed:false,resultsConfirmed:false}),event,now);
  const requestId=event.closeoutPending?.requestId || result.receipt?.requestId || crypto.randomUUID();
  const feed=publicFeed(state).events.find(item=>item.id===event.id);
  const coffeeOrders=Object.values(event.coffeeOrders||{}).flatMap(orders=>Object.values(orders)).length;
  return {ok:true,complete:false,event:{id:event.id,title:event.metadata.title,date:event.metadata.date,slot:event.metadata.slot,pending:!!event.closeoutPending},rsvpRevision:state.revision,requestId,responses:Object.values(event.responses).filter(response=>response.answer!=='tbd').length,waitlist:feed?.waitlist.length||0,coffeeOrders,cashier:result};
}
export async function finishCloseout(env,state,body,mutate,now=new Date()) {
  requireValue(body && validCloseoutRequestId(body.requestId),'Reopen the close-out preview.',400);
  requireValue(body.payoutsConfirmed===true && body.receiptsReviewed===true && body.resultsConfirmed===true,'Confirm the finished payouts, reviewed receipts and final published results.',400);
  const done=state.closeouts?.find(receipt=>receipt.rsvpEventId===body.eventId);
  if(done) {
    requireValue(done.requestId===body.requestId,'This game was already closed out by another request.',409);
    return {ok:true,complete:true,receipt:done};
  }
  let frozen=false;
  try {
    const plan=await closeoutPreview(env,state,body.eventId,now),event=state.events.find(event=>event.id===body.eventId),cashier=plan.cashier;
    requireValue(body.confirmationDate===event.metadata.date,'The game date changed. Review the preview again.',409);
    if(event.closeoutPending)requireValue(body.requestId===event.closeoutPending.requestId,'Resume the existing close-out request.',409);
    if(cashier.alreadyClosed)requireValue(body.requestId===cashier.receipt.requestId,'Resume the completed Cashier request.',409);
    const resultsRevision=cashier.alreadyClosed?cashier.receipt.resultsRevision:cashier.evidence.revision;
    if(!cashier.alreadyClosed)requireValue(body.expectedRevision===cashier.historyRevision && body.expectedResultsRevision===resultsRevision,'Cashier or published results changed. Reopen the preview and review it again.',409);
    const prepared=await mutate({type:'closeout-prepare',eventId:event.id,confirmationDate:event.metadata.date,slot:event.metadata.slot,title:event.metadata.title,requestId:body.requestId,expectedStateRevision:body.rsvpRevision,historyRevision:cashier.alreadyClosed?event.closeoutPending?.historyRevision||0:cashier.historyRevision,resultsRevision,evidence:cashier.evidence||event.closeoutPending?.evidence||null,payoutsConfirmed:true,receiptsReviewed:true,resultsConfirmed:true});
    frozen=true;
    const saved=prepared.events.find(item=>item.id===event.id),pending=saved?.closeoutPending;
    // A concurrent retry may have already finalized the same request.
    if(!saved) {
      const receipt=prepared.closeouts?.find(receipt=>receipt.rsvpEventId===event.id && receipt.requestId===body.requestId);
      requireValue(receipt,'Close-out state changed. Refresh the game.',409);
      return {ok:true,complete:true,receipt};
    }
    const reply=cashier.alreadyClosed?cashier:await cashierCall(env,'close',{...identity(saved),requestId:pending.requestId,expectedRevision:pending.historyRevision,expectedResultsRevision:pending.resultsRevision,payoutsConfirmed:true,receiptsReviewed:true,resultsConfirmed:true});
    const receipt=reply.receipt;
    requireValue(validCloseoutReceipt(receipt,saved,pending.requestId,pending.resultsRevision),'Cashier did not return a matching completion receipt. Resume close-out to retry.',502);
    await mutate({type:'closeout-finalize',eventId:saved.id,requestId:pending.requestId,receipt});
    return {ok:true,complete:true,receipt};
  } catch(error) {
    if(frozen || state.events.find(event=>event.id===body.eventId)?.closeoutPending) return {ok:false,pending:true,status:error instanceof Rejected?error.status:503,error:(error instanceof Rejected?error.message:'Close-out could not finish.')+' The event remains closed to new responses. Resume close-out to finish.'};
    throw error;
  }
}
