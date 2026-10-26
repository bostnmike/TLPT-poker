/* NODE_PATH=<Playwright packages> node scripts/test-stats-guides-browser.cjs [base URL] */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8767';
const pages = ['standings','form-lab','player-movement','streaks','knockouts','players','player'];
const recordings = {
  standings:['standings',50.83], 'form-lab':['form-lab',53.24],
  'player-movement':['heater-meter',52.85], streaks:['streaks',51.80],
  knockouts:['knockouts',50.44], bounties:['bounty-hunters',60.53],
  players:['meet-the-crew',52.35], player:['player-profile',58.51]
};
(async () => {
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const [width,height] of [[1440,1000],[820,1180],[390,844],[320,568],[844,390]]) {
      const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      for(const name of pages) {
        const errors=[], requests=[];
        const onError=e=>errors.push(e.message);
        const onRequest=r=>{if(r.url().includes('/media/norm-narrates/')) requests.push(r.url());};
        page.on('pageerror',onError); page.on('request',onRequest);
        await page.goto(base+'/'+name+'.html');
        await page.evaluate(()=>document.fonts.ready);
        if(name==='knockouts') await page.locator('#knockouts-summary-grid > *').first().waitFor();
        const opener=page.locator('[data-stats-help-open]');
        await opener.locator('img').waitFor();
        assert.equal(await opener.locator('img').evaluate(el=>el.complete&&el.naturalWidth>0),true);
        assert.equal(requests.length,0,'No narration on page load');
        for(const view of name==='knockouts'?['knockouts','bounties']: [name]) {
          if(name==='knockouts') await page.locator('[data-knockouts-view="'+view+'"]').click();
          const recording=recordings[view];
          assert.match(await opener.textContent(),recording?/Listen or read/:/Audio coming soon/);
          const before=requests.length;
          await opener.scrollIntoViewIfNeeded();
          const box=await opener.boundingBox();
          assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.height>=44);
          await opener.click();
          const dialog=page.locator('#stats-help'), audio=dialog.locator('audio');
          await dialog.waitFor({state:'visible'});
          assert.equal(await audio.count(),recording?1:0);
          assert.equal(await dialog.locator('.norm-headshot').count(),1);
          assert.ok(await dialog.locator('h3').count()>=5);
          assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
          const bounds=await dialog.boundingBox();
          assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1);
          assert.equal(await dialog.locator('button').evaluate(el=>el===document.activeElement),true);
          await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
          assert.equal(await dialog.evaluate(el=>document.activeElement===document.body||el.contains(document.activeElement)),true,'Tab does not focus background controls (browser chrome may receive focus)');
          await page.waitForTimeout(100);
          assert.equal(requests.length,before,'Opening help does not download audio');
          if(recording) {
            const [file,duration]=recording;
            assert.equal(await audio.getAttribute('src'),'media/norm-narrates/norm-'+file+'.mp3');
            assert.equal(await audio.getAttribute('preload'),'none');
            assert.equal(await audio.getAttribute('autoplay'),null);
            assert.equal(await audio.evaluate(el=>el.paused),true);
            await audio.evaluate(async el=>{el.muted=true;await el.play();});
            await page.waitForFunction(()=>document.querySelector('#stats-help audio').currentTime>.1);
            assert.ok(Math.abs(await audio.evaluate(el=>el.duration)-duration)<1);
          }
          if(view==='bounties') assert.match(await dialog.locator('h2').textContent(),/Bounty Hunters/);
          await page.screenshot({path:'/tmp/stats-guide-'+view+'-'+width+'.png'});
          for(const method of ['escape','button','backdrop']) {
            if(method!=='escape') {
              await opener.click();
              if(recording) {
                assert.equal(await audio.evaluate(el=>el.paused&&el.currentTime===0),true);
                await audio.evaluate(async el=>{el.muted=true;await el.play();});
              }
            }
            if(method==='escape') await page.keyboard.press('Escape');
            else if(method==='button') await dialog.locator('button').click();
            else await page.mouse.click(2,2);
            await page.waitForFunction(()=>document.body.style.overflow==='');
            if(recording) assert.equal(await audio.evaluate(el=>el.paused&&!el.hasAttribute('src')),true);
            assert.equal(await dialog.isVisible(),false);
            assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
          }
          if(!recording) assert.equal(requests.length,before,'No placeholder audio requests');
          await page.screenshot({path:'/tmp/stats-invite-'+view+'-'+width+'.png'});
          console.log('PASS '+view+' '+width+': mapping, opt-in audio, close/reopen and responsive layout');
        }
        assert.deepEqual(errors,[]);
        page.off('pageerror',onError);page.off('request',onRequest);
      }
      await page.close();
    }
    const page=await browser.newPage();
    await page.route('**/media/norm-narrates/**',route=>route.abort());
    await page.goto(base+'/standings.html');
    await page.locator('[data-stats-help-open]').click();
    await page.locator('#stats-help audio').evaluate(async el=>{el.muted=true;try{await el.play();}catch{}});
    await page.locator('.dashboard-narration-status').waitFor();
    assert.match(await page.locator('.dashboard-narration-status').textContent(),/written guide/);
    assert.match(await page.locator('.stats-help-content').textContent(),/Money versus profit/);
    await page.close();
    console.log('PASS failed audio: written guide remains usable');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
