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
const installId = 'KUArnlk48KQ';
// Decoded using Apple Vision: the shared public player URL, no private or event-specific key.
assert.equal(hash('images/site/tlpt-rsvp-qr.png'), '81b19c3eba08f627df02a9c1f187461a501bfdeb3827c853b80c2f5c8e0f937b', 'Retain the verified public QR');
assert.ok(guide.includes('href="' + app + '"'));
assert.doesNotMatch(guide, /commish=|Bitwarden|adminKey|[?&]autoplay=|<video\b|\.mp4|\bdownload=/);
assert.ok(guide.includes(`id="rsvp-setup-play" href="https://www.youtube.com/watch?v=${installId}"`));
assert.match(guide, /<template id="rsvp-setup-embed">\s*<iframe src="https:\/\/www\.youtube\.com\/embed\/KUArnlk48KQ\?playsinline=1"[^>]*title="TLPT RSVP setup video"[^>]*allowfullscreen><\/iframe>\s*<\/template>/);
assert.match(guide, /<script src="rsvp-app-player\.js\?v=[a-f0-9]{16}"><\/script>/);
assert.match(guide, /Watch on YouTube/);
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
assert.doesNotMatch(home, /home-norm-banner|norm-many-faces|The Many Faces of Norm/, 'Requested homepage banner removal');
assert.match(home, /href="media.html"[^>]*>Film Room<\/a>/, 'Film Room remains in navigation');
// Retain the approved artwork and shared narration sources; remove only the homepage placement.
assert.equal(hash('images/site/norm-many-faces-eleven-preferred-table.jpg'), '0b9035ffc30cca735f06e73e2004f1e98551c222fbe6ec574f78edf304fe54c3', 'Owner-preferred larger felt rendition with all eleven Norms and the white dinner jacket');
assert.equal(hash('images/site/norm-many-faces-eleven.jpg'), 'e2d84f40ec4466f4182c44f5188db52f1096dfe4522a88d4a725fe6326b076a2', 'Approved eleven-character banner retains the white dinner jacket and directly composited actual felt');
assert.equal(hash('images/site/norm-many-faces-single-row-felt.jpg'), '1cdee4af1b039271ca45882b43c302ae2ab87fb5e6eb1c3440dd609748b4495b', 'Corrected felt retains four Winter Classic logos, six banners and the Centennial crest');
assert.equal(hash('images/site/norm-many-faces-single-row.jpg'), 'e13797ffdd002bb6ef6e042c4cb0b767bd45b30c0813bd8191de37461135814b', 'Single-row ten-character panorama retains gold title and card-room setting');
assert.equal(hash('images/site/norm-many-faces-hockey.jpg'), 'c68b789a0c9d04b8ac7c25b62c0e7bb88c35f7c8b716bfcbedd2777722d674aa', 'Ten-character group retains headline, card room and TLPT felt');
assert.equal(hash('images/site/norm-many-faces.jpg'), 'd0694c96d6ced196fa0aedeff6b99985d0d6c0572332d4752e11317c7e318fce', 'Original cast remains unchanged for existing portrait crops');
assert.equal(hash('images/site/norm-hockey-headshot.webp'), 'b916c7b2360889d7a1d22e7b73594c3afaf8acc9f5209f52aaa35b7092902587', 'Use only the approved V2 hockey headshot');
assert.doesNotMatch(home, /home-promo-row|home-rebuy-teaser/, 'Do not restore the retired three-teaser row');
assert.match(schedule, /href="rsvp-app.html"/);
assert.match(schedule, /Put the Yellow Chip on Your Phone\./);
assert.match(schedule, /images\/site\/norm-news-anchor-source.jpg/);
assert.match(schedule, /alt="News-anchor Norm" width="1280" height="720"/);
assert.equal(hash('images/site/norm-news-anchor-source.jpg'), 'a7d065b355b13c230c4c23fd9d834f7ffcac26d41915f68cd4cb7e5bb459b8bd', 'Reuse the exact Nightly News artwork without altering Norm');
assert.match(schedule, /class="rsvp-campaign-chip" src="images\/site\/chip-T-1000.png"/);
assert.match(schedule, /Get the Yellow Chip/);
for (const html of [home, schedule]) assert.doesNotMatch(html, /The TLPT RSVP campaign/i);
assert.ok(read('sitemap.xml').includes('https://tlpt.org/rsvp-app.html'));
// Only the approved public covers/captions are kept locally; playback uses the owner's YouTube uploads.
const filmRoom = read('media.html');
assert.ok(filmRoom.split('id="rsvp-installation"')[1]?.split('<div class="media-card"')[0]?.includes(`/embed/${installId}?playsinline=1`), 'Film Room and setup guide use the same upload');
for (const file of ['media/rsvp-app/tlpt-rsvp-install.mp4', ...[
  'out-of-office', 'bad-beat-hotline', 'calling-the-clock', 'dont-be-a-donkey', 'never-miss-a-game',
  'no-empty-chairs', 'the-games-afoot', 'weather-forecast'
].map(slug => `media/rsvp-film-room/${slug}.mp4`)]) {
  assert.ok(!fs.existsSync(path.join(root, file)), `Retired local video must not ship: ${file}`);
  assert.ok(!filmRoom.includes(file), `Film Room must not reference retired video: ${file}`);
}
assert.doesNotMatch(filmRoom, /ltIT_DGiEEs/, 'Superseded hockey upload must not return');
assert.doesNotMatch(filmRoom, /WnWQ9UaJ4LY/, 'Superseded Elusive RSVP upload must not return');
assert.doesNotMatch(filmRoom, /9Cmli_tTMSg/, 'Superseded Roadshow upload must not return');
assert.doesNotMatch(read('data/gallery-norm.json'), /9Cmli_tTMSg/, 'Gallery must reference the revised Roadshow upload');
for (const [file, expected] of Object.entries({
  'out-of-office-thumbnail.jpg':'ab89106912b51727c09bbca6f6f1f64375e339d5e73d7e1dd68e45a08b75fbab',
  'good-will-chopping-thumbnail.jpg':'9f8fe6473ad84b7436100390c5e9d99a294b9a7604bd505c6b97ed3d2d07f440',
  'now-serving-decaf-thumbnail.jpg':'7fee9a1b64fb13be44e90402619b09326491c661ac88dcb4a0fb2ff1d96f8ce5',
  'now-serving-decaf-captions.srt':'ec060cddf8955afeddbdc0265d33fcd95e85da046030c7449c2f6b59d798532e',
  'now-serving-decaf-captions.vtt':'5b0bb4de0a1a13764fc75540e21b33ddc22725ae2b0d092932a2e1bee14afdcc',
  'coffee-preorders-thumbnail.jpg':'6d97dbc9b7d8e8b9980452386f33151369079ab43bcc7abd79c3a81438b8fb1a',
  'coffee-preorders-captions.srt':'1ab93bebe511d8c6967554c57e2bea7882c2fac2d21e12a9f03c41c777950506',
  'coffee-preorders-captions.vtt':'7233b19d4b8680239bf871e41bce41051136635b425605843721588bd9601aee',
  'two-seats-remain-captions.srt':'87c00dd6d5c207b55b8483394ecf92984ff6476306e72fdfa67fa3b420a8989c',
  'two-seats-remain-captions.vtt':'988bcb976eed9b32f2fa7a920b40d0053c5f7b3f51df1ad285bd063b5a9ef93f',
  'two-seats-remain-thumbnail.jpg':'12386777b0061ddb2b8b0df48e4cf84dd9a029017a1c8af3332fdaf47b7229aa',
  'one-seat-available-thumbnail.jpg':'c28f682de480bedc240a6c912758500a42a61a83d06a5515276e54ef9644b45a',
  'the-courtesy-fold-thumbnail.jpg':'6341a7602f264603c02819767eaf23b74713fb41ecb22afe0a542ce8c46c6d4a',
  'earlier-start-thumbnail.jpg':'b55032eae5c0db2b62a15d2d0fc61b3e65c02f36b80575cceb2fef9fe72932cc',
  'public-hearing-thumbnail.jpg':'c06c5bf99850933cc6bad372acbb2e2b466865baf1e116dbf03e849a4f797a3c',
  'rookie-orientation-thumbnail.jpg':'59fa787435796010aa6f8962dbcbb428fac29b9b4c10941a97d27de3b608b681',
  'doubleheader-thumbnail.jpg':'eb1f0ca1b9d5f480e4f4a2ed4d747348a6ee91826b4d35ee9fafc6c77bb2f224',
  'clocking-out-thumbnail.jpg':'72315764b0fb08b76e3423673ddf38509e5132ff44aded011bfa18ba405fc015',
  'mission-control-thumbnail.jpg':'02530a183e9c85b1d7370f5a40d178c6796dba47a9a92371b898cb524380b312',
  'youth-movement-thumbnail.jpg':'cf7c2d723f6a5ef203d29e5008dbf2077787b5809e7b1dd99bf69508c346b3e9',
  'nightly-news-friday-canceled-thumbnail.jpg':'7ad23cbf1d996471270cc12dcd32d5301567da945c402522ee9ca0583a55425c',
  'amazing-norm-friday-canceled-thumbnail.jpg':'3fac0f09af27ac8ded6fc4087d9dd1c3b4b82a48f6c53272579b9b703543ea70',
  'nightly-news-heavy-heart-thumbnail.jpg':'a7d065b355b13c230c4c23fd9d834f7ffcac26d41915f68cd4cb7e5bb459b8bd',
  'amazing-norm-saturday-canceled-thumbnail.jpg':'401ccde7b46037b2e785c52619ec367c340751011c79ab8e86e1e7566f5fd12c',
  'now-showing-thumbnail.jpg':'0442bea081639e3fcdd17fd15c3b27b6b0a7f94f80961ee98210585321f6f9e0',
  'sunday-special-bulletin-thumbnail.jpg':'2fe992e2b7cc4fbda5213f1c4572649cb67dee2fe367765ae054f7ca72bca15d',
  'who-wants-to-make-a-decision-thumbnail.jpg':'2d9977c8ef0d20b8ca2a57ec4b585d25702f49ad7a9fd5063769f37ca9b1728f',
  'rsvp-roadshow-thumbnail.jpg':'b4b5e180aa2aa0adea08e367be72a1b28541c3890b9834e26eadefc9b4ad0d19',
  'final-boarding-call-thumbnail.jpg':'1901cffa24880641790de0e55c32a9149132d29e3b9ac9b560c76ab93df8e1ac',
  'rsvp-main-event-thumbnail.jpg':'5ceef06e2041c631944fc0d43f72c1f06c4a653238364ac38fd66380d6ec47b5',
  'call-your-play-thumbnail.jpg':'325804b3568327bb237276c0dcdb2c9a848a10cc16cc694cc5a57f33c2d4f972',
  'the-kids-thumbnail.jpg':'0d8ea0f192f80d92c2904e450d01195237c52b981037a96eb50f9242e9dc5075',
  'day-to-day-thumbnail.jpg':'a065f55697f6cec840d511928b1422701f7ceb18698df4df6085a2bd7e1ddb82',
  'the-elusive-rsvp-thumbnail.jpg':'1fc2f84e2755e81aef3143e3e8bca2f7cb06a215b236a9e94cd8bc883478e205',
  'rsvp-referee-thumbnail.jpg':'4f2d516b6637390954dadd09361186beb1491c9058b0b5ff6b082ee4db2be922',
  'calling-the-clock-thumbnail.jpg':'ba3ef9f87c02474bf68a84f7448e41aad0de65834f39a8bd526910ddcb9886f5',
  'calling-the-clock-captions.vtt':'165011cb2cb753cd420bd117b79268d42da0e73c3e3926a56d6c524b9ad0b3fc',
  'the-games-afoot-thumbnail.jpg':'6f57930f24c12be883d3e4f1f351443cb18523c2fda4aa5cff9bc6ac5d8dd2a0',
  'the-games-afoot-captions.vtt':'379d80598278a7a2ccf9fd3bd48e98c7b364564e73c1d2483420f53ec0708e1d',
  'bad-beat-hotline-thumbnail.jpg':'f21122443ee6574ef68d3fb86c04436b8e6a2ddbfeb08cc6de14b0e9fcc56d21',
  'bad-beat-hotline-captions.vtt':'cff4ca0a0a5ae1bd4422d98ac05a14b349105e80afcb02754c7d87bef03c9c24',
  'weather-forecast-thumbnail.jpg':'6693e1484b91805e95bc9d9de936e96560614a77c38adb39a6a1babf48d2f50d',
  'weather-forecast-captions.vtt':'6ed7755a13a6d86b8421c3b43752e7aef8ad12929b032a46d3b378cd2e8ac113',
  'no-empty-chairs-thumbnail.jpg':'cf2bcff46878d0cd7fa5ba2da7101742516a7c0b688861b023ef853e022c3952',
  'no-empty-chairs-captions.vtt':'69ff03f8ff55684b6a8eb22070dec8fa1ea96881f21053b7acfb030d85214a7c',
  'notifications-thumbnail.jpg':'912125ef5ebac232c25d6610e4a103a21e82806e7e3fe80e6393642c70b0d616',
  'notifications-captions.vtt':'8e2e8868310c066a862af13f3e019edd3420d0516a12ced8808ebd3972299966',
  'commercial-thumbnail.jpg':'12dc0b0cea1fcf82aa1746b742494c2f622e6d97ffda86fc971d3296a036988a',
  'install-thumbnail.jpg':'f627c03329e9b6364cdc0e3ae47011b7f3b71efc4cb4032335413dd6d6d0a29e',
  'commercial-captions.vtt':'0aedb2c845d82c2f13ba6530c62bef89da8625ab85f1d6e336e8cf8e3458fed5',
  'install-captions.vtt':'abc3da93b21cca813afd125469950dae5cbca40380446a123e039d7e27ad451d'
})) assert.equal(hash('media/rsvp-film-room/' + file), expected, 'Approved Film Room asset: ' + file);
assert.doesNotMatch(filmRoom, /media-film-description|media-film-duration/);
assert.match(filmRoom, /class="media-youtube-fallback" href="https:\/\/www.youtube.com\/watch\?v=JKbeghbGcAM" target="_blank" rel="noopener">Watch on YouTube ↗<\/a>/);

