/* NODE_PATH=<Playwright packages> node scripts/test-control-deck-browser.cjs [base URL] */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8767';
const pages = ['dashboard','standings','form-lab','knockouts','streaks','player-movement',
  'players','trophy-room','gallery','voice-of-god','player','structures'];
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    for (const width of [1440,820,390,320]) {
      const page = await browser.newPage({ viewport:{width,height:1000}, reducedMotion:'reduce' });
      for (const name of pages) {
        const errors = [];
        const onError = e => errors.push(e.message);
        page.on('pageerror', onError);
        await page.goto(base + '/' + name + '.html' + (name === 'player' ? '?name=BostnMike' : ''));
        await page.evaluate(() => document.fonts.ready);
        const deck = page.locator('.tlpt-control-deck');
        assert.equal(await deck.count(), 1, name + ': one control panel');
        const ready = {
          players: '#crew-tier-counts button', 'trophy-room': '.trophy-card',
          gallery: '.gallery-poster-button', 'voice-of-god': '.vog-clip-card',
          structures: '#format-content table', player: '#player-profile .profile-shell'
        }[name];
        if (ready) await page.locator(ready).first().waitFor({state:'attached'});
        if (name === 'dashboard' && width <= 700) {
          assert.equal(await page.locator('#dashboard-event-scope').isVisible(), false);
          await page.locator('#dashboard-filter-toggle').click();
        }
        if (await page.locator('[data-stat-scope]').count()) {
          await page.locator('#stat-format-trigger').waitFor();
          assert.equal(await deck.locator('[data-stat-scope]').count(), 1, name + ': event filters consolidated');
          assert.equal(await page.locator('#stat-format').inputValue(), 'all');
          assert.equal(await page.locator('#stat-bounty').inputValue(), 'all');
          await page.locator('#stat-format-trigger').click();
          await page.locator('#stat-format-menu [data-value="mtt"]').click();
          assert.equal(await page.locator('#stat-format').inputValue(), 'mtt');
          assert.match(await page.locator('[data-stat-scope-summary]').textContent(), /Filtered view/);
          await page.locator('[data-stat-reset]').click();
          assert.equal(await page.locator('#stat-format').inputValue(), 'all');
          assert.equal(await page.locator('#stat-format-trigger').textContent(), 'All Formats');
          if (name === 'dashboard') assert.equal(await page.locator('[data-stat-reset]').isVisible(),false);
        }
        if (name === 'form-lab') {
          await page.locator('#fl-preset-select').selectOption('custom', {force:true});
          assert.equal(await page.locator('.fl-chart-options').getAttribute('open'), '');
          await page.locator('#fl-x-select').waitFor({state:'attached'});
        }
        // Every dropdown, including advanced chart axes, must open BELOW its field
        // and remain above the next section/card artwork.
        const triggers = deck.locator('.site-select-trigger:visible, .fl-select-trigger:visible');
        for (let n=0; n<await triggers.count(); n++) {
          const trigger = triggers.nth(n);
          await trigger.scrollIntoViewIfNeeded();
          await trigger.click();
          const id = await trigger.getAttribute('aria-controls');
          const menu = page.locator('#' + id);
          await menu.waitFor({state:'visible'});
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const fieldBox = await trigger.boundingBox(), menuBox = await menu.boundingBox();
          assert.ok(menuBox.y >= fieldBox.y + fieldBox.height - 1, name + ': dropdown below field');
          assert.ok(menuBox.x >= 0 && menuBox.x + menuBox.width <= width + 1, name + ': dropdown within width');
          assert.ok(menuBox.y + menuBox.height <= 1001, name + ': dropdown within height');
          assert.ok(await menu.evaluate(el => {
            const r=el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+Math.min(r.height/2,24)));
          }), name + ': dropdown not obscured');
          await page.keyboard.press('Escape');
          assert.equal(await menu.isVisible(), false);
        }
        if (await triggers.count()) {
          const first = triggers.first();
          await first.focus();
          await page.keyboard.press('ArrowDown');
          const menu = page.locator('#' + await first.getAttribute('aria-controls'));
          await menu.waitFor({state:'visible'});
          await page.keyboard.press('Escape');
          assert.equal(await first.evaluate(el => document.activeElement === el), true, name + ': keyboard focus returns to field');
        }
        if (name === 'form-lab') await page.locator('.fl-chart-options summary').click();
        if (name === 'trophy-room') {
          await page.locator('#trophy-search').fill('NO_MATCH_TEST_823');
          await page.locator('#trophy-empty-state').waitFor({state:'visible'});
          await page.locator('#trophy-reset').click();
          assert.equal(await page.locator('#trophy-search').inputValue(), '');
          assert.equal(await page.locator('#trophy-empty-state').isVisible(), false);
        }
        if (name === 'players') {
          await page.locator('#crew-player-search').fill('NO_MATCH_TEST_823');
          await page.locator('.crew-search-empty').waitFor();
          await page.locator('#crew-player-search').fill('');
          await page.locator('.crew-search-empty').waitFor({state:'detached'});
          await page.locator('[data-crew-roster="alumni"]').click();
          assert.equal(await page.locator('[data-crew-roster="alumni"]').getAttribute('aria-pressed'),'true');
          await page.locator('[data-crew-roster="active"]').click();
        }
        if (name === 'dashboard') {
          for (const category of ['results','bankroll','rates','player-dna']) {
            await page.locator('[data-dashboard-category="' + category + '"]').click();
            await page.locator('[data-dashboard-help-open]').click();
            const dialog = page.locator('#dashboard-help');
            await dialog.waitFor({state:'visible'});
            assert.match(await dialog.locator('h2').textContent(), /How to use this view/);
            assert.ok(await dialog.locator('dt').count() >= 2);
            assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, 'Help has no horizontal overflow');
            const bounds = await dialog.boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= 1001);
            await page.keyboard.press('Tab');
            assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)),true,'Modal keeps keyboard focus');
            if (category === 'results') await page.screenshot({path:'/tmp/tlpt-help-results-' + width + '.png'});
            await page.keyboard.press('Escape');
            assert.equal(await dialog.isVisible(),false);
            assert.equal(await page.locator('[data-dashboard-help-open]').evaluate(el => el === document.activeElement),true);
          }
          await page.locator('[data-dashboard-category="results"]').click();
          await page.locator('[data-dashboard-help-open]').click();
          await page.locator('[data-dashboard-help-close]').click();
          await page.locator('[data-dashboard-help-open]').click();
          await page.mouse.click(2,2);
          assert.equal(await page.locator('#dashboard-help').isVisible(),false);
          assert.equal(await page.locator('#dashboard-metric-select-trigger').textContent(), 'Knockouts (Hits)');
          assert.match(await page.locator('#dashboard-studio-strip').textContent(), /Ranking \d+ players? by knockouts \(hits\) across \d+ events?\./);
          await page.locator('#stat-format').selectOption('mtt', {force:true});
          await page.locator('[data-dashboard-category="player-dna"]').click();
          assert.equal(await page.locator('#dashboard-career-note').isVisible(),true);
          assert.equal(await page.locator('.dashboard-event-filters').isVisible(),false);
          assert.match(await page.locator('#dashboard-studio-strip').textContent(), /using career-wide ratings/);
          await page.locator('[data-dashboard-category="results"]').click();
          assert.equal(await page.locator('#dashboard-career-note').isVisible(),false);
          assert.equal(await page.locator('#stat-format').inputValue(),'mtt');
          await page.locator('[data-stat-reset]').click();
          if (width <= 700) {
            await page.locator('#stat-format').selectOption('mtt', {force:true});
            await page.locator('#dashboard-filter-toggle').click();
            assert.equal(await page.locator('#dashboard-event-scope').isVisible(),false);
            assert.match(await page.locator('[data-dashboard-filter-label]').textContent(), /Multi-table/);
            await page.setViewportSize({width:1440,height:1000});
            assert.equal(await page.locator('#stat-format').inputValue(),'mtt');
            await page.locator('#stat-format-trigger').waitFor();
            await page.setViewportSize({width,height:1000});
            await page.locator('#dashboard-filter-toggle').click();
            await page.locator('[data-stat-reset]').click();
            assert.equal(await page.locator('#stat-format-trigger').evaluate(el=>document.activeElement===el),true);
            await page.locator('#dashboard-filter-toggle').click();
            assert.match(await page.locator('[data-dashboard-filter-label]').textContent(), /All \d+ events/);
          }
        }
        if (name === 'structures') {
          await page.locator('#format-btn-500k').click();
          assert.equal(await page.locator('#format-btn-500k').getAttribute('aria-pressed'),'true');
          await page.locator('#format-btn-40k').click();
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1), false, name + ': no horizontal page overflow');
        await deck.scrollIntoViewIfNeeded();
        await page.screenshot({path:'/tmp/tlpt-controls-' + name + '-' + width + '.png'});
        assert.deepEqual(errors, [], name + ': no JavaScript errors');
        page.off('pageerror', onError);
        console.log('PASS ' + width + 'px ' + name);
      }
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
