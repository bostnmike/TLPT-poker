-- Additive: existing payments and credentials remain unchanged.
CREATE TABLE cashier_batches (id TEXT PRIMARY KEY NOT NULL,event_id TEXT NOT NULL,payload_hash TEXT NOT NULL,result_json TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE cashier_batch_checks (id TEXT PRIMARY KEY NOT NULL,batch_id TEXT NOT NULL,ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE receipt_links (receipt_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,cents INTEGER NOT NULL CHECK(cents>0),PRIMARY KEY(receipt_id,payment_id));
CREATE INDEX receipt_links_payment ON receipt_links(payment_id);
INSERT INTO receipt_links (receipt_id,payment_id,cents) SELECT r.id,r.linked_to,r.cents FROM payments r JOIN payments target ON target.id=r.linked_to WHERE r.status='linked';
