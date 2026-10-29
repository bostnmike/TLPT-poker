import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {initNotifications,notificationSupport,initNotificationBadge} from '../public/notifications.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({permission='default',ios=false,installed=false,stored=false,commish=false}={}){
 const events={},posts=[],elements=Object.fromEntries(['notifications','enable-notifications','disable-notifications','notification-status','commish-notifications','enable-commish-notifications','disable-commish-notifications','commish-notification-status'].map(id=>[id,{hidden:false,disabled:false,textContent:'',addEventListener(t,fn){this[t]=fn;}}]));
 let asks=0,enabled=stored?(commish?'@commish':'red'):'',subscription={async unsubscribe(){},toJSON(){return {endpoint:'https://fcm.googleapis.com/fake',keys:{}};}};
 const storage=new Map(stored?[[commish?'tlpt-rsvp-commish-notifications':'tlpt-rsvp-notifications','a'.repeat(64)]]:[]),doc={querySelector:s=>elements[s.slice(1)]||null,addEventListener(t,fn){events[t]=fn;}};
 const win={crypto,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},navigator:{userAgent:ios?'iPhone':'Android',standalone:installed,serviceWorker:{ready:Promise.resolve(),async register(){return {pushManager:{async getSubscription(){return subscription;},async subscribe(){return subscription;}}};}}},matchMedia:()=>({matches:installed}),PushManager:function(){},Notification:{permission,async requestPermission(){asks++;this.permission=permission==='denied'?'denied':'granted';return this.permission;}},async fetch(url,options){if(url.endsWith('/config'))return Response.json({available:true,publicKey:btoa('publickey')});const b=JSON.parse(options.body);posts.push({...b,path:url});if(b.action==='enable')enabled=b.slug;if(b.action==='disable')enabled='';return Response.json({enabled:!!enabled,slug:enabled||null});}};
 const controller=initNotifications(win,doc,commish),choose=(slug,name=slug)=>events['tlpt-player-change']({detail:{slug,name}});
 return {win,doc,elements,posts,controller,choose,commishView:(preview=false,signedIn=true)=>events['tlpt-player-change']({detail:{commish:signedIn,preview,slug:'',name:''}}),asks:()=>asks};
}
test('notification permission is requested only on a player tap; denied and iPhone-install states stay clear',async()=>{
 const f=fixture();f.choose('red','Red');await tick();assert.equal(f.asks(),0);assert.equal(f.elements['enable-notifications'].disabled,false);
 await f.elements['enable-notifications'].click();assert.equal(f.asks(),1);assert.equal(f.posts.at(-1).action,'enable');assert.match(f.elements['notification-status'].textContent,/Notifications on for Red/);
 const denied=fixture({permission:'denied'});denied.choose('red');await tick();assert.equal(denied.asks(),0);assert.equal(denied.elements['enable-notifications'].disabled,true);assert.match(denied.elements['notification-status'].textContent,/blocked/);
 const ios=fixture({ios:true});ios.choose('red');await tick();assert.match(ios.elements['notification-status'].textContent,/Home Screen/);assert.equal(ios.elements['enable-notifications'].disabled,true);assert.equal(notificationSupport(fixture({ios:true,installed:true}).win),'supported');
});
test('switching player names pauses the old subscription and requires an explicit opt-in for the new player',async()=>{
 const f=fixture({permission:'granted',stored:true});f.choose('red','Red');await f.controller.sync();await tick();assert.match(f.elements['notification-status'].textContent,/Notifications on for Red/);
 f.choose('ahmed','Ahmed');await f.controller.sync();assert.equal(f.posts.at(-1).action,'status');assert.ok(f.posts.some(p=>p.action==='disable'));assert.match(f.elements['notification-status'].textContent,/Enable them for Ahmed/);assert.equal(f.elements['enable-notifications'].hidden,false);
 await f.elements['enable-notifications'].click();assert.equal(f.posts.at(-1).slug,'ahmed');assert.match(f.elements['notification-status'].textContent,/Notifications on for Ahmed/);
 await f.elements['disable-notifications'].click();assert.equal(f.posts.at(-1).action,'disable');assert.match(f.elements['notification-status'].textContent,/off on this device/);
});
test('notifications never display in Commish/preview or before choosing a player',async()=>{
 const f=fixture();await tick();assert.equal(f.elements.notifications.hidden,true);f.choose('red');await tick();assert.equal(f.elements.notifications.hidden,false);f.choose('');await tick();assert.equal(f.elements.notifications.hidden,true);
});
test('service-worker push displays a yellow-chip notification and opens only the player event page',async()=>{
 const handlers={},shown=[],opened=[],focused=[];let windows=[];
 const self={location:{origin:'https://rsvp.test'},addEventListener:(t,fn)=>handlers[t]=fn,registration:{async showNotification(...args){shown.push(args);}},clients:{async matchAll(){return windows;},async openWindow(url){opened.push(url);}}};
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,Response});
 let result;handlers.push({data:{json:()=>({title:'You’re In!',body:'Seat confirmed',url:'/?event=e1',tag:'seat:e1'})},waitUntil:p=>result=p});await result;
 assert.equal(shown[0][1].data.url,'/?event=e1');assert.match(shown[0][1].icon,/rsvp-icon-192/);
 handlers.notificationclick({notification:{data:{url:'/?event=e1'},close(){}},waitUntil:p=>result=p});await result;assert.equal(opened[0],'https://rsvp.test/?event=e1');
 windows=[{url:'https://rsvp.test/?commish=1',navigate(){assert.fail('do not navigate Commish');}},{url:'https://rsvp.test/',async navigate(url){focused.push(url);},async focus(){focused.push('focus');}}];
 handlers.notificationclick({notification:{data:{url:'/?event=e2'},close(){}},waitUntil:p=>result=p});await result;assert.deepEqual(focused,['https://rsvp.test/?event=e2','focus']);
 handlers.push({data:{json:()=>({url:'https://evil.test/'})},waitUntil:p=>result=p});await result;assert.equal(shown.at(-1)[1].data.url,'/');
});

