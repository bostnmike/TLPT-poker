import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {canClearEventHistory,eventHistoryClearPlan} from '../lib/event-history.mjs';
const schema=readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort().map(f=>readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8')).join('\n');
const event={id:'mtt:2026-10-24',slot:'mtt',date:'2026-10-24'},now=Date.parse('2026-10-25T17:00:00Z');
const row=(id,extra={})=>({id,source_id:'gmail:'+id,event_id:event.id,candidate_event_ids:'[]',payer:'Test',player:'Test',cents:5000,kind:'entry',status:'confirmed',method:'venmo',received_at:'at',created_at:'at',updated_at:'at',...extra});
const rows=[row('manual',{source_id:'manual:one'}),row('receipt',{status:'linked',linked_to:'manual'}),row('void',{status:'void'}),row('review',{status:'review'}),row('ignored',{status:'ignored'}),row('friday',{event_id:'friday:2026-10-30'}),row('saturday',{event_id:'saturday:2026-10-31'}),row('only-mtt',{event_id:null,candidate_event_ids:JSON.stringify([event.id])}),row('shared',{event_id:null,candidate_event_ids:JSON.stringify([event.id,'saturday:2026-10-31'])})];
function execute({revision=rows.length,stale=false}={}){
 const steps=eventHistoryClearPlan({event,now,expectedRevision:revision,confirmationDate:event.date,checked:true,requestId:'clear-test'});
 const script=`import sqlite3,json,sys
p=json.load(sys.stdin);d=sqlite3.connect(':memory:');d.row_factory=sqlite3.Row;d.execute('PRAGMA foreign_keys=ON');d.executescript(p['schema'])
for row in p['rows']:
 d.execute('INSERT INTO payments ('+','.join(row)+') VALUES ('+','.join('?' for k in row)+')',list(row.values()))
 d.execute('INSERT INTO audit VALUES (?,?,?,?,?,?)',(row['id'],row['id'],'test','actor','{}','at'))
d.execute('INSERT INTO receipt_links VALUES (?,?,?)',('receipt','manual',5000))
for e in ['mtt:2026-10-24','saturday:2026-10-31']:
 d.execute('INSERT INTO cashier_batches VALUES (?,?,?,?,?)',(e,e,'hash','private old batch','at'))
 d.execute('INSERT INTO deleted_payment_sources VALUES (?,?,?)',(e,e,'[]'))
d.execute('INSERT INTO venmo_player_aliases VALUES (?,?,?,?,?,?)',('test','Test','p','P','at','actor'))
d.commit()
if p['stale']:d.execute("UPDATE payments SET updated_at='new' WHERE id='manual'");d.commit()
error=None
try:
 with d:
  for s in p['steps']:d.execute(s['sql'],s['values'])
except sqlite3.IntegrityError as e:error=str(e)
result={'error':error}
for table in ['payments','audit','receipt_links','cashier_batches','cashier_batch_checks','deleted_payment_sources','event_history_clears','venmo_player_aliases']:result[table]=[dict(r) for r in d.execute('SELECT * FROM '+table)]
blocked=[]
if not error:
 for event_id,candidates in [('mtt:2026-10-24','[]'),(None,'["mtt:2026-10-24","saturday:2026-10-31"]')]:
  try:
   with d:d.execute('INSERT INTO payments (id,source_id,event_id,candidate_event_ids,payer,cents,kind,status,method,received_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',('stale','gmail:stale',event_id,candidates,'Test',5000,'entry','review','venmo','at','at','at'))
  except sqlite3.IntegrityError:blocked.append(True)
  else:blocked.append(False)
 with d:d.execute("INSERT INTO payments (id,source_id,event_id,payer,cents,kind,status,method,received_at,created_at,updated_at) VALUES ('new','gmail:new','mtt:2026-11-14','Test',5000,'entry','review','venmo','at','at','at')")
result['staleInsertsBlocked']=blocked
print(json.dumps(result))`;
 const r=spawnSync(process.env.PYTHON||'python3',['-c',script],{input:JSON.stringify({schema,rows,steps,stale}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
test('clearing a past MTT removes all payment statuses, linked receipts, audit and batch history only for that MTT',()=>{
 const r=execute();assert.equal(r.error,null);
 assert.deepEqual(r.payments.map(p=>p.id),['friday','saturday','shared']);assert.deepEqual(r.audit.map(p=>p.id),['friday','saturday','shared']);
 assert.equal(r.receipt_links.length,0);assert.equal(r.cashier_batch_checks.length,0);
 assert.deepEqual(r.cashier_batches.map(b=>b.event_id),['saturday:2026-10-31']);
 assert.deepEqual(r.deleted_payment_sources.map(p=>p.event_id),['saturday:2026-10-31']);
 assert.deepEqual(JSON.parse(r.payments.find(p=>p.id==='shared').candidate_event_ids),['saturday:2026-10-31']);
 assert.equal(r.venmo_player_aliases.length,1);
 assert.deepEqual(r.event_history_clears,[{event_id:event.id,cleared_at:new Date(now).toISOString()}]);
 assert.deepEqual(r.staleInsertsBlocked,[true,true]);
});
test('a changed ledger invalidates the clear confirmation atomically and leaves every record intact',()=>{
 const r=execute({stale:true});assert.match(r.error,/CHECK/);assert.equal(r.payments.length,rows.length);assert.equal(r.event_history_clears.length,0);assert.equal(r.receipt_links.length,1);assert.equal(r.cashier_batches.length,2);
});
test('clearing requires the exact date, explicit acknowledgement and a finished game',()=>{
 const valid={event,now,expectedRevision:1,confirmationDate:event.date,checked:true,requestId:'test'};
 for(const change of [{checked:false},{confirmationDate:'2026-10-31'},{expectedRevision:-1},{event:{...event,slot:'saturday'}},{event:{...event,historyClearedAt:'at'}},{now:Date.parse('2026-10-25T09:59:59Z')}])assert.throws(()=>eventHistoryClearPlan({...valid,...change}));
 assert.equal(canClearEventHistory(event,Date.parse('2026-10-25T10:00:00Z')),true);
 assert.equal(canClearEventHistory({id:'friday:2026-10-23',slot:'friday',date:'2026-10-23'},now),true);
 assert.equal(canClearEventHistory({id:'saturday:2026-10-31',slot:'saturday',date:'2026-10-31'},now),false);
 assert.equal(canClearEventHistory({...event,id:'mtt:2026-11-07',date:'2026-11-07'},Date.parse('2026-11-08T10:59:59Z')),false);
 assert.equal(canClearEventHistory({...event,id:'mtt:2026-11-07',date:'2026-11-07'},Date.parse('2026-11-08T11:00:00Z')),true);
});
