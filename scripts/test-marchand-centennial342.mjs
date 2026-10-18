// Former 342 is current 333; stable photo files intentionally retain /342/.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n,import.meta.url))),p=read('marchand-pucks.json'),stories=read('marchand-stories.json').artifacts,photos=read('marchand-photos.json').artifacts,stats=read('marchand-game-stats.json').games;
const r=p.records.find(x=>x.inventoryId===333);
assert.equal(r.key,'milestone-333');assert.equal(r.sourceSheet,'Milestones');assert.equal(r.date,'2024-03-07');assert.equal(r.puckType,'Game Used Puck');assert.equal(r.team,'Boston Bruins');assert.equal(r.opponent,'Toronto Maple Leafs');assert.equal(r.score,'TOR 1 @ BOS 4');assert.equal(r.videoId,'6348437197112');assert.equal(r.goalType,'');assert.equal(r.careerStat,null);
assert.match(r.notes,/RG13316480/);assert.match(r.notes,/digital COA/);assert.match(r.notes,/Return of a Champion/);
assert.equal(stories[r.key].gameId,2023020993);assert.equal(stats['2023020993'].stats.assists,2);assert.equal(stats['2023020993'].stats.totalToi,'16:54');
assert.deepEqual(photos['333'].map(x=>x.label),['Front','Back','Edge 1','Edge 2','COA']);assert.ok(photos['333'][0].thumbnailUrl);assert.equal(photos['333'][4].sourceFile,'IMG_9774.JPG');assert.match(photos['333'][4].caption,/digital COA/);
assert.equal(p.records.find(x=>x.inventoryId===342).authenticationSerial,'XJ05532097');assert.ok(p.records.some(x=>x.inventoryId===59));
for(const [id,theme]of [[302,'Big Bad Bruins'],[306,'New Blood, New Beginnings']]){const rec=p.records.find(x=>x.inventoryId===id);assert.match(rec.notes,new RegExp(theme));assert.ok(stories[rec.key].sources.some(x=>x.label==='Bruins Centennial Era Night announcement'));}
console.log('March 7 Centennial artifact and era-night regression checks passed.');

// Reusing 342 must never attach the former March 7 puck or duplicate a COA.
const chicago = p.records.find(record => record.inventoryId === 342);
const companion = p.records.find(record => record.inventoryId === 322);
assert.equal(chicago.key, 'milestone-342');
assert.equal(chicago.sourceRow, 43);
assert.equal(chicago.sourceSheet, 'Milestones');
assert.equal(chicago.date, '2024-12-04');
assert.equal(chicago.opponent, 'Chicago Blackhawks');
assert.equal(chicago.authenticationSerial, 'XJ05532097');
assert.equal(companion.authenticationSerial, 'XJ05532094');
assert.equal(chicago.videoId, companion.videoId);
assert.equal(chicago.careerStat, null);
assert.match(chicago.notes, /separate artifacts 44 and 45/);
assert.ok(!p.records.some(record => record.inventoryId === 49));
assert.equal(photos['49'], undefined);
assert.equal(stories['goal-49'], undefined);
assert.equal(stories[chicago.key].inventoryId, 342);
assert.equal(stories[chicago.key].gameId, 2024020407);
const gallery = read('marchand-photos.json');
assert.equal(gallery.stableAssetFolders['342'], 'images/pucks/49/');
for (const [id, path] of [[342, '/49/coa.webp'], [322, '/322/coa-02.webp']]) {
  const coas = photos[id].filter(photo => photo.label.startsWith('COA'));
  assert.equal(coas.length, 1);
  assert.equal(coas[0].label, 'COA');
  assert.ok(coas[0].url.includes(path + '?'));
  assert.match(coas[0].authenticationScope, /no unique hologram/);
  assert.match(coas[0].assignmentBasis, /not a serial-matched certificate/);
  assert.equal(p.records.find(record => record.inventoryId === id).sourceData.find(field => field.label === 'COA Filename').value, 'images/pucks' + path);
}
const gamePhotos = read('marchand-game-photos.json');
assert.equal(gamePhotos.artifacts['goal-49'], undefined);
assert.equal(gamePhotos.artifacts[chicago.key].inventoryId, 342);
for (const key of [chicago.key, companion.key, r.key]) {
  assert.equal(gamePhotos.artifacts[key].displaySelected, false, 'Withheld supplemental images do not change protected physical identities');
  assert.equal(gamePhotos.assets[gamePhotos.artifacts[key].assetId], undefined);
}
const index = JSON.parse(fs.readFileSync(new URL('../docs/marchand-game-photo-index-20261017.json', import.meta.url))).records;
assert.equal(index.length, p.records.length);
for (const record of p.records) {
  const entry = index.find(item => item.collectionRecordKey === record.key);
  assert.ok(entry);
  assert.equal(entry.inventoryId, record.inventoryId);
  assert.equal(entry.canonicalSheet, record.sourceSheet);
  assert.equal(entry.canonicalIdCell, `A${record.sourceRow}`);
  assert.equal(entry.assetId, gamePhotos.artifacts[record.key].assetId);
  assert.equal(entry.displaySelected, gamePhotos.artifacts[record.key].displaySelected);
  if (entry.displaySelected) assert.equal(entry.nativeSha256, gamePhotos.assets[entry.assetId].nativeSha256);
  else assert.equal(entry.url, null);
}
console.log('PASS: Chicago 342/322 identities, one assigned COA each, vacant 49, preserved 333 and all 172 current media joins.');
