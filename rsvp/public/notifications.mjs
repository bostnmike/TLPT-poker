import {installationPlatform,standalone} from './install.mjs?v=20261025-1';
export function notificationSupport(win){
 if(installationPlatform(win.navigator)==='ios'&&!standalone(win))return 'install';
 return 'Notification' in win&&'PushManager' in win&&'serviceWorker' in win.navigator?'supported':'unsupported';
}
export function initNotifications(win,doc){
 const panel=doc.querySelector('#notifications'),enable=doc.querySelector('#enable-notifications'),disable=doc.querySelector('#disable-notifications'),status=doc.querySelector('#notification-status');
 let player={slug:'',name:''},playerReady=false,enabledSlug='',config=null,working=false,message='',chain=Promise.resolve();
 const support=notificationSupport(win),storageKey='tlpt-rsvp-notifications';let token='';
 try{token=win.localStorage.getItem(storageKey)||'';}catch{}
 function deviceToken(){if(!/^[a-f0-9]{64}$/.test(token)){token=Array.from(win.crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');win.localStorage.setItem(storageKey,token);}return token;}
 async function request(data){const r=await win.fetch('/api/notifications',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,token:deviceToken()})});const b=await r.json();if(!r.ok)throw Error(b.error||'Notifications could not be saved. Try again.');return b;}
 function render(){
  panel.hidden=!player.slug;if(panel.hidden)return;
  const on=enabledSlug===player.slug&&win.Notification?.permission==='granted';
  enable.hidden=on;disable.hidden=!enabledSlug;enable.disabled=working||support!=='supported'||!config?.available||win.Notification?.permission==='denied';disable.disabled=working;
  enable.textContent=working?'Saving…':'Enable notifications';
  status.textContent=message||(support==='install'?'On iPhone or iPad, add TLPT RSVP to your Home Screen, open its icon, then enable notifications here.':support==='unsupported'?'This browser doesn’t support notifications. Try the app in an up-to-date supported browser.':win.Notification.permission==='denied'?'Notifications are blocked. Allow them in your phone or browser settings, then reopen this app.':on?`Notifications on for ${player.name}. New games and your confirmed seat — that’s it.`:!config?'Checking notifications…':!config.available?'Notifications are temporarily unavailable. Your RSVP still works.':`Optional alerts for ${player.name}. Tap Enable, then Allow on your phone.`);
 }
 async function sync(){
  if(!playerReady||!token||support!=='supported'){render();return;}
  try{const saved=await request({action:'status'});enabledSlug=saved.enabled?saved.slug:'';
   // A device belongs to the selected name only. Changing names pauses alerts;
   // it never silently signs the next person up using an old permission grant.
   if(enabledSlug&&(enabledSlug!==player.slug||win.Notification.permission!=='granted')){await request({action:'disable'});enabledSlug='';message=player.slug?'Notifications paused. Enable them for '+player.name+'.':'';}
  }catch{message='Couldn’t check notification settings. Try again when connected.';}render();
 }
 function queueSync(){chain=chain.then(sync,sync);return chain;}
 doc.addEventListener('tlpt-player-change',event=>{const next=event.detail;playerReady=true;if(next.slug===player.slug){player=next;render();return;}player=next;message='';queueSync();render();});
 enable.addEventListener('click',async()=>{
  if(working||!player.slug||support!=='supported'||!config?.available)return;
  const selected={...player};working=true;message='';render();
  // Request permission directly from this tap, before any network/worker await.
  let permission;try{permission=win.Notification.requestPermission();}catch{working=false;message='Allow notifications in your phone or browser settings, then try again.';render();return;}
  const task=(async()=>{try{
   if(await permission!=='granted'){message='Notifications are off. Your RSVP still works.';return;}
   await chain;
   const registration=await win.navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});await win.navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(subscription&&!/^[a-f0-9]{64}$/.test(token)){await subscription.unsubscribe();subscription=null;}
   if(!subscription){const raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),key=Uint8Array.from(raw,c=>c.charCodeAt(0));subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});}
   if(player.slug!==selected.slug)return;
   await request({action:'enable',slug:selected.slug,subscription:subscription.toJSON()});enabledSlug=selected.slug;
   if(player.slug!==selected.slug){await request({action:'disable'});enabledSlug='';}
  }catch{message='Couldn’t enable notifications. Check your connection and phone settings, then try again. Your RSVP still works.';}
  finally{working=false;render();}})();
  await task;
 });
 disable.addEventListener('click',async()=>{if(working)return;working=true;render();try{await chain;await request({action:'disable'});enabledSlug='';message='Notifications are off on this device. Your RSVP still works.';}catch{message='Couldn’t turn notifications off. Check your connection and try again.';}finally{working=false;render();}});
 const picker=doc.querySelector('#shared-player');if(picker){playerReady=true;player={slug:picker.value,name:picker.selectedOptions?.[0]?.textContent||''};}
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)queueSync();});
 win.fetch('/api/notifications/config',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(c=>{config=c;render();}).catch(()=>{config={available:false};render();});
 queueSync();render();
 return {sync:queueSync};
}
if(typeof window!=='undefined')initNotifications(window,document);
