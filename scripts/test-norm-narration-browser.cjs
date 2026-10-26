/* NODE_PATH=<Playwright packages> node scripts/test-norm-narration-browser.cjs [base URL] */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8767';
const durations = {results:40.91, bankroll:41.95, rates:43.55, 'player-dna':47.96};
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const [width,height] of [[1440,1000],[820,1180],[390,844],[320,568]]) {
      const page = await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      const requests = [], errors = [];
      page.on('request', r => { if (r.url().includes('/media/norm-narrates/')) requests.push(r.url()); });
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/dashboard.html');
      await page.locator('#dashboard-metric-select-trigger').waitFor().catch(async error => {
        console.error('Dashboard readiness:',width,errors,await page.locator('#dashboard-metric-panel').innerHTML());
        await page.screenshot({path:'/tmp/dashboard-narration-readiness-'+width+'.png'});
        throw error;
      });
      await page.locator('#dashboard-grid .dashboard-card').first().waitFor();
      assert.equal(requests.length,0,'Page load must not request narration');
      for (const [category,duration] of Object.entries(durations)) {
        await page.locator('[data-dashboard-category="' + category + '"]').click();
        await page.waitForFunction(value => document.getElementById('dashboard-metric-panel').dataset.dashboardMetricGroup === value, category);
        const before = requests.length;
        await page.locator('[data-dashboard-help-open]').click();
        const audio = page.locator('#dashboard-help audio');
        assert.equal(await audio.count(),1);
        assert.equal(await audio.getAttribute('preload'),'none');
        assert.equal(await audio.getAttribute('autoplay'),null);
        assert.equal(await audio.getAttribute('src'),'media/norm-narrates/norm-dashboard-' + category + '.mp3');
        assert.equal(await audio.evaluate(el=>el.paused),true);
        await page.waitForTimeout(150);
        assert.equal(requests.length,before,'Opening help must not download narration');
        const dialog = page.locator('#dashboard-help');
        assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
        const box = await dialog.boundingBox();
        assert.ok(box.x>=0 && box.x+box.width<=width+1 && box.y+box.height<=height+1);
        // Muted playback in this isolated test browser, never on the user's device.
        await audio.evaluate(async el=>{el.muted=true;await el.play();});
        await page.waitForFunction(()=>document.querySelector('#dashboard-help audio').currentTime>.2);
        assert.ok(Math.abs(await audio.evaluate(el=>el.duration)-duration)<1,category+' correct recording');
        await page.screenshot({path:'/tmp/norm-narrates-' + category + '-' + width + '.png'});
        if (category==='bankroll') await page.locator('[data-dashboard-help-close]').click();
        else if (category==='rates') await page.mouse.click(2,2);
        else await page.keyboard.press('Escape');
        await page.waitForFunction(()=>{
          const el=document.querySelector('#dashboard-help audio');
          return el.paused && !el.hasAttribute('src');
        });
        assert.equal(await dialog.isVisible(),false);
        assert.equal(await page.locator('[data-dashboard-help-open]').evaluate(el=>el===document.activeElement),true);
        await page.locator('[data-dashboard-help-open]').click();
        assert.equal(await audio.evaluate(el=>el.paused && el.currentTime===0),true,'Reopening does not resume playback');
        await page.locator('[data-dashboard-help-close]').click();
      }
      assert.deepEqual(errors,[]);
      console.log('PASS ' + width + 'x' + height + ': all four recordings, no prefetch/autoplay, playback, stop, reopen and modal bounds');
      await page.close();
    }
    const page=await browser.newPage();
    await page.route('**/media/norm-narrates/**',route=>route.abort());
    await page.goto(base+'/dashboard.html');
    await page.locator('#dashboard-metric-select-trigger').waitFor();
    await page.locator('#dashboard-grid .dashboard-card').first().waitFor();
    await page.locator('[data-dashboard-help-open]').click();
    await page.locator('#dashboard-help audio').evaluate(async el=>{el.muted=true;try{await el.play();}catch{}});
    await page.locator('.dashboard-narration-status').waitFor();
    assert.match(await page.locator('.dashboard-narration-status').textContent(),/written guide/);
    assert.match(await page.locator('#dashboard-help-content').textContent(),/Every recorded elimination counts/);
    await page.close();
    console.log('PASS audio failure: written help remains usable');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
