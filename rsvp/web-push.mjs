// RFC 8291 (aes128gcm) and RFC 8292 (VAPID), using Workers' native Web Crypto.
const utf8=new TextEncoder();
export const b64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export const unbase64=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const concat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;};
export function vapidPublicKey(jwk){return b64url(concat(new Uint8Array([4]),unbase64(jwk.x),unbase64(jwk.y)));}
async function hkdf(secret,salt,info,bits){const key=await crypto.subtle.importKey('raw',secret,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,bits));}
export function validPushEndpoint(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.href.length<=2048&&(
  u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));
 }catch{return false;}
}
export async function validateSubscription(raw){
 if(!raw||!validPushEndpoint(raw.endpoint)||typeof raw.keys?.p256dh!=='string'||typeof raw.keys?.auth!=='string')return null;
 try{if(!/^[A-Za-z0-9_-]+$/.test(raw.keys.p256dh)||!/^[A-Za-z0-9_-]+$/.test(raw.keys.auth))return null;const pub=unbase64(raw.keys.p256dh),auth=unbase64(raw.keys.auth);if(pub.length!==65||pub[0]!==4||auth.length!==16)return null;await crypto.subtle.importKey('raw',pub,{name:'ECDH',namedCurve:'P-256'},false,[]);return {endpoint:raw.endpoint,keys:{p256dh:raw.keys.p256dh,auth:raw.keys.auth}};}catch{return null;}
}
export async function deriveWebPushKeys(shared,auth,salt,receiver,sender){
 const ikm=await hkdf(shared,auth,concat(utf8.encode('WebPush: info\0'),receiver,sender),256);
 return {cek:await hkdf(ikm,salt,utf8.encode('Content-Encoding: aes128gcm\0'),128),nonce:await hkdf(ikm,salt,utf8.encode('Content-Encoding: nonce\0'),96)};
}
export async function encryptedPush(subscription,payload,jwk,now=Date.now()){
 const receiver=unbase64(subscription.keys.p256dh),auth=unbase64(subscription.keys.auth),salt=crypto.getRandomValues(new Uint8Array(16));
 const ephemeral=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const sender=new Uint8Array(await crypto.subtle.exportKey('raw',ephemeral.publicKey));
 const receiverKey=await crypto.subtle.importKey('raw',receiver,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=await crypto.subtle.deriveBits({name:'ECDH',public:receiverKey},ephemeral.privateKey,256);
 const {cek,nonce}=await deriveWebPushKeys(shared,auth,salt,receiver,sender);
 const plaintext=concat(utf8.encode(JSON.stringify(payload)),new Uint8Array([2]));if(plaintext.length>3500)throw Error('Push payload too large');
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,plaintext));
 const recordSize=new Uint8Array(4);new DataView(recordSize.buffer).setUint32(0,4096);
 const tokenHeader=b64url(utf8.encode(JSON.stringify({typ:'JWT',alg:'ES256'}))),claims=b64url(utf8.encode(JSON.stringify({aud:new URL(subscription.endpoint).origin,exp:Math.floor(now/1000)+3600,sub:'https://tlpt.org'})));
 const unsigned=tokenHeader+'.'+claims,signingKey=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},signingKey,utf8.encode(unsigned));
 return {method:'POST',headers:{Authorization:`vapid t=${unsigned}.${b64url(signature)}, k=${vapidPublicKey(jwk)}`,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'3600',Urgency:'normal'},body:concat(salt,recordSize,new Uint8Array([65]),sender,ciphertext),redirect:'error',signal:AbortSignal.timeout(10000)};
}
