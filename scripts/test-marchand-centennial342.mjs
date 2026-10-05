import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n,import.meta.url))),p=read('marchand-pucks.json'),stories=read('marchand-stories.json').artifacts,photos=read('marchand-photos.json').artifacts,stats=read('marchand-game-stats.json').games;
const r=p.records.find(x=>x.inventoryId===342);
assert.equal(r.key,'milestone-342');assert.equal(r.sourceSheet,'Milestones');assert.equal(r.date,'2024-03-07');assert.equal(r.puckType,'Game Used Puck');assert.equal(r.team,'Boston Bruins');assert.equal(r.opponent,'Toronto Maple Leafs');assert.equal(r.score,'TOR 1 @ BOS 4');assert.equal(r.videoId,'6348437197112');assert.equal(r.goalType,'');assert.equal(r.careerStat,null);
assert.match(r.notes,/RG13316480/);assert.match(r.notes,/digital COA/);assert.match(r.notes,/Return of a Champion/);
assert.equal(stories[r.key].gameId,2023020993);assert.equal(stats['2023020993'].stats.assists,2);assert.equal(stats['2023020993'].stats.totalToi,'16:54');
assert.deepEqual(photos['342'].map(x=>x.label),['Front','Back','Edge 1','Edge 2','COA']);assert.ok(photos['342'][0].thumbnailUrl);assert.equal(photos['342'][4].sourceFile,'IMG_9774.JPG');assert.match(photos['342'][4].caption,/digital COA/);
assert.ok(!p.records.some(x=>x.inventoryId===333));assert.ok(p.records.some(x=>x.inventoryId===59));
for(const [id,theme]of [[302,'Big Bad Bruins'],[306,'New Blood, New Beginnings']]){const rec=p.records.find(x=>x.inventoryId===id);assert.match(rec.notes,new RegExp(theme));assert.ok(stories[rec.key].sources.some(x=>x.label==='Bruins Centennial Era Night announcement'));}
console.log('March 7 Centennial artifact and era-night regression checks passed.');
