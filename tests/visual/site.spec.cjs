// Public frozen fixtures only. Never call live RSVP, registration or payment APIs.
const {test, expect, chromium} = require('playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = path.join(__dirname, 'fixtures');
async function prepare(page) {
  await page.clock.setFixedTime(new Date('2026-10-26T16:00:00-04:00'));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      if (url.href.includes('/api/public/events')) {
        const data = JSON.parse(fs.readFileSync(path.join(fixtures, 'data/events.json')));
        // The frozen snapshot predates the live switch. Explicitly mark its
        // already-reviewed open games as open; do not alter fixture data/pixels.
        return route.fulfill({json: {schemaVersion: 1, revision: 'visual-fixture', events: data.events.map(event => ({...event, rsvpOpen: true})), noGameDays: []}});
      }
      return route.abort();
    }
    if (url.pathname.endsWith('.json')) {
      const file = path.join(fixtures, url.pathname);
      if (!file.startsWith(fixtures + path.sep) || !fs.existsSync(file))
        throw new Error('Missing frozen visual fixture: ' + url.pathname);
      return route.fulfill({path: file, contentType: 'application/json'});
    }
    return route.continue();
  });
}
test.beforeEach(async ({page}) => prepare(page));
async function ready(page, name) {
  await page.goto('/' + name + '.html');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1, 1);
}
async function snapshot(target, name, page) {
  if (typeof target.scrollIntoViewIfNeeded === 'function') {
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await target.scrollIntoViewIfNeeded();
  }
  // Native Chromium audio chrome changes its own compact control selection
  // nondeterministically. Mask only that browser-owned rectangle, never TLPT's
  // headshot, caption, read-me or container. Functional gates verify playback,
  // dimensions and wrapping separately; all site-owned pixels stay compared.
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).filter(img => {
      const box = img.getBoundingClientRect();
      return box.width && box.height && box.top < innerHeight && box.bottom > 0;
    }).map(img => img.decode().catch(() => {})));
  });
  const options = {mask: [target.locator('audio')], maskColor: '#c9d1d9'};
  // With updateSnapshots:none Playwright rejects missing references before
  // writing an actual image. Save a review candidate ONLY in the report folder;
  // never write or approve a baseline from this test.
  if (!fs.existsSync(test.info().snapshotPath(name))) {
    const candidate = test.info().outputPath(name.replace('.png', '-candidate.png'));
    await target.screenshot({...options, path: candidate, animations: 'disabled', caret: 'hide', scale: 'css'});
    await test.info().attach(name, {path: candidate, contentType: 'image/png'});
  }
  // Collect all differences in a scene while still failing the test/run.
  await expect.soft(target).toHaveScreenshot(name, options);
}
const pages = ['index', 'dashboard', 'players', 'rules', 'structures', 'trophy-room', 'form-lab', 'register'];
for (const name of pages) test(name + ' page entrance', async ({page}) => {
  await ready(page, name);
  if (name === 'dashboard') await expect(page.locator('#dashboard-grid')).not.toBeEmpty();
  if (name === 'players') await expect(page.locator('#players-grid')).not.toBeEmpty();
  if (name === 'trophy-room') await expect(page.locator('#trophy-result-count')).not.toContainText('Loading');
  if (name === 'form-lab') await expect(page.locator('#fl-player-select')).not.toBeEmpty();
  await snapshot(page, name + '-entrance.png', page);
});
test('rules badges and avatars', async ({page}) => {
  await ready(page, 'rules');
  // This isolated case captures a chapter taller than the viewport. Remove
  // only the unrelated fixed overlays before scrolling; screenshot-time style
  // injection can race Chromium's sticky-layer repaint. Keep their layout space.
  // Separate entrance/menu cases still compare the unmodified header/skip link.
  await page.locator('.site-header, .skip-link').evaluateAll(elements => {
    for (const element of elements) element.style.setProperty('opacity', '0', 'important');
  });
  await snapshot(page.locator('#rules-money'), 'rules-money.png', page);
});
test('trophy dropdown above artwork', async ({page}) => {
  await ready(page, 'trophy-room');
  await page.locator('#trophy-year-filter-trigger').click();
  await expect(page.locator('#trophy-year-filter-menu')).toBeVisible();
  await snapshot(page, 'trophy-dropdown.png', page);
});
test('form lab axis dropdown', async ({page}) => {
  await ready(page, 'form-lab');
  await page.locator('.fl-chart-options summary').click();
  await page.locator('#fl-x-select-trigger').click();
  await expect(page.locator('#fl-x-select-menu')).toBeVisible();
  await snapshot(page, 'form-lab-dropdown.png', page);
});
test('dashboard help dialog', async ({page}) => {
  await ready(page, 'dashboard');
  await page.locator('[data-dashboard-help-open]').click();
  await snapshot(page.locator('#dashboard-help'), 'dashboard-help.png', page);
});
test('Norm inline player and read-me', async ({page}) => {
  await ready(page, 'dashboard');
  await snapshot(page.locator('.norm-page-guide'), 'norm-inline.png', page);
});
test('shared navigation expanded and footer', async ({page}) => {
  await ready(page, 'rules');
  const toggle = page.locator('.site-nav-toggle');
  if (await toggle.isVisible()) {
    await toggle.click();
    const menu = page.locator('.nav-dropdown').filter({has: page.locator('a.nav-dropdown-parent[href$="schedule.html"]')});
    await menu.getByRole('button').click();
    await snapshot(page.locator('.site-header'), 'navigation-expanded.png', page);
  }
  // A tab/context still shares Chromium's process-level font/raster caches.
  // Isolate this fractional-position text capture from prior viewport scenes.
  // Keep the same pinned Chromium, context settings, fixtures and screenshot
  // comparison. Do not modify, mask or move any footer content.
  const {browserName, headless, trace, ...contextOptions} = test.info().project.use;
  const footerBrowser = await chromium.launch({headless});
  try {
    const footerContext = await footerBrowser.newContext(contextOptions);
    const footerPage = await footerContext.newPage();
    await prepare(footerPage);
    await ready(footerPage, 'rules');
    await footerPage.locator('.site-footer').scrollIntoViewIfNeeded();
    await footerPage.mouse.move(1, 1);
    await expect(footerPage.locator('.site-footer a')).toHaveCSS('color', 'rgb(255, 184, 28)');
    await snapshot(footerPage.locator('.site-footer'), 'footer.png', footerPage);
    await test.info().attach('footer-render-state', {contentType:'application/json', body:JSON.stringify(await footerPage.locator('.site-footer a').evaluate(link => {
      const box = link.getBoundingClientRect(), style = getComputedStyle(link);
      return {x:box.x, y:box.y, width:box.width, height:box.height, font:style.font, color:style.color,
        hovered:link.matches(':hover'), focused:document.activeElement === link,
        fonts:document.fonts.status, deviceScaleFactor:devicePixelRatio};
    }))});
  } finally {
    await footerBrowser.close();
  }
});
