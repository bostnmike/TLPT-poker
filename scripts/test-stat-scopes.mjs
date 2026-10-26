import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../stats-scope.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /sessionStorage|localStorage/, 'Event filters must not restore previous choices');
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
  assert.equal(compact.date, event.date);
  assert.equal(compact.title, event.title);
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
for (const page of ['dashboard','standings','player','knockouts','form-lab','streaks','player-movement']) {
  const html = fs.readFileSync(new URL(`../${page}.html`, import.meta.url), 'utf8');
  assert.equal((html.match(/data-stat-scope /g) || []).length, 1, `${page}: shared controls`);
  assert.match(html, /stats-scope\.js\?v=20261026-1/);
  assert.match(html, /stats-scope\.css\?v=20261025-1/);
}
const streakContext = vm.createContext({ document: { addEventListener() {} } });
const dashboardMarkup = fs.readFileSync(new URL('../dashboard.html', import.meta.url),'utf8');
assert.match(dashboardMarkup, /<dialog id="dashboard-help"/, 'Dashboard includes accessible contextual help');
assert.match(dashboardMarkup, /dashboard-help\.js\?v=20261026-4/, 'Contextual help is loaded');
const guideContext = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(new URL('../stats-help-content.js', import.meta.url),'utf8'), guideContext);
for (const page of ['standings','form-lab','player-movement','streaks','knockouts','players','player']) {
  const markup = fs.readFileSync(new URL('../'+page+'.html',import.meta.url),'utf8');
  assert.ok(markup.includes('data-stats-help-open="'+page+'"'), page+': contextual help invitation');
  assert.match(markup, /stats-help\.css\?v=20261026-3/);
  assert.match(markup, /stats-help-content\.js\?v=20261026-2/);
  assert.match(markup, /stats-help\.js\?v=20261026-4/);
}
assert.ok(fs.statSync(new URL('../images/site/norm-headshot.png',import.meta.url)).size>1000);
assert.equal(Object.keys(guideContext.window.TLPTStatsGuides).length,8);
for (const guide of Object.values(guideContext.window.TLPTStatsGuides)) {
  assert.ok(guide.title && guide.intro && guide.sections.length>=4);
  if(guide.audio) {
    const recording = fs.readFileSync(new URL('../'+guide.audio,import.meta.url));
    assert.ok(recording.length>1000, 'Enabled narration has audio data');
    assert.equal(recording.subarray(0,3).toString(),'ID3','Enabled narration is an MP3');
  }
}
for (const category of ['results', 'bankroll', 'rates', 'player-dna']) {
  const recording = fs.readFileSync(new URL(`../media/norm-narrates/norm-dashboard-${category}.mp3`, import.meta.url));
  assert.ok(recording.length > 1000, `${category}: narration asset is present`);
  assert.equal(recording.subarray(0, 3).toString(), 'ID3', `${category}: narration is an MP3`);
}
for (const page of ['dashboard','standings','player','knockouts','form-lab','streaks','player-movement','players','trophy-room','gallery','voice-of-god','structures']) {
  const html = fs.readFileSync(new URL(`../${page}.html`, import.meta.url), 'utf8');
  assert.equal((html.match(/class="[^"]*\btlpt-control-deck\b/g) || []).length, 1, `${page}: one consolidated control surface`);
  assert.match(html, /control-deck\.css\?v=20261026-1/, `${page}: shared control styling`);
  assert.match(html, page === 'dashboard' ? /dashboard-controls-compact/ : /control-deck-heading/, `${page}: control layout`);
}
for (const page of ['lily.html','marchand.html','register.html']) {
  const url = new URL(`../${page}`, import.meta.url);
  if (fs.existsSync(url)) assert.doesNotMatch(fs.readFileSync(url,'utf8'), /control-deck\.css/, `${page}: unrelated forms and microsites stay isolated`);
}
vm.runInContext(fs.readFileSync(new URL('../streaks.js', import.meta.url), 'utf8'), streakContext);
const buildStreakView = vm.runInContext('buildStreakView', streakContext);
const allStreaks = plain(buildStreakView(career.players, events));
for (const key of Object.keys(allStreaks)) assert.deepEqual(allStreaks[key], career.streaks[key], `Combined streak parity: ${key}`);
const movementContext = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL('../player-movement.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, ''), movementContext);
const buildAnalytics = vm.runInContext('buildAnalytics', movementContext);
for (const format of ['all', 'single', 'mtt']) for (const bounty of ['all', 'with', 'without']) {
  const selected = scope.select(events, { format, bounty });
  const streaks = buildStreakView(career.players, selected);
  const ids = new Set(selected.map(e => e.eventId));
  const heaters = buildAnalytics(career.players, history.filter(e => ids.has(e.eventId)));
  for (const player of career.players) {
    const rows = selected.flatMap(e => e.players.filter(p => p.slug === player.slug && p.entries > 0));
    assert.equal(streaks.players[player.slug].playedEvents, rows.length);
    assert.equal(streaks.players[player.slug].eligible, rows.length >= 2);
    for (const [cash, bestKey, currentKey] of [[true,'bestCashStreak','currentCashStreak'], [false,'bestDroughtStreak','currentDroughtStreak']]) {
      let run=0, best=0;
      for (const row of rows) { run = (row.timesPlaced > 0) === cash ? run+1 : 0; best = Math.max(best,run); }
      assert.equal(streaks.players[player.slug][bestKey]?.length || 0, best >= 2 ? best : 0);
      assert.equal(streaks.players[player.slug][currentKey]?.length || 0, run >= 2 ? run : 0);
    }
    const heater = heaters.find(p => p.slug === player.slug);
    assert.equal(Boolean(heater), rows.length >= 4, `${format}/${bounty}: heater eligibility ${player.slug}`);
    if (heater) {
      assert.equal(heater.eventsPlayedForForm, rows.length);
      assert.ok(heater.recentEvents.every(e => ids.has(e.eventId)));
      assert.equal(heater.recentEvents.length, Math.min(6,rows.length));
      for (const key of ratingKeys) assert.deepEqual(plain(heater[key] ?? null), player[key] ?? null);
    }
  }
}
assert.equal(JSON.stringify(career), before, 'Trend views must not mutate career records');
console.log(`PASS: ${combinations} filter combinations, financial/knockout/streak parity, heater windows and thresholds, career immutability and seven page integrations.`);
