import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPaymentSound,CONFIRMATION_AUDIO} from '../lib/payment-sound.mjs';
function fixture(options={}){
 const starts=[],errors=[],playing=[];
 const context={state:'suspended',sampleRate:48000,destination:{},resume:async()=>{context.state='running';},close:async()=>{context.state='closed';},createBuffer:()=>({silent:true}),decodeAudioData:async()=>({clip:true}),createBufferSource:()=>({connect(){},disconnect(){},stop(){this.stopped=true;},start(){starts.push(this);}})};
 const player=createPaymentSound({createContext:()=>context,fetchAudio:async()=>new ArrayBuffer(8),onError:e=>errors.push(e),onPlaying:p=>playing.push(p),...options});
 return {player,context,starts,errors,playing,audible:()=>starts.filter(source=>source.buffer.clip)};
}
test('gesture preparation is silent; a combined manual sale plays exactly once after success',async()=>{
 const f=fixture();f.player.prepare();assert.equal(f.audible().length,0);
 assert.deepEqual(await Promise.all([f.player.confirmed('manual','combined-request'),f.player.confirmed('manual','combined-request')]),[true,false]);
 assert.equal(f.audible().length,1);assert.equal(await f.player.confirmed('manual','combined-request'),false);
 assert.equal(await f.player.confirmed('confirm','receipt-65'),true);assert.equal(f.audible().length,2);
 assert.equal(f.audible()[0].stopped,true);f.audible()[1].onended();assert.equal(f.playing.at(-1),false);
});
test('links, voids, excluded receipts, and refreshes do not sound; a muted iPad stays quiet',async()=>{
 const f=fixture();for(const action of ['link','void','ignore','select','format','refresh'])assert.equal(await f.player.confirmed(action,'record'),false);
 assert.equal(await f.player.confirmed('confirm',''),false);f.player.setEnabled(false);f.player.prepare();assert.equal(await f.player.confirmed('manual','muted'),false);assert.equal(await f.player.test(),false);assert.equal(f.starts.length,0);
 f.player.setEnabled(true);assert.equal(await f.player.test(),true);assert.equal(f.audible().length,1);
 f.player.setEnabled(false);assert.equal(f.audible()[0].stopped,true);
});
test('a completed batch sounds once for the entire request, including duplicate acknowledgements and receipt-only batches',async()=>{
 const f=fixture();f.player.prepare();assert.equal(f.audible().length,0);
 // Five entries and three food contributions share one successful batch ID.
 assert.deepEqual(await Promise.all([f.player.confirmed('batch','five-players-three-food'),f.player.confirmed('batch','five-players-three-food')]),[true,false]);
 assert.equal(f.audible().length,1);
 assert.equal(await f.player.confirmed('batch','five-players-three-food'),false);
 assert.equal(await f.player.confirmed('batch','receipt-matches-only'),true);
 assert.equal(f.audible().length,2);
 f.player.setEnabled(false);assert.equal(await f.player.confirmed('batch','muted-batch'),false);
 assert.equal(f.audible().length,2);
});
test('unavailable audio reports a separate sound error and never throws a payment failure',async()=>{
 let unavailable=true;const f=fixture({fetchAudio:async()=>{if(unavailable)throw Error('offline');return new ArrayBuffer(8);}});
 f.player.prepare();assert.equal(await f.player.confirmed('manual','saved-payment'),false);assert.match(f.errors.at(-1),/Sound could not play/);
 unavailable=false;assert.equal(await f.player.test(),true);assert.equal(f.audible().length,1);assert.equal(f.errors.at(-1),'');
 f.player.dispose();assert.equal(f.context.state,'closed');assert.equal(await f.player.confirmed('confirm','later'),false);
 assert.equal(CONFIRMATION_AUDIO,'/audio/payment-confirmed.m4a');
});
