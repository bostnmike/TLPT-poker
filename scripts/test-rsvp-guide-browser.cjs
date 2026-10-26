/* NODE_PATH=<Playwright packages> node scripts/test-rsvp-guide-browser.cjs [base URL] */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8767';
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    for (const width of [1440, 820, 390, 320]) {
      const page = await browser.newPage({ viewport:{ width, height:950 }, reducedMotion:'reduce' });
      const errors = [], videoRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if(request.url().includes('tlpt-rsvp-install.mp4')) videoRequests.push(request.url()); });
      await page.goto(base + '/rsvp-app.html');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(videoRequests.length, 0, 'Video must not download before user playback');
      assert.equal(await page.title(), 'RSVP App | TLPT.org');
      assert.equal(await page.locator('.nav').count(), 1);
      assert.equal(await page.locator('.site-footer').count(), 1);
      const qr = await page.locator('.rsvp-qr').boundingBox();
      const video = await page.locator('video').boundingBox();
      if (width > 700) assert.ok(video.x > qr.x + qr.width, 'QR and video must be side by side');
      else assert.ok(video.y > qr.y + qr.height, 'Video must stack below QR on mobile');
      assert.ok(Math.abs(video.width / video.height - 9 / 16) < .01, 'Preserve portrait ratio');
      assert.ok(video.height <= 521, 'Desktop portrait must not become oversized');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path:'/tmp/rsvp-app-final-' + width + '.png', fullPage:true });
      await page.locator('summary').filter({ hasText:'iPhone / iPad' }).click();
      assert.equal(await page.locator('.rsvp-phone-guides details').first().getAttribute('open'), '');
      await page.locator('summary').filter({ hasText:'Android' }).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.rsvp-phone-guides details').last().getAttribute('open'), '');
      // Isolated headless playback only; never submit an RSVP or open a private link.
      await page.locator('video').evaluate(async video => {
        video.muted = true;
        video.textTracks[0].mode = 'showing';
        await video.play();
      });
      await page.waitForFunction(() => document.querySelector('video').currentTime > .25);
      await page.waitForFunction(() => document.querySelector('track').track.cues?.length === 14);
      const media = await page.locator('video').evaluate(v => ({duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message}));
      assert.ok(Math.abs(media.duration - 83.75) < .15);
      assert.equal(media.width, 1080);
      assert.equal(media.height, 1920);
      assert.equal(media.error, undefined);
      await page.locator('video').evaluate(v => { v.pause(); });
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[download]').click()]);
      assert.equal(download.suggestedFilename(), 'TLPT-RSVP-Setup.mp4');
      assert.equal(await download.failure(), null);
      await page.goto(base + '/index.html');
      const cards = page.locator('.home-promo-pair > a');
      assert.equal(await cards.count(), 2);
      assert.equal(await cards.first().getAttribute('href'), 'rsvp-app.html');
      assert.equal(await cards.last().getAttribute('href'), 'rebuy-hard.html');
      const appCard = await cards.first().boundingBox(), poem = await cards.last().boundingBox();
      if (width > 700) {
        assert.ok(Math.abs(appCard.y - poem.y) < 1);
        assert.ok(poem.x > appCard.x + appCard.width);
        assert.ok(Math.abs(appCard.height - poem.height) < 1);
      } else assert.ok(poem.y > appCard.y + appCard.height);
      await cards.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path:'/tmp/rsvp-home-final-' + width + '.png' });
      await cards.first().click();
      assert.ok(page.url().endsWith('/rsvp-app.html'));
      await page.goto(base + '/schedule.html');
      assert.equal(await page.locator('.schedule-app-promo a').getAttribute('href'), 'rsvp-app.html');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []);
      console.log('PASS ' + width + 'px: guide, playback, captions, download, home order and Schedule link');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
