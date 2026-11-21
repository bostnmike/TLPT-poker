import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyOperation} from '../model.mjs';
import {database} from './sqlite.mjs';
import {livePaymentSchedule} from '../../cashier/lib/live-payment-schedule.mjs';
import {applyPaymentFormat, paymentSelection} from '../../cashier/lib/events.mjs';
import {publicFeed} from '../model.mjs';

const slots = ['friday', 'saturday', 'sunday', 'mtt'];
const metadata = slot => ({
  slot, day:slot, date:'2030-01-04', title:slot, format:'Fixture',
  structure:'Fixture', time:'7:00 PM', endTime:'11:30 PM', location:'Room', address:'Cary'
});
const state = () => ({revision:1, sequence:0, players:[], events:[], audit:[]});

test('new games default to $30+$10 or MTT $40+$10 on entries and rebuys', () => {
  for (const slot of slots) {
    const saved = state();
    applyOperation(saved, {role:'admin'}, {
      type:'event', newId:slot, metadata:metadata(slot), capacity:slot==='mtt'?18:9, open:true
    });
    const event = saved.events[0];
    assert.equal(event.metadata.rsvpBountyCents,1000);
    assert.equal(event.metadata.rsvpBountyOnRebuy,true);
    const feed = publicFeed(saved, new Date('2030-01-01'));
    const priced = applyPaymentFormat(livePaymentSchedule(feed,{events:{}},[],[],Date.parse('2030-01-01'))[0]);
    for (const kind of ['entry','rebuy']) {
      const total = paymentSelection(priced,[kind]);
      const base = slot==='mtt'?4000:3000;
      assert.deepEqual([total.cents,total.prize,total.bounty],[base+1000,base,1000]);
    }
  }
});

test('an explicit event exception remains editable after default creation', () => {
  const saved = state();
  applyOperation(saved,{role:'admin'},{
    type:'event', newId:'custom', capacity:9, open:false,
    metadata:{...metadata('friday'),rsvpBuyInCents:3500,rsvpRebuyCents:2500,rsvpBountyCents:0}
  });
  const event = saved.events[0];
  assert.deepEqual([event.metadata.rsvpBuyInCents,event.metadata.rsvpRebuyCents,event.metadata.rsvpBountyCents,event.metadata.rsvpBountyOnRebuy],[3500,2500,0,false]);
});

test('existing-event migration preserves everything except payment defaults and state audit revision', () => {
  const saved = state();
  saved.events = slots.map((slot,index) => ({
    id:slot, metadata:{...metadata(slot),rsvpBountyCents:0,rsvpBountyOnRebuy:false}, open:index===0,
    responses:{red:{answer:'yes',order:1}}, capacity:9,
    coffeeOrders:{red:{fixture:{status:'completed'}}},
    ...(index===1?{cancelled:true}:index===2?{deletedAt:'2029-12-01'}:{})
  }));
  const db = database();
  try {
    db.sql.prepare('INSERT INTO rsvp_state VALUES(1,1,?)').run(JSON.stringify(saved));
    db.sql.exec(readFileSync(new URL('../migrations/0006_default_bounty_rebuys.sql',import.meta.url),'utf8'));
    const row = db.sql.prepare('SELECT revision,body FROM rsvp_state').get();
    const migrated = JSON.parse(row.body);
    assert.equal(row.revision,2);
    assert.equal(migrated.revision,2);
    assert.equal(migrated.audit.at(-1).type,'default-bounty-rebuys');
    for (const [index,event] of migrated.events.entries()) {
      const base = event.metadata.slot==='mtt'?4000:3000;
      const expected = structuredClone(saved.events[index]);
      Object.assign(expected.metadata,{rsvpBuyInCents:base,rsvpRebuyCents:base,rsvpBountyCents:1000,rsvpBountyOnRebuy:true});
      assert.deepEqual(event,expected);
    }
  } finally { db.sql.close(); }
});
