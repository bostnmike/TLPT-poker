import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url));
const records = JSON.parse(read('data/marchand-pucks.json')).records;
const manifest = JSON.parse(read('data/marchand-photos.json')).artifacts;
const ids = new Set(records.map((record) => String(record.inventoryId)));
let photoCount = 0;
for (const [id, photos] of Object.entries(manifest)) {
  assert.ok(ids.has(id), `Unknown artifact ${id}`);
  assert.ok(Array.isArray(photos) && photos.length, `Empty photo set: ${id}`);
  assert.equal(photos[0].label, 'Front', `Front must lead artifact ${id}`);
  assert.equal(new Set(photos.map((photo) => photo.label)).size, photos.length, `Duplicate view: ${id}`);
  for (const photo of photos) {
    assert.equal(photo.rotation, 0, `Rotation must be baked into image pixels: ${photo.url}`);
    assert.match(photo.label, /^(Front|Back|Edge [1-9]\d*)$/);
    for (const fullUrl of [photo.url, photo.thumbnailUrl].filter(Boolean)) {
      const url = fullUrl.split('?')[0];
      assert.ok(url.startsWith(`images/pucks/${id}/`) && !url.includes('..'), `Wrong folder: ${url}`);
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
