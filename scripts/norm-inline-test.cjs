const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const dashboard=[['results',40.91],['bankroll',41.95],['rates',43.55],['player-dna',47.96]];
const guides={standings:['standings',50.83],'form-lab':['form-lab',53.24],'player-movement':['heater-meter',52.85],streaks:['streaks',51.80],knockouts:['knockouts',50.44],bounties:['bounty-hunters',60.53],players:['meet-the-crew',52.35],player:['player-profile',58.51]};
module.exports=async function run(kind,base){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const isDashboard=kind==='dashboard',pages=isDashboard?['dashboard']:Object.keys(guides).filter(k=>k!=='bounties');
 const openSelector=isDashboard?'[data-dashboard-help-open]':'[data-stats-help-open]';
 const dialogSelector=isDashboard?'#dashboard-help':'#stats-help';
 try{
  for(const [width,height] of [[1440,1000],[820,1180],[390,844],[320,568],[844,390]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
   for(const name of pages){
    const requests=[],errors=[];const onRequest=r=>{if(r.url().includes('/media/norm-narrates/'))requests.push(r.url());};const onError=e=>errors.push(e.message);
    page.on('request',onRequest);page.on('pageerror',onError);
    await page.goto(base+'/'+name+'.html'+(name==='player'?'?name=Wild%20Bill':''));
    if(isDashboard)await page.locator('#dashboard-metric-select-trigger').waitFor();
    if(name==='knockouts')await page.locator('#knockouts-summary-grid > *').first().waitFor();
    const card=page.locator('.norm-page-guide'),audio=card.locator('audio'),opener=page.locator(openSelector),dialog=page.locator(dialogSelector);
    await audio.waitFor();assert.equal(requests.length,0,'Page load never fetches narration');
    const views=isDashboard?dashboard.map(x=>x[0]):name==='knockouts'?['knockouts','bounties']:[name];
    for(const [index,view] of views.entries()){
     if(isDashboard)await page.locator('[data-dashboard-category="'+view+'"]').click();
     if(name==='knockouts')await page.locator('[data-knockouts-view="'+view+'"]').click();
     const [file,duration]=isDashboard?['dashboard-'+view,dashboard.find(x=>x[0]===view)[1]]:guides[view];
     const src='media/norm-narrates/norm-'+file+'.mp3';
     await page.waitForFunction(src=>document.querySelector('.norm-page-guide audio').getAttribute('src')===src,src);
     assert.equal(await audio.evaluate(e=>e.paused),true,'Changing view stops the previous audio');
     assert.equal(await audio.getAttribute('preload'),'none');assert.equal(await audio.getAttribute('autoplay'),null);
     assert.equal(await page.locator('dialog audio').count(),0,'Audio belongs on the actual page');
     const portrait=card.locator('.norm-headshot');assert.equal(await portrait.evaluate(e=>e.complete&&e.naturalWidth>0),true);
     await page.waitForFunction(size=>Math.round(document.querySelector('.norm-page-guide .norm-headshot').getBoundingClientRect().width)===size,width<=600?80:96);
     assert.equal(Math.round((await portrait.boundingBox()).width),width<=600?80:96);
     const bounds=await card.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);assert.equal(await card.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
     const playerBounds=await audio.boundingBox(),link=await opener.boundingBox();assert.ok(link.x>=playerBounds.x+playerBounds.width-1,'Read-me remains beside the audio');assert.ok(Math.abs(link.y+link.height/2-playerBounds.y-playerBounds.height/2)<2,'Read-me shares the player row');assert.ok(link.height>=44);
     assert.equal(await card.locator('.norm-page-footer').count(),0,'No separate footer row');
     assert.ok(bounds.height<(width<=600?200:170),'Narration stays compact');
     const before=requests.length;await page.waitForTimeout(100);assert.equal(requests.length,before,'View switch does not prefetch');
     await audio.evaluate(async e=>{e.muted=true;await e.play();});await page.waitForFunction(()=>document.querySelector('.norm-page-guide audio').currentTime>.15);
     assert.ok(Math.abs(await audio.evaluate(e=>e.duration)-duration)<1,'Correct recording duration');
     const position=await audio.evaluate(e=>e.currentTime);
     await opener.click();await dialog.waitFor({state:'visible'});assert.equal(await audio.evaluate(e=>e.paused),true,'Written guide pauses narration');assert.ok(await audio.evaluate(e=>e.currentTime)>=position);
     assert.equal(await dialog.locator('audio').count(),0);assert.ok(await dialog.locator('h3').count()>=3);
     assert.equal(await dialog.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
     const d=await dialog.boundingBox();assert.ok(d.x>=0&&d.x+d.width<=width+1&&d.y+d.height<=height+1);
     assert.equal(await dialog.locator('button').first().evaluate(e=>e===document.activeElement),true);
     await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(e=>document.activeElement===document.body||e.contains(document.activeElement)),true);
     if(index%3===1)await dialog.locator('button').first().click();else if(index%3===2)await page.mouse.click(2,2);else await page.keyboard.press('Escape');
     assert.equal(await dialog.isVisible(),false);assert.equal(await opener.evaluate(e=>e===document.activeElement),true);assert.equal(await audio.evaluate(e=>e.paused),true,'Closing does not auto-resume');assert.equal(await audio.getAttribute('src'),src);
     await card.scrollIntoViewIfNeeded();if(width===390||width===1440)await page.screenshot({path:'/tmp/norm-inline-'+view+'-'+width+'.png'});
     // Leave audio playing before the next view so its stop/reset behavior is exercised.
     await audio.evaluate(async e=>{e.muted=true;await e.play();});
     console.log(`PASS ${view} ${width}: inline player, larger portrait, read-me on right, mapping/playback/pause and layout`);
    }
    assert.deepEqual(errors,[]);page.off('request',onRequest);page.off('pageerror',onError);
   }
   await page.close();
  }
  const page=await browser.newPage();await page.route('**/media/norm-narrates/**',r=>r.abort());
  await page.goto(base+'/'+(isDashboard?'dashboard':'standings')+'.html');await page.locator('.norm-page-guide audio').waitFor();
  await page.locator('.norm-page-guide audio').evaluate(async e=>{e.muted=true;try{await e.play();}catch{}});
  await page.locator('.norm-narration-status').waitFor();assert.match(await page.locator('.norm-narration-status').textContent(),/written guide/);
  await page.locator(openSelector).click();await page.locator(dialogSelector).waitFor({state:'visible'});assert.ok(await page.locator(dialogSelector+' h3').count()>=3);await page.close();
  console.log('PASS failed audio: separate written guide stays usable');
 }finally{await browser.close();}
};
