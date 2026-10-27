import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const guide = read('rsvp-app.html'), home = read('index.html'), schedule = read('schedule.html');
const app = 'https://tlpt-rsvp.tlpt-bostnmike.workers.dev/';
assert.equal(hash('media/rsvp-app/tlpt-rsvp-install.mp4'), '217179b19e096c095659e9298b0aadd0bc4c9017d19a5caaa6ce9a33a94d5c65', 'Retain the exact approved 84-second video');
// Decoded using Apple Vision: the shared public player URL, no private or event-specific key.
assert.equal(hash('images/site/tlpt-rsvp-qr.png'), '81b19c3eba08f627df02a9c1f187461a501bfdeb3827c853b80c2f5c8e0f937b', 'Retain the verified public QR');
assert.ok(guide.includes('href="' + app + '"'));
assert.doesNotMatch(guide, /commish=|Bitwarden|adminKey|autoplay/);
assert.match(guide, /<video[^>]+controls[^>]+playsinline[^>]+preload="none"/);
assert.match(guide, /<track kind="captions" src="media\/rsvp-app\/captions.vtt" srclang="en"/);
assert.match(guide, /download="TLPT-RSVP-Setup.mp4"/);
assert.match(guide, /media\/rsvp-app\/poster.jpg/);
assert.match(guide, /Add <strong>that app<\/strong> to your Home Screen—not this guide/);
assert.match(guide, /Internet is needed/);
assert.match(guide, /Open as Web App/);
assert.match(guide, /Install and create shortcut/);
const captions = read('media/rsvp-app/captions.vtt');
assert.ok(captions.startsWith('WEBVTT\n'));
const times = [...captions.matchAll(/(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/g)];
assert.equal(times.length, 14);
const seconds = parts => Number(parts[0])*3600 + Number(parts[1])*60 + Number(parts[2]) + Number(parts[3])/1000;
let previous = 0;
for (const match of times) {
  const start = seconds(match.slice(1,5)), end = seconds(match.slice(5,9));
  assert.ok(start >= previous && end > start && end <= 83.75);
  previous = end;
}
const promo = home.split('<div class="home-promo-pair"')[1].split('<section')[0];
assert.ok(promo.indexOf('href="rsvp-app.html"') < promo.indexOf('href="rebuy-hard.html"'), 'App precedes Norm');
assert.match(promo, /images\/rebuy-hard\/norm-santa-tlpt.png/);
assert.match(schedule, /href="rsvp-app.html"/);
assert.match(schedule, /Put the Yellow Chip on Your Phone\./);
assert.match(schedule, /images\/site\/norm-rsvp-campaign.jpg/);
assert.match(schedule, /class="rsvp-campaign-chip" src="images\/site\/chip-T-1000.png"/);
assert.match(schedule, /Get the Yellow Chip/);
assert.ok(read('sitemap.xml').includes('https://tlpt.org/rsvp-app.html'));
for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html') && !['marchand.html','lily.html','cashier.html'].includes(name))) {
  const html = read(file);
  assert.match(html, /<div class="nav-dropdown">\s*<a href="\/?schedule.html" class="nav-dropdown-parent[^"]*"[^>]*>Schedule<\/a>\s*<div class="nav-dropdown-menu">\s*<a href="\/?rsvp-app.html"[^>]*>RSVP App<\/a>/, file + ': RSVP App must be a child of Schedule');
}
console.log('PASS: approved RSVP video, verified public QR, captions, player-only links and app-before-poem placement.');
