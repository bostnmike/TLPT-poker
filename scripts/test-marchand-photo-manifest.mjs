import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url));
const records = JSON.parse(read('data/marchand-pucks.json')).records;
const manifest = JSON.parse(read('data/marchand-photos.json')).artifacts;
const library = JSON.parse(read('data/marchand-photo-library.json'));
const libraryBase = 'https://bostnmike.github.io/marchand-puck-images/';
assert.equal(library.baseUrl, libraryBase, 'Unexpected photo-library host');
const remoteChecks = new Map();
const ids = new Set(records.map((record) => String(record.inventoryId)));
const palmieri = records.find((record) => record.inventoryId === 324);
assert.equal(palmieri.sourceSheet, 'Milestones');
assert.equal(palmieri.category, 'Milestone');
assert.equal(palmieri.puckType, 'Goal Scored Puck');
assert.match(palmieri.description, /Kyle Palmieri/);
assert.equal(palmieri.careerStat, null, 'Opponent goal must not become a Marchand career goal');
assert.match(palmieri.notes, /4:21 of period 2/);
assert.ok(manifest[324].some((photo) => photo.label === 'COA'));
assert.ok(manifest[71].some((photo) => photo.label === 'COA 2'));
let photoCount = 0;
for (const [id, photos] of Object.entries(manifest)) {
  assert.ok(ids.has(id), `Unknown artifact ${id}`);
  assert.ok(Array.isArray(photos) && photos.length, `Empty photo set: ${id}`);
  if (photos.some((photo) => photo.label === 'Front')) {
    assert.equal(photos[0].label, 'Front', `Front must lead artifact ${id} when available`);
  }
  assert.equal(new Set(photos.map((photo) => photo.label)).size, photos.length, `Duplicate view: ${id}`);
  for (const photo of photos) {
    assert.equal(photo.rotation, 0, `Rotation must be baked into image pixels: ${photo.url}`);
    assert.match(photo.label, /^(Front|Back|Edge [1-9]\d*|COA(?: [2-9]\d*)?)$/);
    for (const fullUrl of [photo.url, photo.thumbnailUrl].filter(Boolean)) {
      const external = fullUrl.startsWith(libraryBase);
      const url = (external ? fullUrl.slice(libraryBase.length) : fullUrl).split('?')[0];
      assert.ok(url.startsWith(`images/pucks/${id}/`) && !url.includes('..'), `Wrong folder: ${url}`);
      if (external) {
        const expected = library.assets[url];
        assert.ok(expected?.bytes > 100, `Missing library inventory entry: ${url}`);
        assert.match(expected.sha256, /^[a-f0-9]{64}$/);
        assert.match(url, /^images\/pucks\/\d+\/(?:front(?:-thumb)?|back|edge-\d+)\.webp$/);
        remoteChecks.set(fullUrl, expected);
        continue;
      }
      const bytes = read(url);
      assert.ok(bytes.length > 100, `Empty photo: ${url}`);
      if (url.endsWith('.png')) assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      else if (url.endsWith('.webp')) {
        assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
        assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      } else assert.fail(`Unsupported photo format: ${url}`);
    }
    photoCount++;
  }
}
console.log(`Verified ${photoCount} puck views across ${Object.keys(manifest).length} artifacts.`);
if (process.argv.includes('--live')) {
  const checks = [...remoteChecks]; let cursor = 0;
  await Promise.all(Array.from({length: 8}, async () => {
    while (cursor < checks.length) {
      const [url, expected] = checks[cursor++];
      const response = await fetch(url, {signal: AbortSignal.timeout(60000)});
      assert.equal(response.status, 200, `Image unavailable: ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length, expected.bytes, `Wrong byte count: ${url}`);
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected.sha256, `Image hash mismatch: ${url}`);
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    }
  }));
  console.log(`Live verification passed for all ${checks.length} external photographs and thumbnails.`);
}
