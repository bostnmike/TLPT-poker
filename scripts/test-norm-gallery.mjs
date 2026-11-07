import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read = name => fs.readFileSync(new URL('../'+name,import.meta.url));
const manifest = JSON.parse(read('data/gallery-norm.json'));
const media = read('media.html').toString();
const html = read('gallery.html').toString();
const code = read('gallery.js').toString();
assert.equal(manifest.posters.length,35,'Keep all 34 existing portraits and the approved Now Serving DeCaf poster');
assert.doesNotMatch(code,/data[.]banner|gallery-norm-banner/,'The gallery renders portraits without the original group picture');
assert.ok(!manifest.posters.some(art=>art.id==='many-faces-of-norm'));
const all=manifest.posters;
assert.equal(all[0].sha256,'7a3a006aa70213e2a349c422374434474315c213d8defcd1ebaba88cabf11e4f','Use the approved Now Serving DeCaf portrait first');
assert.equal(all.find(art=>art.id==='coffee-preorders').sha256,'da5907a9f923b628a8d71099ab9d64df78079b543853aa234d5893ecb38cb7fe','Use the approved coffee pre-order portrait');
assert.equal(all.find(art=>art.id==='two-seats-remain').sha256,'8c39bf6e93a73cee50f96d17340243ca95ecf2807b78328a9956cf2fc6f6090d','Use the exact approved Two Seats Remain portrait');
assert.equal(new Set(all.map(p=>p.id)).size,35);
for(const art of all){
  assert.match(art.src,/^images\/norm-gallery\/[a-z0-9-]+\.(?:jpg|png)$/);
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
assert.match(code,/galleryWing === "norm" \? galleryNormArt : filteredEventPosters\(\)/,'Viewer remains within the selected collection and poster year');
assert.match(code,/galleryWing !== "norm"/,'Archive loading must not overwrite Norm status');
assert.ok(!read('index.html').toString().includes('images/norm-gallery/'),'Do not restore homepage banner');
const family=[
  ['01-mall-studio.webp','35136b35891c6cce98529aab173ce0cfa46f3433670a99b0d33381f56a9f8226'],
  ['02-victorian-estate.webp','b4e2f4378487114aa3df5e8aea5f52d9b5770acd1df952838d21c1da24edebaa'],
  ['03-holiday-card.webp','b908dd57b105f8b13847bce96237ad6ab3cb04c575b16875f1eb4bed049a73c6'],
  ['04-airport-reunion.webp','d5632869001a6fcc86d4bf329d49c5b2e3a2110728275f1401b58a85dc9c7769'],
  ['05-family-tree.webp','45324426fb587b62714afc876f187e93bb388e0bceb755cd2ae9682942876ce9']
];
const wing=html.split('id="gallery-norm-wing"')[1]?.split('id="gallery-norm-content"')[0];
assert.match(wing,/id="family-portraits"/);
assert.deepEqual([...wing.matchAll(/src="images\/family-portraits\/([^"/]+)"/g)].map(match=>match[1]),family.map(([file])=>file));
for(const [file,sha] of family){
  assert.equal(crypto.createHash('sha256').update(read('images/family-portraits/'+file)).digest('hex'),sha,'Approved Family Portrait bytes: '+file);
}
for(const unrelated of ['index.html','media.html','media.js','media.css']){
  assert.doesNotMatch(read(unrelated).toString(),/family-portrait|initFamilyPortraits/i,`${unrelated} must not host the exhibit`);
}
console.log('PASS: Norm Gallery without the original group picture, all 35 portrait hashes, film mappings and isolated archive');
console.log('PASS: five unmodified Family Portraits belong to the Norm exhibit only');
