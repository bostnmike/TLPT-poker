/* NODE_PATH=<Playwright packages> node scripts/test-stats-guides-browser.cjs [base URL] */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8767';
const pages = ['standings','form-lab','player-movement','streaks','knockouts','players','player'];
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const [width,height] of [[1440,1000],[820,1180],[390,844],[320,568]]) {
      const page = await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      for (const name of pages) {
        const errors = [], audioRequests = [];
        const onError = error => errors.push(error.message);
        const onRequest = r => {if(r.url().includes('/media/norm-narrates/')) audioRequests.push(r.url());};
        page.on('pageerror',onError);
        page.on('request',onRequest);
        await page.goto(base+'/'+name+'.html');
        await page.evaluate(()=>document.fonts.ready);
        const opener = page.locator('[data-stats-help-open]');
        await opener.locator('.norm-headshot').waitFor();
        await opener.scrollIntoViewIfNeeded();
        assert.equal(await opener.locator('img').evaluate(el=>el.complete && el.naturalWidth>0),true);
        const box = await opener.boundingBox();
        assert.ok(box.x>=0 && box.x+box.width<=width+1);
        assert.ok(box.height>=44);
        assert.match(await opener.textContent(),/Read the guide/);
        await opener.click();
        const dialog = page.locator('#stats-help');
        await dialog.waitFor({state:'visible'});
        assert.equal(await dialog.locator('audio').count(),0,'No unfinished audio player');
        assert.equal(await dialog.locator('.norm-headshot').count(),1);
        assert.ok(await dialog.locator('h3').count()>=5);
        assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
        const bounds = await dialog.boundingBox();
        assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width+1 && bounds.y+bounds.height<=height+1);
        assert.equal(await dialog.locator('button').evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
        await page.screenshot({path:'/tmp/stats-guide-'+name+'-'+width+'.png'});
        await page.keyboard.press('Escape');
        assert.equal(await dialog.isVisible(),false);
        assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
        await page.waitForFunction(()=>document.body.style.overflow==='');
        await page.screenshot({path:'/tmp/stats-invite-'+name+'-'+width+'.png'});
        await opener.click();
        await dialog.locator('button').click();
        assert.equal(await dialog.isVisible(),false);
        await opener.click();
        await page.mouse.click(2,2);
        assert.equal(await dialog.isVisible(),false);
        if(name==='knockouts') {
          await page.locator('[data-knockouts-view="bounties"]').click();
          await opener.click();
          assert.match(await dialog.locator('h2').textContent(),/Bounty Hunters/);
          assert.match(await dialog.textContent(),/Retaining your own bounty does not add a bounty win/);
          await page.keyboard.press('Escape');
        }
        assert.equal(audioRequests.length,0,'Unrecorded guides must not request audio');
        assert.deepEqual(errors,[]);
        page.off('pageerror',onError);
        page.off('request',onRequest);
        console.log('PASS '+name+' '+width+': portrait, modal, keyboard, bounds, no placeholder audio');
      }
      await page.close();
    }
    // Verify the shared future-recording path using an existing reviewed test fixture.
    const page = await browser.newPage();
    await page.goto(base+'/standings.html');
    await page.evaluate(()=>{window.TLPTStatsGuides.standings.audio='media/norm-narrates/norm-dashboard-results.mp3';});
    await page.locator('[data-stats-help-open]').click();
    const audio = page.locator('#stats-help audio');
    assert.equal(await audio.getAttribute('preload'),'none');
    assert.equal(await audio.getAttribute('autoplay'),null);
    await audio.evaluate(async el=>{el.muted=true;await el.play();});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>{const a=document.querySelector('#stats-help audio');return a.paused&&!a.hasAttribute('src');});
    await page.locator('[data-stats-help-open]').click();
    assert.equal(await audio.evaluate(el=>el.paused&&el.currentTime===0),true);
    await page.close();
    console.log('PASS shared audio: opt-in playback, close stops, reopen resets');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