test('reopening the app preserves an enabled subscription while the player feed is still loading',async()=>{
 const f=fixture({permission:'granted',stored:true});await tick();assert.equal(f.posts.length,0);
 f.choose('red','Red');await f.controller.sync();assert.ok(!f.posts.some(p=>p.action==='disable'));assert.match(f.elements['notification-status'].textContent,/Notifications on for Red/);
});

test('Commish opt-in uses authenticated Commish settings and stays enabled while previewing players',async()=>{
 const f=fixture({commish:true});f.commishView();await tick();assert.equal(f.elements['commish-notifications'].hidden,false);assert.match(f.elements['enable-commish-notifications'].textContent,/Enable Commish/);assert.equal(f.asks(),0);
 await f.elements['enable-commish-notifications'].click();assert.equal(f.posts.at(-1).path,'/api/commish-notifications');assert.match(f.elements['commish-notification-status'].textContent,/Commish notifications are on/);
 f.commishView(true);await f.controller.sync();assert.equal(f.elements['commish-notifications'].hidden,true);assert.ok(!f.posts.some(p=>p.action==='disable'));
 f.commishView(false);assert.equal(f.elements['commish-notifications'].hidden,false);assert.match(f.elements['commish-notification-status'].textContent,/Commish notifications are on/);
 await f.elements['disable-commish-notifications'].click();assert.equal(f.posts.at(-1).action,'disable');
});
test('opening the public player app or an expired Commish entry never silently removes Commish alerts',async()=>{
 const f=fixture({commish:true,stored:true,permission:'granted'});f.commishView(false,false);await f.controller.sync();assert.equal(f.elements['commish-notifications'].hidden,true);assert.equal(f.posts.length,0);
 f.commishView();await f.controller.sync();assert.match(f.elements['commish-notification-status'].textContent,/Commish notifications are on/);assert.ok(!f.posts.some(p=>p.action==='disable'));
});
test('Commish notification clicks target a Commish window and leave player windows intact',async()=>{
 const handlers={},shown=[],navigated=[];const self={location:{origin:'https://rsvp.test'},addEventListener:(t,fn)=>handlers[t]=fn,registration:{async showNotification(...args){shown.push(args);}},clients:{async matchAll(){return [{url:'https://rsvp.test/',navigate(){assert.fail('do not navigate player');}},{url:'https://rsvp.test/?commish=1',async navigate(url){navigated.push(url);},async focus(){navigated.push('focus');}}];}}};
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,Response});let task;
 handlers.push({data:{json:()=>({kind:'response',title:'Red is In',url:'/?commish=1&event=e1'})},waitUntil:p=>task=p});await task;const data=shown[0][1].data;assert.equal(data.commish,true);assert.equal(data.url,'/?commish=1&event=e1');
 handlers.notificationclick({notification:{data,close(){}},waitUntil:p=>task=p});await task;assert.deepEqual(navigated,['https://rsvp.test/?commish=1&event=e1','focus']);
 handlers.push({data:{json:()=>({kind:'game-open',url:'/?commish=1&event=e1'})},waitUntil:p=>task=p});await task;assert.equal(shown.at(-1)[1].data.url,'/');
});

