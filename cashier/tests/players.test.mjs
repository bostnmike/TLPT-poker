import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlayer,playerInitials,newestPayments} from '../lib/players.mjs';
const players=[{name:'A.I. Dave',slug:'ai-dave',aliases:['ai dave']},{name:'Ahmed',slug:'ahmed',aliases:['ahmed']}];
test('player names, slugs and explicit aliases resolve without guessing a Venmo identity',()=>{
 for(const name of ['A.I. Dave','AI Dave','ai-dave'])assert.equal(resolvePlayer({player:name},players)?.slug,'ai-dave');
 assert.equal(resolvePlayer({payer:'Ahmed'},players)?.slug,'ahmed');
 assert.equal(resolvePlayer({payer:'Ahmed Smith'},players),null);
 assert.equal(resolvePlayer({player:'Guest',payer:'Ahmed'},players),null);
 assert.equal(resolvePlayer({payer:'Ahmed'},[...players,{name:'Other',slug:'other',aliases:['ahmed']}]),null);
 assert.equal(playerInitials('Guest Player'),'GP');
});
test('both ledgers can sort by receipt time with stable tie breaks without changing source records',()=>{
 const rows=[{id:'old',received_at:'2026-10-24T18:00:00Z'},{id:'new',received_at:'2026-10-24T19:00:00Z',created_at:'2026-10-24T19:01:00Z'},{id:'tie',received_at:'2026-10-24T19:00:00Z',created_at:'2026-10-24T19:02:00Z'}];
 assert.deepEqual(newestPayments(rows).map(p=>p.id),['tie','new','old']);
 assert.equal(rows[0].id,'old');
});
