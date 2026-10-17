export const CONFIRMATION_AUDIO='/audio/payment-confirmed.m4a';
const soundError='Sound could not play. Tap Test sound and check the iPad volume.';

// The cashier's tap unlocks audio before the save request; only a successful
// new payment or completed batch plays the clip once. Polling and individual
// receipt links/corrections stay quiet; a batch uses its one request identity.
export function createPaymentSound({createContext,fetchAudio=async()=>{
 const response=await fetch(CONFIRMATION_AUDIO);if(!response.ok)throw Error('Audio unavailable');return response.arrayBuffer();
},onError=(_message)=>{},onPlaying=(_playing)=>{}}){
 let context=null,bufferPromise=null,enabled=true,disposed=false,current=null;
 const played=new Set();
 const getContext=()=>{if(disposed)throw Error('Audio closed');return context||(context=createContext());};
 const buffer=c=>bufferPromise||(bufferPromise=Promise.resolve().then(fetchAudio).then(bytes=>c.decodeAudioData(bytes)).catch(error=>{bufferPromise=null;throw error;}));
 function stop(){const source=current;current=null;if(source){try{source.stop();source.disconnect();}catch{}}}
 function prepare(){
  if(!enabled||disposed)return;
  try{
   const c=getContext();void c.resume().catch(()=>{});
   // An inaudible source started within the tap also unlocks older iPad Safari.
   const silent=c.createBufferSource();silent.buffer=c.createBuffer(1,1,c.sampleRate);silent.connect(c.destination);silent.onended=()=>silent.disconnect();silent.start();
   void buffer(c).catch(()=>{});
  }catch{}
 }
 async function play(key){
  if(!enabled||disposed||(key&&played.has(key)))return false;
  if(key)played.add(key);
  try{
   const c=getContext();await c.resume();const decoded=await buffer(c);
   if(!enabled||disposed)return false;if(c.state!=='running')throw Error('Audio blocked');
   stop();const source=c.createBufferSource();source.buffer=decoded;source.connect(c.destination);
   source.onended=()=>{source.disconnect();if(current===source){current=null;if(!disposed)onPlaying(false);}};
   current=source;source.start();onError('');onPlaying(true);return true;
  }catch{if(!disposed){onPlaying(false);onError(soundError);}return false;}
 }
 return {
  prepare,
  confirmed(action,id){return ['manual','confirm','batch'].includes(action)&&id?play(`${action}:${id}`):Promise.resolve(false);},
  test(){prepare();return play(null);},
  setEnabled(value){enabled=!!value;if(!enabled){stop();onPlaying(false);onError('');}},
  dispose(){disposed=true;stop();if(context)void context.close().catch(()=>{});played.clear();}
 };
}
