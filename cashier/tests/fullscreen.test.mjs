import {test} from 'node:test';import assert from 'node:assert/strict';
import {pageIsFullscreen,togglePageFullscreen,registerViewKey} from '../lib/fullscreen.mjs';
test('fullscreen enters the page, reflects a browser exit, and uses the matching exit method',async()=>{
 const doc={fullscreenEnabled:true,fullscreenElement:null,documentElement:{async requestFullscreen(){doc.fullscreenElement=this;}},async exitFullscreen(){doc.fullscreenElement=null;}};
 assert.equal(await togglePageFullscreen(doc),'entered');assert.equal(pageIsFullscreen(doc),true);
 assert.equal(await togglePageFullscreen(doc),'exited');assert.equal(pageIsFullscreen(doc),false);
});
test('iPad legacy fullscreen works and unsupported or denied fullscreen can show Home Screen instructions',async()=>{
 const doc={webkitFullscreenEnabled:true,webkitFullscreenElement:null,documentElement:{async webkitRequestFullscreen(){doc.webkitFullscreenElement=this;}},async webkitExitFullscreen(){doc.webkitFullscreenElement=null;}};
 assert.equal(await togglePageFullscreen(doc),'entered');assert.equal(await togglePageFullscreen(doc),'exited');
 assert.equal(await togglePageFullscreen({fullscreenEnabled:false,documentElement:{requestFullscreen(){throw Error('must not call');}}}),'unavailable');
 await assert.rejects(()=>togglePageFullscreen({documentElement:{requestFullscreen(){throw Error('denied');}}}),/denied/);
});
test('background-only poll timestamps keep the same view; new payments, heartbeat, or prices update it',()=>{
 const data={serverAt:'one',scheduleCheckedAt:'one',events:[{id:'mtt',rules:{entry:5000}}],payments:[],sync:{last_check:'one'}};
 const newer={...data,serverAt:'two',scheduleCheckedAt:'two'};assert.equal(registerViewKey(data),registerViewKey(newer));
 for(const changed of [{...newer,payments:[{id:'new-receipt',status:'review'}]},{...newer,sync:{last_check:'two'}},{...newer,events:[{id:'mtt',rules:{entry:3500}}]}])assert.notEqual(registerViewKey(data),registerViewKey(changed));
});
