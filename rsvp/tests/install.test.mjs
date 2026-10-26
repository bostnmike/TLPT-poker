import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {installationPlatform,standalone,initInstallation} from '../public/install.mjs';

function fixture(){
 const listeners={},media={matches:false,addEventListener(type,fn){this.change=fn;}},registrations=[];
 const element=dataset=>({dataset,hidden:true,open:false,textContent:'',attrs:{},events:{},addEventListener(type,fn){this.events[type]=fn;},setAttribute(k,v){this.attrs[k]=v;},showModal(){this.open=true;}});
 const ids=Object.fromEntries(['install-banner','install-dialog','native-install','install-status','installation-help','add-to-home-screen'].map(id=>[id,element({})]));
 const buttons=['ios','android','desktop'].map(v=>element({installPlatform:v})),panels=['ios','android','desktop'].map(v=>element({installSteps:v}));
 const doc={querySelector:s=>ids[s.slice(1)],querySelectorAll:s=>s==='[data-install-platform]'?buttons:panels};
 const win={navigator:{userAgent:'Android',platform:'Linux',maxTouchPoints:0,serviceWorker:{register(...args){registrations.push(args);return Promise.resolve();}}},matchMedia:()=>media,addEventListener(type,fn){listeners[type]=fn;}};
 initInstallation(win,doc);return {win,ids,buttons,panels,listeners,media,registrations};
}
test('installation selects iPhone, touch-screen iPad and Android guidance and recognizes standalone launches',()=>{
 assert.equal(installationPlatform({userAgent:'iPhone',platform:'iPhone'}),'ios');
 assert.equal(installationPlatform({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}),'ios');
 assert.equal(installationPlatform({userAgent:'Android',platform:'Linux'}),'android');
 assert.equal(installationPlatform({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0}),'desktop');
 assert.equal(standalone({navigator:{standalone:true},matchMedia:()=>({matches:false})}),true);
 assert.equal(standalone({navigator:{},matchMedia:()=>({matches:true})}),true);
});
test('manual installation remains available without a browser prompt and users can choose another device',async()=>{
 const {ids,buttons,panels,registrations}=fixture();await ids['add-to-home-screen'].events.click();
 assert.equal(ids['install-dialog'].open,true);assert.equal(panels[1].hidden,false);assert.equal(ids['native-install'].hidden,true);
 buttons[0].events.click();assert.equal(panels[0].hidden,false);assert.equal(panels[1].hidden,true);assert.equal(buttons[0].attrs['aria-pressed'],'true');
 assert.deepEqual(registrations,[['/sw.js',{scope:'/',updateViaCache:'none'}]]);
});
test('native prompt is user-triggered, single-use and does not claim installation until appinstalled',async()=>{
 const {ids,listeners}=fixture();let prompts=0,prevented=false;
 listeners.beforeinstallprompt({preventDefault(){prevented=true;},async prompt(){prompts++;},userChoice:Promise.resolve({outcome:'accepted'})});
 assert.equal(prevented,true);assert.equal(prompts,0);assert.equal(ids['native-install'].hidden,false);
 await ids['add-to-home-screen'].events.click();assert.equal(prompts,1);assert.equal(ids['install-banner'].hidden,false);assert.match(ids['install-status'].textContent,/Finish adding/);
 await ids['add-to-home-screen'].events.click();assert.equal(prompts,1);
 listeners.appinstalled();assert.equal(ids['install-banner'].hidden,true);assert.equal(ids['installation-help'].hidden,true);
});
test('app manifest opens the public root and its icons have the advertised dimensions',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url)));
 assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.name,'TLPT RSVP');
 assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
 for(const icon of manifest.icons){const png=readFileSync(new URL('../public'+icon.src,import.meta.url));assert.equal(png.readUInt32BE(16),parseInt(icon.sizes));assert.equal(png.readUInt32BE(20),parseInt(icon.sizes));}
 const apple=readFileSync(new URL('../public/rsvp-icon-180.png',import.meta.url));assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
});
test('service worker leaves API writes alone, fetches navigation fresh and gives an explicit offline page',async()=>{
 const handlers={},seen=[];let offline=false;
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{URL,Response,self:{location:{origin:'https://rsvp.test'},addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},fetch:async request=>{seen.push(request.url);if(offline)throw Error('offline');return new Response('fresh live page');}});
 let response;
 handlers.fetch({request:{url:'https://rsvp.test/api/respond',mode:'cors',method:'POST'},respondWith(){assert.fail('API writes must bypass the service worker');}});
 const navigate=()=>handlers.fetch({request:{url:'https://rsvp.test/?commish=1',mode:'navigate'},respondWith(p){response=p;}});
 navigate();assert.equal(await (await response).text(),'fresh live page');navigate();assert.equal(await (await response).text(),'fresh live page');assert.equal(seen.length,2);
 offline=true;navigate();const fallback=await response;assert.equal(fallback.status,503);assert.equal(fallback.headers.get('Cache-Control'),'no-store');assert.match(await fallback.text(),/No response was sent/);
});
