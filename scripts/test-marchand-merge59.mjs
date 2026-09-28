import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const {records,meta}=JSON.parse(read('data/marchand-pucks.json'));
const photos=JSON.parse(read('data/marchand-photos.json')).artifacts;
const keep=records.find(r=>r.inventoryId===59);
assert.ok(keep);assert.equal(records.some(r=>r.inventoryId===333),false);
assert.equal(meta.records,152);assert.equal(meta.milestones,38);
assert.equal(keep.puckType,'Goal Scored Puck');assert.equal(keep.primaryAssist,'BM63');
assert.match(keep.notes,/return to Boston/);assert.match(keep.videoUrl,/6383495592112$/);
assert.equal(JSON.parse(read('data/marchand-stories.json')).artifacts['milestone-333'],undefined);
assert.match(read('marchand.js'),/requestedArtifact === "milestone-333" \? "goal-59"/);
assert.deepEqual(photos[313].slice(0,4).map(p=>p.label),['Front','Back','Edge 1','Edge 2']);
assert.ok(photos[313][0].thumbnailUrl);
for(const [id,views] of Object.entries(photos))for(const p of views.filter(p=>p.sourceFile)){
 assert.ok(p.caption);assert.ok(p.authenticationScope);
 if(p.authenticationScope==='game-level')assert.match(p.caption,/not a specific scoring play|does not identify an individual/);
 assert.notEqual(Number(id),333);
}
assert.match(photos[58].find(p=>p.sourceFile==='IMG_9793.JPG').caption,/goal-puck/);
console.log('PASS: #59 merge preserves goal video; #313 gallery and provenance distinctions verified.');
