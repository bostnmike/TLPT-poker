import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url));
const collection=JSON.parse(read('data/marchand-pucks.json'));
const photos=JSON.parse(read('data/marchand-game-photos.json'));
const indexData=JSON.parse(read('docs/marchand-game-photo-index-20261017.json'));
const index=indexData.records;
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
 assert.ok(['PASS','PASS_FRESH_APPROVED_SOURCE_IDENTITY','PASS_OWNER_APPROVED_EXACT_GAME_PHOTO'].includes(photo.subjectRuleReview));
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
  assert.match(url,/^images\/marchand-games\/[a-z0-9][a-z0-9-]*\/(?:game\.(?:png|jpg|webp)|game-thumb\.webp)\?v=[a-f0-9]{12}$/);
  const data=read(url.split('?')[0]);
  assert.equal(data.length,bytes);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),hash);
  if(url.split('?')[0].endsWith('.png'))assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  else if(url.split('?')[0].endsWith('.jpg'))assert.equal(data.subarray(0,3).toString('hex'),'ffd8ff');
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
assert.notEqual(selected('history-500').nativeSha256,selected('history-504').nativeSha256);
assert.equal(selected('goal-4').credit,'Game video still / NHL / NESN broadcast');
assert.match(selected('goal-4').caption,/smiles.*glove.*backhand goal/i);
assert.match(selected('goal-10').caption,/Postgame interview, October 5, 2019/);
assert.match(selected('history-502').caption,/pregame.*Pittsburgh/i);
assert.match(selected('history-500').caption,/Bertuzzi.*overtime winner/i);
assert.match(selected('milestone-333').caption,/Carlo/);
assert.match(selected('milestone-333').credit,/Steve Babineau/);
for(const key of ['goal-4','goal-10','milestone-333','history-502','history-500']){const a=selected(key);assert.ok(a.nativeFullSize);assert.equal(a.sha256,a.nativeSha256);assert.match(a.url,/punchlist-20261018-/);}
assert.equal(selected('goal-40').videoSource.clip_id,'6347357564112');
assert.match(selected('milestone-314').sourceEmbeddedCaption,/Barry Chin/);
assert.match(selected('repeat-626').sourceEmbeddedCaption,/Sam Navarro/);
assert.ok(selected('milestone-317').rawIptcQualification);
assert.equal(photos.artifacts['goal-49'].inventoryId,49);
assert.equal(photos.artifacts['milestone-342'].inventoryId,342);
assert.match(selected('milestone-301').caption,/2011|reunion|championship/i);
assert.equal(photos.artifacts['warmup-713'].photoDate,'2025-12-30');
assert.match(selected('warmup-713').caption,/Kevin/);
assert.match(byId(713).notes,/reached November 13, 2025/);
assert.equal(collection.meta.currentCanonicalMasterSha256,'ae10d15325e8195ceac3ff4292831bc53557994a6ce3101a92baa0b80f5857b1');
assert.equal(collection.meta.priorCanonicalMetadataBeforeLegacyCleanup.currentCanonicalMasterSha256,'f867496b36eaf13baae8f49883d9b632926395d09b90e1f65ae59238e21869b9');
assert.equal(byId(30).sourceData.find(field=>field.label==='Detail Image Filenames').value,'images/pucks/30/edge-01.webp; images/pucks/30/edge-02.webp; images/pucks/30/edge-03.webp; images/pucks/30/edge-05.webp');
assert.equal(collection.meta.currentCanonicalMaster.sha256,collection.meta.currentCanonicalMasterSha256);
assert.equal(collection.meta.latestCanonicalUpdate.sourceSha256,collection.meta.currentCanonicalMasterSha256);
assert.equal(collection.meta.currentCanonicalMaster.nativeExcelAppTest,'PASS');
assert.equal(photos.meta.nativeExcelAppTest,'PASS');
assert.equal(photos.meta.sourceIndexSha256,indexData.sourceIndexSha256);
assert.equal(photos.meta.changedNativeImages.length,0);
assert.equal(photos.meta.retainedNativeImages.length,172);
assert.equal(photos.meta.restoredArchivedNativeImages.length,0);
console.log('PASS:172 distinct singular gallery tails;all172 native assets retained;prior708 JPEG and source credits preserved;correct19/27 links;713 ceremony;Excel PASS;current57/59 and historical313 consolidation distinct.');

