import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const functions = ['coffeeIconMarkup', 'totalCoffeeConsumed', 'playerProfileStreakMeta', 'playerProfileSnapshotMarkup', 'renderLeagueSnapshot']
  .map(name => source.match(new RegExp('^function ' + name + '\\([^]*?^}', 'm'))[0]);
const snapshot = { innerHTML: '' };
const context = vm.createContext({
  document: { getElementById: id => id === 'home-snapshot-grid' ? snapshot : null },
  initAnimatedCounters: () => {},
  fmtMoney: () => '$0',
  fmtPct: () => '0.0%',
  statValueClass: () => '',
  displayPlayerName: player => player.name,
  isPlayerAlumni: () => false,
  badgesMarkup: () => '',
  isCrewEligible: () => false,
});
vm.runInContext(functions.join('\n'), context);
const player = { slug: 'test-player', name: 'Test Player' };
const archetype = { emoji: '', name: '', desc: '' };
const render = data => context.playerProfileSnapshotMarkup(player, data, archetype, archetype, {}, '');
assert.match(render({}), /Coffee Consumed<\/span>\s*<strong[^>]*>0<\/strong>/);
assert.match(render({ coffeeConsumption: { other: 5 } }), /Coffee Consumed<\/span>\s*<strong[^>]*>0<\/strong>/);
assert.match(render({ coffeeConsumption: { [player.slug]: 2 } }), /Coffee Consumed<\/span>\s*<strong[^>]*>2<\/strong>/);
console.log('PASS: Coffee Consumed renders with and without a tally on profiles missing historical stats.');

context.renderLeagueSnapshot({ coffeeConsumption: { hiro: 11, others: 20 } });
assert.match(snapshot.innerHTML, /data-target-value="31"[^>]*>\s*31\s*<\/div>\s*<div[^>]*>Coffee Consumed/);
context.renderLeagueSnapshot({ coffeeConsumption: { hiro: 13, others: 21 } });
assert.match(snapshot.innerHTML, /data-target-value="34"[^>]*>\s*34\s*<\/div>\s*<div[^>]*>Coffee Consumed/);
assert.match(snapshot.innerHTML, /href="dashboard.html\?view=coffee">[\s\S]*?coffee-icon[\s\S]*?Go deeper/);
assert.match(render({}), /class="coffee-icon" aria-hidden="true"><i class="coffee-icon-cup"><\/i><\/i>Coffee Consumed/);
console.log('PASS: Home uses the shared tally and links directly to the Dashboard coffee ranking.');
