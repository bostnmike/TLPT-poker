const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8767';
(async()=>{
 const browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true});
 const expected=(await(await fetch(base+'/data/generated/site-data.json')).json()).players.find(p=>p.slug==='li-fo');
 try{
  for(const width of [1440,820,390,320]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
   for(const alias of ['Li-Fo','LiFo','Li Fo','Tony','ButtonMan','ButtonMan: fka LiFo']){
    await page.goto(base+'/player.html?name='+encodeURIComponent(alias));
    const card=page.locator('#player-profile [data-player-card]');
    await card.waitFor();
    assert.equal(await card.getAttribute('data-card-player-name'),'ButtonMan: fka LiFo',alias);
    const image=card.locator('img[src*="images/players/li-fo.jpg"]').first();
    await image.waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('#player-profile img')].some(i=>i.src.includes('/li-fo.jpg')&&i.complete&&i.naturalWidth>0));
    const name=card.locator('.tlpt-card-player-name');
    assert.equal(await name.textContent(),'ButtonMan: fka LiFo');
    const hits=page.locator('#player-profile .player-body-count-head h3');
    await hits.waitFor();
    assert.equal((await hits.textContent()).trim(),'💀 Your Body Count '+expected.hits,alias+' keeps the correct knockout history');
    assert.ok(await name.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Name must not be ellipsized');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   }
   await page.locator('#player-profile [data-player-card]').screenshot({path:'/tmp/buttonman-card-'+width+'.png'});
   await page.goto(base+'/news.html');
   await page.locator('img[alt="ButtonMan: fka LiFo"]').first().waitFor();
   assert.ok(await page.locator('img[alt="ButtonMan: fka LiFo"]').first().evaluate(i=>i.getAttribute('src').includes('li-fo.jpg')));
   await page.close();console.log('PASS ButtonMan '+width+': legacy links, current name, portrait and news avatar');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
