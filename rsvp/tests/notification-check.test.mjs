import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initNotificationCheck} from '../public/notification-check.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({count=6,permission='granted',supported=true,blocked=false}={}){
 const elements=Object.fromEntries(['check-count','check-deliveries','check-permission','check-support','check-status','check-result','check-refresh','check-test'].map(id=>[id,{textContent:'',disabled:false,addEventListener:(type,fn)=>elements[id][type]=fn}])),calls=[];
 const win={location:{origin:'https://rsvp.test'},Notification:{permission},navigator:{...(supported?{async setAppBadge(value){calls.push(value);if(blocked)throw Error('Blocked');}}:{}),async clearAppBadge(){assert.fail('loading the check must not clear badges');}},caches:{async has(){return true;},async open(name){assert.equal(name,'tlpt-rsvp-unread-v1');return {async match(url){assert.equal(url,'https://rsvp.test/__tlpt-unread');return Response.json({count,seen:['opaque-a','opaque-b']});}};}}};
 return {elements,calls,controller:initNotificationCheck(win,{querySelector:selector=>elements[selector.slice(1)]})};
}
test('notification check reads only local count metadata and never clears or sets the badge on load',async()=>{
 const f=fixture();await f.controller.refresh();assert.equal(f.elements['check-count'].textContent,'6');assert.equal(f.elements['check-deliveries'].textContent,'2');assert.equal(f.elements['check-support'].textContent,'Available');assert.deepEqual(f.calls,[]);
 await f.elements['check-test'].click();assert.deepEqual(f.calls,[6]);assert.match(f.elements['check-result'].textContent,/does not change the saved unread count/);
});
test('notification check handles unsupported, denied and failing badge APIs without changing permissions',async()=>{
 for(const options of [{supported:false},{permission:'denied'}]){const f=fixture(options);await tick();assert.equal(f.elements['check-test'].disabled,true);assert.deepEqual(f.calls,[]);}
 const f=fixture({blocked:true});await f.controller.refresh();await f.elements['check-test'].click();assert.match(f.elements['check-result'].textContent,/could not show/);
});
