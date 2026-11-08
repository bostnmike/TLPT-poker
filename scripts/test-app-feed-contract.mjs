// Exercise the real producer and both real consumers with synthetic state only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {publicFeed} from '../rsvp/model.mjs';
import {overlayLiveRsvps, validateLiveRsvps} from '../cashier/lib/live-rsvp.mjs';

const names = ['loadLiveRsvpEvents', 'getRsvpCounts', 'getEventDateKey', 'getCurrentEvents'];
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const functions = names.map(name => {
  const match = source.match(new RegExp('^(?:async )?function ' + name + '\\([^]*?^}', 'm'));
  assert.ok(match, `Missing production site function ${name}`);
  return match[0];
}).join('\n');
const state = {
  revision: 7, updatedAt: '2026-11-01T12:00:00Z',
  adminHash: 'PRIVATE_ADMIN', audit: ['PRIVATE_AUDIT'],
  players: ['bostnmike', 'confirmed', 'waiting', 'maybe'].map(slug => ({slug, name: slug, rosterStatus: 'active', linkHash: 'PRIVATE_LINK'})),
  events: [{id: 'stable-friday', capacity: 2, open: true,
    metadata: {title: 'Fixture Friday', slot: 'friday', date: '2026-11-06'},
    responses: {confirmed: {answer: 'yes', order: 1}, waiting: {answer: 'yes', order: 2}, maybe: {answer: 'maybe', order: 3}},
    coffeeOrders: {confirmed: 'PRIVATE_COFFEE'}}]
};
let feed = publicFeed(state, new Date('2026-11-01T12:00:00Z'));
assert.equal(validateLiveRsvps(feed), feed);
for (const secret of ['PRIVATE_ADMIN', 'PRIVATE_AUDIT', 'PRIVATE_LINK', 'PRIVATE_COFFEE']) assert.ok(!JSON.stringify(feed).includes(secret));
assert.equal(feed.schemaVersion, 1);
assert.equal(feed.events[0].rsvpOpen, true);
assert.equal(feed.events[0].rsvp_url, 'https://tlpt-rsvp.tlpt-bostnmike.workers.dev/?event=stable-friday');
const context = {
  fetch: async () => Response.json(feed), AbortSignal, LIVE_RSVP_FEED: 'https://fixture.test',
  EVENT_SLOT_ORDER: ['friday','saturday','sunday','mtt'], getEventSlot: e => e.slot, getEventDayLabel: e => e.slot
};
vm.createContext(context);
vm.runInContext(functions, context);
const live = await context.loadLiveRsvpEvents([]);
assert.equal(live.unavailable, false);
assert.equal(context.getCurrentEvents(live)[0].id, 'stable-friday');
const counts = context.getRsvpCounts(live.events[0]);
assert.equal(counts.yes, 2);
assert.equal(counts.maybe, 1, 'Waitlist must not count as an independent Maybe');
const saved = [{id:'friday:2026-11-06', slot:'friday', date:'2026-11-06', payments:[{id:'fixture-payment', cents:3000}]}];
const overlaid = overlayLiveRsvps(saved, feed);
assert.deepEqual(overlaid[0].payments, saved[0].payments);
assert.deepEqual(overlaid[0].rsvpWaitlist, [{slug:'waiting', position:1}]);
assert.equal(overlaid[0].rsvpStale, false);
state.events[0].open = false;
feed = publicFeed(state, new Date('2026-11-01T12:00:00Z'));
assert.equal(context.getCurrentEvents(await context.loadLiveRsvpEvents([])).length, 0);
assert.equal(overlayLiveRsvps(saved, feed)[0].rsvpStale, false, 'Closed signup does not erase the saved payment lineup');
context.fetch = async () => { throw Error('Synthetic outage'); };
assert.equal(context.getCurrentEvents(await context.loadLiveRsvpEvents(saved)).length, 0);
for (const changed of [{...feed, schemaVersion:2}, {...feed, revision:'invalid'}, {...feed, events:[{...feed.events[0], rsvps:[]}]}]) assert.throws(() => validateLiveRsvps(changed));
console.log('PASS: real RSVP feed → site and Cashier; schema, privacy, stable links, seats/waitlist, open/closed/outage and unchanged payment ownership.');
