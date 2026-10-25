/* Optional browser regression: NODE_PATH=<playwright packages> node scripts/test-crew-browser.cjs [base URL] */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8767';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 820, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/players.html`);
      await page.locator('.crew-ultimate-card').first().waitFor();
      const expected = await page.evaluate(() => {
        const active = crewRosterPlayers(window.siteData.players, 'active');
        return { active:active.length, ranked:active.filter(isCrewEstablished).length,
          provisional:active.filter(isCrewProvisional).length,
          rookie:active.filter(isCrewRookie).length, full:window.siteData.players.length };
      });
      const snapshot = await page.evaluate(() => JSON.stringify(window.siteData.players));
      assert.equal(await page.locator('.crew-ultimate-card').count(), expected.ranked);
      assert.equal(await page.locator('#crew-tier-summary').evaluate(e => e.open), width >= 760);
      const firstCard = await page.locator('.crew-ultimate-card').first().boundingBox();
      console.log(`${width}px: first player card at ${Math.round(firstCard.y)}px`);
      if (width >= 760) {
        const controls = await page.locator('.crew-header-controls').boundingBox();
        const counts = await page.locator('#crew-tier-summary').boundingBox();
        assert.ok(counts.x >= controls.x + controls.width, 'Counts must sit beside controls');
        assert.ok(Math.abs(counts.y - controls.y) < 2);
      } else await page.locator('#crew-tier-summary > summary').click();
      assert.equal(Number(await page.locator('[data-crew-tier="all"] strong').innerText()), expected.active);
      for (const category of ['provisional', 'rookie']) {
        assert.equal(Number(await page.locator(`[data-crew-tier="${category}"] strong`).innerText()), expected[category]);
        if (expected[category]) {
          await page.locator(`[data-crew-tier="${category}"]`).click();
          assert.equal(await page.locator('.crew-ultimate-card').count(), expected[category]);
        }
      }
      await page.locator('[data-crew-tier="all"]').click();
      if (width < 760) await page.locator('#crew-tier-summary > summary').click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path:`/tmp/tlpt-crew-cards-${width}.png` });
      await page.locator('[data-crew-display="map"]').click();
      assert.equal(await page.locator('.crew-ultimate-card').count(), 0);
      assert.equal(await page.locator('.crew-map-bubble').count(), expected.ranked);
      await page.waitForFunction(() => [...document.querySelectorAll('.crew-map-bubble img')].every(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('.crew-map-bubble img').count(), expected.ranked);
      assert.equal(await page.locator('.crew-map-bubble').evaluateAll(buttons => buttons.every(button => {
        const player = window.siteData.players.find(p => p.slug === button.dataset.slug);
        return button.textContent.trim() === '' && button.querySelector('img').getAttribute('src') === player.image;
      })), true, 'Every map bubble must use its matching player avatar, not initials');
      const medianText = await page.locator('.crew-map-guide').filter({ hasText:'Dashed lines' }).innerText();
      await page.locator('.crew-map-bubble').last().focus();
      const focusedSlug = await page.locator('.crew-map-bubble').last().getAttribute('data-slug');
      assert.equal(await page.locator('#crew-map-player').inputValue(), focusedSlug);
      const trigger = page.locator('#crew-map-player-trigger');
      await trigger.waitFor();
      await trigger.click();
      const menu = page.locator('#crew-map-player-menu');
      await page.waitForFunction(() => {
        const t=document.querySelector('#crew-map-player-trigger').getBoundingClientRect();
        const m=document.querySelector('#crew-map-player-menu').getBoundingClientRect();
        return m.top >= t.bottom - 1 && m.left >= 0 && m.right <= innerWidth + 1;
      });
      assert.equal(await menu.evaluate(e => {
        const r=e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x+10,r.y+10));
      }), true, 'Dropdown must not be covered by page artwork');
      await menu.locator('[data-value="bostnmike"]').click();
      assert.match(await page.locator('.crew-map-detail').innerText(), /BostnMike/);
      await page.locator('[data-crew-roster="all"]').click();
      assert.equal(await page.locator('.crew-map-guide').filter({ hasText:'Dashed lines' }).innerText(), medianText);
      assert.equal(Number(await page.locator('[data-crew-tier="all"] strong').textContent()), expected.full);
      assert.ok(await page.locator('#crew-map-player optgroup[label="Alumni"] option').count());
      await page.locator('[data-crew-roster="alumni"]').click();
      assert.equal(await page.locator('.crew-map-guide').filter({ hasText:'Dashed lines' }).innerText(), medianText);
      await page.locator('[data-crew-roster="active"]').click();
      await page.locator('.crew-map').scrollIntoViewIfNeeded();
      await page.screenshot({ path:`/tmp/tlpt-crew-map-${width}.png` });
      await page.locator('#crew-player-search').fill('no-such-player');
      assert.equal(await page.locator('.crew-map-bubble').count(), 0);
      assert.match(await page.locator('.crew-search-empty').innerText(), /No established players/);
      await page.locator('#crew-player-search').fill('');
      await page.locator('[data-map-cards]').click();
      await page.locator('#crew-view-archetype').click();
      assert.equal(await page.locator('#players-visual').isVisible(), true);
      await page.locator('#crew-view-tier').click();
      assert.equal(await page.locator('.crew-ultimate-card').count(), expected.ranked);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.equal(await page.evaluate(() => JSON.stringify(window.siteData.players)), snapshot);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: Crew cards, tier counts, map, fixed ratings/medians, alumni, search, keyboard and dropdowns at four widths.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