test('visiting Commish controls preserves a browser’s separate player notification subscription',async()=>{
 const f=fixture({stored:true,permission:'granted'});f.commishView();await f.controller.sync();assert.ok(!f.posts.some(p=>p.action==='disable'));assert.equal(f.elements.notifications.hidden,true);
 f.choose('red','Red');await f.controller.sync();assert.match(f.elements['notification-status'].textContent,/Notifications on for Red/);
});


test('received pushes set a numeric unread-activity badge compatible with iOS and notification clicks clear it without blocking unsupported or denied badge APIs',async()=>{
 for(const mode of ['supported','unsupported','throw','reject']){
  const handlers={},calls=[];let task;
  const self={location:{origin:'https://rsvp.test'},navigator:mode==='unsupported'?{}:{setAppBadge(count){assert.equal(count,1);calls.push('set');if(mode==='throw')throw Error('Blocked');if(mode==='reject')return Promise.reject(Error('Blocked'));},clearAppBadge(){calls.push('clear');if(mode==='throw')throw Error('Blocked');if(mode==='reject')return Promise.reject(Error('Blocked'));}},addEventListener:(type,fn)=>handlers[type]=fn,registration:{async showNotification(){calls.push('banner');}},clients:{async matchAll(){return [];},async openWindow(){calls.push('open');}}};
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,Response});
  handlers.push({data:{json:()=>({kind:'response',url:'/?commish=1&event=e1'})},waitUntil:p=>task=p});await task;
  assert.ok(calls.includes('banner'),mode);assert.equal(calls.includes('set'),mode!=='unsupported',mode);
  handlers.notificationclick({notification:{data:{commish:true,url:'/?commish=1&event=e1'},close(){}},waitUntil:p=>task=p});await task;
  assert.ok(calls.includes('open'),mode);assert.equal(calls.includes('clear'),mode!=='unsupported',mode);
 }
});
test('opening or returning to a visible app clears its badge; hidden apps and badge failures do not affect notifications',async()=>{
 for(const mode of ['supported','unsupported','throw','reject']){
  let clears=0;const handlers={},win={navigator:mode==='unsupported'?{}:{clearAppBadge(){clears++;if(mode==='throw')throw Error('Blocked');if(mode==='reject')return Promise.reject(Error('Blocked'));}}},doc={hidden:false,addEventListener:(type,fn)=>handlers[type]=fn};
  initNotificationBadge(win,doc);await tick();assert.equal(clears,mode==='unsupported'?0:1);
  doc.hidden=true;await handlers.visibilitychange();assert.equal(clears,mode==='unsupported'?0:1);
  doc.hidden=false;await handlers.visibilitychange();assert.equal(clears,mode==='unsupported'?0:2);
 }
});


