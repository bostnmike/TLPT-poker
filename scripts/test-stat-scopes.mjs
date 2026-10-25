import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../stats-scope.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ window: {} });
vm.runInContext(source, ctx);
const scope = ctx.window.TLPTStats;
const events = read('data/generated/stat-events.json').events;
const history = read('data/generated/event-history.json').events;
const formats = read('data/event-formats.json').events;
const archive = read('knockout-events-full.json');
const career = read('data/generated/site-data.json');
const before = JSON.stringify(career);
const plain = value => JSON.parse(JSON.stringify(value));
assert.equal(events.length, history.length);
for (const event of history) {
  const compact = events.find(e => e.eventId === event.eventId);
  assert.ok(compact, event.eventId);
  assert.deepEqual(compact.players, event.players);
  assert.deepEqual(compact.knockouts, archive[event.eventId]);
  assert.equal(compact.format, formats[event.eventId]);
  assert.equal(compact.bounty, Boolean(event.summary.bounty?.amount));
}
const totalKeys = ['entries', 'buyIns', 'rebuys', 'hits', 'timesPlaced', 'bubbles', 'profit',
  'totalCost', 'totalWinnings', 'bountiesWon', 'bountyPaid', 'bountyCollected', 'bountyRetained',
  'bountyWinnings', 'bountyNet', 'settlementAdjustment'];
const ratingKeys = ['trueSkillScore', 'luckIndex', 'clutchIndex', 'aggressionIndex', 'survivorIndex',
  'tiltIndex', 'expectedProfit', 'tier', 'cardForm', 'cardCollection', 'featuredCardEdition', 'rosterStatus'];
let combinations = 0;
for (const format of ['all', 'single', 'mtt']) for (const bounty of ['all', 'with', 'without']) {
  const selected = scope.select(events, { format, bounty });
  const expected = history.filter(e => (format === 'all' || formats[e.eventId] === format)
    && (bounty === 'all' || Boolean(e.summary.bounty?.amount) === (bounty === 'with')));
  assert.deepEqual(plain(selected.map(e => e.eventId)), expected.map(e => e.eventId));
  const players = scope.aggregate(career.players, selected);
  for (const player of players) {
    const original = career.players.find(p => p.slug === player.slug);
    const rows = expected.flatMap(e => e.players.filter(p => p.slug === player.slug && p.entries > 0));
    for (const key of totalKeys) assert.equal(player[key], rows.reduce((sum, r) => sum + Number(r[key] || 0), 0), `${format}/${bounty} ${player.slug} ${key}`);
    for (const key of ratingKeys) assert.deepEqual(plain(player[key] ?? null), original[key] ?? null, `Career ${key} changed`);
    assert.equal(player.roi, player.totalCost ? player.profit / player.totalCost : 0);
    assert.equal(player.hitRate, player.entries ? player.hits / player.entries : 0);
    assert.equal(player.cashRate, player.buyIns ? player.timesPlaced / player.buyIns : 0);
    assert.equal(player.bubbleRate, player.buyIns ? player.bubbles / player.buyIns : 0);
    assert.equal(player.totalWinnings, player.tournamentWinnings + player.bountyWinnings + player.settlementAdjustment);
    assert.equal(player.tournamentProfit, player.tournamentWinnings - player.tournamentCost);
  }
  const kills = scope.knockoutView(selected);
  assert.equal(Object.values(kills.byKiller).flatMap(Object.values).reduce((a,b) => a+b,0), players.reduce((sum,p) => sum+p.hits,0));
  assert.equal(kills.bounties.claims.length, players.reduce((sum,p) => sum+p.bountiesWon,0));
  assert.equal(kills.bounties.claims.reduce((sum,c) => sum+c.amount,0), players.reduce((sum,p) => sum+p.bountyCollected,0));
  combinations++;
}
assert.equal(JSON.stringify(career), before, 'Career source must never be mutated');
const all = scope.aggregate(career.players, events);
for (const player of all) {
  const original = career.players.find(p => p.slug === player.slug);
  for (const key of [...totalKeys, 'roi', 'hitRate', 'cashRate', 'bubbleRate', 'tournamentProfit']) assert.equal(player[key], original[key], `Combined parity: ${player.slug} ${key}`);
}
assert.deepEqual(plain(scope.knockoutView(events)), read('data/generated/knockouts.json'));
assert.deepEqual(plain(scope.normalize({ format: 'bad', bounty: 'bad' })), { format: 'all', bounty: 'all' });
// Fixed settlement fixture, not the MTT aggregate (which grows with future events).
const mtt = scope.aggregate(career.players, events.filter(event => event.eventId === '2026-10-24'));
assert.equal(mtt.find(p => p.slug === 'wild-bill').settlementAdjustment, 10);
assert.equal(mtt.find(p => p.slug === 'providencemike').totalWinnings, 490);
assert.equal(mtt.find(p => p.slug === 'ai-dave').hits, 2, 'Opt-out hands still count');
assert.equal(mtt.find(p => p.slug === 'liam-o').buyIns, 1, 'Single-appearance players are included');
for (const page of ['dashboard','standings','player','knockouts','form-lab']) {
  const html = fs.readFileSync(new URL(`../${page}.html`, import.meta.url), 'utf8');
  assert.equal((html.match(/data-stat-scope /g) || []).length, 1, `${page}: shared controls`);
  assert.match(html, /stats-scope\.js\?v=20261025-1/);
  assert.match(html, /stats-scope\.css\?v=20261025-1/);
}
console.log(`PASS: ${combinations} filter combinations, source parity, all financial/rate/knockout totals, opt-outs, chops, settlement, career immutability and five page integrations.`);
