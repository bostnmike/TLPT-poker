import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {chipCount, prizeCents, calculateIcm, MAX_POOL_CENTS} from '../public/icm-math.mjs';
import {availableIcmGames, icmGamePlayers} from '../public/icm.mjs';

test('ICM matches ICMIZER’s published three-player example and a heads-up closed form', () => {
  const three = calculateIcm([5000, 3000, 2000], [500000, 300000, 200000]);
  assert.deepEqual(three.equities, [383929, 327500, 288571]);
  assert.ok(Math.abs(three.exactCents[0] - 383928.5714285714) < 1e-7);
  assert.deepEqual(calculateIcm([75, 25], [70000, 30000]).equities, [60000, 40000]);
  assert.deepEqual(calculateIcm([3, 1], [100, 0]).equities, [75, 25]);
});

test('equal stacks, flat payouts and unpaid places retain the exact pool down to the final penny', () => {
  assert.deepEqual(calculateIcm([1, 1, 1], [100, 0, 0]).equities, [34, 33, 33]);
  assert.deepEqual(calculateIcm([10000, 20, 1], [500, 500, 500]).equities, [500, 500, 500]);
  assert.deepEqual(calculateIcm([1, 1, 1, 1, 1], [40000, 25000, 15000, 10000, 5000]).equities, [19000, 19000, 19000, 19000, 19000]);
  const result = calculateIcm([500, 400, 300, 200, 100], [10000, 6000, 3000, 0, 0]);
  assert.equal(result.equities.reduce((a, b) => a + b), 19000);
  assert.ok(result.equities.every(cents => cents > 0));
});

test('2–5 player calculations conserve the pool, respect prize bounds, and are invariant to chip-unit scaling', () => {
  let seed = 73419;
  const random = () => (seed = (seed * 48271) % 2147483647);
  for (let count = 2; count <= 5; count++) for (let trial = 0; trial < 100; trial++) {
    const stacks = Array.from({length:count}, () => random() % 100000 + 1);
    const payouts = Array.from({length:count}, () => random() % 100000).sort((a, b) => b - a);
    const result = calculateIcm(stacks, payouts), scaled = calculateIcm(stacks.map(value => value * 100), payouts);
    assert.equal(result.equities.reduce((a, b) => a + b), payouts.reduce((a, b) => a + b));
    result.equities.forEach((cents, index) => {
      assert.ok(Number.isSafeInteger(cents) && cents >= payouts.at(-1) && cents <= payouts[0]);
      assert.ok(Math.abs(result.exactCents[index] - scaled.exactCents[index]) < 1e-7);
      assert.ok(Math.abs(cents - scaled.equities[index]) <= 1);
    });
  }
});

test('ICM stays finite with highly unequal stacks and preserves player identity when reordered', () => {
  const stacks = [9000000000000, 1000, 100, 10, 1], payouts = [100000000, 50000000, 10000000, 0, 0];
  const result = calculateIcm(stacks, payouts), reversed = calculateIcm([...stacks].reverse(), payouts);
  assert.ok(result.exactCents.every(Number.isFinite));
  assert.equal(result.equities.reduce((a, b) => a + b), 160000000);
  result.exactCents.forEach((cents, index) => assert.ok(Math.abs(cents - reversed.exactCents[4 - index]) < 1e-6));
});

test('chip and prize entry parse whole chips and cents without truncating malformed input', () => {
  assert.equal(chipCount('125,000'), 125000); assert.equal(chipCount(' 500 '), 500);
  assert.equal(prizeCents('1,234.56'), 123456); assert.equal(prizeCents('12.5'), 1250); assert.equal(prizeCents('0'), 0);
  for (const input of ['', '1.5', '-5', '0', '1e6', '12,34', 'Infinity', '9007199254740992']) assert.throws(() => chipCount(input));
  for (const input of ['', '-1', '1.234', '1e3', '1,23.00', 'Infinity', '1000000001']) assert.throws(() => prizeCents(input));
});

test('invalid player counts, chip totals and payout structures cannot produce a result', () => {
  for (const stacks of [[1], [1,1,1,1,1,1], [0,1], [-1,1], [1.5,2], [NaN,2], [Infinity,1], [Number.MAX_SAFE_INTEGER,1]]) assert.throws(() => calculateIcm(stacks, stacks.map(() => 100)));
  for (const payouts of [[100], [100,0,0], [0,0], [50,100], [-1,0], [NaN,0], [1.5,0], [MAX_POOL_CENTS,1]]) assert.throws(() => calculateIcm([1,1], payouts));
});

test('game choices respect the RSVP on/off switch and names come from the selected confirmed lineup including the host', () => {
  const feed = {players:[{slug:'host',name:'Host'},{slug:'red',name:'Red'},{slug:'maybe',name:'Maybe'},{slug:'out',name:'Out'},{slug:'wait',name:'Wait'}],events:[{id:'open',rsvpOpen:true},{id:'closed',rsvpOpen:false}]};
  assert.deepEqual(availableIcmGames(feed).map(event => event.id), ['open']);
  assert.deepEqual(availableIcmGames(feed, true).map(event => event.id), ['open','closed']);
  assert.deepEqual(availableIcmGames(feed, 'true').map(event => event.id), ['open']);
  assert.deepEqual(icmGamePlayers(feed,{rsvps:{host:'yes',red:'yes',maybe:'maybe',out:'no',wait:'maybe'}}).map(player => player.slug), ['host','red']);
});

test('both views offer a new-tab ICM link with an escaped game identity and no private key', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const context = {HOST:'bostnmike',esc:String,dateLabel:String,person:String,waitlistMarkup:()=>'',lineup:()=>'',posterMarkup:()=>'',playerName:String,playerPreview:false,busy:false,viewer:null,viewingPlayer:()=>context.viewer};
  vm.createContext(context);vm.runInContext(source.match(/^function eventCard\(e\)\{[^]*?^}/m)[0]+';this.card=eventCard;',context);
  const event = {id:'game & 1',slot:'friday',day:'Friday',title:'Game',date:'2030-01-04',capacity:9,rsvpOpen:true,rsvps:{},waitlist:[]};
  let html = context.card(event);assert.match(html,/href="\/icm.html\?event=game%20%26%201" target="_blank" rel="noopener"/);assert.ok(!html.includes('commish=1'));
  context.viewer = {role:'admin'};html = context.card(event);assert.match(html,/event=game%20%26%201&amp;commish=1/);assert.ok(!html.includes('#key='));
  context.window={matchMedia:()=>({matches:true})};html=context.card(event);assert.match(html,/target="_self"/);assert.ok(!html.includes('(opens in a new tab)'));assert.match(html,/commish=1/);
});
