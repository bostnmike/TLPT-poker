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
const banner = home.match(/<a class="home-norm-banner"[\s\S]*?<\/a>/)?.[0] || '';
assert.equal((home.match(/class="home-norm-banner"/g) || []).length, 1, 'One consolidated Norm banner');
assert.match(banner, /href="media.html"/);
assert.match(banner, /aria-label="The Many Faces of Norm — visit the Film Room"/);
assert.match(banner, /Visit the Film Room/);
assert.match(banner, /width="1983" height="793"/);
assert.equal(hash('images/site/norm-many-faces.jpg'), 'a6253f9f7016f36be6074fbe647304d9511a0256aac406ebcb0ad2886ca22bc4', 'Approved nine-character group, title and TLPT felt');
assert.doesNotMatch(home, /home-promo-row|home-rebuy-teaser/, 'Banner replaces all three teasers');
assert.ok(home.indexOf('class="home-norm-banner"') < home.indexOf('id="home-games"'), 'Banner stays in the former teaser position');
assert.match(schedule, /href="rsvp-app.html"/);
assert.match(schedule, /Put the Yellow Chip on Your Phone\./);
assert.match(schedule, /images\/site\/norm-rsvp-campaign.jpg/);
assert.match(schedule, /class="rsvp-campaign-chip" src="images\/site\/chip-T-1000.png"/);
assert.match(schedule, /Get the Yellow Chip/);
for (const html of [home, schedule]) assert.doesNotMatch(html, /The TLPT RSVP campaign/i);
assert.ok(read('sitemap.xml').includes('https://tlpt.org/rsvp-app.html'));
// Preserve approved originals; Film Room playback now uses the owner's YouTube uploads.
const filmRoom = read('media.html');
for (const [file, expected] of Object.entries({
  'rsvp-referee-thumbnail.jpg':'4f2d516b6637390954dadd09361186beb1491c9058b0b5ff6b082ee4db2be922',
  'calling-the-clock.mp4':'3be424078220a1f3dea69b6ad1a2f1c99a69468592f07b255717e5fad13ec793',
  'calling-the-clock-thumbnail.jpg':'ba3ef9f87c02474bf68a84f7448e41aad0de65834f39a8bd526910ddcb9886f5',
  'calling-the-clock-captions.vtt':'165011cb2cb753cd420bd117b79268d42da0e73c3e3926a56d6c524b9ad0b3fc',
  'the-games-afoot.mp4':'0f5fd283dbdb7abd9401a452eb522ea6991a3f41419f905892185e27f3002150',
  'the-games-afoot-thumbnail.jpg':'6f57930f24c12be883d3e4f1f351443cb18523c2fda4aa5cff9bc6ac5d8dd2a0',
  'the-games-afoot-captions.vtt':'379d80598278a7a2ccf9fd3bd48e98c7b364564e73c1d2483420f53ec0708e1d',
  'bad-beat-hotline.mp4':'0b0b6600c8fdb32333ab97aaa4defcbf8aceb323eb79b0f15f274356389163a0',
  'bad-beat-hotline-thumbnail.jpg':'f21122443ee6574ef68d3fb86c04436b8e6a2ddbfeb08cc6de14b0e9fcc56d21',
  'bad-beat-hotline-captions.vtt':'cff4ca0a0a5ae1bd4422d98ac05a14b349105e80afcb02754c7d87bef03c9c24',
  'weather-forecast.mp4':'9271e686cf3c775bb5414a15874d6fad8d26f9e85e7aa3075557c2faa1af79e9',
  'weather-forecast-thumbnail.jpg':'6693e1484b91805e95bc9d9de936e96560614a77c38adb39a6a1babf48d2f50d',
  'weather-forecast-captions.vtt':'6ed7755a13a6d86b8421c3b43752e7aef8ad12929b032a46d3b378cd2e8ac113',
  'no-empty-chairs.mp4':'c17e8b16f01388a3922b961f6475858f2207353043f9c0de15e26caf78ec1b15',
  'no-empty-chairs-thumbnail.jpg':'cf2bcff46878d0cd7fa5ba2da7101742516a7c0b688861b023ef853e022c3952',
  'no-empty-chairs-captions.vtt':'69ff03f8ff55684b6a8eb22070dec8fa1ea96881f21053b7acfb030d85214a7c',
  'never-miss-a-game.mp4':'68bcc0139f3ee7fca69b6309f32e28fe836925a0e90d415d7aabdbecca99b0bc',
  'notifications-thumbnail.jpg':'912125ef5ebac232c25d6610e4a103a21e82806e7e3fe80e6393642c70b0d616',
  'notifications-captions.vtt':'8e2e8868310c066a862af13f3e019edd3420d0516a12ced8808ebd3972299966',
  'dont-be-a-donkey.mp4':'c62e33c48b720798d3fed4f54c50c8662e9eeb1485fadd33db41239fa44ed742',
  'commercial-thumbnail.jpg':'12dc0b0cea1fcf82aa1746b742494c2f622e6d97ffda86fc971d3296a036988a',
  'install-thumbnail.jpg':'f627c03329e9b6364cdc0e3ae47011b7f3b71efc4cb4032335413dd6d6d0a29e',
  'commercial-captions.vtt':'0aedb2c845d82c2f13ba6530c62bef89da8625ab85f1d6e336e8cf8e3458fed5',
  'install-captions.vtt':'abc3da93b21cca813afd125469950dae5cbca40380446a123e039d7e27ad451d'
})) assert.equal(hash('media/rsvp-film-room/' + file), expected, 'Approved Film Room asset: ' + file);
assert.doesNotMatch(filmRoom, /media-film-description|media-film-duration/);
for (const [id, title] of [
  ['rsvp-referee', '🟥 The RSVP Referee'],
  ['rsvp-notifications', '🔔 Never Miss a Game'],
  ['rsvp-commercial', '🎬 Don’t Be a Donkey'],
  ['rsvp-installation', '📱 TLPT RSVP'],
  ['the-games-afoot', '🔎 The Game’s Afoot'],
  ['bad-beat-hotline', '☎️ Bad Beat Hotline'],
  ['weather-forecast', '🌦️ Weather Forecast'],
  ['no-empty-chairs', '🪑 No Empty Chairs'],
  ['calling-the-clock', '⏱️ Calling the Clock'],
]) assert.ok(filmRoom.includes(`<h2 id="${id}-title">${title}</h2>`), 'Short title only: ' + id);
for (const [slug, duration] of [['the-games-afoot',36],['bad-beat-hotline',30],['weather-forecast',29],['no-empty-chairs',32],['calling-the-clock',26]]) {
  const captions=read('media/rsvp-film-room/'+slug+'-captions.vtt');
  assert.ok(captions.startsWith('WEBVTT\n'));
  const cues=[...captions.matchAll(/(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/g)];
  assert.ok(cues.length>=15, 'Complete captions for '+slug);
  let previousEnd=0;
  for (const cue of cues) {
    const start=seconds(cue.slice(1,5)),end=seconds(cue.slice(5,9));
    assert.ok(start>=previousEnd&&end>start&&end<=duration, 'Caption timing for '+slug);
    previousEnd=end;
  }
}
const youtubeFilms = [
  ['rsvp-referee','sPBNdswB3Xw'],
  ['the-games-afoot','sr4AU3WoRTA'], ['bad-beat-hotline','iugKsWyLU5Y'],
  ['weather-forecast','kFF9RmDW5sk'], ['no-empty-chairs','RyPECQqsayY'],
  ['calling-the-clock','ipI7E9GUVnQ'], ['rsvp-notifications','ANC2iebFFDc'],
  ['rsvp-commercial','I0EmodtWMV0'], ['rsvp-installation','KUArnlk48KQ'],
];
for (const [id, youtubeId] of youtubeFilms) {
  assert.equal(filmRoom.split(`id="${id}"`).length - 1, 1, 'Exactly one film card: '+id);
  const card=filmRoom.split(`id="${id}"`)[1].split('<!-- VIDEO 1 -->')[0].split('<div class="media-card"')[0];
  assert.ok(card.includes(`src="https://www.youtube.com/embed/${youtubeId}?playsinline=1"`), 'Correct YouTube upload: '+id);
  assert.match(card, /class="media-embed-wrap"/);
  assert.match(card, /loading="lazy"/);
  assert.match(card, /referrerpolicy="strict-origin-when-cross-origin"/);
  assert.match(card, /allowfullscreen/);
  const cover = ({'rsvp-notifications':'notifications','rsvp-commercial':'commercial','rsvp-installation':'install'})[id] || id;
  const thumbnail = 'media/rsvp-film-room/'+cover+'-thumbnail.jpg';
  const version = hash(thumbnail).slice(0,16);
  assert.ok(card.includes('data-thumbnail="'+thumbnail+'?v='+version+'"'), 'Approved wide cover: '+id);
}
assert.equal((filmRoom.match(/<video\b/g) || []).length, 0, 'Film Room uses YouTube, not duplicate MP4 players');
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
assert.equal((filmRoom.match(/<iframe\b/g) || []).length, 17, 'Nine RSVP YouTube films plus all eight original embeds');
for (const id of ['gnI9KnFmrgE','hVs41qBEIHo','RPCM5CLNBjk','F_UJsj1uC5s','4pB0mVtyt7Q','OB-hhe60nKs','KA3Nq_AMuY4','A5LBbTMEYCY'])
  assert.ok(filmRoom.includes('https://www.youtube.com/embed/'+id), 'Retain original film: '+id);
assert.ok(filmRoom.includes('https://x.com/i/status/2011230641132835019'));
for (const frame of filmRoom.matchAll(/<iframe\b[\s\S]*?<\/iframe>/g)) {
  assert.match(frame[0], /title="[^"]+"/);
  assert.match(frame[0], /loading="lazy"/);
  assert.doesNotMatch(frame[0], /autoplay=1|cc_load_policy=1/, 'No autoplay or forced captions');
}
for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html') && !['marchand.html','lily.html','cashier.html'].includes(name))) {
  const html = read(file);
  assert.match(html, /<div class="nav-dropdown">\s*<a href="\/?schedule.html" class="nav-dropdown-parent[^"]*"[^>]*>Schedule<\/a>\s*<div class="nav-dropdown-menu">\s*<a href="\/?rsvp-app.html"[^>]*>RSVP App<\/a>/, file + ': RSVP App must be a child of Schedule');
}
console.log('PASS: approved RSVP videos, verified public QR, captions, player-only links and consolidated Norm banner.');
