/* Required public-artifact regression: NODE_PATH=<playwright packages> node scripts/test-stat-scope-browser.cjs [base URL] */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const {mockRsvpFeed} = require('./browser-rsvp-fixture.cjs');
const events = require('../data/generated/stat-events.json').events;
const mttBounty = events.filter(e => e.format === 'mtt' && e.bounty);
const mttNoBounty = events.filter(e => e.format === 'mtt' && !e.bounty);
const mttPlayers = new Set(mttBounty.flatMap(e => e.players.filter(p => p.entries > 0).map(p => p.slug)));
const providenceCash = mttBounty.reduce((sum,e) => sum + (e.players.find(p => p.slug === 'providencemike')?.totalWinnings || 0), 0);
const base = process.argv[2] || 'http://127.0.0.1:8766';
(async () => {
  const browser = await chromium.launch({ ...(process.env.CI ? {} : {channel:'chrome'}), headless: true });
  try {
    for (const width of [1440, 820, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      // Legacy saved choices must never change the default on any page.
      await context.addInitScript(() => sessionStorage.setItem('tlpt-stat-scope', JSON.stringify({format:'mtt',bounty:'with'})));
      const page = await context.newPage();
      await mockRsvpFeed(page);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      async function choose(key, value) {
        const trigger = page.locator(`#stat-${key}-trigger`);
        await trigger.click();
        const menu = page.locator(`#stat-${key}-menu`);
        await page.waitForFunction(key => {
          const a = document.getElementById(`stat-${key}-trigger`).getBoundingClientRect();
          const b = document.getElementById(`stat-${key}-menu`).getBoundingClientRect();
          return b.top >= a.bottom - 1;
        }, key);
        const a = await trigger.boundingBox(), b = await menu.boundingBox();
        assert.ok(b.y >= a.y + a.height - 1, 'Menu must sit below control');
        assert.ok(b.x >= 0 && b.x + b.width <= width + 1, 'Menu must fit viewport');
        await menu.locator(`[data-value="${value}"]`).click();
      }
      async function assertFinancialParticipants(selected, metric) {
        const participants = new Map();
        for (const event of selected) for (const row of event.players) {
          if (!(row.buyIns > 0)) continue;
          const total = participants.get(row.name) || {profit:0, cost:0, bountyNet:0};
          total.profit += Math.round(row.profit * 100);
          total.cost += Math.round(row.totalCost * 100);
          total.bountyNet += Math.round((row.bountyNet || 0) * 100);
          participants.set(row.name, total);
        }
        const cards = await page.locator('#dashboard-grid .dashboard-card').evaluateAll(nodes => nodes.map(el => ({
          name:new URL(el.href).searchParams.get('name'),
          rank:Number(el.querySelector('.dashboard-list-rank').textContent),
          value:el.querySelector('.dashboard-card-value').dataset.targetValue,
          neutral:el.querySelector('.dashboard-card-value').classList.contains('neutral')
        })));
        assert.deepEqual(cards.map(c => c.name).sort(), [...participants.keys()].sort(), `${metric}: every participant, including zero and first appearances`);
        const actualByRank = [...cards].sort((a,b) => a.rank-b.rank);
        const valueFor = name => {
          const p = participants.get(name);
          return metric === 'roi' ? (p.cost ? p.profit/p.cost : 0) : p[metric];
        };
        for (let i=0; i<actualByRank.length; i++) {
          const card = actualByRank[i];
          assert.equal(card.rank, i+1, 'Global ranks remain contiguous across roster sections');
          if (i) assert.ok(valueFor(actualByRank[i-1].name) >= valueFor(card.name), 'Positive, zero and negative values rank numerically');
          if (valueFor(card.name) === 0) {
            assert.equal(card.value, metric === 'roi' ? '0.0%' : '$0', `${card.name}: recorded zero is visible`);
            if (metric !== 'roi') assert.equal(card.neutral, true, `${card.name}: zero is neutral`);
          }
        }
      }
      for (const file of ['dashboard.html', 'standings.html', 'knockouts.html', 'player.html?name=ProvidenceMike', 'form-lab.html', 'streaks.html', 'player-movement.html']) {
        await page.goto(`${base}/${file}`);
        await page.evaluate(() => document.fonts.ready);
        if (file.startsWith('dashboard') && width <= 700) {
          await page.locator('#dashboard-grid .dashboard-card').first().waitFor({state:'attached'});
          assert.equal(await page.locator('#dashboard-event-scope').isVisible(), false);
          await page.locator('#dashboard-filter-toggle').click();
        }
        await page.locator('#stat-format-trigger').waitFor();
        assert.match(await page.locator('#stat-format-trigger').innerText(), /All Formats/);
        assert.match(await page.locator('#stat-bounty-trigger').innerText(), /All Events/);
        await page.waitForFunction(count => document.querySelector('[data-stat-scope-summary]').textContent.includes(`${count} matching event`), events.length);
        assert.equal(await page.locator('[data-stat-reset]').getAttribute('aria-disabled'), 'true');
        if (file.startsWith('dashboard')) assert.equal(await page.locator('[data-stat-reset]').isVisible(), false);
        if (file.startsWith('dashboard')) {
          for (const format of ['all','single','mtt']) for (const bounty of ['all','with','without']) {
            await choose('format', format);
            await choose('bounty', bounty);
            const selected = events.filter(e => (format === 'all' || e.format === format)
              && (bounty === 'all' || e.bounty === (bounty === 'with')));
            for (const metric of ['profit','bountyNet','roi']) {
              await page.locator(`[data-dashboard-category="${metric === 'roi' ? 'rates' : 'bankroll'}"]`).click();
              await page.locator('#dashboard-metric-select-trigger').click();
              await page.locator(`#dashboard-metric-select-menu [data-value="${metric}"]`).click();
              await assertFinancialParticipants(selected, metric);
            }
          }
          await page.locator('[data-dashboard-category="results"]').click();
          await page.locator('[data-stat-reset]').click();
        }
        await choose('format', 'mtt');
        await choose('bounty', 'with');
        await page.waitForFunction(count => document.querySelector('[data-stat-scope-summary]').textContent.includes(`${count} matching event`), mttBounty.length);
        if (file.startsWith('dashboard')) {
          assert.ok(await page.locator('#dashboard-grid').innerText());
          await page.locator('[data-dashboard-category="player-dna"]').click();
          assert.equal(await page.locator('#dashboard-career-note').isVisible(), true);
          await page.locator('[data-dashboard-category="results"]').click();
        }
        if (file.startsWith('standings')) assert.equal(await page.locator('#standings-table tbody .standings-row-link').count(), mttPlayers.size);
        if (file.startsWith('player.html')) {
          await page.locator('.player-body-count-card').waitFor();
          assert.ok((await page.locator('#player-stats').innerText()).includes(`$${providenceCash.toLocaleString('en-US')}`));
          assert.equal(await page.locator('.player-dna-card').count(), 1);
        }
        if (file.startsWith('form-lab')) {
          await page.locator('#fl-player-select').selectOption({ label: 'Liam O' }, { force: true });
          const liamCount = mttBounty.filter(e => e.players.some(p => p.slug === 'liam-o' && p.entries > 0)).length;
          assert.ok((await page.locator('#fl-player-card').innerText()).includes(`${Math.min(6,liamCount)} shown / ${liamCount} matching event`));
        }
        if (file.startsWith('streaks')) {
          assert.match(await page.locator('#streak-longest-title').innerText(), /in This View/);
          if (mttBounty.length < 2) assert.match(await page.locator('#streak-player-detail').innerText(), /two matching appearances/);
        }
        if (file.startsWith('player-movement')) {
          await page.locator('.pm-btn[data-sort="cold"]').click();
          if (mttBounty.length < 4) assert.match(await page.locator('#pm-top-movers').innerText(), /four matching appearances/);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `${file} overflows at ${width}px`);
        await choose('bounty', 'without');
        await page.waitForFunction(count => document.querySelector('[data-stat-scope-summary]').textContent.includes(`${count} matching event`), mttNoBounty.length);
        if (!mttNoBounty.length && file.startsWith('standings')) assert.match(await page.locator('#standings-table tbody').innerText(), /No results match/);
        if (!mttNoBounty.length && file.startsWith('form-lab')) assert.match(await page.locator('#fl-chart-subtitle').innerText(), /no results in the selected events/);
        await page.locator('[data-stat-reset]').click();
        assert.match(await page.locator('#stat-format-trigger').innerText(), /All Formats/);
        assert.match(await page.locator('#stat-bounty-trigger').innerText(), /All Events/);
        if (file.startsWith('streaks')) {
          assert.match(await page.locator('#streak-longest-title').innerText(), /All-Time Heaters/);
          assert.ok(await page.locator('#streak-player-select option').count() > 1);
        }
        if (file.startsWith('player-movement')) {
          assert.equal(await page.locator('.pm-btn[data-sort="cold"]').getAttribute('aria-pressed'), 'true');
          assert.ok(await page.locator('#pm-player-grid .pm-player-card').count() > 0);
        }
        console.log(`PASS ${width}px ${file}: filters, empty state, reset, overlay and width`);
      }
      await choose('format', 'mtt');
      await choose('bounty', 'with');
      await page.reload();
      await page.locator('#stat-format-trigger').waitFor();
      assert.match(await page.locator('#stat-format-trigger').innerText(), /All Formats/);
      assert.match(await page.locator('#stat-bounty-trigger').innerText(), /All Events/);
      await choose('format', 'mtt');
      await choose('bounty', 'with');
      await page.goto(`${base}/standings.html`);
      await page.locator('#stat-format-trigger').waitFor();
      assert.match(await page.locator('#stat-format-trigger').innerText(), /All Formats/);
      assert.match(await page.locator('#stat-bounty-trigger').innerText(), /All Events/);
      await page.locator('#stat-format-trigger').focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('Enter');
      assert.match(await page.locator('#stat-format-trigger').innerText(), /All Formats/);
      assert.equal(errors.length, 0, errors.join('\n'));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
