// Former 343 is current 301; former 342 is current 333. Preserve stable assets.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n,import.meta.url)));
const p=read('marchand-pucks.json'),stories=read('marchand-stories.json').artifacts,photos=read('marchand-photos.json').artifacts;
const a=p.records.find(r=>r.inventoryId===333),b=p.records.find(r=>r.inventoryId===301);
assert.equal(b.key,'milestone-301');assert.equal(b.sourceSheet,'Milestones');assert.equal(b.sourceRow,2);
assert.equal(b.date,'2024-03-07');assert.equal(b.videoId,'6348427251112');assert.equal(a.videoId,'6348437197112');
assert.match(a.notes,/RG13316480/);assert.match(b.notes,/RG13316479/);
assert.deepEqual(photos['301'].map(x=>x.label),['Front','Back','Edge 1','Edge 2','COA']);
assert.ok(photos['301'][0].thumbnailUrl);assert.ok(photos['301'].every(x=>x.url.includes('/343/')));
assert.equal(b.sourceData.find(x=>x.label==='COA Filename').value,'images/pucks/343/coa.webp');
assert.equal(b.sourceData.find(x=>x.label==='Original COA Filename').value,'IMG_9775.JPG');
assert.equal(photos['301'].at(-1).sourceFile,'IMG_9775.JPG');
assert.equal(photos['333'].at(-1).sourceFile,'IMG_9774.JPG');
assert.equal(stories[b.key].gameId,stories[a.key].gameId);assert.match(stories[b.key].paragraphs.join(' '),/2011.*captain.*duck boat.*Stanley Cup/);
console.log('PASS: separate March 7 pucks, serials, ceremony video, four photos plus owner-confirmed COA label and canonical mapping.');

assert.equal(a.authenticationSerial, 'RG13316480');
assert.equal(b.authenticationSerial, 'RG13316479');
assert.equal(a.sourceRow, 34);
assert.ok(photos['333'].every(photo => photo.url.includes('/342/')));
assert.ok(photos['342'].every(photo => photo.url.includes('/49/')));
assert.equal(photos['343'], undefined);
assert.match(b.notes, /artifact #333 \(RG13316480\)/);
assert.deepEqual(p.records.filter(record => record.sourceSheet === 'Milestones').map(record => record.inventoryId).sort((a,b)=>a-b), Array.from({length:42},(_,i)=>301+i));
