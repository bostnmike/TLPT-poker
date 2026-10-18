import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url));
const collection=JSON.parse(read('data/marchand-pucks.json'));
const photos=JSON.parse(read('data/marchand-game-photos.json'));
const index=JSON.parse(read('docs/marchand-game-photo-index-20261017.json')).records;
assert.equal(collection.records.length,172);
assert.equal(index.length,172);
assert.equal(Object.keys(photos.artifacts).length,172);
assert.equal(Object.keys(photos.assets).length,172);
assert.equal(photos.meta.artifacts,172);
assert.equal(photos.meta.assets,172);
assert.equal(photos.meta.selectedGameImages,172);
assert.equal(photos.meta.withheldGameImages,0);
assert.equal(photos.meta.uniqueImagePerSelectedArtifact,true);
assert.equal(photos.meta.physicalPhotographySeparate,true);
let selectedCount=0,withheldCount=0;
const nonBrad=[];
for(const record of collection.records){
 const mapping=photos.artifacts[record.key];
 const joined=index.find(row=>row.collectionRecordKey===record.key);
 assert.ok(mapping&&joined,`Missing decision/join for ${record.key}`);
 assert.equal(mapping.inventoryId,record.inventoryId);
 assert.equal(mapping.artifactDate,record.date);
 assert.equal(typeof mapping.displaySelected,'boolean');
 assert.equal(joined.displaySelected,mapping.displaySelected);
 assert.equal(joined.inventoryId,record.inventoryId);
 assert.equal(joined.canonicalSheet,record.sourceSheet);
 assert.equal(joined.canonicalIdCell,`A${record.sourceRow}`);
 assert.equal(joined.assetId,mapping.assetId);
 if(!mapping.displaySelected){
  withheldCount++;
  assert.equal(mapping.galleryPosition,'omit');
  assert.equal(joined.galleryPosition,'omit');
  assert.equal(joined.url,null);
  assert.equal(joined.thumbnailUrl,null);
  assert.equal(photos.assets[mapping.assetId],undefined,`Withheld image cannot remain active: ${record.key}`);
  continue;
 }
 selectedCount++;
 const photo=photos.assets[mapping.assetId];
 assert.ok(photo);
 assert.equal(photo.role,'game_reference');
 assert.equal(photo.displaySelected,true);
 assert.equal(mapping.galleryPosition,'last');
 assert.equal(joined.galleryPosition,'last');
 assert.equal(photo.subjectRuleReview,'PASS');
 assert.ok(photo.bradVisible||!photo.bradPlayed);
 if(!photo.bradPlayed)nonBrad.push(record.inventoryId);
 if(mapping.photoDate!==record.date)assert.equal(record.inventoryId,705);
 for(const field of ['caption','credit','sourceUrl','nativeSha256','url','thumbnailUrl'])assert.equal(joined[field],photo[field]);
}
assert.equal(selectedCount,172);
assert.equal(withheldCount,0);
assert.ok(nonBrad.every(id=>[703,705].includes(id)));
for(const field of ['nativeSha256','originalAssetSha256','sha256'])assert.equal(new Set(Object.values(photos.assets).map(p=>p[field])).size,172,`Selected images/originals must be distinct: ${field}`);
for(const [id,photo]of Object.entries(photos.assets)){
 assert.ok(photo.caption&&photo.originalCaption&&photo.credit);
 assert.match(photo.sourceUrl,/^https:\/\//);
 assert.ok(['photograph','video_still'].includes(photo.imageKind));
 assert.equal(photo.selectedImageProcessing.generative_processing,false);
 assert.equal(photo.selectedImageProcessing.no_resampling,true);
 assert.ok(photo.width<=photo.nativeWidth&&photo.height<=photo.nativeHeight);
 assert.ok(Math.abs(photo.width/photo.height-photo.nativeWidth/photo.nativeHeight)<.01);
 if(photo.imageKind==='video_still'){
  assert.ok(photo.videoSource);
  assert.ok(photo.videoSource.selected_frame_seconds>=0);
  assert.match(photo.videoSource.original_video_sha256,/^[a-f0-9]{64}$/);
  assert.ok(!photo.license.startsWith('CC '));
 }
 for(const[url,hash,bytes]of[[photo.url,photo.sha256,photo.bytes],[photo.thumbnailUrl,photo.thumbnailSha256,photo.thumbnailBytes]]){
  assert.match(url,/^images\/marchand-games\/[a-z0-9][a-z0-9-]*\/(?:game\.(?:png|webp)|game-thumb\.webp)\?v=[a-f0-9]{12}$/);
  const data=read(url.split('?')[0]);
  assert.equal(data.length,bytes);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),hash);
  if(url.split('?')[0].endsWith('.png'))assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  else{assert.equal(data.subarray(0,4).toString(),'RIFF');assert.equal(data.subarray(8,12).toString(),'WEBP');}
 }
 if(photo.nativeFullSize){assert.equal(photo.sha256,photo.nativeSha256);assert.equal(photo.width,photo.nativeWidth);assert.equal(photo.height,photo.nativeHeight);}
 if(photo.license.startsWith('CC '))assert.match(photo.licenseUrl,/^https:\/\/creativecommons.org\/licenses\/by-sa\/(?:2|4)\.0\/$/);
}
const byId=id=>collection.records.find(r=>r.inventoryId===id);
for(const[id,videoId]of[[19,'lceo1s1K0c0'],[27,'Vf6W6gdGQy8']]){
 const r=byId(id);assert.equal(r.videoId,videoId);assert.equal(r.videoProvider,'youtube');assert.equal(r.videoUrl,`https://www.youtube.com/watch?v=${videoId}`);
 assert.equal(r.sourceData.find(f=>/video/i.test(f.label)).url,r.videoUrl);
}
const selected=key=>photos.assets[photos.artifacts[key].assetId];
assert.equal(selected('goal-27').gameId,'2022020771');
assert.equal(selected('goal-27').videoSource.clip_id,'6335779350112');
for(const id of [3,12,24,45]){ const a=selected(`goal-${id}`); assert.equal(photos.artifacts[`goal-${id}`].displaySelected,true); assert.ok(a.nativeFullSize); assert.match(a.url,/complete-20261018-/); assert.equal(a.sha256,a.nativeSha256); }
assert.match(selected('milestone-322').caption,/TNT interview in Chicago/);
assert.match(selected('milestone-322').relationNote,/Pregame/);
assert.doesNotMatch(selected('milestone-322').caption,/postgame|post-game/i);
assert.match(selected('history-509').relationNote,/Post-win/);
assert.notEqual(selected('history-510').nativeSha256,selected('history-504').nativeSha256);
assert.equal(selected('goal-4').credit,'Game video still / BruinsCorner on YouTube');
assert.equal(selected('goal-40').videoSource.clip_id,'6347357564112');
assert.match(selected('milestone-314').sourceEmbeddedCaption,/Barry Chin/);
assert.match(selected('repeat-626').sourceEmbeddedCaption,/Sam Navarro/);
assert.ok(selected('milestone-317').rawIptcQualification);
assert.equal(photos.artifacts['goal-49'],undefined);
assert.equal(photos.artifacts['milestone-342'].inventoryId,342);
assert.match(selected('milestone-301').caption,/2011|reunion|championship/i);
assert.equal(photos.artifacts['warmup-713'].photoDate,'2025-12-30');
assert.match(selected('warmup-713').caption,/Kevin/);
assert.match(byId(713).notes,/reached November 13, 2025/);
assert.equal(collection.meta.currentCanonicalMasterSha256,'326aa9bf2bac3d809d8e27484c9538eb91846e1ee621c7e344c096c98df329fd');
assert.equal(collection.meta.currentCanonicalMaster.sha256,collection.meta.currentCanonicalMasterSha256);
assert.equal(collection.meta.latestCanonicalUpdate.sourceSha256,collection.meta.currentCanonicalMasterSha256);
assert.equal(collection.meta.currentCanonicalMaster.nativeExcelAppTest,'PASS');
assert.equal(photos.meta.nativeExcelAppTest,'PASS');
assert.equal(photos.meta.sourceIndexSha256,'573fcf2c510fa3b72078b773dac08f5fbf4d6869cd03f656c1150f198ec29e57');
assert.equal(photos.meta.changedNativeImages.length,10);
assert.equal(photos.meta.retainedNativeImages.length,95);
assert.equal(photos.meta.restoredArchivedNativeImages.length,67);
console.log('PASS:172 distinct singular gallery tails;10 exact native replacements;95 retained/67 restored;source credits;correct19/27 links;713 ceremony;Excel PASS;owner qualification retained.');
