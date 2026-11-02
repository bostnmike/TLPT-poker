import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read = name => fs.readFileSync(new URL('../'+name,import.meta.url));
const manifest = JSON.parse(read('data/gallery-norm.json'));
const media = read('media.html').toString();
const html = read('gallery.html').toString();
const code = read('gallery.js').toString();
assert.equal(manifest.posters.length,23,'Keep all 23 approved Norm covers, including both cancellation treatments');
assert.equal(manifest.banner.sha256,'948d1b3a9894c3053108588d92dc4ea1a89db6ecbb4355a757b4b0bec9b4198f','Use the owner-selected reviewed 21-Norm group picture');
assert.deepEqual([manifest.banner.width,manifest.banner.height],[1600,800]);
const all=[manifest.banner,...manifest.posters];
assert.equal(new Set(all.map(p=>p.id)).size,24);
for(const art of all){
  assert.match(art.src,/^images\/norm-gallery\/[a-z0-9-]+\.jpg$/);
  assert.equal(crypto.createHash('sha256').update(read(art.src)).digest('hex'),art.sha256,'Approved original bytes: '+art.id);
}
for(const art of manifest.posters){
  assert.deepEqual([art.width,art.height],[1080,1920],art.id+' preserves 9:16');
  assert.equal(art.filmHref,'media.html#'+art.id);
  const card=media.split('class="media-card" id="'+art.id+'"')[1]?.split('<div class="media-card"')[0];
  assert.ok(card?.includes('youtube.com/embed/'+art.youtubeId+'?playsinline=1'),art.id+' links to the corresponding film');
  assert.ok(card.includes('title="'+art.title.replace(/&/g,'&amp;')+'"'),art.id+' keeps the approved title');
}
assert.match(html,/id="gallery-norm-wing"[^>]*hidden/,'Norm wing is opt-in, not extra default scrolling');
assert.match(html,/data-gallery-wing="posters" aria-pressed="true"/);
assert.match(html,/id="gallery-year-field"/);
assert.match(code,/galleryWing === "norm" \? galleryNormArt : galleryPosters/,'Viewer remains within selected collection');
assert.match(code,/galleryWing !== "norm"/,'Archive loading must not overwrite Norm status');
assert.ok(!read('index.html').toString().includes('images/norm-gallery/'),'Do not restore homepage banner');
console.log('PASS: Norm Gallery approved banner, all 23 portrait hashes, film mappings and isolated archive');
