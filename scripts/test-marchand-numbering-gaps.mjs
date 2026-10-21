import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const {records}=JSON.parse(read('data/marchand-pucks.json'));
const physical=JSON.parse(read('data/marchand-photos.json'));
const games=JSON.parse(read('data/marchand-game-photos.json'));
const stories=JSON.parse(read('data/marchand-stories.json')).artifacts;
const byId=id=>records.find(r=>r.inventoryId===id);
const range=(lo,hi)=>Array.from({length:hi-lo+1},(_,i)=>lo+i);
assert.deepEqual(records.map(r=>r.inventoryId).sort((a,b)=>a-b),[...range(1,75),...range(300,342),...range(500,509),...range(600,626),...range(700,716)]);
assert.equal(records.length,172);
for(const sheet of new Set(records.map(r=>r.sourceSheet))){const ids=records.filter(r=>r.sourceSheet===sheet).map(r=>r.inventoryId);assert.deepEqual(ids,[...ids].sort((a,b)=>a-b),'Numeric order within '+sheet);}
for(const retired of [76,77,343,510,717]){
 assert.equal(byId(retired),undefined,`Retired card ${retired}`);
 assert.equal(physical.artifacts[retired],undefined,`Retired physical gallery ${retired}`);
 assert.ok(!Object.values(games.artifacts).some(x=>x.inventoryId===retired));
 assert.ok(!Object.values(stories).some(x=>x.inventoryId===retired));
}
for(const [id,date,serial,namespace,assetId] of [
 [57,'2019-02-09','MGA21933','76','2018020838-a76-publishing'],
 [59,'2016-01-19','G009264','77','2015020686-a77-publishing'],
 [300,'2025-10-21','BB25087','59','2025020103-a59-publishing'],
 [500,'2023-04-06','','510','2022021246-a510-publishing'],
 [709,'2026-01-25','','717','2025020823-a717-publishing']]){
 const r=byId(id);assert.equal(r.date,date);assert.equal(r.authenticationSerial,serial);
 assert.equal(physical.stableAssetFolders[id],`images/pucks/${namespace}/`);
 assert.ok(physical.artifacts[id].every(v=>v.url.includes(`/pucks/${namespace}/`)));
 assert.equal(games.artifacts[r.key].assetId,assetId);assert.equal(games.artifacts[r.key].inventoryId,id);assert.equal(games.artifacts[r.key].galleryPosition,'last');
 assert.equal(stories[r.key].inventoryId,id);
}
assert.equal(byId(300).scorerCode,'EL27');assert.equal(byId(300).primaryAssist,'BM63');
assert.equal(byId(59).authenticationRecordUrl,'https://www.tricoloresports.com/us/service/authentique/');
for(const [id,namespace,serial]of[[301,'343','RG13316479'],[333,'342','RG13316480'],[342,'49','XJ05532097']]){
 assert.equal(byId(id).authenticationSerial,serial);assert.ok(physical.artifacts[id].every(v=>v.url.includes(`/pucks/${namespace}/`)));
}
const js=read('marchand.js');const context={state:{records:[...records]}};vm.createContext(context);
vm.runInContext(js.slice(js.indexOf('  function resolveArtifact('),js.indexOf('  async function loadCollection()')),context);
for(const [oldKey,newId]of[['goal-76',57],['goal-77',59],['milestone-343',300],['history-510',500],['hfc-717',709]])assert.equal(context.resolveArtifact(oldKey).inventoryId,newId);
for(const id of[49,57,59,300,301,333,342,500,709])assert.equal(context.resolveArtifact(byId(id).key).inventoryId,id);
assert.notEqual(context.resolveArtifact('goal-57').inventoryId,313);
assert.notEqual(context.resolveArtifact('goal-59').authenticationSerial,'BB25087');
context.state.records.push({key:'goal-76',inventoryId:76});assert.equal(context.resolveArtifact('goal-76').inventoryId,76,'Future active ID overrides historical redirect');
console.log('PASS:172 continuous IDs;five exact physical identities/game joins;retired cards absent;57/59 safe from historical aliases;stable native namespaces preserved.');
