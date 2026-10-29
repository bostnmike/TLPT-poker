/* NODE_PATH=<Playwright packages> node scripts/test-rsvp-guide-browser.cjs [base URL] */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8767';
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    for (const width of [1440, 1024, 820, 768, 390, 320]) {
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
      const cards = page.locator('.home-promo-row > a');
      const destinations = ['media.html#rsvp-notifications', 'media.html#rsvp-commercial', 'rebuy-hard.html'];
      assert.equal(await cards.count(), 3);
      assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), destinations);
      await cards.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      assert.match(await cards.first().innerText(), /Notifications/i);
      assert.match(await cards.nth(1).innerText(), /Don’t Be a Donkey/);
      assert.match(await cards.last().innerText(), /Rebuy Hard/);
      let previousCard;
      for (const card of await cards.all()) {
        const bounds = await card.boundingBox();
        for (const selector of ['.home-rebuy-image', '.home-rebuy-copy', '.home-rebuy-cta']) {
          const box = await card.locator(selector).boundingBox();
          assert.ok(box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width + 1, selector + ': fits teaser');
        }
        assert.equal(await card.evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
        if (previousCard && width > 800) {
          assert.ok(Math.abs(bounds.y - previousCard.y) < 1);
          assert.ok(bounds.x > previousCard.x + previousCard.width);
          assert.ok(Math.abs(bounds.height - previousCard.height) < 1);
        } else if (previousCard) assert.ok(bounds.y > previousCard.y + previousCard.height);
        previousCard = bounds;
      }
      assert.ok((await cards.nth(1).locator('.home-rsvp-chip').boundingBox()).width <= 36);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await cards.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path:'/tmp/rsvp-home-final-' + width + '.png' });
      for (let index = 0; index < destinations.length; index++) {
        if (index) await page.goto(base + '/index.html');
        await page.locator('.home-promo-row > a').nth(index).click();
        assert.ok(page.url().endsWith('/' + destinations[index]));
        if (index < 2) {
          const target = page.locator('#' + destinations[index].split('#')[1]);
          await target.waitFor();
          const title = await target.locator('h2').boundingBox();
          const header = await page.locator('.site-header').boundingBox();
          assert.ok(title.y >= header.y + header.height - 1, 'Linked film title clears sticky navigation');
          assert.equal(await target.locator('video').evaluate(video => video.paused), true, 'Teaser never autoplays');
        }
      }
      await page.goto(base + '/schedule.html');
      assert.equal(await page.locator('.schedule-app-promo a').getAttribute('href'), 'rsvp-app.html');
      await page.locator('.schedule-app-promo img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      assert.equal(await page.locator('#rsvp-campaign-title').innerText(), 'Put the Yellow Chip on Your Phone.');
      const campaign = await page.locator('.schedule-app-promo').boundingBox();
      for (const selector of ['.rsvp-campaign-norm', '#rsvp-campaign-title', '.rsvp-campaign-chip', '.schedule-app-promo .btn']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box.x >= campaign.x && box.x + box.width <= campaign.x + campaign.width + 1, selector + ': stays inside campaign');
      }
      assert.ok((await page.locator('.rsvp-campaign-chip').boundingBox()).width <= 36, 'Campaign chip stays inline, not hero-sized');
      assert.ok((await page.locator('.schedule-app-promo .btn').boundingBox()).height >= 40, 'Setup CTA retains a usable tap target');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      const scheduleMenu = page.locator('.nav-dropdown:has(> a[href="schedule.html"])');
      if (width > 900) {
        await scheduleMenu.locator('.nav-dropdown-parent').hover();
        assert.equal(await scheduleMenu.locator('.nav-dropdown-menu').isVisible(), true);
        await scheduleMenu.locator('.nav-dropdown-parent').focus();
        await scheduleMenu.locator('a[href="rsvp-app.html"]').waitFor({ state:'visible' });
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'RSVP App', 'Keyboard reaches Schedule subpage');
      } else {
        await page.locator('.site-nav-toggle').click();
        await scheduleMenu.locator('.nav-submenu-toggle').click();
        assert.equal(await scheduleMenu.locator('.nav-submenu-toggle').getAttribute('aria-expanded'), 'true');
      }
      await scheduleMenu.locator('a[href="rsvp-app.html"]').click();
      assert.ok(page.url().endsWith('/rsvp-app.html'));
      assert.equal(await page.locator('.nav a.is-active').allTextContents().then(a => a.map(s => s.trim()).join(' / ')), 'Schedule / RSVP App');
      assert.equal((await page.locator('.nav a[aria-current="page"]').textContent()).trim(), 'RSVP App');
      const filmRequests = [];
      page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.mp4')) filmRequests.push(request.url()); });
      await page.goto(base + '/media.html');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(filmRequests.length, 0, 'Film Room videos must not download before playback');
      assert.equal(await page.locator('.media-card').count(), 17, 'Retain nine original films and all eight native RSVP films');
      assert.equal(await page.locator('.media-film-description, .media-film-duration').count(),0,'Cards contain only their title and player');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      for (const [id, duration] of [['the-games-afoot',36],['bad-beat-hotline',30],['weather-forecast',29],['no-empty-chairs',32],['calling-the-clock',26],['rsvp-notifications', 40], ['rsvp-commercial', 39], ['rsvp-installation', 83.75]]) {
        const card = page.locator('#' + id), player = card.locator('video');
        await card.scrollIntoViewIfNeeded();
        const box = await player.boundingBox();
        assert.ok(Math.abs(box.width / box.height - 16 / 9) < .02, 'Film Room retains its landscape card frame');
        assert.equal(await player.evaluate(v => getComputedStyle(v).objectFit), 'contain', 'Portrait footage must not crop');
        const poster = await player.evaluate(async v => {
          const image = new Image(); image.src = v.poster; await image.decode();
          return [image.naturalWidth, image.naturalHeight];
        });
        assert.deepEqual(poster, [1280, 720]);
        await card.screenshot({path:'/tmp/' + id + '-' + width + '.png'});
        assert.equal(await player.evaluate(v => v.textTracks[0].mode), 'disabled', 'Captions remain optional');
        await player.evaluate(async v => { v.muted = true; v.textTracks[0].mode = 'showing'; await v.play(); });
        await page.waitForFunction(id => document.querySelector('#' + id + ' video').currentTime > .1, id);
        await page.waitForFunction(id => document.querySelector('#' + id + ' track').track.cues?.length > 0, id);
        if (id === 'rsvp-notifications') assert.equal(await player.evaluate(v => v.textTracks[0].cues.length), 20);
        const state = await player.evaluate(v => ({duration:v.duration, width:v.videoWidth, height:v.videoHeight, error:v.error?.message}));
        assert.ok(Math.abs(state.duration - duration) < .15);
        assert.equal(state.width, 1080); assert.equal(state.height, 1920);
        assert.equal(state.error, undefined);
        await player.evaluate(v => v.pause());
      }
      assert.deepEqual(errors, []);
      console.log('PASS ' + width + 'px: guide, playback, captions, download, home order, Schedule link and all eight Film Room videos');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
