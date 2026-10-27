import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolvePaymentPlayer} from '../lib/venmo-aliases.mjs';
const players=JSON.parse(readFileSync(new URL('../lib/player-directory.json',import.meta.url)));
test('historical Li-Fo payments resolve to ButtonMan without editing receipts or their payer names',()=>{
 const player=players.find(p=>p.slug==='li-fo');
 assert.equal(player.name,'ButtonMan: fka LiFo');
 assert.match(player.image,/images\/players\/li-fo\.jpg$/);
 for(const name of ['Li-Fo','LiFo','Li Fo','Tony','ButtonMan','ButtonMan: fka LiFo']){
  const payment={player:name,payer:'Tony Kosturi',method:'venmo',cents:5000};
  const before=JSON.stringify(payment);
  assert.equal(resolvePaymentPlayer(payment,players)?.slug,'li-fo');
  assert.equal(resolvePaymentPlayer(payment,players)?.name,player.name);
  assert.equal(JSON.stringify(payment),before);
 }
 assert.equal(resolvePaymentPlayer({payer:'Tony Kosturi',method:'venmo'},players)?.slug,'li-fo');
});
