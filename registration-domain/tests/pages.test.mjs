import assert from "node:assert/strict";
import {test} from "node:test";
import {readFile, mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {registrationPage, build, canonicalSource} from "../build.mjs";

const source = canonicalSource();

test("canonical rendering is deterministic and never mutates root HTML", async () => {
  const file = new URL('../../register.html', import.meta.url);
  const before = await readFile(file, 'utf8');
  assert.equal(canonicalSource(), source);
  assert.equal(await readFile(file, 'utf8'), before);
  assert.match(source, /register\.js\?v=[a-f0-9]{16}/);
  assert.match(source, /TLPT GENERATED HEADER/);
});

test("static registration preserves the form, attachments, privacy and branded return URL", () => {
  const html = registrationPage(source);
  assert.match(html, /<base href="https:\/\/tlpt\.org\/"/);
  assert.match(html, /href="https:\/\/register\.tlpt\.org\/#main-content"/);
  assert.match(html, /name="_next" value="https:\/\/register\.tlpt\.org\/\?submitted=1"/);
  assert.match(html, /action="https:\/\/formsubmit\.co\/blanchettemr@gmail\.com"/);
  assert.match(html, /enctype="multipart\/form-data"/);
  assert.match(html, /name="attachment"[^>]*multiple[^>]*required/);
  assert.match(html, /name="_captcha" value="true"/);
  assert.match(html, /content="noindex,nofollow,noarchive"/);
  // Only hosting-specific URLs change; the entire working form stays intact.
  assert.equal(html.replace('  <base href="https://tlpt.org/" />\n', '')
    .replace('https://register.tlpt.org/?submitted=1', 'https://tlpt.org/register.html?submitted=1')
    .replaceAll('href="https://register.tlpt.org/#', 'href="#'), source);
});

test("build outputs only the registration pages and hosting metadata", async () => {
  const output = await mkdtemp(join(tmpdir(), "tlpt-register-pages-test-"));
  await build(output);
  assert.equal(await readFile(join(output, "index.html"), "utf8"), registrationPage(source));
  assert.equal(await readFile(join(output, "register.html"), "utf8"), registrationPage(source));
  assert.equal(await readFile(join(output, "CNAME"), "utf8"), "register.tlpt.org\n");
  assert.equal(await readFile(join(output, "robots.txt"), "utf8"), "User-agent: *\nDisallow: /\n");
});

test("refuses to publish an unexpected or indexable source", () => {
  for (const html of ["Wrong page", source.replace('name="_next"', 'name="broken"'),
    source.replace("noindex,nofollow,noarchive", "index"), source.replace("formsubmit.co", "invalid.example")]) {
    assert.throws(() => registrationPage(html), /Unexpected registration source/);
  }
});
