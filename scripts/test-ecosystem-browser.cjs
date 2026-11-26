const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8767';
const out=process.env.ECOSYSTEM_REVIEW_DIR;
async function bounds(page){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal page overflow');
 const state=await page.locator('#map').evaluate(map=>{
  const outer=map.getBoundingClientRect(), buttons=[...map.querySelectorAll('.map-node')].map(b=>({id:b.dataset.id,r:b.getBoundingClientRect()}));
  return {layout:map.dataset.layout,inside:buttons.every(({r})=>r.left>=outer.left&&r.right<=outer.right+1&&r.top>=outer.top&&r.bottom<=outer.bottom+1),collisions:buttons.some((a,i)=>buttons.slice(i+1).some(b=>a.r.left<b.r.right-1&&a.r.right>b.r.left+1&&a.r.top<b.r.bottom-1&&a.r.bottom>b.r.top+1)),rows:[...map.querySelectorAll('.map-node:not(.hub)')].every(b=>{const markers=b.querySelector('.node-badges').getBoundingClientRect(),art=b.querySelector('.node-art').getBoundingClientRect(),name=b.querySelector('.name').getBoundingClientRect();return markers.bottom<=art.top+1&&art.bottom<=name.top+1;})};
 });
 assert.ok(['graph','cards'].includes(state.layout));assert.equal(state.inside,true,'All stations stay in map');assert.equal(state.collisions,false,'Station cards never overlap');assert.equal(state.rows,true,'Numbered marker row stays separate from artwork and labels');return state.layout;
}
(async()=>{
 const browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true});
 try{
  for(const width of [1440,820,390,320]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
   const errors=[],operational=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/workers[.]dev|\/api\//.test(r.url()))operational.push(r.url());});
   await page.goto(base+'/ecosystem.html');await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(()=>document.querySelectorAll('.map-node').length===9&&document.querySelector('#map').dataset.layout);
   assert.equal(await page.locator('h1').innerText(),'Behind the Cards');assert.equal(await page.locator('.nav a[href$="ecosystem.html"]').count(),0);assert.equal(await page.locator('.nav [aria-current="page"]').count(),0);
   assert.equal(await page.locator('.journey-marker').count(),0);assert.equal(await page.locator('#play').isDisabled(),true);
   const data=await page.locator('#ecosystem-data').evaluate(el=>JSON.parse(el.textContent));
   const edges=new Map(data.edges.map(e=>[e.id,e]));
   const layout=await bounds(page);
   if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:out+'/overview-'+width+'.png',fullPage:true});}
   const choose=async id=>{await page.locator('#journey-picker-trigger').click();await page.locator('#journey-picker-menu [data-value="'+id+'"]').click();};
   for(const j of data.journeys){
    await choose(j.id);
    await page.waitForTimeout(100);await bounds(page);
    assert.equal(await page.locator('.journey-marker').count(),j.steps.length);assert.equal(await page.locator('.journey-marker.is-current').count(),0);
    assert.equal(await page.locator('#step-count').innerText(),'0 / '+j.steps.length);
    for(let i=0;i<j.steps.length;i++){
     await page.locator('#next').click();
     assert.equal(await page.locator('#step-count').innerText(),(i+1)+' / '+j.steps.length);
     assert.equal(await page.locator('.journey-marker.is-current').count(),1);
     const step=j.steps[i],station=step.nodeId||edges.get(step.edgeId).to;
     assert.equal(await page.locator('.map-node[data-id="'+station+'"] .journey-marker.is-current').innerText(),String(i+1));
     assert.equal(await page.locator('.journey-step[aria-current="step"] .ordinal').innerText(),String(i+1));
    }
    assert.equal(await page.locator('#next').isDisabled(),true);
    if(j.id==='seats')assert.equal(await page.locator('.map-node[data-id="rsvp"] .journey-marker').count(),2,'Repeated station visits keep both step numbers');
   }
   await choose('join');await page.getByRole('button',{name:'Play journey',exact:true}).click();
   assert.equal(await page.locator('#step-count').innerText(),'1 / 6');await page.getByRole('button',{name:'Pause',exact:true}).click();
   const paused=await page.locator('#step-count').innerText();await page.waitForTimeout(2850);assert.equal(await page.locator('#step-count').innerText(),paused,'Pause stops progression');assert.equal(await page.locator('#packet.visible').count(),0,'Reduced motion suppresses moving packets');
   await page.locator('#next').click();await page.locator('#previous').click();assert.equal(await page.locator('#step-count').innerText(),'1 / 6');
   await page.locator('.journey-step[data-step="2"]').click();assert.equal(await page.locator('#step-count').innerText(),'3 / 6');assert.equal(await page.locator('.journey-marker.is-current').innerText(),'3');
   if(out){await page.locator('#main-content').screenshot({path:out+'/journey-'+width+'.png'});}
   await page.keyboard.press('Escape');assert.equal(await page.locator('.journey-marker').count(),0);assert.equal(await page.locator('#journey-picker').inputValue(),'overview');
   await page.locator('.map-node[data-id="registration"]').click();assert.equal(await page.locator('#inspector h2').innerText(),data.nodes.find(n=>n.id==='registration').title);assert.equal(await page.locator('.journey-marker').count(),0);await page.locator('#full-map').click();
   await page.locator('#journey-picker-trigger').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.notEqual(await page.locator('#journey-picker').inputValue(),'overview');await page.keyboard.press('Escape');
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.waitForTimeout(200);await bounds(page);
   assert.deepEqual(errors,[]);assert.deepEqual(operational,[]);console.log('PASS Behind the Cards '+width+'px '+layout+': all '+data.journeys.reduce((n,j)=>n+j.steps.length,0)+' steps, markers, playback/pause, reset, keyboard, large text and no operational requests');await page.close();
  }
  // Root-absolute recovery link remains valid even for a missing nested URL.
  const page=await browser.newPage();await page.route('**/missing/nested/page',async route=>{const response=await page.request.get(base+'/404.html');await route.fulfill({response});});
  await page.goto(base+'/missing/nested/page');await page.getByRole('link',{name:'BostnMike Production',exact:true}).click();assert.equal(new URL(page.url()).pathname,'/ecosystem.html');await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
