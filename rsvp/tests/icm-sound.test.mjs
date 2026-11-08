import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createIcmSound} from '../public/icm-sound.mjs';

function fixture() {
  const sources = [], messages = [];
  let loads = 0;
  const context = {state:'running',sampleRate:44100,destination:{},resume:async()=>{},close:async()=>{},createBuffer:()=>({silent:true}),decodeAudioData:async()=>({clip:true}),createBufferSource(){
    const source = {connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};
    sources.push(source);return source;
  }};
  const sound = createIcmSound({createContext:()=>context,fetchAudio:async()=>{loads++;return new ArrayBuffer(8);},onStatus:text=>messages.push(text)});
  return {sound,sources,messages,context,get loads(){return loads;}};
}
test('preparing audio unlocks silently; only calculation/replay plays the clip and loading is reused', async () => {
  const f = fixture();f.sound.prepare();
  assert.equal(f.sources.filter(source=>source.buffer?.clip).length,0);
  assert.equal(await f.sound.play(),true);
  assert.equal(f.sources.filter(source=>source.buffer?.clip&&source.started).length,1);
  assert.equal(await f.sound.play(),true);assert.equal(f.loads,1);
  const clips=f.sources.filter(source=>source.buffer?.clip);assert.equal(clips[0].stopped,true);assert.equal(clips[1].started,true);
  f.sound.dispose();assert.equal(await f.sound.play(),false);
});
test('blocked or unavailable sound returns a recoverable status instead of failing the calculator', async () => {
  const f=fixture();f.context.state='suspended';assert.equal(await f.sound.play(),false);assert.match(f.messages.at(-1),/Replay sound/);
  f.context.state='running';assert.equal(await f.sound.play(),true);
  const missing=createIcmSound({createContext:()=>{throw Error('No audio');}});assert.doesNotThrow(()=>missing.prepare());assert.equal(await missing.play(),false);
});
test('an audio download failure can be retried without using a broken cached buffer', async () => {
  const f=fixture();let attempts=0;
  const sound=createIcmSound({createContext:()=>f.context,fetchAudio:async()=>{if(++attempts===1)throw Error('Offline');return new ArrayBuffer(8);}});
  assert.equal(await sound.play(),false);assert.equal(await sound.play(),true);assert.equal(attempts,2);
});