// Owner-approved v2 context must be visible, not only implicit in image type.
for(const id of [2,36,56,303,305,506,601,702]){const r=byId(id),a=selected(r.key);assert.equal(a.label,a.displayLabel);assert.ok(a.displayLabel);assert.match(a.url,/targeted-v2-20261018-/);assert.equal(a.sourceRevision,'Targeted-Photo-Edition-20261018-v2');assert.equal(a.sha256,a.nativeSha256);assert.doesNotMatch(a.finalVisualReview.scope,/pending/i);if(a.imageKind==='photograph')assert.equal(a.videoSource,undefined);}
assert.equal(selected('history-506').sha256,'2a51d93ccf9e836256e5c9a0a9834c12f5d838d444e70c2430cf206819107edc');
assert.deepEqual([selected('history-506').width,selected('history-506').height],[810,865]);
assert.deepEqual(selected('history-506').selectedImageProcessing.crop_box,[1500,125,2310,990]);
assert.equal(selected('history-506').photographerIdentified,false);
assert.equal(selected('history-506').credit,'Boston Bruins / NHL');
assert.match(selected('milestone-303').displayLabel,/FIRST-PERIOD/);
assert.match(selected('milestone-303').context,/SECOND goal/);
assert.match(selected('goal-36').displayLabel,/PREGAME/);
assert.match(selected('goal-2').displayLabel,/POSTGAME/);
assert.match(selected('repeat-601').displayLabel,/GAME ACTION/);
assert.match(selected('hfc-702').displayLabel,/SHOOTOUT WIN/);
assert.equal(photos.meta.photographs,93);assert.equal(photos.meta.videoStills,79);

assert.equal(photos.artifacts['goal-57'].assetId,'2018020838-a76-publishing');
assert.equal(photos.assets['2024020086-a57-publishing'],undefined);
assert.deepEqual(photos.meta.openOwnerReview,[]);
assert.match(photos.meta.revision,/Gap-Free-Numbering/);
for(const id of [67,602,605,608,617,621,622,625]){
 const a=selected(byId(id).key);assert.equal(a.label,a.displayLabel);assert.match(a.url,/identity-v3-20261018-/);
 assert.equal(a.sourceRevision,'Canonical-Consolidated-Edition-20261018-v4');assert.equal(a.sha256,a.nativeSha256);assert.equal(a.imageKind,'photograph');
 assert.equal(a.videoSource,undefined);assert.equal(a.subjectRuleReview,'PASS_FRESH_APPROVED_SOURCE_IDENTITY');
 assert.equal(a.finalVisualReview.status,'PASS_WITH_EXISTING_QUALIFICATIONS');assert.doesNotMatch(a.finalVisualReview.scope,/pending/i);
}
assert.match(selected('repeat-608').displayLabel,/POSTGAME/);
assert.match(selected('repeat-621').displayLabel,/POSTGAME/);
assert.match(selected('repeat-622').displayLabel,/PORTRAIT/);
assert.match(selected('repeat-625').context,/no specific goal/i);
assert.equal(selected('repeat-602').photographerIdentified,false);
assert.equal(selected('repeat-625').photographerIdentified,false);
assert.match(selected('repeat-605').identityEvidence,/partly covers.*helmet numeral/i);

assert.equal(photos.artifacts['goal-59'].assetId,'2015020686-a77-publishing');
assert.equal(photos.artifacts['milestone-300'].assetId,'2025020103-a59-publishing');
assert.equal(selected('milestone-300').sha256,'725736d9b36d626d7b57ef03b5832494a72d41446dbee3f31a73c1cc6cac3ab1');
const owner708=selected('hfc-708');
assert.equal(owner708.sha256,'47a628ade4c90f925ef1c799eac6b859a392ba84f89cc5209b26b4970f98fd6e');
assert.deepEqual([owner708.width,owner708.height],[594,423]);assert.equal(owner708.bytes,92787);
assert.equal(owner708.label,'Game photograph');assert.equal(owner708.imageKind,'photograph');assert.equal(owner708.videoSource,undefined);
assert.equal(owner708.caption,'Marchand and Malkin at Consol Energy Center.');
assert.equal(owner708.credit,'Gregory Shamus / NHLI via Getty Images');assert.equal(owner708.sourceUrl,'https://www.gettyimages.com/detail/187101132');
assert.equal(byId(708).videoUrl,'https://www.youtube.com/watch?v=thyZzfvmliU');
assert.deepEqual(photos.meta.openQualityIds,[]);assert.deepEqual(photos.meta.resolvedPriorQualityIds,[708]);
assert.equal(index.find(r=>r.inventoryId===300).bookPage,101);
