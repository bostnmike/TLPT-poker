import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {assertAssetReference} from './asset-reference-test.mjs';
import {canonicalSource} from '../registration-domain/build.mjs';
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(root, "register.html");
const scriptPath = path.join(root, "register.js");
const stylePath = path.join(root, "register.css");

assert.ok(fs.existsSync(pagePath), "register.html must exist");
assert.ok(fs.existsSync(scriptPath), "register.js must exist");
assert.ok(fs.existsSync(stylePath), "register.css must exist");

// The separate registration publisher may read a commit before generated root
// markup is committed. Validate exactly the canonical page it will publish.
const page = canonicalSource();
const script = fs.readFileSync(scriptPath, "utf8");
const style = fs.readFileSync(stylePath, "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");

assert.match(page, /<meta name="robots" content="noindex,nofollow,noarchive"\s*\/>/);
assert.match(page, /<title>Register \| TLPT\.org<\/title>/);
assert.match(page, /action="https:\/\/formsubmit\.co\/blanchettemr@gmail\.com"/);
assert.match(page, /method="post"/);
assert.match(page, /enctype="multipart\/form-data"/);
assert.match(page, /id="avatar-photos" name="attachment" type="file"/, "Avatar photos must use FormSubmit's documented attachment field");
assert.match(page, /name="_next" value="https:\/\/tlpt\.org\/register\.html\?submitted=1"/);
assert.match(page, /name="_captcha" value="true"/);
assert.match(page, /name="_honey"/);
assert.match(page, /name="attachment"[^>]+multiple[^>]+required/);
assert.match(page, /name="Public profile consent"[^>]+required/);
assert.match(page, /name="AI likeness consent"[^>]+required/);
assert.match(page, /name="League humor acknowledged"[^>]+required/);
assert.match(page, /name="Registration packet version" value="3"/);
assert.match(page, /id="registration-packet" name="Registration packet JSON"/);
assert.match(page, /ready-to-review player file/);
assertAssetReference(page, 'register.css');
assertAssetReference(page, 'register.js');
assert.match(page, /<label for="invited-by">Who vouched for you\?/);
assert.match(page, /id="invited-by" name="Vouched for by"/);
assert.doesNotMatch(page, /Who invited you\?/);
assert.ok(script.includes('["Vouched for by", valueOf("invited-by")]'));
assert.match(page, /src="images\/players\/bostnmike\.jpg"/);
assert.match(page, /alt="BostnMike, the TLPT commissioner"/);
assert.doesNotMatch(page, /A welcome from The Commish/);
assert.match(page, /Welcome to TLPT! If you made it this far, you clearly know someone cool\./);
assert.match(page, /This brief reg form gives me what I need to build your profile, create your avatar, and track league results\./);
assert.match(page, /If this feels like overkill for a weekend poker league, you clearly haven’t checked out the rest of the site\./);
assert.equal((page.match(/data-register-step=/g) || []).length, 3, "Register must remain a three-step form");
assert.equal((page.match(/data-progress-step=/g) || []).length, 3, "Register progress must show three steps");
assert.match(page, /register-progress-chip[^>]*aria-hidden="true"><img class="register-progress-chip-image" src="images\/site\/chip-T-25000\.png"/);
assert.match(page, /register-progress-chip[^>]*aria-hidden="true"><img class="register-progress-chip-image" src="images\/site\/chip-T-1000\.png"/);
assert.match(page, /register-progress-chip[^>]*aria-hidden="true"><img class="register-progress-chip-image" src="images\/site\/chip-T-25\.png"/);
assert.equal((page.match(/class="register-progress-chip-image"/g) || []).length, 3);
assert.equal((page.match(/class="register-progress-chip-image"[^>]+width="34" height="34"/g) || []).length, 3);
assert.match(page, /<span class="sr-only">Step 1: <\/span>Name &amp; Contact/);
assert.match(page, /<span class="sr-only">Step 2: <\/span>Avatar/);
assert.match(page, /<span class="sr-only">Step 3: <\/span>Review/);
assert.match(page, /id="first-name" name="First name"[^>]+required/);
assert.match(page, /id="last-name" name="Last name"[^>]+required/);
assert.match(page, /id="nickname" name="Nickname"/);
assert.match(page, /id="registration-email" name="email" type="email"[^>]+required/);
assert.match(page, /id="registration-phone" name="Mobile number" type="tel"[^>]+required/);
assert.match(page, /placeholder="\(555\) 123-4567"/);
assert.ok(page.includes('pattern="\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}"'));
assert.match(page, /TLPT uses a group chat for game invitations, schedule updates, and day-of reminders\./);
assert.doesNotMatch(page, /Name pronunciation|Nicknames or alternate spellings|name="Pronouns"|Preferred contact method|Which games usually work|Usual availability|Table persona|Poker experience|Self-described playing style|Player catchphrase/);
assert.doesNotMatch(page, /About 3–4 minutes|Private link • Commissioner review|register-intake-meta|Moderated intake|register-secure-note/);
assert.match(page, /Review &amp; the table handshake/);
assert.match(page, /Put my poker name on the board\./);
assert.match(page, /appear publicly on TLPT\.org/);
assert.match(page, /publicly show an AI-illustrated player avatar/);
assert.match(page, /reference photos themselves stay off the site/);
assert.match(page, /friendly roasting/);
assert.match(page, /<h2 id="register-confirmation-title">The books are being reviewed\.<\/h2>/);
assert.match(page, /BostnMike \(aka The Commish\) will review your details and confirm whether you’re officially “A Friend of Ours\.”/);
assert.match(page, /Until then, consider yourself a promising associate\./);
assert.match(page, /Once you get the nod, he’ll create your player identity, prepare your avatar, and add you to the roster before your first official appearance\./);
assert.match(page, /No ring-kissing, blood oaths or saint burning required\.<br \/>A timely RSVP wouldn’t hurt\./);
assert.match(style, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);

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
assert.match(script, /schemaVersion:3/);
assert.match(script, /firstName:valueOf|const firstName = valueOf/);
assert.match(script, /lastName:valueOf|const lastName = valueOf/);
assert.doesNotMatch(script, /valueOf\("pronunciation"\)|valueOf\("pronouns"\)|valueOf\("nicknames"\)/);
assert.match(script, /const validateEmail =/);
assert.match(script, /completeEmail = \/\^\[\^\\s@\]\+@/);
assert.doesNotMatch(script, /checkedValue\("Preferred contact method"\)|checkedValue\("Usual availability"\)/);
assert.match(script, /status:"pending-review"/);
assert.match(script, /publicProfileDraft:/);
assert.match(script, /referenceFiles:Array\.from/);
assert.match(script, /JSON\.stringify\(packet\)/);
new vm.Script(script, { filename:"register.js" });

