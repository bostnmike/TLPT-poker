import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const {records,meta}=JSON.parse(read('data/marchand-pucks.json'));
const photos=JSON.parse(read('data/marchand-photos.json')).artifacts;
const keep=records.find(r=>r.inventoryId===300);
assert.ok(keep);assert.equal(records.find(r=>r.inventoryId===333).authenticationSerial,"RG13316480");
assert.equal(meta.records,172);assert.equal(meta.milestones, 43);
assert.equal(keep.puckType,'Goal Scored Puck');assert.equal(keep.primaryAssist,'BM63');
assert.match(keep.notes,/return to Boston/);assert.match(keep.videoUrl,/6383495592112$/);
assert.equal(JSON.parse(read('data/marchand-stories.json')).artifacts['milestone-333'].gameId,2023020993);
assert.doesNotMatch(read('marchand.js'),/requestedArtifact === "milestone-333" \? "goal-59"/);
assert.match(keep.notes,/historical number retired.*unrelated to current artifact 333/);
assert.deepEqual(photos[313].slice(0,4).map(p=>p.label),['Front','Back','Edge 1','Edge 2']);
assert.ok(photos[313][0].thumbnailUrl);
for(const [id,views] of Object.entries(photos))for(const p of views.filter(p=>p.sourceFile)){
 assert.ok(p.caption);assert.ok(p.authenticationScope);
 if(p.authenticationScope==='game-level')assert.match(p.caption,/not a specific scoring play|does not identify an individual|game-used puck label/);
 if(Number(id)===333)assert.equal(p.sourceFile,'IMG_9774.JPG');
}
assert.match(photos[58].find(p=>p.sourceFile==='IMG_9793.JPG').caption,/goal-puck/);
console.log('PASS: #59 merge preserves goal video; #313 gallery and provenance distinctions verified.');

assert.equal(keep.key,'milestone-300');assert.equal(keep.sourceSheet,'Milestones');assert.equal(keep.sourceRow,2);
assert.equal(keep.scorerCode,'EL27');assert.equal(keep.careerStat,988);assert.equal(keep.seasonStat,5);
assert.equal(keep.authenticationSerial,'BB25087');assert.equal(keep.category,'RS Point');
assert.ok(photos[300].every(v=>v.url.includes('/59/')));
assert.ok(photos[301].every(v=>v.url.includes('/343/')));
assert.equal(records.find(r=>r.inventoryId===59).authenticationSerial,'G009264');
assert.ok(photos[59].every(v=>v.url.includes('/77/')));
assert.equal(records.find(r=>r.inventoryId===57).authenticationSerial,'MGA21933');
assert.ok(photos[57].every(v=>v.url.includes('/76/')));
assert.match(keep.notes,/now artifact 300; formerly 59, then 343/);
console.log('PASS: historical59/343 identity now300;fresh57/59 separate;313consolidation and protected301namespace preserved.');
