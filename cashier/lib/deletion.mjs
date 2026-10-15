// Retain only source identifiers so a deleted receipt cannot be imported again.
// The parent version guard makes the whole batch a no-op if another cashier
// action changed the record after the delete confirmation was opened.
export function paymentDeletionPlan(payment){
 const where='(id=? OR linked_to=?) AND EXISTS (SELECT 1 FROM payments AS current WHERE current.id=? AND current.updated_at=? AND current.status=?)';
 const values=[payment.id,payment.id,payment.id,payment.updated_at,payment.status];
 return [
  {sql:`INSERT OR IGNORE INTO deleted_payment_sources (source_id,event_id,candidate_event_ids) SELECT source_id,event_id,candidate_event_ids FROM payments WHERE ${where}`,values},
  {sql:`DELETE FROM audit WHERE payment_id IN (SELECT id FROM payments WHERE ${where})`,values},
  {sql:`DELETE FROM payments WHERE ${where}`,values}
 ];
}

export const RECEIPT_INSERT_SQL='INSERT OR IGNORE INTO payments (id,source_id,event_id,candidate_event_ids,payer,player,cents,kind,status,method,note,received_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM deleted_payment_sources WHERE source_id=?)';