// Exercise the production serialization hook: every selected photo must
// survive under a distinct field, while the JSON and other answers stay intact.
const formListeners = new Map();
const phoneListeners = new Map();
const mockPhone = {
  value:"",
  selectionStart:0,
  validationMessage:"",
  setCustomValidity(message) { this.validationMessage = message; },
  setSelectionRange(start) { this.selectionStart = start; },
  addEventListener:(name, handler) => phoneListeners.set(name, handler),
};
const mockForm = {
  querySelectorAll:() => [],
  querySelector:() => null,
  addEventListener:(name, handler) => formListeners.set(name, handler),
};
vm.runInNewContext(script, {
  document:{
    getElementById:id => id === "register-form" ? mockForm : id === "registration-phone" ? mockPhone : null,
    querySelectorAll:() => [],
    querySelector:() => null,
  },
  window:{location:{search:""}, addEventListener:() => {}},
  URLSearchParams,
  File,
  CSS:{escape:value => value},
});

for (const raw of ["2025550100", "202-555-0100", "(202) 555-0100", "+1 (202) 555-0100", "12025550100", "202.555.0100"]) {
  mockPhone.value = raw;
  mockPhone.selectionStart = raw.length;
  phoneListeners.get("input")();
  assert.equal(mockPhone.value, "(202) 555-0100", `Normalize pasted/typed phone: ${raw}`);
  assert.equal(mockPhone.validationMessage, "");
  assert.equal(mockPhone.selectionStart, 14);
}
for (const raw of ["202", "202555010", "202555010099", "+44 2071234567"]) {
  mockPhone.value = raw;
  mockPhone.selectionStart = raw.length;
  phoneListeners.get("input")();
  assert.match(mockPhone.validationMessage, /10-digit mobile number/);
  assert.equal(mockPhone.value.replace(/\D/g, ""), raw.replace(/\D/g, ""), "Never discard excess digits to fabricate a valid number");
}
mockPhone.value = "2026550100";
mockPhone.selectionStart = 4;
phoneListeners.get("input")();
assert.equal(mockPhone.value, "(202) 655-0100");
assert.equal(mockPhone.selectionStart, 7, "Editing in the middle should not jump to the end");
mockPhone.value = "";
mockPhone.selectionStart = 0;
phoneListeners.get("input")();
assert.equal(mockPhone.value, "");
assert.equal(mockPhone.validationMessage, "", "Empty input is handled by the required attribute");
mockPhone.value = "2025550100";
phoneListeners.get("blur")();
assert.equal(mockPhone.value, "(202) 555-0100", "Normalize autofilled values on blur as well");

for (const photoCount of [1, 2, 4]) {
  const data = new FormData();
  const photos = Array.from({length:photoCount}, (_, index) =>
    new File([`photo-${index}`], `reference-${index + 1}.png`, {type:"image/png"}));
  photos.forEach(photo => data.append("attachment", photo));
  data.append("Registration packet JSON", '{"status":"pending-review"}');
  formListeners.get("formdata")({formData:data});
  const uploaded = Array.from(data.entries()).filter(([, value]) => value instanceof File);
  assert.equal(uploaded.length, photoCount, "Every photo must survive serialization");
  assert.equal(new Set(uploaded.map(([name]) => name)).size, photoCount, "Each photo needs a unique multipart name");
  assert.deepEqual(uploaded.map(([, file]) => file.name), photos.map(file => file.name));
  assert.equal(data.get("Registration packet JSON"), '{"status":"pending-review"}');
}

console.log("Hidden registration page checks passed.");
