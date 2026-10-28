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
const promo = home.split('<div class="home-promo-row"')[1].split('<section')[0];
assert.deepEqual([...promo.matchAll(/<a\b[^>]+href="([^"]+)"/g)].map(match => match[1]),
  ['media.html#rsvp-notifications', 'media.html#rsvp-commercial', 'rebuy-hard.html'],
  'Notifications, Donkey, then Rebuy Hard');
assert.match(promo, /images\/rebuy-hard\/norm-santa-tlpt.png/);
assert.match(promo, /images\/site\/norm-rsvp-campaign.jpg/);
assert.match(promo, /Never Miss a Game/);
assert.match(promo, /Don’t Be a Donkey/);
assert.match(promo, /class="home-rsvp-chip" src="images\/site\/chip-T-1000.png"/);
assert.match(promo, /Watch · 0:40/);
assert.match(promo, /Watch · 0:39/);
assert.doesNotMatch(promo, /The Commish made an app|TLPT RSVP\. Now on your phone\./);
assert.match(schedule, /href="rsvp-app.html"/);
assert.match(schedule, /Put the Yellow Chip on Your Phone\./);
assert.match(schedule, /images\/site\/norm-rsvp-campaign.jpg/);
assert.match(schedule, /class="rsvp-campaign-chip" src="images\/site\/chip-T-1000.png"/);
assert.match(schedule, /Get the Yellow Chip/);
for (const html of [home, schedule]) assert.doesNotMatch(html, /The TLPT RSVP campaign/i);
assert.ok(read('sitemap.xml').includes('https://tlpt.org/rsvp-app.html'));
// Film Room handoff: exact approved commercial, covers and optional captions.
const filmRoom = read('media.html');
for (const [file, expected] of Object.entries({
  'never-miss-a-game.mp4':'68bcc0139f3ee7fca69b6309f32e28fe836925a0e90d415d7aabdbecca99b0bc',
  'notifications-thumbnail.jpg':'912125ef5ebac232c25d6610e4a103a21e82806e7e3fe80e6393642c70b0d616',
  'notifications-captions.vtt':'8e2e8868310c066a862af13f3e019edd3420d0516a12ced8808ebd3972299966',
  'dont-be-a-donkey.mp4':'c62e33c48b720798d3fed4f54c50c8662e9eeb1485fadd33db41239fa44ed742',
  'commercial-thumbnail.jpg':'12dc0b0cea1fcf82aa1746b742494c2f622e6d97ffda86fc971d3296a036988a',
  'install-thumbnail.jpg':'f627c03329e9b6364cdc0e3ae47011b7f3b71efc4cb4032335413dd6d6d0a29e',
  'commercial-captions.vtt':'0aedb2c845d82c2f13ba6530c62bef89da8625ab85f1d6e336e8cf8e3458fed5',
  'install-captions.vtt':'abc3da93b21cca813afd125469950dae5cbca40380446a123e039d7e27ad451d'
})) assert.equal(hash('media/rsvp-film-room/' + file), expected, 'Approved Film Room asset: ' + file);
assert.match(filmRoom, /Commercial · 0:39/);
assert.match(filmRoom, /Commercial · 0:40/);
assert.match(filmRoom, /Never Miss a Game — TLPT RSVP Notifications/);
for (const file of ['dont-be-a-donkey.mp4', 'commercial-thumbnail.jpg', 'commercial-captions.vtt',
  'never-miss-a-game.mp4', 'notifications-thumbnail.jpg', 'notifications-captions.vtt']) {
  assert.ok(filmRoom.includes(file + '?v=' + hash('media/rsvp-film-room/' + file).slice(0, 16)), 'Commercial cache version matches approved content: ' + file);
}
assert.equal((filmRoom.match(/<video\b/g) || []).length, 3);
const notificationCaptions = read('media/rsvp-film-room/notifications-captions.vtt');
assert.ok(notificationCaptions.startsWith('WEBVTT\n'));
const notificationTimes = [...notificationCaptions.matchAll(/(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/g)];
assert.equal(notificationTimes.length, 20);
previous = 0;
for (const match of notificationTimes) {
  const start = seconds(match.slice(1,5)), end = seconds(match.slice(5,9));
  assert.ok(start >= previous && end > start && end <= 40);
  previous = end;
}
assert.equal((filmRoom.match(/<iframe\b/g) || []).length, 8, 'Keep all existing embedded films');
assert.ok(filmRoom.includes('https://x.com/i/status/2011230641132835019'));
assert.match(filmRoom, /<source src="media\/rsvp-app\/tlpt-rsvp-install.mp4"/);
for (const video of filmRoom.matchAll(/<video\b[\s\S]*?<\/video>/g)) {
  assert.match(video[0], /controls playsinline preload="none"/);
  assert.match(video[0], /poster="media\/rsvp-film-room\//);
  assert.match(video[0], /<track kind="captions"[^>]+srclang="en" label="English">/);
  assert.doesNotMatch(video[0], /autoplay|\bdefault\b/);
}
assert.match(read('media.css'), /\.media-native-video\s*\{[^}]*object-fit:contain/);
for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html') && !['marchand.html','lily.html','cashier.html'].includes(name))) {
  const html = read(file);
  assert.match(html, /<div class="nav-dropdown">\s*<a href="\/?schedule.html" class="nav-dropdown-parent[^"]*"[^>]*>Schedule<\/a>\s*<div class="nav-dropdown-menu">\s*<a href="\/?rsvp-app.html"[^>]*>RSVP App<\/a>/, file + ': RSVP App must be a child of Schedule');
}
console.log('PASS: approved RSVP videos, verified public QR, captions, player-only links and three-teaser order.');
