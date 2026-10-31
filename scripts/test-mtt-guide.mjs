import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../mtt-guide.js", import.meta.url), "utf8");
function element(attrs = {}) {
  const listeners = {};
  const classes = new Set();
  return {
    attrs, listeners, hidden: false, disabled: true, dataset: {}, textContent: "",
    classList: { add: key => classes.add(key), remove: key => classes.delete(key), contains: key => classes.has(key) },
    setAttribute: (key, value) => { attrs[key] = value; },
    getAttribute: key => attrs[key] ?? null,
    addEventListener: (key, fn) => { listeners[key] = fn; },
    click() { listeners.click(); }
  };
}

for (const hasFormats of [true, false]) {
  const toggle = element({"aria-expanded":"false"});
  const panel = element(); panel.hidden = true;
  const frame = element(); frame.dataset.src = "downloads/mtt-guide-viewer.html?v=20261018-2";
  const print = element(); const status = element(); const content = element();
  let printCalls = 0;
  frame.contentWindow = {focus() {}, print() { printCalls++; }};
  const formats = hasFormats ? [element({"aria-pressed":"true"}), element({"aria-pressed":"false"})] : [];
  formats[0]?.classList.add("active");
  panel.querySelector = selector => ({"iframe":frame,"[data-mtt-guide-print]":print,"[data-mtt-guide-status]":status}[selector]);
  const events = {};
  const document = {
    querySelector: selector => ({"[data-mtt-guide-toggle]":toggle,".format-content-shell":hasFormats ? content : null}[selector]),
    getElementById: () => panel,
    querySelectorAll: () => formats
  };
  const window = {location:{origin:"https://tlpt.org"},addEventListener:(type, handler) => { events[type] = handler; }};
  vm.runInNewContext(source, {document,window});
  assert.equal(frame.getAttribute("src"), null, "PDF must load only on request");
  toggle.click();
  assert.equal(panel.hidden, false);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(frame.getAttribute("src"), frame.dataset.src);
  if (hasFormats) {
    assert.equal(content.hidden, true);
    assert.equal(formats[0].getAttribute("aria-pressed"), "false");
  }
  assert.equal(print.disabled, true);
  const ready = {origin:"https://tlpt.org",source:frame.contentWindow,data:{type:"mtt-guide-ready"}};
  events.message({...ready,origin:"https://example.org"});
  events.message({...ready,source:{}});
  assert.equal(print.disabled, true, "Untrusted messages cannot enable printing");
  events.message(ready);
  assert.equal(print.disabled, false);
  print.click(); assert.equal(printCalls, 1);
  frame.contentWindow.print = () => { throw new Error("Unsupported"); };
  print.click(); assert.match(status.textContent, /Download/);
  events.message({...ready,data:{type:"mtt-guide-error"}});
  assert.equal(print.disabled, true);
  toggle.click();
  assert.equal(panel.hidden, true);
  if (hasFormats) {
    assert.equal(content.hidden, false);
    assert.equal(formats[0].getAttribute("aria-pressed"), "true");
    toggle.click();
    formats[1].setAttribute("aria-pressed", "true");
    formats[1].click();
    assert.equal(panel.hidden, true);
    assert.equal(content.hidden, false);
    assert.equal(formats[0].getAttribute("aria-pressed"), "false");
    assert.equal(formats[1].getAttribute("aria-pressed"), "true");
  }
}
const viewer = fs.readFileSync(new URL("../downloads/mtt-guide-viewer.html", import.meta.url), "utf8");
assert.match(viewer, /await page\.render/);
assert.match(viewer, /getTextContent/);
assert.match(viewer, /@media print/);
assert.match(viewer, /break-after:page/);
assert.match(viewer, /isEvalSupported: false/);
assert.ok(viewer.indexOf('await page.render') < viewer.indexOf('type:"mtt-guide-ready"'));
console.log("PASS: inline MTT guide lazy loading, toggle/format restoration, print readiness, error fallback, trusted messages and accessible two-page rendering");
