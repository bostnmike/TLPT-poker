// Network only: no RSVP, identity, credential, or admin response is cached.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).catch(()=>new Response(
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TLPT RSVP — reconnect</title><h1>You’re offline.</h1><p>Reconnect to see the live lineup and save your RSVP.</p><p>No response was sent.</p><p><a href="/">Try again</a></p></html>',
  {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}}
 )));
});

function notificationTarget(value,commish){
 try{const target=new URL(value,self.location.origin);if(target.origin===self.location.origin&&target.pathname==='/'&&(!target.searchParams.has('commish')||commish&&target.searchParams.get('commish')==='1'))return target.pathname+target.search;}catch{}
 return '/';
}
// Only an unread count and opaque delivery IDs are stored here, never RSVPs,
// identities, credentials or notification text. The queue serializes overlapping
// pushes and app openings; the recent IDs prevent retry double-counting.
const badgeCacheName='tlpt-rsvp-unread-v1',badgeCacheURL=new URL('/__tlpt-unread',self.location.origin).href;
let badgeState={count:0,seen:[]},badgeQueue=Promise.resolve(),badgeStorageAvailable=true;
function appBadge(id=null){
 const task=badgeQueue.then(async()=>{
  let cache;
  if(badgeStorageAvailable)try{cache=await self.caches?.open(badgeCacheName);const response=await cache?.match(badgeCacheURL);if(response){const saved=await response.json();if(Number.isSafeInteger(saved.count)&&saved.count>=0&&Array.isArray(saved.seen))badgeState={count:saved.count,seen:saved.seen.filter(value=>typeof value==='string').slice(-512)};}}catch{badgeStorageAvailable=false;cache=undefined;/* Keep the in-memory count if storage is unavailable. */}
  if(id){if(!badgeState.seen.includes(id)){badgeState.count++;badgeState.seen.push(id);badgeState.seen=badgeState.seen.slice(-512);}}
  else badgeState.count=0;
  try{await cache?.put(badgeCacheURL,new Response(JSON.stringify(badgeState),{headers:{'Content-Type':'application/json'}}));}catch{badgeStorageAvailable=false;/* Do not reload stale stored counts after a failed write. */}
  try{if(badgeState.count)await self.navigator?.setAppBadge?.(badgeState.count);else await self.navigator?.clearAppBadge?.();}catch{/* Badge support is optional; banners and clicks still work. */}
 });
 badgeQueue=task.catch(()=>{});return badgeQueue;
}
self.addEventListener('message',event=>{if(event.data?.type==='tlpt-clear-unread')event.waitUntil(appBadge());});
self.addEventListener('push',event=>{
 let payload;try{payload=event.data.json();}catch{payload={};}
 const commish=payload.kind==='response',url=notificationTarget(payload.url,commish);
 event.waitUntil(Promise.all([appBadge(typeof payload.notificationId==='string'?payload.notificationId:String(payload.tag||[payload.kind,payload.eventId,payload.title,payload.body].join(':'))),self.registration.showNotification(String(payload.title||'TLPT RSVP').slice(0,150),{
  body:String(payload.body||'Open TLPT RSVP to check the live lineup.').slice(0,700),
  icon:'/rsvp-icon-192.png?v=20261026-2',tag:String(payload.tag||'tlpt-rsvp').slice(0,180),data:{url,commish}
 })]));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(notificationTarget(event.notification.data?.url,event.notification.data?.commish===true),self.location.origin),commish=url.searchParams.has('commish');
 event.waitUntil(Promise.all([appBadge(),(async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>{const u=new URL(client.url);return u.origin===url.origin&&u.pathname==='/'&&u.searchParams.has('commish')===commish;});
  if(existing){await existing.navigate(url.href);return existing.focus();}return self.clients.openWindow(url.href);
 })()]));
});
