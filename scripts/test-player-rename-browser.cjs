const {chromium}=require('playwright');
const {mockRsvpFeed} = require('./browser-rsvp-fixture.cjs');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8767';
(async()=>{
 const browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true});
 const siteData=await(await fetch(base+'/data/generated/site-data.json')).json();
 const expected=siteData.players.find(p=>p.slug==='li-fo');
 try{
  for(const width of [1440,820,390,320]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
   await mockRsvpFeed(page);
   for(const alias of ['Li-Fo','LiFo','Li Fo','Tony','ButtonMan','ButtonMan: fka LiFo']){
    await page.goto(base+'/player.html?name='+encodeURIComponent(alias));
    const card=page.locator('#player-profile [data-player-card]');
    await card.waitFor();
    assert.equal(await card.getAttribute('data-card-player-name'),'ButtonMan',alias);
    const image=card.locator('img[src*="images/players/li-fo.jpg"]').first();
    await image.waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('#player-profile img')].some(i=>i.src.includes('/li-fo.jpg')&&i.complete&&i.naturalWidth>0));
    const name=card.locator('.tlpt-card-player-name');
    assert.equal(await name.textContent(),'ButtonMan');
    const hits=page.locator('#player-profile .player-body-count-head h3');
    await hits.waitFor();
    assert.equal((await hits.textContent()).trim(),'💀 Your Body Count '+expected.hits,alias+' keeps the correct knockout history');
    assert.ok(await name.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Name must not be ellipsized');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   }
   await page.locator('#player-profile [data-player-card]').screenshot({path:'/tmp/buttonman-card-'+width+'.png'});
   for (const alias of ['P', 'Piercen', 'Piercen Craig', 'Pushin Craig']) {
    await page.goto(base+'/player.html?name='+encodeURIComponent(alias));
    const card = page.locator('#player-profile [data-player-card]');
    await card.waitFor();
    assert.equal(await card.getAttribute('data-card-player-name'), 'Piercen', alias);
    await card.locator('img[src*="images/players/piercen-craig-v2.webp"]').first().evaluate(img=>img.decode());
    const coffee = page.locator('.tlpt-player-snapshot-stat').filter({hasText:'Coffee Consumed'});
    assert.equal(await coffee.locator('strong').textContent(), String(siteData.coffeeConsumption.p));
   }
   await page.goto(base+'/player.html?name=Hiro');
   const tiles=page.locator('.tlpt-player-snapshot-grid .tlpt-player-snapshot-stat');
   const coffee=tiles.nth(8);
   await coffee.waitFor({state:'visible'});
   assert.equal(await tiles.count(),9);
   assert.equal(await tiles.nth(7).locator('span').textContent(),'Bounty Net');
   assert.equal(await coffee.locator('span').textContent(),'Coffee Consumed');
   assert.equal(await coffee.locator('strong').textContent(),String(siteData.coffeeConsumption.hiro));
   assert.ok(await coffee.locator('span').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getBoundingClientRect().right<=el.parentElement.getBoundingClientRect().right+1;}),'Coffee label fits the tile');
   if(width===1440){
    const bounty=await tiles.nth(7).boundingBox();
    const cups=await coffee.boundingBox();
    assert.ok(cups.x>bounty.x && Math.abs(cups.y-bounty.y)<1,'Coffee is bottom right on desktop');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);

   await page.goto(base+'/index.html');
   const homeMetrics=page.locator('#home-snapshot-grid .snapshot-card');
   const counter=homeMetrics.nth(3);
   await counter.waitFor({state:'visible'});
   assert.equal(await homeMetrics.count(),4);
   assert.equal(await counter.locator('.snapshot-label').textContent(),'Coffee Consumed');
   assert.equal(await homeMetrics.getByText('Rebuys',{exact:true}).count(),0);
   const totalCoffee=Object.values(siteData.coffeeConsumption).reduce((sum,count)=>sum+count,0);
   assert.equal(await counter.locator('.snapshot-value').getAttribute('data-target-value'),String(totalCoffee));
   await counter.locator('.snapshot-cta').click();
   await page.waitForURL('**/dashboard.html?view=coffee');
   const coffeeTab=page.getByRole('tab',{name:'Coffee Consumed'});
   await coffeeTab.waitFor({state:'visible'});
   await page.waitForFunction(()=>document.getElementById('dashboard-category-coffee').getAttribute('aria-selected')==='true');
   assert.equal(await page.locator('#dashboard-grid .dashboard-card').count(),Object.keys(siteData.coffeeConsumption).length);
   const icon = await coffeeTab.locator('.coffee-icon').boundingBox();
   const label = await coffeeTab.locator('span').last().boundingBox();
   assert.ok(icon.width >= 24 && icon.height >= 24, 'Coffee icon stays legible at each width');
   assert.ok(icon.y + icon.height <= label.y || icon.x + icon.width <= label.x, 'Coffee icon and label have separate space');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.goto(base+'/news.html');
   // A later weekly feature can move this player into a collapsed archive story.
   // Open that story before verifying the same visible, loaded portrait.
   const newsStory=page.locator('.news-post-card').filter({has:page.locator('img[alt="ButtonMan"]')}).first();
   await newsStory.waitFor();
   const archivedBody=newsStory.locator('details.news-post-details');
   if(await archivedBody.count() && !await archivedBody.evaluate(e=>e.open)){
    await archivedBody.locator('summary').click();
   }
   const newsAvatar=newsStory.locator('img[alt="ButtonMan"]').first();
   await newsAvatar.waitFor();
   await newsAvatar.scrollIntoViewIfNeeded();
   assert.ok(await newsAvatar.evaluate(i=>i.getAttribute('src').includes('li-fo.jpg')));
   assert.ok(await newsAvatar.evaluate(async i=>{await i.decode();return i.naturalWidth>0;}),'News portrait loads');
   for(const section of ['players','trophy-room']){
    await page.goto(base+'/'+section+'.html');
    if(section==='trophy-room'){
     await page.locator('#trophy-player-filter option[value="li-fo"]').waitFor({state:'attached'});
     await page.locator('#trophy-player-filter').selectOption('li-fo',{force:true});
    }
    const label=page.locator('.crew-ultimate-identity h3,.trophy-card-identity strong').filter({hasText:'ButtonMan'}).first();
    await label.waitFor();
    assert.ok(await label.evaluate(e=>e.scrollWidth<=e.clientWidth+1),section+' displays the full name');
   }
   await page.close();console.log('PASS ButtonMan '+width+': legacy links, current name, portrait and news avatar');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
