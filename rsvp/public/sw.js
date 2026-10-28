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

self.addEventListener('push',event=>{
 let payload;try{payload=event.data.json();}catch{payload={};}
 let url='/';try{const target=new URL(payload.url,self.location.origin);if(target.origin===self.location.origin&&target.pathname==='/'&&!target.searchParams.has('commish'))url=target.pathname+target.search;}catch{}
 event.waitUntil(self.registration.showNotification(String(payload.title||'TLPT RSVP').slice(0,150),{
  body:String(payload.body||'Open TLPT RSVP to check the live lineup.').slice(0,700),
  icon:'/rsvp-icon-192.png?v=20261026-2',tag:String(payload.tag||'tlpt-rsvp').slice(0,180),data:{url}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(event.notification.data?.url||'/',self.location.origin);
 if(url.origin!==self.location.origin||url.pathname!=='/'||url.searchParams.has('commish'))return;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>{const u=new URL(client.url);return u.origin===url.origin&&u.pathname==='/'&&!u.searchParams.has('commish');});
  if(existing){await existing.navigate(url.href);return existing.focus();}return self.clients.openWindow(url.href);
 })());
});