for (const [id, title] of [
  ['out-of-office', 'Out of Office. Out of Excuses.'],
  ['good-will-chopping', 'Good Will Chopping'],
  ['now-serving-decaf', '☕ Now Serving DeCaf'],
  ['coffee-preorders', '☕ Coffee Pre-orders — How d’ya like them lattes?'],
  ['two-seats-remain', '☕ Two Seats Remain'],
  ['one-seat-available', '🪑 One Seat Available'],
  ['the-courtesy-fold', '🃏 The Courtesy Fold'],
  ['earlier-start', '⏰ Earlier Start'],
  ['public-hearing', '⚖️ Public Hearing'],
  ['rookie-orientation', '🎓 Rookie Orientation'],
  ['doubleheader', '⚾ Doubleheader — Friday + Saturday'],
  ['clocking-out', '🕔 Clocking Out'],
  ['mission-control', '🚀 Mission Control'],
  ['youth-movement', '🔎 Where’s the Youth Movement?'],
  ['nightly-news-friday-canceled', '📰 Nightly News — Friday Canceled'],
  ['amazing-norm-friday-canceled', '🎩 The Amazing Norm — Friday Canceled'],
  ['nightly-news-heavy-heart', '📰 Nightly News — A Heavy Heart'],
  ['amazing-norm-saturday-canceled', '🎩 The Amazing Norm — Saturday Canceled'],
  ['now-showing', '🎟️ Now Showing'],
  ['sunday-special-bulletin', '🌧️ Sunday Special Bulletin'],
  ['who-wants-to-make-a-decision', '❓ Who Wants to Make a Decision?'],
  ['rsvp-roadshow', '🔍 RSVP Roadshow'],
  ['final-boarding-call', '✈️ Final Boarding Call'],
  ['rsvp-main-event', '🎙️ The RSVP Main Event'],
  ['the-kids', '📽️ The Kids — Still Loading'],
  ['call-your-play', '🏈 Call Your Play'],
  ['day-to-day', '🏒 Day to Day'],
  ['the-elusive-rsvp', '🦜 The Elusive RSVP'],
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
  ['out-of-office','B_7DZjLXC4I'],
  ['good-will-chopping','0ioNSdNGmME'],
  ['now-serving-decaf','WFy0mP9u0Bw'],
  ['coffee-preorders','JKbeghbGcAM'],
  ['two-seats-remain','XS62fWZR_FM'],
  ['one-seat-available','ep08DkRP3gw'],
  ['the-courtesy-fold','45e1e-1290I'],
  ['earlier-start','ervb9fx_0oc'],
  ['public-hearing','Va-Q7PHbMDI'],
  ['rookie-orientation','cCInbuQ0_QI'],
  ['doubleheader','hyIBSyjWgvU'],
  ['clocking-out','FuEu6XnbLvk'],
  ['mission-control','rVnC_ctqRn0'],
  ['youth-movement','nvJYKCcRwA8'],
  ['nightly-news-friday-canceled','uSNlM_E_zck'],
  ['amazing-norm-friday-canceled','6dKAxotRBXI'],
  ['nightly-news-heavy-heart','VrliccRY5ZE'],
  ['amazing-norm-saturday-canceled','PjiZafNM4Xs'],
  ['now-showing','i17yME1Az2o'],
  ['sunday-special-bulletin','HweZPs_q85U'],
  ['who-wants-to-make-a-decision','Ij45B2zhMY4'],
  ['rsvp-roadshow','MvwsaPIq9-8'],
  ['final-boarding-call','elGvMvI4z98'],
  ['rsvp-main-event','inTd_p7otyE'],
  ['the-kids','AYTCCtyBTqQ'],
  ['call-your-play','GY4uQaUwsbU'],
  ['day-to-day','rzKNK2yiu-I'],
  ['the-elusive-rsvp','iYLibq-VvcQ'],
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
assert.equal((filmRoom.match(/<iframe\b/g) || []).length, 45, 'Thirty-seven RSVP YouTube films plus all eight original embeds');
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
console.log('PASS: approved RSVP videos, verified public QR, captions, player-only links and banner-free homepage.');
