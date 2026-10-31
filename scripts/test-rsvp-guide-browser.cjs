/* NODE_PATH=<Playwright packages> node scripts/test-rsvp-guide-browser.cjs [base URL] */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8767';
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    for (const width of [1440, 1024, 820, 768, 390, 320]) {
      const page = await browser.newPage({ viewport:{ width, height:950 }, reducedMotion:'reduce' });
      // Test TLPT's embed mappings/layout without making YouTube availability or
      // personalized player chrome a release dependency. Actual YouTube playback,
      // visibility and uploaded thumbnails are verified separately in the browser.
      await page.route('https://www.youtube.com/embed/**', route => route.fulfill({
        contentType:'text/html', body:'<!doctype html><title>YouTube frame fixture</title>'
      }));
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
      assert.equal(await page.locator('.home-norm-banner').count(), 0, 'Homepage banner stays removed');
      assert.equal(await page.locator('.home-promo-row, .home-rebuy-teaser').count(), 0);
      assert.equal(await page.locator('.nav-dropdown-menu a[href="media.html"]').count(), 1, 'Film Room remains in navigation');
      assert.equal(await page.locator('.home-page-hero').evaluate(el => el.nextElementSibling?.id), 'home-games', 'Games follow the hero without an empty banner wrapper');
      const hero = await page.locator('.home-page-hero').boundingBox();
      const games = await page.locator('#home-games').boundingBox();
      assert.ok(games.y >= hero.y + hero.height - 1, 'Games do not overlap the hero');
      assert.ok(games.y - hero.y - hero.height <= 48, 'No leftover banner-sized gap');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({path:'/tmp/home-without-norm-' + width + '.png'});
      await page.goto(base + '/media.html');
      assert.equal(await page.locator('.media-video-facade').count(), 22, 'Film Room ready without autoplay');
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
      assert.equal(await page.locator('.media-card').count(), 23, 'Retain nine original films and all fourteen RSVP films');
      assert.equal(await page.locator('.media-card video').count(), 0, 'No duplicate native Film Room players');
      assert.equal(await page.locator('.media-card iframe').count(), 0, 'No YouTube player loads before a click');
      assert.equal(await page.locator('.media-video-facade').count(), 22, 'All twenty-two YouTube covers retained');
      assert.equal(await page.locator('.media-film-description, .media-film-duration').count(),0,'Cards contain only their title and player');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      for (const [id, youtubeId] of [['rsvp-main-event','inTd_p7otyE'],['the-kids','AYTCCtyBTqQ'],['call-your-play','GY4uQaUwsbU'],['day-to-day','rzKNK2yiu-I'],['the-elusive-rsvp','iYLibq-VvcQ'],['rsvp-referee','sPBNdswB3Xw'],['the-games-afoot','sr4AU3WoRTA'],['bad-beat-hotline','iugKsWyLU5Y'],['weather-forecast','kFF9RmDW5sk'],['no-empty-chairs','RyPECQqsayY'],['calling-the-clock','ipI7E9GUVnQ'],['rsvp-notifications','ANC2iebFFDc'],['rsvp-commercial','I0EmodtWMV0'],['rsvp-installation','KUArnlk48KQ']]) {
        const card = page.locator('#' + id), cover = card.locator('.media-video-facade'), player = card.locator('iframe');
        assert.equal(await card.count(), 1, 'Exactly one card for '+id);
        await card.scrollIntoViewIfNeeded();
        const thumbnailSlug = ({'rsvp-notifications':'notifications','rsvp-commercial':'commercial','rsvp-installation':'install'})[id] || id;
        assert.match(await cover.locator('img').getAttribute('src'), new RegExp('^media/rsvp-film-room/'+thumbnailSlug+'-thumbnail[.]jpg[?]v=[a-f0-9]{16}$'), 'Matching approved landscape thumbnail');
        await cover.locator('img').evaluate(img => img.decode());
        assert.equal(await cover.locator('img').evaluate(img => img.naturalWidth), 1280, 'Wide cover loads without Shorts cropping');
        assert.ok(await cover.getAttribute('aria-label'), 'Accessible play button');
        const coverBox = await cover.boundingBox();
        assert.ok(Math.abs(coverBox.width / coverBox.height - 16 / 9) < .02, 'Existing cover aspect ratio');
        await card.screenshot({path:'/tmp/' + id + '-' + width + '.png'});
        await cover.click();
        await player.waitFor({state:'visible'});
        const box = await player.boundingBox();
        assert.ok(Math.abs(box.width / box.height - 16 / 9) < .02, 'Film Room retains its landscape card frame');
        const bounds = await card.boundingBox();
        assert.ok(box.x >= bounds.x && box.x+box.width <= bounds.x+bounds.width+1, 'Embed stays within its card');
        assert.equal(await player.getAttribute('src'), 'https://www.youtube.com/embed/'+youtubeId+'?playsinline=1&autoplay=1');
        assert.equal(await player.getAttribute('loading'), 'eager', 'Load the requested player only after activation');
        assert.equal(await player.getAttribute('referrerpolicy'), 'strict-origin-when-cross-origin');
        assert.ok(await player.getAttribute('title'), 'Accessible player title');
        assert.equal(await player.getAttribute('allowfullscreen'), '');
        const params = new URL(await player.getAttribute('src')).searchParams;
        assert.equal(params.get('autoplay'), '1', 'The explicit play click starts the video');
        assert.notEqual(params.get('cc_load_policy'), '1', 'Captions are optional, never forced on');
      }
      assert.deepEqual(errors, []);
      console.log('PASS ' + width + 'px: guide playback/captions/download, home links, Schedule link and all fourteen YouTube embed mappings/layouts');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
