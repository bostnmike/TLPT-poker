import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync} from 'node:fs';
import {payerKey,rememberedPayer,resolvePaymentPlayer,rememberPayerPlan} from '../lib/venmo-aliases.mjs';
import {buildRsvpChecklist} from '../lib/rsvp.mjs';
import {stalePaymentPredicate} from '../lib/events.mjs';
const players=[{name:'Ahmed',slug:'ahmed',aliases:[]},{name:'Alex C',slug:'alex-c',aliases:[]}];
const alias={payer_key:payerKey('Venmo Sample'),payer_name:'Venmo Sample',player_slug:'ahmed',player_name:'Ahmed'};
test('remembered names match across events without confirming payments, and an explicit player always wins',()=>{
 const p={id:'receipt',payer:'  VENMO   SAMPLE ',player:'',event_id:'friday:2026-10-23',kind:'unknown',status:'review'};
 assert.equal(resolvePaymentPlayer(p,players,[alias])?.name,'Ahmed');
 assert.equal(resolvePaymentPlayer({...p,player:'Alex C'},players,[alias])?.name,'Alex C');
 assert.equal(resolvePaymentPlayer({...p,player:'Unlisted Guest'},players,[alias]),null);
 const model=buildRsvpChecklist({id:p.event_id,rsvps:[{player:'ahmed',answer:'yes'}]},[p],players,[alias]);
 assert.equal(model.rows[0].pending.length,1);assert.equal(model.rows[0].status,'review');assert.equal(model.paid,0);assert.equal(p.player,'');
});
test('matching preserves punctuation, refuses conflicting or retired-player aliases, and Forget returns to ordinary matching',()=>{
 assert.notEqual(payerKey('A.B.'),payerKey('AB'));
 assert.equal(rememberedPayer('Venmo Sample',[alias,{...alias,player_slug:'alex-c'}]),null);
 assert.equal(resolvePaymentPlayer({payer:'Venmo Sample'},players,[{...alias,player_slug:'retired'}]),null);
 assert.equal(resolvePaymentPlayer({payer:'Venmo Sample'},players,[]),null);
 assert.equal(rememberPayerPlan({payer:'Someone',source_id:'manual:one',method:'cash'},players[0],'actor','now'),null);
});
test('actual alias SQL only saves on a review receipt, supports replacement, and survives event cleanup',()=>{
 const schema=readdirSync(new URL('../drizzle/',import.meta.url)).filter(s=>/^\d+.*\.sql$/.test(s)).sort().map(s=>readFileSync(new URL('../drizzle/'+s,import.meta.url),'utf8')).join('\n');
 const old='friday:2026-10-16',row=id=>({id,source_id:'gmail:'+id,payer:'Venmo Sample',method:'venmo'}),steps=[];
 steps.push(rememberPayerPlan(row('first'),players[0],'actor','one'));
 steps.push(rememberPayerPlan(row('second'),players[1],'actor','two'));
 steps.push(rememberPayerPlan(row('voided'),players[0],'actor','three'));
 const purge=stalePaymentPredicate(['friday:2026-10-23']);steps.push({sql:'DELETE FROM payments WHERE '+purge.sql,values:purge.values});
 const script=`import sqlite3,json,sys\np=json.load(sys.stdin)\ndb=sqlite3.connect(':memory:')\ndb.row_factory=sqlite3.Row\ndb.executescript(p['schema'])\nfor id,status in [('first','review'),('second','review'),('voided','void')]:\n db.execute('INSERT INTO payments (id,source_id,event_id,payer,cents,kind,status,method,received_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',(id,'gmail:'+id,p['event'],'Venmo Sample',3000,'entry',status,'venmo','at','at','at'))\nfor s in p['steps']:db.execute(s['sql'],s['values'])\nprint(json.dumps({'aliases':[dict(r) for r in db.execute('SELECT * FROM venmo_player_aliases')],'payments':db.execute('SELECT count(*) FROM payments').fetchone()[0]}))`;
 const result=spawnSync(process.env.PYTHON || 'python3',['-c',script],{input:JSON.stringify({schema,event:old,steps}),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const saved=JSON.parse(result.stdout);assert.equal(saved.payments,0);assert.equal(saved.aliases.length,1);assert.equal(saved.aliases[0].player_slug,'alex-c');assert.equal(saved.aliases[0].updated_at,'two');
});
