import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {eventPoster,parseGallery,createCatalogLoader,GALLERY_MANIFEST} from '../posters.mjs';
import {validateMetadata,publicFeed,playerView} from '../model.mjs';
const catalog=parseGallery({folder:'images/fw',files:['fw26-10-31.jpg','fw26-11-01.png','fw26-11-06.jpg']});
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const client=source.match(/^function posterFor\(file,date\)\{[^\n]+/m)[0];
function preview(metadata,posters=catalog){const ctx={posterCatalog:posters};vm.createContext(ctx);const result=vm.runInContext(client+`;posterFor(${JSON.stringify(metadata.poster)},${JSON.stringify(metadata.date)})`,ctx);return result?JSON.parse(JSON.stringify(result)):null;}
test('automatic and explicit PNG/JPG matching agrees in feed and Commish preview',()=>{
 for(const metadata of [{date:'2026-11-01'},{date:'2026-10-31',poster:'auto'},{date:'2026-10-31',poster:'fw26-11-01.png'},{date:'Date TBD',poster:'fw26-10-31.jpg'}]){
  const poster=eventPoster(metadata,catalog);assert.ok(poster);assert.deepEqual(preview(metadata),poster);assert.equal(poster.url,'https://tlpt.org/images/fw/'+poster.file);assert.equal(poster.thumbnailUrl,'https://tlpt.org/images/fw/thumbs/'+poster.file);
 }
 assert.equal(eventPoster({date:'2026-11-01'},catalog).file,'fw26-11-01.png');
 assert.equal(eventPoster({date:'2026-10-31'},catalog).file,'fw26-10-31.jpg');
});
test('none, undated automatic, missing art and empty catalog never invent an image filename',()=>{
 for(const [metadata,posters] of [[{date:'2026-11-01',poster:'none'},catalog],[{date:'Date TBD'},catalog],[{date:'2026-11-02'},catalog],[{date:'2026-11-01'},[]],[{poster:'../../private.png'},catalog]]){
  assert.equal(eventPoster(metadata,posters),null);assert.equal(preview(metadata,posters),null);
 }
 assert.equal(eventPoster({date:'2026-11-01',poster:'fw26-11-01.png'},[]).file,'fw26-11-01.png');
 assert.equal(preview({date:'2026-11-01',poster:'fw26-11-01.png'},[]).file,'fw26-11-01.png');
});
test('gallery file validation accepts PNG/JPG only and deterministic date matches preserve explicit PNG',()=>{
 const list=parseGallery({folder:'images/fw',files:['fw26-11-01.png','fw26-11-01.jpg','fw26-11-01.png','../private.png','https://evil.test/a.jpg','fw26-11-01.png?key=x','fw26-11-01.svg',null]});assert.equal(list.length,2);
 assert.equal(eventPoster({date:'2026-11-01'},list).file,'fw26-11-01.jpg');assert.equal(eventPoster({date:'2026-11-01',poster:'fw26-11-01.png'},list).file,'fw26-11-01.png');assert.throws(()=>parseGallery({folder:'private',files:[]}),/unavailable/);
 const metadata={title:'Sunday',format:'50K Format',slot:'sunday',day:'Sunday',date:'2026-11-01',time:'7:00 PM',endTime:'11:30 PM',location:'Room',address:'Cary',structure:'Friday blinds',poster:'fw26-11-01.png'};
 assert.equal(validateMetadata(metadata).poster,'fw26-11-01.png');assert.throws(()=>validateMetadata({...metadata,poster:'fw26-11-01.png/../../key'}),/gallery/);
});
test('catalog cache coalesces requests and retains last verified filenames during outages',async()=>{
 let calls=0,clock=100,fail=false;
 const load=createCatalogLoader(async(url)=>{calls++;assert.equal(url,GALLERY_MANIFEST);if(fail)throw Error('Offline');return Response.json({folder:'images/fw',files:['fw26-11-01.png']});},()=>clock);
 const first=await Promise.all([load(),load(),load()]);assert.equal(calls,1);assert.ok(first.every(r=>r.posters[0].file==='fw26-11-01.png'));await load();assert.equal(calls,1);
 clock+=300001;fail=true;const stale=await load();assert.equal(calls,2);assert.equal(stale.unavailable,true);assert.equal(eventPoster({date:'2026-11-01'},stale.posters).file,'fw26-11-01.png');await load();assert.equal(calls,2);
 clock+=30001;fail=false;assert.equal((await load()).unavailable,undefined);assert.equal(calls,3);
});
test('cold catalog failure and malformed manifests safely omit auto art without affecting explicit choices',async()=>{
 for(const fetcher of [async()=>{throw Error('Offline');},async()=>new Response('',{status:503}),async()=>Response.json({folder:'elsewhere',files:['fw26-11-01.png']})]){
  const result=await createCatalogLoader(fetcher)();assert.equal(result.unavailable,true);assert.deepEqual(result.posters,[]);assert.equal(eventPoster({date:'2026-11-01'},result.posters),null);assert.equal(eventPoster({poster:'fw26-11-01.png'},result.posters).file,'fw26-11-01.png');
 }
});
test('resolving gallery art changes no event state, responses or queue metadata',()=>{
 const state={revision:4,updatedAt:'2026-10-31T12:00:00Z',players:[{slug:'bostnmike',name:'BostnMike'},{slug:'guest',name:'Guest'}],events:[{id:'unchanged',capacity:1,open:true,metadata:{title:'Sunday',slot:'sunday',date:'2026-11-01'},responses:{bostnmike:{answer:'yes',order:0},guest:{answer:'yes',order:1}}}]};
 const before=JSON.stringify(state),feed=publicFeed(state,new Date(),catalog);assert.equal(feed.events[0].poster.file,'fw26-11-01.png');assert.equal(feed.events[0].waitlist[0].slug,'guest');assert.equal(playerView(state,'guest',catalog).events[0].poster.file,'fw26-11-01.png');assert.equal(JSON.stringify(state),before);
});
