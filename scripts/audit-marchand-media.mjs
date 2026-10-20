import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name)));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const collection = read('data/marchand-pucks.json');
const physical = read('data/marchand-photos.json');
const games = read('data/marchand-game-photos.json');
const library = read('data/marchand-photo-library.json');
const base = library.baseUrl;
const local = new Set(), hosted = new Set(), physicalPaths = new Set();
const sourceFields = new Set(['Front Image Filename', 'Back Image Filename', 'Detail Image Filenames', 'COA Filename', 'Authentication Evidence']);
const strip = url => url.replace(base, '').split('?')[0];
const isImage = name => /\.(?:webp|png|jpe?g)$/i.test(name);
function images(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const full = path.join(dir, item.name);
    return item.isDirectory() ? images(full) : isImage(item.name) ? [full] : [];
  });
}
function include(url) {
  const relative = strip(url);
  assert.ok(!relative.includes('..') && relative.startsWith('images/'), `Unsafe image path: ${url}`);
  (url.startsWith(base) ? hosted : local).add(relative);
  return relative;
}
const ids = new Set(collection.records.map(record => String(record.inventoryId)));
for (const id of Object.keys(physical.artifacts)) assert.ok(ids.has(id), `Gallery has retired owner ${id}`);
for (const record of collection.records) {
  const views = physical.artifacts[record.inventoryId] || [];
  const fullPaths = new Set(views.map(view => strip(view.url)));
  const stable = physical.stableAssetFolders?.[record.inventoryId] || `images/pucks/${record.inventoryId}/`;
  for (const view of views) {
    for (const url of [view.url, view.thumbnailUrl].filter(Boolean)) {
      const relative = include(url);
      assert.ok(relative.startsWith(stable), `Wrong physical owner for ${record.key}: ${relative}`);
      physicalPaths.add(relative);
    }
  }
  for (const field of record.sourceData.filter(field => sourceFields.has(field.label))) {
    const paths = field.value.match(/images\/pucks\/[\w/.-]+\.(?:webp|png|jpe?g)/gi) || [];
    for (const relative of paths) assert.ok(fullPaths.has(relative), `Canonical ${record.key} has obsolete image reference: ${relative}`);
  }
  const mapping = games.artifacts[record.key];
  assert.ok(mapping && mapping.inventoryId === record.inventoryId, `Wrong game owner: ${record.key}`);
  if (mapping.displaySelected) {
    const asset = games.assets[mapping.assetId];
    assert.ok(asset, `Missing game asset: ${record.key}`);
    include(asset.url); include(asset.thumbnailUrl);
  }
}
const indexPaths = Object.keys(library.assets);
assert.deepEqual(new Set(indexPaths), hosted, 'Hosted inventory must contain exactly the current gallery assets');
for (const relative of local) assert.ok(fs.existsSync(path.join(root, relative)), `Missing active file: ${relative}`);
const localFiles = ['images/pucks', 'images/marchand-games'].flatMap(dir => images(path.join(root, dir)));
for (const file of localFiles) assert.ok(local.has(path.relative(root, file)), `Unreferenced image in active website tree: ${path.relative(root, file)}`);
const hostFlag = process.argv.indexOf('--image-host');
if (hostFlag !== -1) {
  const hostRoot = path.resolve(process.argv[hostFlag + 1]);
  const hostIndex = JSON.parse(fs.readFileSync(path.join(hostRoot, 'assets.json')));
  assert.deepEqual(hostIndex.assets, library.assets, 'Site and image-host inventories differ');
  const files = images(path.join(hostRoot, 'images/pucks'));
  assert.deepEqual(new Set(files.map(file => path.relative(hostRoot, file))), hosted, 'Image host has orphan or missing files');
  for (const relative of hosted) {
    const data = fs.readFileSync(path.join(hostRoot, relative));
    assert.equal(data.length, library.assets[relative].bytes, `Wrong byte count: ${relative}`);
    assert.equal(hash(data), library.assets[relative].sha256, `Wrong image bytes: ${relative}`);
  }
}
console.log(`PASS: ${collection.records.length} owners; ${localFiles.length} site files; ${hosted.size} hosted files; no obsolete image references or unreferenced active files.`);
