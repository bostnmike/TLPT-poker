import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {registrationPage, canonicalSource} from './build.mjs';

const revision = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(revision ?? '')) {
  throw new Error('Pass the full canonical source commit SHA');
}
const source = canonicalSource();
const checks = [
  ['https://register.tlpt.org/source-revision.txt', `${revision}\n`],
  ['https://register.tlpt.org/', registrationPage(source)],
  ['https://register.tlpt.org/register.html', registrationPage(source)],
  ['https://tlpt.org/register.html', source],
  ...await Promise.all(['register.css', 'register.js'].map(async name => [
    `https://tlpt.org/${name}`, await readFile(new URL(`../${name}`, import.meta.url), 'utf8'),
  ])),
];

// Pages releases and CDN caches can settle independently. Completion requires
// the expected content at both public addresses, not just an accepted push.
const deadline = Date.now() + 12 * 60_000;
let previous = '';
let attempt = 0;
while (true) {
  attempt++;
  const pending = (await Promise.all(checks.map(async ([address, expected]) => {
    const url = new URL(address);
    url.searchParams.set('release', revision);
    url.searchParams.set('check', String(attempt));
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(15_000), cache: 'no-store'});
      return response.ok && await response.text() === expected ? null : address;
    } catch {
      return address;
    }
  }))).filter(Boolean);
  if (!pending.length) {
    console.log(`Verified ${revision} on both registration addresses and shared form assets.`);
    break;
  }
  const status = pending.join(', ');
  if (status !== previous) console.log(`Waiting for publication: ${status}`);
  previous = status;
  if (Date.now() >= deadline) throw new Error(`Live publication did not converge: ${status}`);
  await delay(10_000);
}
