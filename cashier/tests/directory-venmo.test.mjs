import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolvePaymentPlayer,resolveDirectoryVenmoPlayer,payerKey} from '../lib/venmo-aliases.mjs';
import {buildRsvpChecklist} from '../lib/rsvp.mjs';
const players=JSON.parse(readFileSync(new URL('../lib/player-directory.json',import.meta.url)));
const mappings=[['Michael Blanchette','BostnMike','bostnmike'],['David Michaelson','dmichaelson','ai-dave'],['Tony Kosturi','soonthanks','li-fo'],['Andrew Grace','Andrew-Grace-10','red'],['Nat Stine','Nathaniel-Stine','phattedcalf'],['William Blanchette','William-Blanchette-1','the-architect'],['Timothy Bailey','CougarTLB','cougar'],['Bill Stevenson','Bill-Stevenson-5','pittsburghbill'],['Kishan Changela','kcchangela','kishan'],['Vishal Nair','Vishuals','vish'],['Hiro Asari','HiroAsari','hiro'],['Sadr Ahmed','Sadr-Ahmed','ahmed'],['Liam Ohanlon','Liam-Ohanlon-2','liam-o'],['Nas Al F','nasalf','nasa-al'],['Alexander Cowart','alexcowart03','alex-c'],['Thomas Ormsby','Thomas-Ormsby','chris-o'],['William Lawton','LibNotwal','wild-bill']];
test('all 17 confirmed display names and handles map to their intended existing players',()=>{
 for(const [name,handle,slug]of mappings)for(const payer of [name,handle,'@'+handle,`  ${name.toUpperCase()}  `]){
  assert.equal(resolvePaymentPlayer({payer,method:'venmo'},players)?.slug,slug,payer);
 }
 assert.equal(players.filter(p=>p.venmoUsername).length,17);
});
test('directory matches stay exact, fail closed on collisions, and respect explicit and private assignments',()=>{
 const p={payer:'Sadr Ahmed',method:'venmo'};
 assert.equal(resolvePaymentPlayer({...p,payer:'Sadr'},players),null);
 assert.equal(resolvePaymentPlayer({...p,payer:'Sadr-Ahmed'},players)?.slug,'ahmed'); // Exact handle.
 assert.equal(resolvePaymentPlayer({...p,method:'cash'},players),null);
 assert.equal(resolvePaymentPlayer({...p,player:'Red'},players)?.slug,'red');
 assert.equal(resolvePaymentPlayer(p,players,[{payer_key:payerKey(p.payer),player_slug:'red'}])?.slug,'red');
 const duplicate=[...players,{name:'Conflicting player',slug:'conflict',aliases:[],venmoNames:['Sadr Ahmed']}];
 assert.equal(resolveDirectoryVenmoPlayer(p,duplicate),null);
 assert.equal(resolvePaymentPlayer(p,duplicate),null);
 assert.equal(resolvePaymentPlayer({...p,payer:'Unknown Sender'},players),null);
});
test('a directory match puts a receipt on its RSVP row without crediting or altering it',()=>{
 const event={id:'mtt:2026-10-24',rsvps:[{player:'chris-o',answer:'yes'}]};
 const receipt={id:'test',payer:'Thomas Ormsby',player:'',method:'venmo',event_id:event.id,kind:'entry',status:'review',cents:5000};
 const model=buildRsvpChecklist(event,[receipt],players,[]);
 assert.equal(model.rows[0].pending[0].id,'test');assert.equal(model.rows[0].status,'review');assert.equal(model.paid,0);
 assert.equal(receipt.player,'');assert.equal(receipt.status,'review');
});
