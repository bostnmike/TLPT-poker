// Device-local troubleshooting: no subscription keys, private links or RSVP
// state are read or sent. Loading this page never clears the unread counter.
export function initNotificationCheck(win,doc){
 const out=id=>doc.querySelector('#'+id),test=out('check-test');
 async function refresh(){
  out('check-status').textContent='Checking this browser…';
  out('check-permission').textContent=win.Notification?.permission||'Not available';
  out('check-support').textContent=typeof win.navigator.setAppBadge==='function'?'Available':'Not available';
  test.disabled=typeof win.navigator.setAppBadge!=='function'||win.Notification?.permission!=='granted';
  try{
   let saved={count:0,seen:[]};
   if(await win.caches?.has('tlpt-rsvp-unread-v1')){const cache=await win.caches.open('tlpt-rsvp-unread-v1'),response=await cache.match(new URL('/__tlpt-unread',win.location.origin).href);if(response)saved=await response.json();}
   out('check-count').textContent=String(Number.isSafeInteger(saved.count)&&saved.count>=0?saved.count:0);
   out('check-deliveries').textContent=String(Array.isArray(saved.seen)?saved.seen.length:0);
   out('check-status').textContent='These values belong only to this browser. Opening the RSVP app clears its unread count; this check does not.';
  }catch{out('check-count').textContent='Unavailable';out('check-deliveries').textContent='Unavailable';out('check-status').textContent='This browser could not read its saved notification count.';}
 }
 out('check-refresh').addEventListener('click',refresh);
 test.addEventListener('click',async()=>{
  test.disabled=true;
  try{await win.navigator.setAppBadge(6);out('check-result').textContent='A test badge of 6 was requested. Check the yellow TLPT RSVP icon. This does not change the saved unread count.';}
  catch{out('check-result').textContent='This browser could not show the test badge.';}
  finally{test.disabled=typeof win.navigator.setAppBadge!=='function'||win.Notification?.permission!=='granted';}
 });
 refresh();return {refresh};
}
if(typeof window!=='undefined')initNotificationCheck(window,document);
