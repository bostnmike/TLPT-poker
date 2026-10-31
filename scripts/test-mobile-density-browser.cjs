/* Required responsive regression; supply the local or published base URL. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8767';
const pages=['dashboard','standings','form-lab','knockouts','schedule','trophy-room'];
async function checkRsvpChairs(browser,width){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 // Browser-only public fixtures: never change RSVP responses in production.
 const events=JSON.parse(fs.readFileSync(path.join(__dirname,'../tests/visual/fixtures/data/events.json'))).events;
 for(const event of events){
  event.rsvpOpen=true;
  event.rsvps={bostnmike:'yes',hiro:'yes'};
  event.seatAssignments=[['bostnmike','','hiro']];
 }
 await page.route('**/api/public/events*',route=>route.fulfill({json:{schemaVersion:1,revision:'chair-check',events,noGameDays:[]}}));
 try{
  for(const name of ['index','schedule']){
   await page.goto(base+'/'+name+'.html',{waitUntil:'networkidle'});
   const list=page.locator(name==='index'?'#home-events-list':'#schedule-list');
   await list.locator('.event-empty-seat-image').first().waitFor();
   const chairs=list.locator('.event-empty-seat-image');
   await chairs.evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
   const result=await list.evaluate(root=>{
    const rows=[...root.querySelectorAll('.event-rsvp-avatar-row')];
    const bounds=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
    return rows.map(row=>{
     const seats=[...row.querySelectorAll(':scope > .event-empty-seat, :scope > .event-rsvp-seat-player')];
     const before=seats.map(bounds);
     const images=[...row.querySelectorAll('.event-empty-seat-image')];
     const valid=images.every(img=>{
      const r=img.getBoundingClientRect(),s=img.parentElement.getBoundingClientRect();
      return img.complete&&img.naturalWidth===256&&img.getAttribute('alt')===''&&img.getAttribute('aria-hidden')==='true'
       &&/RSVP spot$/.test(img.parentElement.getAttribute('aria-label'))
       &&r.width>0&&r.height>0&&Math.abs(r.x-s.x)<1&&Math.abs(r.y-s.y)<1&&r.width<=s.width+1&&r.height<=s.height+1;
     });
     // The asset must not alter the pre-existing chair boxes or occupied avatars.
     images.forEach(img=>{img.replaceWith(document.createTextNode('🪑'));});
     const unchanged=JSON.stringify(before)===JSON.stringify(seats.map(bounds));
     seats.filter(seat=>seat.classList.contains('event-empty-seat')).forEach((seat,i)=>seat.replaceChildren(images[i]));
     return {count:seats.length,valid,unchanged,chairs:images.length,
      held:row.querySelectorAll('[aria-label*="manually held-open"]').length,
      avatars:row.querySelectorAll('.event-rsvp-seat-player img').length,
      hasFelt:getComputedStyle(row,'::before').backgroundImage.includes('winter-classic')};
    });
   });
   assert.ok(result.length>0);
   assert.ok(result.some(row=>row.held>0&&row.avatars===2),'Manual blank and occupied-avatar coverage');
   for(const row of result){assert.equal(row.count,9);assert.ok(row.valid&&row.unchanged&&row.hasFelt);}
   if(name==='schedule')assert.ok(await list.locator('.is-two-table-row').count()>=2,'MTT uses the shared chair');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const card=list.locator('.event-card').first();
   await card.scrollIntoViewIfNeeded();
   await card.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
   await card.screenshot({path:'/tmp/rsvp-chair-'+name+'-'+width+'.png'});
   console.log('PASS approved RSVP chairs '+name+' '+width+' ('+result.length+' tables)');
  }
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true});
 try{
  for(const width of [1440,820,390,320]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
   for(const name of pages){
    await page.goto(base+'/'+name+'.html',{waitUntil:'networkidle'});
    const hero=page.locator('.mobile-compact-hero');
    await hero.waitFor();
    assert.equal(await hero.locator('.hero-mobile-copy').isVisible(),width<=700);
    assert.equal(await hero.locator('.hero-desktop-copy').isVisible(),width>700);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' overflow');
    if(await page.locator('#stat-bounty').count()){
     assert.equal(await page.locator('#stat-bounty').inputValue(),'all');
     assert.deepEqual(await page.locator('#stat-bounty option').allTextContents(),['All Events','With Bounties','Without Bounties']);
     if(name==='dashboard'&&width<=700)await page.locator('#dashboard-filter-toggle').click();
     await page.locator('#stat-bounty-trigger').waitFor();
     assert.equal(await page.locator('#stat-bounty-trigger').textContent(),'All Events');
     await page.locator('#stat-bounty-trigger').click();
     await page.locator('#stat-bounty-menu [data-value="with"]').click();
     assert.equal(await page.locator('#stat-bounty').inputValue(),'with');
     await page.locator('[data-stat-reset]').click();
     assert.equal(await page.locator('#stat-bounty-trigger').textContent(),'All Events');
     if(name==='dashboard'&&width<=700)await page.locator('#dashboard-filter-toggle').click();
    }
    if(name==='trophy-room'){
     const details=hero.locator('.mobile-hero-more');
     assert.equal(await details.isVisible(),width<=700);
     if(width<=700){
      assert.equal(await details.getAttribute('open'),null);
      await details.locator('summary').focus();await page.keyboard.press('Enter');
      assert.equal(await details.getAttribute('open'),'');
      assert.match(await details.textContent(),/Active Crew Skin/);
      await details.locator('summary').click();
     }
    }
    if(name==='knockouts'){
     const cards=page.locator('.knockouts-nemesis-card');
     await cards.first().waitFor();
     const count=await cards.count();
     assert.ok(count>0);
     for(const card of await cards.all()){
      if(!await card.isVisible())continue;
      if(width<=700){
       const names=card.locator('.knockouts-nemesis-hover-name');
       assert.equal(await names.count(),2);
       assert.equal(await names.first().evaluate(e=>getComputedStyle(e).opacity),'1');
       const sides=card.locator('.knockouts-nemesis-side');
       const a=await sides.first().boundingBox(),b=await sides.last().boundingBox();
       assert.ok(b.x>a.x+a.width,'Matchup remains horizontal');
       assert.ok((await card.boundingBox()).height<155,'Compact matchup row');
       assert.equal(await card.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
      }
     }
     assert.equal(await cards.count(),count,'No player removed');
    }
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:'/tmp/mobile-density-'+name+'-'+width+'.png'});
    console.log('PASS '+name+' '+width+' height='+await page.evaluate(()=>document.documentElement.scrollHeight));
   }
   await page.close();
   await checkRsvpChairs(browser,width);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
