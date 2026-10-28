import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {initNotifications,notificationSupport} from '../public/notifications.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({permission='default',ios=false,installed=false,stored=false}={}){
 const events={},posts=[],elements=Object.fromEntries(['notifications','enable-notifications','disable-notifications','notification-status'].map(id=>[id,{hidden:false,disabled:false,textContent:'',addEventListener(t,fn){this[t]=fn;}}]));
 let asks=0,enabled=stored?'red':'',subscription={async unsubscribe(){},toJSON(){return {endpoint:'https://fcm.googleapis.com/fake',keys:{}};}};
 const storage=new Map(stored?[['tlpt-rsvp-notifications','a'.repeat(64)]]:[]),doc={querySelector:s=>elements[s.slice(1)]||null,addEventListener(t,fn){events[t]=fn;}};
 const win={crypto,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},navigator:{userAgent:ios?'iPhone':'Android',standalone:installed,serviceWorker:{ready:Promise.resolve(),async register(){return {pushManager:{async getSubscription(){return subscription;},async subscribe(){return subscription;}}};}}},matchMedia:()=>({matches:installed}),PushManager:function(){},Notification:{permission,async requestPermission(){asks++;this.permission=permission==='denied'?'denied':'granted';return this.permission;}},async fetch(url,options){if(url.endsWith('/config'))return Response.json({available:true,publicKey:btoa('publickey')});const b=JSON.parse(options.body);posts.push(b);if(b.action==='enable')enabled=b.slug;if(b.action==='disable')enabled='';return Response.json({enabled:!!enabled,slug:enabled||null});}};
 const controller=initNotifications(win,doc),choose=(slug,name=slug)=>events['tlpt-player-change']({detail:{slug,name}});
 return {win,doc,elements,posts,controller,choose,asks:()=>asks};
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