function badgeWorker(records=new Map(),brokenStorage=false){
 const handlers={},badges=[],banners=[];
 const cache={async match(key){return records.has(key)?new Response(records.get(key)):undefined;},async put(key,response){if(brokenStorage==='write')throw Error('Quota');records.set(key,await response.text());}};
 const self={location:{origin:'https://rsvp.test'},navigator:{async setAppBadge(value){badges.push(value);},async clearAppBadge(){badges.push(0);}},caches:{async open(){if(brokenStorage===true)throw Error('Storage blocked');return cache;}},addEventListener:(type,fn)=>handlers[type]=fn,registration:{async showNotification(title){banners.push(title);}},clients:{async matchAll(){return [];},async openWindow(){}}};
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,Response});
 function dispatch(type,data){let task;handlers[type]({...data,waitUntil:promise=>task=promise});return task;}
 return {records,badges,banners,push:id=>dispatch('push',{data:{json:()=>({notificationId:id,title:'Private notification text',url:'/?event=e1'})}}),clear:()=>dispatch('message',{data:{type:'tlpt-clear-unread'}})};
}
test('six overlapping notifications count to six, retries do not add duplicates, and unread counts survive worker restarts',async()=>{
 const first=badgeWorker();await Promise.all(Array.from({length:6},(_,i)=>first.push('delivery-'+i)));assert.deepEqual(first.badges,[1,2,3,4,5,6]);
 await first.push('delivery-5');assert.equal(first.badges.at(-1),6);
 const restarted=badgeWorker(first.records);await restarted.push('delivery-6');assert.equal(restarted.badges.at(-1),7);
 await restarted.clear();assert.equal(restarted.badges.at(-1),0);await restarted.push('delivery-6');assert.equal(restarted.badges.at(-1),0);
 await restarted.push('delivery-7');assert.equal(restarted.badges.at(-1),1);
 for(const stored of first.records.values())assert.ok(!stored.includes('Private notification text'));
 const legacy=badgeWorker();await legacy.push(undefined);for(const stored of legacy.records.values())assert.ok(!stored.includes('Private notification text'));
});
test('counts and resets are device-local, and unavailable storage cannot stop banners or in-memory counting',async()=>{
 const phone=badgeWorker(),mac=badgeWorker();await phone.push('first');await mac.push('first');await phone.push('second');
 assert.equal(phone.badges.at(-1),2);assert.equal(mac.badges.at(-1),1);await phone.clear();assert.equal(phone.badges.at(-1),0);assert.equal(mac.badges.at(-1),1);
 const blocked=badgeWorker(new Map(),true);await blocked.push('one');await blocked.push('two');assert.deepEqual(blocked.badges,[1,2]);assert.equal(blocked.banners.length,2);
 const initial=badgeWorker();await initial.clear();const writeBlocked=badgeWorker(initial.records,'write');await writeBlocked.push('one');await writeBlocked.push('two');assert.deepEqual(writeBlocked.badges,[1,2]);
});
test('opening the app tells its worker to reset the persistent counter only while visible',async()=>{
 const events={},messages=[],win={navigator:{async clearAppBadge(){},serviceWorker:{ready:Promise.resolve({active:{postMessage:message=>messages.push(message)}})}}},doc={hidden:false,addEventListener:(type,fn)=>events[type]=fn};
 initNotificationBadge(win,doc);await tick();assert.deepEqual(messages,[{type:'tlpt-clear-unread'}]);
 doc.hidden=true;await events.visibilitychange();assert.equal(messages.length,1);
 doc.hidden=false;await events.visibilitychange();assert.equal(messages.length,2);
});
