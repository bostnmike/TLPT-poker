import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const {records,meta}=JSON.parse(read('data/marchand-pucks.json'));
const photos=JSON.parse(read('data/marchand-photos.json')).artifacts;
const keep=records.find(r=>r.inventoryId===343);
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

const script=read('marchand.js');
const context={state:{records:[...records]}};
vm.createContext(context);
vm.runInContext(script.slice(script.indexOf('  function resolveArtifact('),script.indexOf('  async function loadCollection()')),context);
for(const [key,id] of [['milestone-343',343],['milestone-342',342],['goal-49',49],['milestone-301',301],['milestone-333',333],['goal-9',9]])assert.equal(context.resolveArtifact(key).inventoryId,id);
const approved49=context.state.records.find(record=>record.inventoryId===49);
context.state.records=context.state.records.filter(record=>record.inventoryId!==49);
assert.equal(context.resolveArtifact('goal-49').inventoryId,342,'Historical alias remains available only when49is not active');
context.state.records.push(approved49);
assert.equal(context.resolveArtifact('goal-49').inventoryId,49,'A future active goal 49 must override the historical alias');

assert.equal(records.find(r=>r.inventoryId===57),undefined);
assert.equal(photos[57],undefined);
assert.equal(context.resolveArtifact('goal-57'),undefined,'No permanent active57alias');
context.state.records.push({key:'goal-57',inventoryId:57});
assert.equal(context.resolveArtifact('goal-57').inventoryId,57,'A future active57 must resolve to itself');

assert.equal(records.some(r=>r.inventoryId===59),false);
assert.equal(context.resolveArtifact('goal-59'),undefined,'No permanent active59alias');
assert.equal(keep.key,'milestone-343');assert.equal(keep.sourceSheet,'Milestones');assert.equal(keep.sourceRow,44);
assert.equal(keep.scorerCode,'EL27');assert.equal(keep.careerStat,988);assert.equal(keep.seasonStat,5);
assert.equal(keep.authenticationSerial,'BB25087');assert.equal(keep.category,'RS Point');
assert.equal(photos[59],undefined);assert.ok(photos[343].every(v=>v.url.includes('/59/')));
assert.ok(photos[301].every(v=>v.url.includes('/343/')));
context.state.records.push({key:'goal-59',inventoryId:59});
assert.equal(context.resolveArtifact('goal-59').inventoryId,59,'Future active59must resolve to itself');
assert.equal(context.resolveArtifact('milestone-343').inventoryId,343,'Active343continues overriding the old301alias');
