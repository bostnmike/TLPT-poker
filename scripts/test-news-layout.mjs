#!/usr/bin/env node
/** Verify the shared TWTW layout against every story, without browser dependencies. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'news-render.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'news-data.json'), 'utf8'));
const sandbox = {
  console,
  document: { addEventListener() {} }
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'news-render.js', timeout: 5000 });

const sectionTitles = (html) => [...String(html).matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/g)]
  .map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const imageTags = (html) => [...String(html).matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);

function assertImageContract(html, expectedAttributes, label, expectedCount = 1) {
  const tags = imageTags(html);
  assert.equal(tags.length, expectedCount, `${label}: image count`);

  for (const tag of tags) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([A-Za-z][\w:-]*)="([^"]*)"/g)]
        .map(([, name, value]) => [name.toLowerCase(), value])
    );

    for (const [name, expected] of Object.entries(expectedAttributes)) {
      assert.equal(attributes[name], String(expected), `${label}: ${name}`);
    }
  }
}
const order = ['👂🏼 Felt Whispers', '🔦 Game Spotlight', '🔢 Numbers That Matter', '🎙️ Host Roast'];
const deprecatedMarkup = /news-felt-(?:grid|card)|news-quickhits-grid|news-section-divider|<h4>[^<]*Quick Hits/;
const fixture = {
  id: 'test-four-section-story', date: '09/06/2026', title: 'TWTW: Test', featured: true,
  mainStoryHtml: '<p>Story content stays intact.</p>',
  spotlight: { player: 'Example Player', fallback: 'EP', pills: ['Compact context'] },
  numbersThatMatter: ['One.', 'Two.', 'Three.', 'Four.'],
  roastHtml: '<p>BostnMike remains the host roast subject.</p>',
  feltSaid: [{ label: 'RETIRED_FELT_MARKER', value: 'Hidden', note: 'Hidden' }],
  tldr: 'RETIRED_TLDR_MARKER',
  quickHitsLeft: ['RETIRED_QUICK_LEFT_MARKER'],
  quickHitsRight: ['RETIRED_QUICK_RIGHT_MARKER']
};

assert.deepEqual(sectionTitles(sandbox.renderWeekBody(fixture)), order, 'Full story section order');
assert.doesNotMatch(sandbox.renderWeekBody(fixture), /RETIRED_|TL;DR/, 'Old fields must never render');
assert.doesNotMatch(sandbox.renderWeekBody(fixture), deprecatedMarkup, 'Removed section markup');
assert.doesNotMatch(sandbox.renderWeekBody(fixture), /The Main Story/, 'Old narrative heading must stay retired');
for (const name of ['renderWhatTheFeltSaid', 'getFeltWhisperTone', 'getFeltWhisperIcon', 'renderQuickHits', 'renderTLDR']) {
  assert.equal(typeof sandbox[name], 'undefined', `Retired function must stay removed: ${name}`);
}
const freshFixture = { ...fixture };
for (const key of ['feltSaid', 'tldr', 'quickHitsLeft', 'quickHitsRight']) delete freshFixture[key];
assert.equal(sandbox.renderWeekBody(freshFixture), sandbox.renderWeekBody(fixture), 'New format needs no legacy keys');
assert.equal(sandbox.renderWeekBody({}).trim(), '', 'Empty optional sections stay absent');

const portraitMarkup = [];
const defaultAvatar = sandbox.renderAvatar({ src: 'images/players/example.jpg', alt: 'Example' });
portraitMarkup.push(defaultAvatar);
assertImageContract(defaultAvatar, {
  loading: 'lazy', decoding: 'async', fetchpriority: 'auto', width: 44, height: 44
}, 'Default News avatar');

const author = { innerHTML: '' };
sandbox.renderAuthor({
  name: 'Example Author', avatar: 'images/players/author.jpg', fallback: 'EA'
}, author);
portraitMarkup.push(author.innerHTML);
assertImageContract(author.innerHTML, {
  loading: 'eager', decoding: 'async', fetchpriority: 'high', width: 68, height: 68
}, 'Visible News author');

const singleSummary = sandbox.renderSummaryCard({
  tone: 'blue', label: 'Single', player: 'Single Player',
  avatar: 'images/players/single.jpg', fallback: 'SP'
});
portraitMarkup.push(singleSummary);
assertImageContract(singleSummary, {
  loading: 'lazy', decoding: 'async', fetchpriority: 'auto', width: 46, height: 46
}, 'Single-player summary');

const multiSummary = sandbox.renderSummaryCard({
  tone: 'blue', label: 'Multi', player: 'One / Two',
  avatars: [
    { src: 'images/players/one.jpg', alt: 'One' },
    { src: 'images/players/two.jpg', alt: 'Two' }
  ]
});
portraitMarkup.push(multiSummary);
assertImageContract(multiSummary, {
  loading: 'lazy', decoding: 'async', fetchpriority: 'auto', width: 38, height: 38
}, 'Multi-player summary', 2);

const singleSpotlight = sandbox.renderGameSpotlight({
  spotlight: {
    player: 'Single Player', avatar: 'images/players/single.jpg',
    fallback: 'SP', pills: ['One']
  }
});
portraitMarkup.push(singleSpotlight);
assertImageContract(singleSpotlight, {
  loading: 'lazy', decoding: 'async', fetchpriority: 'auto', width: 42, height: 42
}, 'Single-player spotlight');

const multiSpotlight = sandbox.renderGameSpotlight({
  spotlight: {
    player: 'One / Two', pills: ['One'],
    avatars: [
      { src: 'images/players/one.jpg', alt: 'One' },
      { src: 'images/players/two.jpg', alt: 'Two' }
    ]
  }
});
portraitMarkup.push(multiSpotlight);
assertImageContract(multiSpotlight, {
  loading: 'lazy', decoding: 'async', fetchpriority: 'auto', width: 42, height: 42
}, 'Multi-player spotlight', 2);

const hostRoast = sandbox.renderRoastSection({
  roastHtml: '<p>The host remains the target.</p>'
});
portraitMarkup.push(hostRoast);
assertImageContract(hostRoast, {
  loading: 'lazy', decoding: 'async', fetchpriority: 'auto', width: 44, height: 44
}, 'Host Roast');

assert.equal(
  (portraitMarkup.join('').match(/fetchpriority="high"/g) || []).length,
  1,
  'Only the visible News author requests high fetch priority'
);

assert.ok(Array.isArray(data.weeks) && data.weeks.length, 'Story archive must exist');
const original = JSON.stringify(data);
const ids = data.weeks.map((week) => week.id);
assert.equal(new Set(ids).size, ids.length, 'No duplicate story IDs');
assert.equal(data.weeks.filter((week) => week.featured === true).length, 1, 'Exactly one featured story');
assert.equal(data.weeks[0].featured, true, 'Newest story remains first and featured');
const missingRoasts = [];

for (const week of data.weeks) {
  const labels = (week.summaryCards || []).map((card) => String(card?.label || ''));
  assert.ok(labels.includes('👂🏼 Felt Whispers'), `Felt Whispers summary label: ${week.id}`);
  assert.ok(labels.every((label) => !label.includes('Main Story')), `Legacy Main Story summary label: ${week.id}`);
}

for (const [index, week] of data.weeks.entries()) {
  const expected = [];
  if (typeof week.mainStoryHtml === 'string' && week.mainStoryHtml) expected.push(order[0]);
  if (week.spotlight) expected.push(order[1]);
  if (Array.isArray(week.numbersThatMatter) && week.numbersThatMatter.length) expected.push(order[2]);
  if (typeof week.roastHtml === 'string' && week.roastHtml) expected.push(order[3]);
  else missingRoasts.push(week.id);
  const body = sandbox.renderWeekBody(week);
  assert.deepEqual(sectionTitles(body), expected, `Section order: ${week.id}`);
  assert.doesNotMatch(body, deprecatedMarkup, `Removed sections: ${week.id}`);
  if (week.mainStoryHtml) assert.ok(body.includes(week.mainStoryHtml), `Story HTML preserved: ${week.id}`);
  if (week.roastHtml) assert.ok(body.includes(week.roastHtml), `Roast HTML preserved: ${week.id}`);
  for (const isFeatured of [true, false]) {
    const article = sandbox.renderWeek(week, index, isFeatured);
    assert.deepEqual(sectionTitles(article), expected, `Featured/archive layout: ${week.id}`);
    assert.ok(article.includes(`id="${week.id}"`), `Stable story anchor: ${week.id}`);
    assert.equal(article.includes(' news-post-featured'), isFeatured, `Featured styling: ${week.id}`);
  }
}

const feed = { innerHTML: '' };
sandbox.renderWeeks(data.weeks, feed);
assert.equal((feed.innerHTML.match(/class="news-post-card/g) || []).length, data.weeks.length, 'Every story rendered');
assert.equal((feed.innerHTML.match(/ news-post-featured/g) || []).length, 1, 'Only one featured article');
assert.doesNotMatch(feed.innerHTML, deprecatedMarkup, 'No retired sections in the complete feed');
const archive = { innerHTML: '' };
sandbox.renderArchiveList(data.weeks, archive);
assert.equal((archive.innerHTML.match(/class="news-archive-link/g) || []).length, data.weeks.length, 'Every archive link retained');
assert.equal((archive.innerHTML.match(/ is-active/g) || []).length, 1, 'One active archive link');
for (const id of ids) assert.ok(archive.innerHTML.includes(`href="#${id}"`), `Archive link: ${id}`);

const summary = { innerHTML: '' };
sandbox.renderSummaryCards(data.weeks[0].summaryCards, summary);
assert.equal((summary.innerHTML.match(/<article class="news-summary-card /g) || []).length, 4, 'Summary cards retained');
const statbar = { innerHTML: '', className: '' };
sandbox.renderStatPills(data.weeks[0].statPills, statbar);
assert.equal((statbar.innerHTML.match(/class="news-stat-pill"/g) || []).length, 4, 'Stat pills retained');

// Metadata remains authoritative for avatar names, slugs and aliases.
sandbox.metadataFixture = { players: [{ name: 'Example Player', slug: 'example', aliases: ['Alias'], image: 'images/players/verified.jpg' }] };
vm.runInContext('playerAvatarLookup = buildPlayerAvatarLookup(metadataFixture);', sandbox);
assert.equal(sandbox.resolvePlayerAvatar({ alt: 'Alias', src: 'images/players/old.jpg' }), 'images/players/verified.jpg');
assert.equal(sandbox.resolvePlayerAvatar({ alt: 'Unknown', src: 'images/players/fallback.jpg' }), 'images/players/fallback.jpg');
assert.match(sandbox.renderAvatar({ alt: 'Unknown', fallback: 'UN' }), /player-avatar-fallback/);
assert.equal(JSON.stringify(data), original, 'Rendering must not mutate story data');

console.log(`TWTW layout PASS: ${data.weeks.length} stories; Felt Whispers narrative heading in featured and archive modes; no TL;DR, legacy feltSaid card grid or Quick Hits; links, cards, stat pills and avatars retained.`);
if (missingRoasts.length) console.log(`Preserved existing missing Host Roast content (not invented): ${missingRoasts.join(', ')}`);
