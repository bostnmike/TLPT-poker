import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(root, "register.html");
const scriptPath = path.join(root, "register.js");
const stylePath = path.join(root, "register.css");

assert.ok(fs.existsSync(pagePath), "register.html must exist");
assert.ok(fs.existsSync(scriptPath), "register.js must exist");
assert.ok(fs.existsSync(stylePath), "register.css must exist");

const page = fs.readFileSync(pagePath, "utf8");
const script = fs.readFileSync(scriptPath, "utf8");
const style = fs.readFileSync(stylePath, "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");

assert.match(page, /<meta name="robots" content="noindex,nofollow,noarchive"\s*\/>/);
assert.match(page, /<title>Register \| TLPT\.org<\/title>/);
assert.match(page, /action="https:\/\/formsubmit\.co\/blanchettemr@gmail\.com"/);
assert.match(page, /method="post"/);
assert.match(page, /enctype="multipart\/form-data"/);
assert.match(page, /name="_next" value="https:\/\/tlpt\.org\/register\.html\?submitted=1"/);
assert.match(page, /name="_captcha" value="true"/);
assert.match(page, /name="_honey"/);
assert.match(page, /name="Avatar reference photos"[^>]+multiple[^>]+required/);
assert.match(page, /name="Public profile consent"[^>]+required/);
assert.match(page, /name="AI likeness consent"[^>]+required/);
assert.match(page, /name="League humor acknowledged"[^>]+required/);
assert.match(page, /name="Registration packet version" value="1"/);
assert.match(page, /id="registration-packet" name="Registration packet JSON"/);
assert.match(page, /href="register\.css\?v=20261015-3"/);
assert.match(page, /src="register\.js\?v=20261015-2"/);
assert.match(page, /src="images\/players\/bostnmike\.jpg"/);
assert.match(page, /alt="BostnMike, the TLPT commissioner"/);
assert.match(page, /If you made it this far, you clearly know someone cool\./);
assert.match(page, /If this feels like overkill for a weekend poker league, you clearly haven’t checked out the rest of the site\./);
assert.equal((page.match(/data-register-step=/g) || []).length, 4, "Register must remain a four-step form");
assert.equal((page.match(/data-progress-step=/g) || []).length, 4, "Register progress must show four steps");
assert.doesNotMatch(page, /Table persona|Poker experience|Self-described playing style|Player catchphrase/);
assert.match(page, /BostnMike \(aka The Commish\) will create your player identity, prepare your avatar, and add you to the roster before your first official appearance\./);
assert.match(page, /The statistics—and regrettable decisions—begin at the table\. Welcome to the league!/);
assert.match(style, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);

const nav = page.match(/<nav class="nav">([\s\S]*?)<\/nav>/)?.[1] || "";
assert.doesNotMatch(nav, /href="register\.html"/, "Register must remain unlisted in navigation");
assert.doesNotMatch(sitemap, /register\.html/, "Register must remain outside the sitemap");

for (const filename of fs.readdirSync(root).filter(name => name.endsWith(".html") && name !== "register.html")) {
  const source = fs.readFileSync(path.join(root, filename), "utf8");
  assert.doesNotMatch(source, /href=["'](?:\.\/)?register\.html(?:[?#][^"']*)?["']/, `${filename} must not link to Register`);
}

assert.match(script, /10 \* 1024 \* 1024/);
assert.match(script, /files\.length > 4/);
assert.match(script, /images\/players\/\$\{slug\}\.jpg/);
assert.match(script, /query\.get\("submitted"\) === "1"/);
assert.match(script, /schemaVersion:1/);
assert.match(script, /status:"pending-review"/);
assert.match(script, /publicProfileDraft:/);
assert.match(script, /referenceFiles:Array\.from/);
assert.match(script, /JSON\.stringify\(packet\)/);
new vm.Script(script, { filename:"register.js" });

console.log("Hidden registration page checks passed.");
