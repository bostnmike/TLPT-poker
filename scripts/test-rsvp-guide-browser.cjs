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
      const errors = [], videoRequests = [], youtubeRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if(request.url().includes('tlpt-rsvp-install.mp4')) videoRequests.push(request.url()); });
      page.on('request', request => { if(request.url().startsWith('https://www.youtube.com/embed/')) youtubeRequests.push(request.url()); });
      await page.goto(base + '/rsvp-app.html');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(youtubeRequests.length, 0, 'No YouTube frame request before user playback');
      assert.equal(await page.locator('.rsvp-setup-player iframe').count(), 0);
      assert.equal(await page.title(), 'RSVP App | TLPT.org');
      assert.equal(await page.locator('.nav').count(), 1);
      assert.equal(await page.locator('.site-footer').count(), 1);
      const qr = await page.locator('.rsvp-qr').boundingBox();
      const video = await page.locator('.rsvp-setup-player').boundingBox();
      assert.ok(video.width >= 200 && video.height >= 200, 'YouTube player meets minimum viewport size');
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
      const watchUrl = 'https://www.youtube.com/watch?v=KUArnlk48KQ';
      const play = page.getByRole('link', {name:'Play the TLPT RSVP setup video'});
      assert.equal(await play.getAttribute('href'), watchUrl);
      assert.equal(await page.getByRole('link', {name:'Watch on YouTube'}).getAttribute('href'), watchUrl);
      await play.focus();
      const embedUrl = 'https://www.youtube.com/embed/KUArnlk48KQ?playsinline=1&autoplay=1';
      const [embed] = await Promise.all([page.waitForRequest(embedUrl), page.keyboard.press('Enter')]);
      assert.equal(embed.url(), embedUrl, 'Only the approved upload loads on explicit activation');
      const frame = page.locator('.rsvp-setup-player iframe');
      assert.equal(await frame.getAttribute('title'), 'TLPT RSVP setup video');
      assert.equal(await frame.getAttribute('allowfullscreen'), '');
      const framed = await frame.boundingBox();
      assert.ok(Math.abs(framed.width / framed.height - 9 / 16) < .01, 'The embedded player retains its portrait layout');
      assert.equal(await page.locator('video, [download]').count(), 0, 'No local player or download link');
      assert.equal(videoRequests.length, 0, 'No site-hosted installation MP4 is fetched');
      await page.goto(base + '/index.html');
      await page.waitForFunction(() => document.querySelector('#home-snapshot-grid')?.children.length > 0);
      await page.evaluate(() => document.fonts.ready);
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
      assert.equal(await page.locator('.media-video-facade').count(), 42, 'Film Room ready without autoplay');
      await page.goto(base + '/schedule.html');
      assert.equal(await page.locator('.schedule-app-promo a').getAttribute('href'), 'rsvp-app.html');
      await page.locator('.schedule-app-promo img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      assert.equal(await page.locator('#rsvp-campaign-title').innerText(), 'Put the Yellow Chip on Your Phone.');
      const anchor = page.locator('.rsvp-campaign-norm');
      assert.equal(await anchor.locator('img').getAttribute('src'), 'images/site/norm-news-anchor-source.jpg');
      assert.equal(await anchor.locator('img').getAttribute('alt'), 'News-anchor Norm');
      assert.deepEqual(await anchor.locator('img').evaluate(img => [img.naturalWidth, img.naturalHeight]), [1280, 720]);
      assert.equal(Math.round((await anchor.boundingBox()).width), width <= 560 ? 64 : width <= 1000 ? 80 : 96, 'Keep the original campaign avatar size');
      const crop = await anchor.evaluate(frame => {
        const img = frame.querySelector('img'), box = frame.getBoundingClientRect(), art = img.getBoundingClientRect();
        const scale = art.width / img.naturalWidth;
        return {x:(box.left + frame.clientLeft - art.left) / scale, y:(box.top + frame.clientTop - art.top) / scale,
          width:frame.clientWidth / scale, height:frame.clientHeight / scale,
          overflow:getComputedStyle(frame).overflow, radius:getComputedStyle(frame).borderRadius};
      });
      assert.ok(Math.abs(crop.x - 740) < .15 && Math.abs(crop.y) < .15, 'Center the intended news-anchor face, not the headline');
      assert.ok(Math.abs(crop.width - 360) < .15 && Math.abs(crop.height - 360) < .15, 'Keep the same square crop on every screen');
      assert.equal(crop.overflow, 'hidden');
      assert.equal(crop.radius, '50%');
      const campaign = await page.locator('.schedule-app-promo').boundingBox();
      for (const selector of ['.rsvp-campaign-norm', '#rsvp-campaign-title', '.rsvp-campaign-chip', '.schedule-app-promo .btn']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box.x >= campaign.x && box.x + box.width <= campaign.x + campaign.width + 1, selector + ': stays inside campaign');
      }
      assert.ok((await page.locator('.rsvp-campaign-chip').boundingBox()).width <= 36, 'Campaign chip stays inline, not hero-sized');
      assert.ok((await page.locator('.schedule-app-promo .btn').boundingBox()).height >= 40, 'Setup CTA retains a usable tap target');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.locator('.schedule-app-promo').screenshot({path:'/tmp/schedule-news-anchor-' + width + '.png'});
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
      assert.equal(await page.locator('.media-card').count(), 43, 'Retain nine original films and all thirty-four RSVP films');
      assert.equal(await page.locator('.media-card video').count(), 0, 'No duplicate native Film Room players');
      assert.equal(await page.locator('.media-card iframe').count(), 0, 'No YouTube player loads before a click');
      assert.equal(await page.locator('.media-video-facade').count(), 42, 'All forty-two YouTube covers retained');
      assert.equal(await page.locator('.media-film-description, .media-film-duration').count(),0,'Cards contain only their title and player');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      for (const [id, youtubeId] of [
        ['coffee-preorders','JKbeghbGcAM'],
        ['two-seats-remain','XS62fWZR_FM'],
        ['one-seat-available','ep08DkRP3gw'],
        ['the-courtesy-fold','45e1e-1290I'],
        ['earlier-start','ervb9fx_0oc'],
        ['public-hearing','Va-Q7PHbMDI'],
        ['rookie-orientation','cCInbuQ0_QI'],
        ['doubleheader','hyIBSyjWgvU'],
        ['clocking-out','FuEu6XnbLvk'],
        ['mission-control','rVnC_ctqRn0'],
        ['youth-movement','nvJYKCcRwA8'],
        ['nightly-news-friday-canceled','uSNlM_E_zck'],
        ['amazing-norm-friday-canceled','6dKAxotRBXI'],
        ['nightly-news-heavy-heart','VrliccRY5ZE'],
        ['amazing-norm-saturday-canceled','PjiZafNM4Xs'],
        ['now-showing','i17yME1Az2o'],
        ['sunday-special-bulletin','HweZPs_q85U'],
        ['who-wants-to-make-a-decision','Ij45B2zhMY4'],
        ['rsvp-roadshow','MvwsaPIq9-8'],
        ['final-boarding-call','elGvMvI4z98'],['rsvp-main-event','inTd_p7otyE'],['the-kids','AYTCCtyBTqQ'],['call-your-play','GY4uQaUwsbU'],['day-to-day','rzKNK2yiu-I'],['the-elusive-rsvp','iYLibq-VvcQ'],['rsvp-referee','sPBNdswB3Xw'],['the-games-afoot','sr4AU3WoRTA'],['bad-beat-hotline','iugKsWyLU5Y'],['weather-forecast','kFF9RmDW5sk'],['no-empty-chairs','RyPECQqsayY'],['calling-the-clock','ipI7E9GUVnQ'],['rsvp-notifications','ANC2iebFFDc'],['rsvp-commercial','I0EmodtWMV0'],['rsvp-installation','KUArnlk48KQ']]) {
        const card = page.locator('#' + id), cover = card.locator('.media-video-facade'), player = card.locator('iframe');
        if (id === 'coffee-preorders') {
          const fallback = card.getByRole('link', {name:'Watch on YouTube ↗'});
          assert.equal(await fallback.getAttribute('href'),'https://www.youtube.com/watch?v=JKbeghbGcAM');
          assert.equal(await fallback.getAttribute('target'),'_blank');
          assert.ok((await fallback.boundingBox()).height>=44,'Fallback keeps a usable touch target');
        }

        assert.equal(await card.count(), 1, 'Exactly one card for '+id);
        await card.scrollIntoViewIfNeeded();
        const thumbnailSlug = ({'rsvp-notifications':'notifications','rsvp-commercial':'commercial','rsvp-installation':'install'})[id] || id;
        assert.match(await cover.locator('img').getAttribute('src'), new RegExp('^media/rsvp-film-room/'+thumbnailSlug+'-thumbnail[.]jpg[?]v=[a-f0-9]{16}$'), 'Matching approved landscape thumbnail');
        await cover.locator('img').evaluate(img => img.decode());
        const expectedDimensions = ['coffee-preorders','two-seats-remain'].includes(id) ? [1920, 1080] : [1280, 720];
        assert.deepEqual(await cover.locator('img').evaluate(img => [img.naturalWidth, img.naturalHeight]), expectedDimensions, 'Approved wide cover loads without Shorts cropping');
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
      console.log('PASS ' + width + 'px: setup embed activation/layout, navigation, and all thirty-four Film Room RSVP YouTube mappings');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
