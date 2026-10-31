import {addDay,easternEpoch} from './events.mjs';
export function canClearEventHistory(event,now=Date.now()){
 return !!event&&['friday','saturday','mtt'].includes(event.slot)&&event.id===event.slot+':'+event.date&&!event.historyClearedAt&&now>=easternEpoch(addDay(event.date),6);
}
// Shared ambiguous receipts stay available to their other possible events.
export const HISTORY_SCOPE="(event_id=? OR (event_id IS NULL AND json_array_length(candidate_event_ids)=1 AND EXISTS (SELECT 1 FROM json_each(candidate_event_ids) WHERE value=?)))";
export function eventHistoryClearPlan({event,expectedRevision,confirmationDate,checked,now=Date.now(),requestId}){
 if(!canClearEventHistory(event,now))throw Error('Only a past game with uncleared history can be cleared, after 6 AM Eastern the following day.');
 if(checked!==true||confirmationDate!==event.date||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Confirm the event date and permanent deletion before clearing history.');
 const id=event.id,values=[id,id],step=(sql,...values)=>({sql,values});
 return [
  step('INSERT INTO cashier_batch_checks (id,batch_id,ok) SELECT ?,?,CASE WHEN (SELECT history_revision FROM register_revision WHERE id=1)=? AND NOT EXISTS (SELECT 1 FROM event_history_clears WHERE event_id=?) THEN 1 ELSE 0 END',requestId,requestId,expectedRevision,id),
  step('INSERT INTO event_history_clears (event_id,cleared_at) VALUES (?,?)',id,new Date(now).toISOString()),
  step(`DELETE FROM audit WHERE payment_id IN (SELECT id FROM payments WHERE ${HISTORY_SCOPE})`,...values),
  step(`DELETE FROM receipt_links WHERE receipt_id IN (SELECT id FROM payments WHERE ${HISTORY_SCOPE}) OR payment_id IN (SELECT id FROM payments WHERE ${HISTORY_SCOPE})`,...values,...values),
  step(`DELETE FROM payments WHERE ${HISTORY_SCOPE}`,...values),
  step('UPDATE payments SET candidate_event_ids=(SELECT json_group_array(value) FROM json_each(payments.candidate_event_ids) WHERE value<>?) WHERE event_id IS NULL AND EXISTS (SELECT 1 FROM json_each(candidate_event_ids) WHERE value=?)',id,id),
  step(`DELETE FROM deleted_payment_sources WHERE ${HISTORY_SCOPE}`,...values),
  step('UPDATE deleted_payment_sources SET candidate_event_ids=(SELECT json_group_array(value) FROM json_each(deleted_payment_sources.candidate_event_ids) WHERE value<>?) WHERE event_id IS NULL AND EXISTS (SELECT 1 FROM json_each(candidate_event_ids) WHERE value=?)',id,id),
  step('DELETE FROM cashier_batch_checks WHERE batch_id IN (SELECT id FROM cashier_batches WHERE event_id=?)',id),
  step('DELETE FROM cashier_batches WHERE event_id=?',id),
  step('DELETE FROM cashier_batch_checks WHERE id=?',requestId)
 ];
}
