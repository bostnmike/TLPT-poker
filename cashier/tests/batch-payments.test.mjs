import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync} from 'node:fs';
import {batchPlan,BatchError} from '../lib/batch-payments.mjs';
import {totals} from '../lib/receipt.mjs';
import {paymentPortion} from '../lib/payment-portions.mjs';
import {paymentDeletionPlan,RECEIPT_INSERT_SQL} from '../lib/deletion.mjs';
const schema=readdirSync(new URL('../drizzle/',import.meta.url)).filter(s=>/^\d+.*\.sql$/.test(s)).sort().map(s=>readFileSync(new URL('../drizzle/'+s,import.meta.url),'utf8')).join('\n');
const uid=()=>crypto.randomUUID(),event={id:'mtt:2026-10-24',rules:{entry:5000,entryPrize:4000,bounty:1000,rebuy:4000,food:1500}};
const row=(player,items=['entry'],method='venmo')=>({id:uid(),player,items,cents:items.reduce((n,k)=>n+event.rules[k],0),method});
const manual=allocations=>({id:uid(),action:'manual',method:'venmo',allocations});
const payment=(extra={})=>({id:uid(),source_id:'gmail:'+uid(),event_id:event.id,candidate_event_ids:'[]',payer:'Venmo Payer',player:'',cents:5000,kind:'entry',status:'review',method:'venmo',note:'TLPT mtt entry',received_at:'2026-10-24T18:00:00Z',created_at:'created',updated_at:'original',linked_to:null,prize_cents:null,bounty_cents:null,food_cents:null,item_cents:null,...extra});
const receiptGroup=(p,action='confirm',extra={})=>({id:uid(),action,paymentId:p.id,expectedUpdatedAt:p.updated_at,...extra});
const target=p=>({paymentId:p.id,expectedUpdatedAt:p.updated_at,cents:p.cents});
const plan=(groups,payments=[],links=[],players=[])=>batchPlan({input:{requestId:uid(),checked:true,groups},event,payments,links,players,actor:'test-owner',now:'saved'});
function execute(payments,steps,links=[],races=[]){
 const script=`import sqlite3,json,sys
p=json.load(sys.stdin)
d=sqlite3.connect(':memory:');d.row_factory=sqlite3.Row;d.execute('PRAGMA foreign_keys=ON');d.executescript(p['schema'])
for r in p['payments']:d.execute('INSERT INTO payments ('+','.join(r)+') VALUES ('+','.join('?' for k in r)+')',list(r.values()))
for r in p['links']:d.execute('INSERT INTO receipt_links VALUES (?,?,?)',(r['receipt_id'],r['payment_id'],r['cents']))
for r in p['races']:d.execute(r['sql'],r['values'])
d.commit();error=None
try:
 with d:
  for s in p['steps']:d.execute(s['sql'],s['values'])
except Exception as e:error=str(e)
print(json.dumps({'error':error,**{t:[dict(r) for r in d.execute('SELECT * FROM '+t)] for t in ['payments','receipt_links','cashier_batches','cashier_batch_checks','deleted_payment_sources','audit']}}))`;
 const r=spawnSync(process.env.PYTHON||'python3',['-c',script],{input:JSON.stringify({schema,payments,steps,links,races}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
test('five MTT players with three food contributions and mixed methods retain exact individual allocations',()=>{
 const allocations=Array.from({length:5},(_,i)=>row('Player '+i,i<3?['entry','food']:['entry'],i===4?'cash':'venmo'));
 const p=plan([manual(allocations)]),out=execute([],p.steps);assert.equal(out.error,null);assert.equal(out.payments.length,5);assert.equal(out.cashier_batch_checks.length,0);
 const t=totals(out.payments);assert.deepEqual([t.collected,t.prizePool,t.bounty,t.food,t.entries,t.pizzas],[29500,20000,5000,4500,5,3]);
 assert.equal(out.payments.filter(p=>p.method==='cash').length,1);assert.equal(paymentPortion(out.payments[0],'entry'),5000);assert.equal(paymentPortion(out.payments[0],'food'),1500);
});
test('one Venmo receipt can fund five players while its parent never counts a second time',()=>{
 const p=payment({cents:29500}),allocations=Array.from({length:5},(_,i)=>row('Player '+i,i<3?['entry','food']:['entry']));
 const out=execute([p],plan([receiptGroup(p,'confirm',{allocations})],[p]).steps);
 assert.equal(out.error,null);assert.equal(out.receipt_links.length,5);assert.equal(out.payments.find(r=>r.id===p.id).status,'linked');assert.equal(totals(out.payments).collected,29500);assert.equal(totals(out.payments).entries,5);
 assert.throws(()=>plan([receiptGroup(p,'confirm',{allocations,rememberPayer:true})],[p]),/several different players/);
});
test('separate buy-in and food emails can cover one manual bundle without adding money again',()=>{
 const m=payment({source_id:'manual:'+uid(),status:'confirmed',player:'Ahmed',cents:6500,kind:'entry+food',prize_cents:4000,bounty_cents:1000,food_cents:1500,item_cents:'{"entry":5000,"food":1500}'}),a=payment(),b=payment({cents:1500,kind:'food'});
 const groups=[receiptGroup(a,'link',{targets:[{...target(m),cents:5000}]}),receiptGroup(b,'link',{targets:[{...target(m),cents:1500}]})];
 const p=plan(groups,[m,a,b]),out=execute([m,a,b],p.steps);assert.equal(out.error,null);assert.equal(p.result.linkedReceipts,2);assert.equal(p.result.addedCents,0);assert.equal(totals(out.payments).collected,6500);assert.equal(out.receipt_links.reduce((n,l)=>n+l.cents,0),6500);
});
test('one receipt matches multiple manual players, and unrelated new entries can share the batch',()=>{
 const a=payment({source_id:'manual:'+uid(),player:'A',status:'confirmed'}),b=payment({source_id:'manual:'+uid(),player:'B',status:'confirmed'}),r=payment({cents:10000});
 const p=plan([manual([row('C',['rebuy'])]),receiptGroup(r,'link',{targets:[target(a),target(b)]})],[a,b,r]);const out=execute([a,b,r],p.steps);assert.equal(out.error,null);assert.equal(totals(out.payments).collected,14000);assert.equal(out.receipt_links.length,2);
});
test('a concurrent receipt change rolls back the whole batch, including its retry record',()=>{
 const r=payment(),p=plan([manual([row('New')]),receiptGroup(r,'confirm',{allocations:[row('Receipt player')]})],[r]);
 const cache={sql:'INSERT INTO cashier_batches VALUES (?,?,?,?,?)',values:[uid(),event.id,'hash','{}','now']};
 const out=execute([r],[cache,...p.steps],[],[{sql:'UPDATE payments SET status=? WHERE id=?',values:['ignored',r.id]}]);
 assert.match(out.error,/CHECK/);assert.equal(out.payments.length,1);assert.equal(out.payments[0].status,'ignored');assert.equal(out.cashier_batches.length,0);assert.equal(out.audit.length,0);assert.equal(out.cashier_batch_checks.length,0);
});
test('coverage guards reject concurrent links even if a target timestamp is unchanged',()=>{
 const m=payment({source_id:'manual:'+uid(),player:'A',status:'confirmed'}),r=payment(),other=payment({status:'linked'});
 const p=plan([receiptGroup(r,'link',{targets:[target(m)]})],[m,r,other]);
 const out=execute([m,r,other],p.steps,[],[{sql:'INSERT INTO receipt_links VALUES (?,?,?)',values:[other.id,m.id,5000]}]);assert.match(out.error,/CHECK/);assert.equal(out.payments.find(p=>p.id===r.id).status,'review');assert.equal(out.receipt_links.length,1);
});
test('invalid totals, stale records, duplicated sources, cash targets and over-coverage fail before writing',()=>{
 const r=payment(),m=payment({source_id:'manual:'+uid(),status:'confirmed',player:'A'});
 for(const groups of [[receiptGroup(r,'confirm',{allocations:[row('A',['food'])]})],[receiptGroup(r,'confirm',{allocations:[row('A')],expectedUpdatedAt:'stale'})],[receiptGroup(r,'ignore'),receiptGroup(r,'ignore')],[receiptGroup(r,'link',{targets:[{...target(m),cents:6000}]})],[receiptGroup(r,'link',{targets:[target(m)]}),receiptGroup(m,'void')]])assert.throws(()=>plan(groups,[r,m]),BatchError);
 assert.throws(()=>plan([receiptGroup(r,'link',{targets:[target(m)]})],[r,{...m,method:'cash'}]),/manual Venmo/);
 assert.throws(()=>plan([receiptGroup(r,'confirm',{allocations:[row('A')]})],[{...r,event_id:'other'}]),/event/);
});
test('shared-receipt deletion preserves other players, suppresses re-import, and removes the final orphan',()=>{
 const p=payment({cents:10000}),a=row('A'),b=row('B');const first=execute([p],plan([receiptGroup(p,'confirm',{allocations:[a,b]})],[p]).steps);assert.equal(first.error,null);
 const child=first.payments.find(p=>p.id===a.id),second=execute(first.payments,paymentDeletionPlan(child),first.receipt_links);assert.equal(second.error,null);assert.equal(totals(second.payments).collected,5000);assert.equal(second.receipt_links.length,1);assert.ok(second.payments.some(r=>r.id===p.id));
 const last=second.payments.find(p=>p.id===b.id);const third=execute(second.payments,paymentDeletionPlan(last),second.receipt_links);assert.equal(third.error,null);assert.equal(third.payments.length,0);
 const insert={sql:RECEIPT_INSERT_SQL,values:[p.id,p.source_id,event.id,'[]',p.payer,'',10000,'unknown','review','venmo','','received','created','updated',p.source_id]};
 const out=execute(first.payments,[...paymentDeletionPlan(child),...paymentDeletionPlan(first.payments.find(r=>r.id===b.id)),insert],first.receipt_links);assert.equal(out.error,null);assert.equal(out.payments.length,0);
});
test('bulk voids and exclusions retain history and remove only the intended confirmed amounts',()=>{
 const a=payment({status:'confirmed'}),b=payment(),other=payment({status:'confirmed'});
 const p=plan([receiptGroup(a,'void'),receiptGroup(b,'ignore')],[a,b,other]),out=execute([a,b,other],p.steps);assert.equal(out.error,null);assert.equal(p.result.removedCents,5000);assert.equal(totals(out.payments).collected,5000);assert.equal(out.payments.length,3);
});
test('upgrading an existing ledger seeds old receipt coverage without rewriting any payment',()=>{
 const migrations=readdirSync(new URL('../drizzle/',import.meta.url)).filter(s=>/^\d+.*\.sql$/.test(s)).sort();
 const before=migrations.filter(n=>!n.startsWith('0011')).map(n=>readFileSync(new URL('../drizzle/'+n,import.meta.url),'utf8')).join('\n');
 const after=readFileSync(new URL('../drizzle/0011_batch_payments.sql',import.meta.url),'utf8');
 const m=payment({source_id:'manual:'+uid(),status:'confirmed',player:'Existing player'}),r=payment({status:'linked',linked_to:m.id});
 const script=`import json,sqlite3,sys
p=json.load(sys.stdin);d=sqlite3.connect(':memory:');d.row_factory=sqlite3.Row;d.execute('PRAGMA foreign_keys=ON');d.executescript(p['before'])
for r in p['rows']:d.execute('INSERT INTO payments ('+','.join(r)+') VALUES ('+','.join('?' for k in r)+')',list(r.values()))
d.commit();old=[dict(r) for r in d.execute('SELECT * FROM payments ORDER BY id')];d.executescript(p['after']);new=[dict(r) for r in d.execute('SELECT * FROM payments ORDER BY id')]
print(json.dumps({'unchanged':old==new,'links':[dict(r) for r in d.execute('SELECT * FROM receipt_links')]}))`;
 const run=spawnSync(process.env.PYTHON||'python3',['-c',script],{input:JSON.stringify({before,after,rows:[m,r]}),encoding:'utf8'});assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.equal(result.unchanged,true);assert.deepEqual(result.links,[{receipt_id:r.id,payment_id:m.id,cents:r.cents}]);
});
test('bulk permanent deletion needs a distinct acknowledgement and removes only the selected records',()=>{
 const a=payment({status:'confirmed'}),b=payment({status:'confirmed'}),other=payment({status:'confirmed'}),groups=[receiptGroup(a,'delete'),receiptGroup(b,'delete')];
 assert.throws(()=>plan(groups,[a,b,other]),/permanent deletion/);
 const p=batchPlan({input:{requestId:uid(),checked:true,deleteAcknowledged:true,groups},event,payments:[a,b,other],links:[],players:[],actor:'owner',now:'saved'}),out=execute([a,b,other],p.steps);
 assert.equal(out.error,null);assert.equal(out.payments.length,1);assert.equal(out.payments[0].id,other.id);assert.equal(p.result.deleted,2);assert.equal(p.result.removedCents,10000);
});
