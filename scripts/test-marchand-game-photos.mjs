import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url));
const collection = JSON.parse(read('data/marchand-pucks.json'));
const photos = JSON.parse(read('data/marchand-game-photos.json'));
const index = JSON.parse(read('docs/marchand-game-photo-index-20261017.json')).records;
const byKey = new Map(collection.records.map(record => [record.key, record]));
assert.equal(Object.keys(photos.artifacts).length, 172);
assert.equal(Object.keys(photos.assets).length, 172);
assert.equal(photos.meta.artifacts, 172);
assert.equal(photos.meta.assets, 172);
assert.equal(photos.meta.uniqueImagePerArtifact, true);
assert.equal(photos.meta.galleryPosition, 'last');
assert.equal(photos.meta.physicalPhotographySeparate, true);
assert.equal(new Set(Object.values(photos.artifacts).map(row => row.assetId)).size, 172, 'Every puck needs its own selected image');
assert.equal(new Set(Object.values(photos.assets).map(row => row.nativeSha256)).size, 172, 'Renamed duplicate files are still duplicates');
assert.equal(new Set(Object.values(photos.assets).map(row => row.originalAssetSha256)).size, 172, 'Different crops of one original are still shared images');
assert.equal(new Set(Object.values(photos.assets).map(row => row.sha256)).size, 172, 'Web delivery images must remain distinct');
const nonBrad = [];
for (const [key, mapping] of Object.entries(photos.artifacts)) {
  const record = byKey.get(key);
  assert.ok(record, `Unknown game-photo record ${key}`);
  assert.equal(mapping.inventoryId, record.inventoryId);
  assert.equal(mapping.artifactDate, record.date);
  const photo = photos.assets[mapping.assetId];
  assert.ok(photo, `Missing asset for ${key}`);
  assert.equal(photo.role, 'game_reference');
  assert.equal(photo.subjectRuleReview, 'PASS');
  assert.ok(photo.bradVisible || !photo.bradPlayed, `${key}: Brad must be identifiable when he played`);
  if (!photo.bradPlayed) nonBrad.push(record.inventoryId);
  if (mapping.photoDate !== record.date) assert.equal(record.inventoryId, 705);
  const joined = index.find(row => row.collectionRecordKey === key);
  assert.ok(joined);
  assert.equal(joined.inventoryId, record.inventoryId);
  assert.equal(joined.canonicalSheet, record.sourceSheet);
  assert.equal(joined.canonicalIdCell, `A${record.sourceRow}`);
  assert.equal(joined.assetId, mapping.assetId);
  assert.equal(joined.nativeSha256, photo.nativeSha256);
  assert.equal(joined.caption, photo.caption);
  assert.equal(joined.credit, photo.credit);
  assert.equal(joined.sourceUrl, photo.sourceUrl);
}
assert.deepEqual(nonBrad.sort((a,b) => a-b), [703,705]);
assert.equal(photos.artifacts['hfc-705'].photoDate, '2022-02-10');
assert.equal(photos.artifacts['goal-58'].photoDate, '2025-02-12');
const selected = key => photos.assets[photos.artifacts[key].assetId];
assert.notEqual(selected('history-504').nativeSha256, selected('history-510').nativeSha256);
assert.notEqual(selected('milestone-301').nativeSha256, selected('milestone-333').nativeSha256);
assert.match(selected('milestone-301').caption, /2011|reunion|championship/i);
assert.ok(selected('milestone-333').bradVisible);
assert.equal(selected('goal-27').gameId, '2022020771');
assert.notEqual(selected('goal-27').videoSource?.clip_id, '6335779350112');
assert.equal(photos.artifacts['goal-49'], undefined);
assert.equal(photos.artifacts['milestone-342'].inventoryId, 342);
for (const [id, photo] of Object.entries(photos.assets)) {
  assert.ok(photo.caption && photo.originalCaption && photo.credit, `Missing attribution or scene for ${id}`);
  assert.match(photo.sourceUrl, /^https:\/\//);
  assert.ok(['photograph','video_still'].includes(photo.imageKind));
  assert.equal(photo.selectedImageProcessing.generative_processing, false);
  assert.equal(photo.selectedImageProcessing.no_resampling, true);
  assert.match(photo.nativeSha256, /^[a-f0-9]{64}$/);
  assert.ok(photo.width <= photo.nativeWidth && photo.height <= photo.nativeHeight, `Upscaled ${id}`);
  assert.ok(Math.abs(photo.width / photo.height - photo.nativeWidth / photo.nativeHeight) < .01, `Additional crop ${id}`);
  if (photo.imageKind === 'video_still') {
    assert.ok(photo.videoSource);
    assert.ok(photo.videoSource.selected_frame_seconds >= 0);
    assert.match(photo.videoSource.original_video_sha256, /^[a-f0-9]{64}$/);
    assert.ok(!photo.license.startsWith('CC '), 'A former photograph license must not transfer to a new broadcast still');
  }
  for (const [url, expected, bytes] of [[photo.url,photo.sha256,photo.bytes],[photo.thumbnailUrl,photo.thumbnailSha256,photo.thumbnailBytes]]) {
    assert.match(url, /^images\/marchand-games\/[a-z0-9][a-z0-9-]*\/(?:game\.(?:png|webp)|game-thumb\.webp)\?v=[a-f0-9]{12}$/);
    const data = read(url.split('?')[0]);
    assert.equal(data.length, bytes);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), expected);
    if (url.split('?')[0].endsWith('.png')) assert.equal(data.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    else {
      assert.equal(data.subarray(0,4).toString(), 'RIFF');
      assert.equal(data.subarray(8,12).toString(), 'WEBP');
    }
  }
  if (photo.nativeFullSize) {
    assert.equal(photo.sha256, photo.nativeSha256, 'Native full delivery must preserve the source file exactly');
    assert.equal(photo.width, photo.nativeWidth);
    assert.equal(photo.height, photo.nativeHeight);
  }
  if (photo.license.startsWith('CC ')) assert.match(photo.licenseUrl, /^https:\/\/creativecommons.org\/licenses\/by-sa\/(?:2|4)\.0\/$/);
}
console.log('PASS: 172 distinct approved game-reference gallery tails, complete current ID/source joins, correct dates, DNP exceptions, archived frame provenance and asset hashes.');
