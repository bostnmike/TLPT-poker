import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readdirSync,readFileSync} from 'node:fs';
import {paymentDeletionPlan,RECEIPT_INSERT_SQL} from '../lib/deletion.mjs';import {stalePaymentPredicate} from '../lib/events.mjs';import {totals} from '../lib/receipt.mjs';
const schema=readdirSync(new URL('../drizzle/',import.meta.url)).filter(s=>/^\d+.*\.sql$/.test(s)).sort().map(s=>readFileSync(new URL('../drizzle/'+s,import.meta.url),'utf8')).join('\n');
const row=(id,extra={})=>({id,source_id:'gmail:'+id,event_id:'mtt:2026-10-24',candidate_event_ids:'[]',payer:'Example Player',player:'Example Player',cents:6500,kind:'entry+food',status:'confirmed',method:'venmo',note:'Example',received_at:'2026-10-24T17:00:00Z',created_at:'created',updated_at:'version-one',prize_cents:4000,bounty_cents:1000,food_cents:1500,linked_to:null,...extra});
function execute(rows,steps){const script=`import sqlite3,json,sys\np=json.load(sys.stdin)\ndb=sqlite3.connect(':memory:')\ndb.row_factory=sqlite3.Row\ndb.executescript(p['schema'])\nfor row in p['rows']:\n db.execute('INSERT INTO payments ('+','.join(row.keys())+') VALUES ('+','.join('?' for k in row)+')',list(row.values()))\n db.execute('INSERT INTO audit (id,payment_id,action,actor,details,at) VALUES (?,?,?,?,?,?)',(row['id'],row['id'],'test','test','{}','at'))\ndb.commit()\nwith db:\n for step in p['steps']:db.execute(step['sql'],step['values'])\nprint(json.dumps({'payments':[dict(r) for r in db.execute('SELECT * FROM payments ORDER BY id')],'audit':[r['payment_id'] for r in db.execute('SELECT * FROM audit ORDER BY id')],'deleted':[dict(r) for r in db.execute('SELECT * FROM deleted_payment_sources ORDER BY source_id')]}))\n`;const r=spawnSync(process.env.PYTHON || 'python3',['-c',script],{input:JSON.stringify({schema,rows,steps}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
test('deleting a combined transaction removes it and its linked receipt, audit entries, and all money allocations',()=>{
 const parent=row('parent',{source_id:'manual:parent'}),linked=row('linked',{status:'linked',linked_to:'parent'}),other=row('other');
 const result=execute([parent,linked,other],paymentDeletionPlan(parent));
 assert.deepEqual(result.payments.map(p=>p.id),['other']);assert.deepEqual(result.audit,['other']);assert.deepEqual(result.deleted.map(s=>s.source_id),['gmail:linked','manual:parent']);
 assert.equal(totals(result.payments).collected,6500);assert.equal(totals(result.payments).entries,1);
 assert.deepEqual(Object.keys(result.deleted[0]).sort(),['candidate_event_ids','event_id','source_id']);
});
test('review and voided transactions can be deleted; an unrelated event is untouched',()=>{
 for(const status of ['review','void']){const p=row('remove',{status}),other=row('keep',{event_id:'friday:2026-10-16'});const r=execute([p,other],paymentDeletionPlan(p));assert.deepEqual(r.payments.map(p=>p.id),['keep']);assert.equal(r.deleted.length,1);}
});
test('a record changed since confirmation is left completely intact',()=>{
 const current=row('changed',{updated_at:'version-two'});const r=execute([current],paymentDeletionPlan({...current,updated_at:'version-one'}));assert.equal(r.payments.length,1);assert.equal(r.audit.length,1);assert.equal(r.deleted.length,0);
});
test('the actual importer insert cannot resurrect a deleted receipt but still imports a new receipt',()=>{
 const p=row('receipt');const insert=id=>({sql:RECEIPT_INSERT_SQL,values:[id,'gmail:'+id,'mtt:2026-10-24','[]','Example Payer','',6500,'unknown','review','venmo','MTT','received','created','updated','gmail:'+id]});
 const r=execute([p],[...paymentDeletionPlan(p),insert('receipt'),insert('new-receipt')]);assert.deepEqual(r.payments.map(p=>p.id),['new-receipt']);assert.equal(totals(r.payments).collected,0);
});
test('deleted-source suppression follows the same event replacement retention rules',()=>{
 const old=row('old',{event_id:'friday:2026-10-16'}),keep=row('keep'),shared=row('shared',{event_id:null,candidate_event_ids:'["friday:2026-10-16","mtt:2026-10-24"]'});
 const purge=stalePaymentPredicate(['friday:2026-10-23','mtt:2026-10-24'],'deleted_payment_sources');
 const r=execute([old,keep,shared],[...paymentDeletionPlan(old),...paymentDeletionPlan(keep),...paymentDeletionPlan(shared),{sql:'DELETE FROM deleted_payment_sources WHERE '+purge.sql,values:purge.values}]);assert.deepEqual(r.deleted.map(s=>s.source_id),['gmail:keep','gmail:shared']);
});
