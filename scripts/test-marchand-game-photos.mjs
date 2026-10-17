import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url));
const collection = JSON.parse(read('data/marchand-pucks.json'));
const photos = JSON.parse(read('data/marchand-game-photos.json'));
const byKey = new Map(collection.records.map(record => [record.key, record]));
assert.equal(Object.keys(photos.artifacts).length, photos.meta.artifacts);
assert.equal(Object.keys(photos.assets).length, photos.meta.assets);
assert.equal(photos.meta.approvedBaseMappings, 170);
assert.equal(photos.meta.addendumMappings, 2);
assert.equal(photos.meta.galleryPosition, 'last');
const nonBrad = [];
for (const [key, mapping] of Object.entries(photos.artifacts)) {
  const record = byKey.get(key);
  assert.ok(record, `Unknown game-photo record ${key}`);
  assert.equal(mapping.inventoryId, record.inventoryId, `Wrong current identity ${key}`);
  assert.equal(mapping.artifactDate, record.date);
  const photo = photos.assets[mapping.assetId];
  assert.ok(photo, `Missing asset for ${key}`);
  assert.equal(photo.role, 'game_reference');
  assert.equal(photo.subjectRuleReview, 'PASS');
  assert.ok(photo.bradVisible || !photo.bradPlayed, `${key}: Brad must be identifiable when he played`);
  if (!photo.bradPlayed) nonBrad.push(record.inventoryId);
  if (mapping.photoDate !== record.date) assert.equal(record.inventoryId, 705, 'Only documented rescheduled game can differ');
}
assert.deepEqual(nonBrad.sort((a,b) => a-b), [703,705]);
assert.equal(photos.artifacts['hfc-705'].photoDate, '2022-02-10');
assert.equal(photos.artifacts['goal-58'].photoDate, '2025-02-12');
assert.notEqual(photos.assets[photos.artifacts['history-504'].assetId].nativeSha256, photos.assets[photos.artifacts['history-510'].assetId].nativeSha256, 'Owner requires different images for 504/510');
assert.equal(photos.assets[photos.artifacts['history-504'].assetId].imageKind, 'video_still');
assert.equal(photos.assets[photos.artifacts['history-504'].assetId].videoSource.timestamp_seconds, 337);
assert.deepEqual(photos.meta.approvedSubjectExceptions.teammatesOutsideGoalCelebration, [504]);
for (const id of [301,333]) assert.equal(photos.artifacts[`milestone-${id}`].inventoryId,id);
for (const [id, photo] of Object.entries(photos.assets)) {
  assert.ok(photo.caption && photo.originalCaption && photo.credit, `Missing attribution or scene for ${id}`);
  assert.match(photo.sourceUrl, /^https:\/\//);
  assert.ok(['photograph','video_still'].includes(photo.imageKind));
  assert.match(photo.nativeSha256, /^[a-f0-9]{64}$/);
  assert.ok(photo.width <= photo.nativeWidth && photo.height <= photo.nativeHeight, `Upscaled ${id}`);
  assert.ok(Math.abs(photo.width / photo.height - photo.nativeWidth / photo.nativeHeight) < .01, `Cropped frame ${id}`);
  for (const [url, expected, bytes] of [[photo.url, photo.sha256, photo.bytes],[photo.thumbnailUrl,photo.thumbnailSha256,photo.thumbnailBytes]]) {
    assert.match(url, /^images\/marchand-games\/(?:\d{10}(?:-bench-504)?|artifact-330)\/game(?:-thumb)?\.webp\?v=[a-f0-9]{12}$/);
    const data = read(url.split('?')[0]);
    assert.equal(data.length, bytes);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), expected);
    assert.equal(data.subarray(0,4).toString(),'RIFF');
    assert.equal(data.subarray(8,12).toString(),'WEBP');
  }
  if (photo.license?.startsWith('CC ')) assert.match(photo.licenseUrl, /^https:\/\/creativecommons.org\/licenses\/by-sa\/(?:2|4)\.0\/$/);
}
assert.equal(photos.assets['2022020927'].license, 'CC BY-SA 2.0');
assert.equal(photos.assets['artifact-330'].license, 'CC BY-SA 4.0');
console.log(`PASS: ${photos.meta.artifacts} explicitly mapped game-reference gallery tails; ${photos.meta.assets} faithful assets, correct dates, subject exceptions, credits and CC licenses.`);
