import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {closeoutIdentity,previewEventCloseout,closeOutEvent,verifyCloseoutResults} from '../lib/event-closeout.mjs';
import {closeoutEvidence} from './fixtures/closeout-evidence.mjs';
const now=Date.parse('2020-01-02T06:30:00Z'); // 1:30 a.m. Eastern: verified finish may bypass legacy6am.
const eventId='mtt:2020-01-01',otherId='friday:2099-01-02';
const input={protocol:1,eventId,rsvpEventId:'stable-mtt',title:'Close-out test',confirmationDate:'2020-01-01',payoutsConfirmed:false,receiptsReviewed:false,resultsConfirmed:false};
const schema=readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort().map(f=>readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8')).join('\n');
function database(t){
 const dir=mkdtempSync(join(tmpdir(),'cashier-closeout-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const path=join(dir,'db.sqlite');
 const execute=(steps=[],init=false)=>{
  const script=`import sqlite3,json,sys
p=json.load(sys.stdin);d=sqlite3.connect(p['path']);d.row_factory=sqlite3.Row;d.execute('PRAGMA foreign_keys=ON')
if p['init']:d.executescript(p['schema'])
rows=[]
with d:
 for s in p['steps']:
  c=d.execute(s['sql'],s.get('values',[]))
  if c.description:rows=[dict(r) for r in c.fetchall()]
print(json.dumps(rows))`;
  const r=spawnSync('python3',['-c',script],{input:JSON.stringify({path,steps,init,schema}),encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return JSON.parse(r.stdout);
 };
 execute([],true);
 const prepare=sql=>({sql,values:[],bind(...values){return {...this,values};},async first(){return execute([this])[0]||null;},async all(){return {results:execute([this])};},async run(){execute([this]);}});
 return {prepare,async batch(steps){execute(steps);},execute};
}
function seed(db){
 const steps=[];
 for(const [id,e,candidates,status] of [['paid',eventId,[],'confirmed'],['review',eventId,[],'review'],['other',otherId,[],'confirmed'],['shared',null,[eventId,otherId],'review']])steps.push({sql:'INSERT INTO payments(id,source_id,event_id,candidate_event_ids,payer,cents,kind,status,method,received_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',values:[id,'gmail:'+id,e,JSON.stringify(candidates),'Test',3000,'entry',status,'venmo','at','at','at']});
 steps.push({sql:'INSERT INTO receipt_links VALUES(?,?,?)',values:['review','paid',3000]},
  {sql:'INSERT INTO audit VALUES(?,?,?,?,?,?)',values:['audit','paid','test','actor','{}','at']},
  {sql:'INSERT INTO cashier_batches VALUES(?,?,?,?,?)',values:['old-batch',eventId,'hash','{}','at']},
  {sql:'INSERT INTO event_payment_formats VALUES(?,?,?,?,?)',values:[eventId,'standard',500,'at','actor']},
  {sql:'INSERT INTO venmo_player_aliases VALUES(?,?,?,?,?,?)',values:['test','Test','test','Test','at','actor']},
  {sql:'INSERT INTO schedule_state VALUES(?,?,?,?,?,?)',values:['schedule',JSON.stringify([{id:eventId},{id:otherId}]),'live-v1:test','at','at','']},
  {sql:'INSERT INTO live_rsvp_state VALUES(?,?,?,?,?)',values:['attendance',JSON.stringify({schemaVersion:1,revision:1,events:[{id:'stable-mtt',slot:'mtt',date:'2020-01-01',rsvps:{test:'yes'}},{slot:'friday',date:'2099-01-02',rsvps:{}}]}),'at','at','']});
 db.execute(steps);
}
const finish=(preview,extra={})=>({...input,payoutsConfirmed:true,receiptsReviewed:true,resultsConfirmed:true,requestId:'11111111-1111-4111-8111-111111111111',expectedRevision:preview.historyRevision,expectedResultsRevision:preview.evidence.revision,...extra});
test('preview is read-only; verified explicit close clears one ledger, caches and formats, preserving future/shared records and aliases',async t=>{
 const db=database(t);seed(db);const fixture=closeoutEvidence();
 const p=await previewEventCloseout(db,input,fixture.fetch,now);assert.equal(p.ok,true);assert.equal(p.records,2);assert.equal(p.review,1);assert.equal(db.execute([{sql:'SELECT * FROM event_history_clears'}]).length,0);
 assert.equal((await closeOutEvent(db,finish(p,{payoutsConfirmed:false}),fixture.fetch,now)).code,'confirmation');
 const closed=await closeOutEvent(db,finish(p),fixture.fetch,now);assert.equal(closed.ok,true,JSON.stringify(closed));assert.equal(closed.receipt.closed,true);assert.equal(closed.receipt.requestId,finish(p).requestId);
 assert.deepEqual(db.execute([{sql:'SELECT id FROM payments ORDER BY id'}]).map(p=>p.id),['other','shared']);
 assert.deepEqual(JSON.parse(db.execute([{sql:"SELECT candidate_event_ids FROM payments WHERE id='shared'"}])[0].candidate_event_ids),[otherId]);
 for(const table of ['audit','receipt_links','cashier_batches','cashier_batch_checks','event_payment_formats'])assert.equal(db.execute([{sql:'SELECT * FROM '+table}]).length,0,table);
 assert.equal(db.execute([{sql:'SELECT * FROM venmo_player_aliases'}]).length,1);
 assert.deepEqual(JSON.parse(db.execute([{sql:'SELECT events_json FROM schedule_state'}])[0].events_json),[{id:otherId}]);
 assert.equal(JSON.parse(db.execute([{sql:'SELECT body FROM live_rsvp_state'}])[0].body).events.length,1);
 assert.throws(()=>db.execute([{sql:"INSERT INTO payments(id,source_id,event_id,payer,cents,kind,status,method,received_at,created_at,updated_at) VALUES('late','gmail:late',?,'Test',3000,'entry','review','venmo','at','at','at')",values:[eventId]}]),/cleared/);
 const retry=await closeOutEvent(db,finish(p),async()=>{throw Error('offline');},now+10000);assert.equal(retry.ok,true);assert.equal(retry.alreadyClosed,true);assert.deepEqual(retry.receipt,closed.receipt);
 assert.equal((await closeOutEvent(db,finish(p,{requestId:'22222222-2222-4222-8222-222222222222'}),fixture.fetch,now)).code,'action-conflict');
 assert.equal((await previewEventCloseout(db,{...input,rsvpEventId:'wrong-id'},fixture.fetch,now)).code,'identity');
});
test('future/undated/mismatched results and unpublished or failing canonical checks fail without writes',async t=>{
 const db=database(t);
 assert.throws(()=>closeoutIdentity({...input,eventId:otherId,confirmationDate:'2099-01-02'},now),/Future/);
 assert.throws(()=>closeoutIdentity({...input,eventId:'mtt:Date TBD'},now),/dated/);
 for(const fixture of [closeoutEvidence({title:'Different event'}),closeoutEvidence({publishedMismatch:true}),closeoutEvidence({rawMissing:true}),closeoutEvidence({invalidReport:true})])assert.equal((await previewEventCloseout(db,input,fixture.fetch,now)).ok,false);
 await assert.rejects(()=>verifyCloseoutResults({date:'2020-01-01',title:input.title},closeoutEvidence().fetch,Date.parse('2020-01-01T12:00Z')),/future/);
 assert.equal(db.execute([{sql:'SELECT * FROM event_closeouts'}]).length,0);
});
test('stale ledger/results and open event deny clearing; a current preview succeeds after closure',async t=>{
 const db=database(t);seed(db);const fixture=closeoutEvidence();const p=await previewEventCloseout(db,input,fixture.fetch,now);
 assert.equal((await closeOutEvent(db,finish(p,{expectedRevision:p.historyRevision-1}),fixture.fetch,now)).code,'ledger-changed');
 assert.equal((await closeOutEvent(db,finish(p,{expectedResultsRevision:'b'.repeat(40)}),fixture.fetch,now)).code,'results-changed');
 const opened=closeoutEvidence({feed:{schemaVersion:1,revision:1,events:[{id:'stable-mtt',slot:'mtt',date:'2020-01-01',rsvpOpen:true}]}});
 assert.equal((await closeOutEvent(db,finish(p),opened.fetch,now)).code,'event-open');
 assert.equal(db.execute([{sql:'SELECT * FROM payments'}]).length,4);assert.equal(db.execute([{sql:'SELECT * FROM event_history_clears'}]).length,0);
});
test('a zero-payment event receives a durable marker; a prior manual clear can be reconciled',async t=>{
 for(const legacy of [false,true]){
  const db=database(t);if(legacy)db.execute([{sql:'INSERT INTO event_history_clears VALUES(?,?)',values:[eventId,'earlier']}]);
  const fixture=closeoutEvidence(),p=await previewEventCloseout(db,input,fixture.fetch,now);assert.equal(p.records,0);assert.equal(p.alreadyCleared,legacy);
  const result=await closeOutEvent(db,finish(p),fixture.fetch,now);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(db.execute([{sql:'SELECT * FROM event_closeouts'}]).length,1);assert.equal(db.execute([{sql:'SELECT * FROM event_history_clears'}]).length,1);
 }
});
