import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {registrationPage, canonicalSource} from './build.mjs';
import {matchesPublishedContent} from './published-content.mjs';
import {matchesPublishedRevision} from './published-revision.mjs';

const revision = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(revision ?? '')) {
  throw new Error('Pass the full canonical source commit SHA');
}
const source = canonicalSource();
const checks = [
  ['https://register.tlpt.org/source-revision.txt', `${revision}\n`, false, true],
  ['https://register.tlpt.org/', registrationPage(source)],
  ['https://register.tlpt.org/register.html', registrationPage(source)],
  ['https://tlpt.org/register.html', source, true],
  ...await Promise.all(['register.css', 'register.js'].map(async name => [
    `https://tlpt.org/${name}`, await readFile(new URL(`../${name}`, import.meta.url), 'utf8'),
  ])),
];

// Pages releases and CDN caches can settle independently. Completion requires
// the expected content at both public addresses, not just an accepted push.
const deadline = Date.now() + 12 * 60_000;
let previous = '';
let attempt = 0;
const comparisons = new Map();
async function compare(base, head) {
  const key = `${base}...${head}`;
  if (!comparisons.has(key)) {
    const response = await fetch(`https://api.github.com/repos/bostnmike/TLPT-poker/compare/${key}`, {
      signal: AbortSignal.timeout(15_000), headers: {Accept:'application/vnd.github+json'},
    });
    if (!response.ok) throw Error('Cannot prove published revision ancestry');
    comparisons.set(key, await response.json());
  }
  return comparisons.get(key);
}
while (true) {
  attempt++;
  const pending = (await Promise.all(checks.map(async ([address, expected, allowEmailMarkerRemoval, marker]) => {
    const url = new URL(address);
    url.searchParams.set('release', revision);
    url.searchParams.set('check', String(attempt));
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(15_000), cache: 'no-store'});
      if (!response.ok) return address;
      const actual = await response.text();
      const matched = marker ? await matchesPublishedRevision(actual, revision, compare) :
        matchesPublishedContent(actual, expected, allowEmailMarkerRemoval);
      return matched ? null : address;
    } catch {
      return address;
    }
  }))).filter(Boolean);
  if (!pending.length) {
    console.log(`Verified exact registration content and shared assets for ${revision}; publisher marker is exact or a proven descendant.`);
    break;
  }
  const status = pending.join(', ');
  if (status !== previous) console.log(`Waiting for publication: ${status}`);
  previous = status;
  if (Date.now() >= deadline) throw new Error(`Live publication did not converge: ${status}`);
  await delay(10_000);
}
