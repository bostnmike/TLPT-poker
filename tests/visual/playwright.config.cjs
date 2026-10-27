const {defineConfig} = require('playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'site.spec.cjs',
  outputDir: path.join(root, 'browser-results/visual'),
  snapshotPathTemplate: '{testDir}/baselines/{platform}/{projectName}/{arg}{ext}',
  updateSnapshots: 'none',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: [['list'], ['html', {outputFolder: path.join(root, 'browser-results/visual-report'), open: 'never'}]],
  expect: {timeout: 10000, toHaveScreenshot: {animations: 'disabled', caret: 'hide', scale: 'css', threshold: 0.15, maxDiffPixels: 30}},
  use: {browserName: 'chromium', headless: true, baseURL: 'http://127.0.0.1:8775',
    locale: 'en-US', timezoneId: 'America/New_York', colorScheme: 'dark', reducedMotion: 'reduce',
    deviceScaleFactor: 1, serviceWorkers: 'block', trace: 'retain-on-failure'},
  projects: [1440, 820, 390, 320].map(width => ({name: String(width), use: {viewport: {width, height: 1000}}})),
  webServer: {command: 'python3 -m http.server 8775 --bind 127.0.0.1 --directory .site-release',
    cwd: root, url: 'http://127.0.0.1:8775/index.html', reuseExistingServer: false, timeout: 15000}
});
