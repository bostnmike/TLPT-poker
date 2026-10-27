// Smoke-test the pinned image before any site assertions; no production access.
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
  const expected = require('../tests/visual/environment.json');
  assert.equal(require('playwright/package.json').version, expected.playwrightVersion);
  assert.equal(process.env.TLPT_BROWSER_IMAGE, expected.image);
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent('<p style="font-family:Arial">TLPT browser readiness</p>');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot();
    const receipt = {image:expected.image, playwright:expected.playwrightVersion,
      chromium:browser.version(), node:process.version,
      arial:execFileSync('fc-match', ['Arial'], {encoding:'utf8'}).trim(),
      symbolFonts:Object.fromEntries(['2197','25be','25bc','25b6'].map(code => [code,
        execFileSync('fc-match', ['-f', '%{file}', `Arial:charset=${code}`], {encoding:'utf8'}).trim()]))};
    fs.mkdirSync('browser-results', {recursive:true});
    fs.writeFileSync('browser-results/environment.json', JSON.stringify(receipt, null, 2));
    console.log('PASS: pinned browser environment', receipt);
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
