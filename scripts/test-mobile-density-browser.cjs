/* Optional responsive regression; supply the local or published base URL. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8767';
const pages=['dashboard','standings','form-lab','knockouts','schedule','trophy-room'];
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
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
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
