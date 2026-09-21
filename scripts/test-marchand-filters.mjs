import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Exercise the real page's event handlers and rendered rows without network access.
const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const html = read("marchand.html");
const payload = JSON.parse(read("data/marchand-pucks.json"));
const decoder = JSON.parse(read("data/marchand-players.json"));
class Element {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.events = new Map();
    this.value = "";
    this.checked = false;
    this.hidden = false;
    this.classList = { add() {}, toggle() {} };
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text || "") + this.children.map((child) => child.textContent).join(""); }
  set innerHTML(value) { this.textContent = value; }
  append(...nodes) { for (const node of nodes) this.children.push(...(node.tag === "fragment" ? node.children : [node])); }
  replaceChildren(...nodes) { this.text = ""; this.children = []; this.append(...nodes); }
  addEventListener(type, handler) { this.events.set(type, [...(this.events.get(type) || []), handler]); }
  dispatch(type) { for (const handler of this.events.get(type) || []) handler({ target: this }); }
  click() { this.dispatch("click"); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key); }
  removeAttribute(key) { this.attributes.delete(key); }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch("close"); }
}
const ids = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], new Element()]));
const statButtons = [...html.matchAll(/<button[^>]*data-collection-filter="([^"]+)"[^>]*>/g)].map((match) => {
  const button = new Element("button");
  button.dataset.collectionFilter = match[1].replaceAll("&amp;", "&");
  return button;
});
const eraButtons = [...html.matchAll(/<button[^>]*data-era-button="([^"]+)"[^>]*>/g)].map((match) => {
  const button = new Element("button");
  button.dataset.eraButton = match[1];
  return button;
});
const reset = new Element("button");
const body = new Element("body");
const errors = [];
vm.runInNewContext(read("marchand.js"), {
  document: {
    body,
    getElementById: (id) => { assert.ok(ids.has(id), `missing element ${id}`); return ids.get(id); },
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element("fragment"),
    querySelector: (selector) => { assert.equal(selector, "[data-empty-reset]"); return reset; },
    querySelectorAll: (selector) => ({ "[data-collection-filter]": statButtons, "[data-era-button]": eraButtons, "[data-sort]": [] })[selector] || [],
  },
  window: { location: { search: "?artifact=goal-72" }, matchMedia: () => ({ matches: true }) },
  fetch: async (url) => ({ ok: true, json: async () => url.includes("players") ? decoder : payload }),
  console: { error: (...args) => errors.push(args) },
  URLSearchParams, Intl, Date,
});
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(errors, []);
const element = (id) => ids.get(id);
const rows = () => element("collection-body").children;
const shownIds = () => rows().map((row) => Number(row.children[0].textContent));
const pressStat = (filter) => statButtons.find((button) => button.dataset.collectionFilter === filter).click();
const change = (id, value) => { element(id).value = value; element(id).dispatch("change"); };
assert.equal(statButtons.length, 5);
assert.equal(rows().length, 122);
assert.equal(element("artifact-dialog").open, true, "vault artifact links should open the requested deep dive on page load");
assert.equal(element("artifact-dialog-number").textContent, "Artifact No. 72");
element("artifact-dialog-close").click();
assert.equal(element("road-to-history-story").hidden, true);

for (const [filter, expected] of [["Goals & Games", 78], ["Milestones", 35], ["Road to History", 9], ["video", 107], ["all", 122]]) {
  change("team-filter", "Florida Panthers");
  element("collection-search").value = "conflicting search";
  pressStat(filter);
  assert.equal(rows().length, expected, `${filter} should open the full collection represented by its count`);
  assert.equal(statButtons.find((button) => button.dataset.collectionFilter === filter).getAttribute("aria-pressed"), "true");
  assert.equal(element("road-to-history-story").hidden, filter !== "Road to History");
  assert.equal(element("archive-title").focused, true);
  assert.equal(element("archive-title").scrolled, true);
  if (filter === "Road to History") {
    assert.deepEqual(shownIds(), [501, 502, 503, 509, 504, 505, 506, 507, 508]);
    assert.equal(body.dataset.era, "boston");
  }
  if (filter === "video") assert.ok(shownIds().every((id) => payload.records.find((record) => record.inventoryId === id).videoUrl));
}
change("sheet-filter", "Road to History");
assert.equal(element("road-to-history-story").hidden, false);
change("sheet-filter", "");
change("category-filter", "Road to History");
assert.equal(rows().length, 9);
assert.equal(element("road-to-history-story").hidden, false);
element("clear-filters").click();
assert.equal(rows().length, 122);
assert.equal(element("road-to-history-story").hidden, true);
assert.equal(statButtons[0].getAttribute("aria-pressed"), "true");

const cellValue = (parentId, label) => element(parentId).children.find((child) => child.children[0].textContent === label)?.children[1].textContent;
for (const [id, emoji, label] of [[72, "🍪", "Goal Scored Puck"], [57, "🍎", "Assist / non-goal point · Game Used Puck"], [59, "🍎", "Assist / non-goal point · Goal Scored Puck"], [316, "🏒", "Game Used Puck"], [503, "🏒", "Warm-Up Used Puck"]]) {
  const row = rows().find((item) => Number(item.children[0].textContent) === id);
  const symbol = row.children[7].children[0];
  assert.equal(symbol.textContent, emoji);
  assert.equal(symbol.getAttribute("aria-label"), label);
  row.children[1].children[0].click();
  assert.equal(element("artifact-dialog").open, true);
  assert.equal(cellValue("artifact-dialog-facts", "Puck type"), `${emoji} ${label}`);
  assert.equal(cellValue("artifact-source-grid", "Puck Type"), `${emoji} ${label}`);
  if ([57, 59].includes(id)) {
    assert.ok(cellValue("artifact-dialog-facts", "Category").startsWith("🍎 "));
    assert.ok(!element("artifact-personnel-grid").children[0].textContent.includes("Goal scorer"));
  }
  element("artifact-dialog-close").click();
}
assert.deepEqual(errors, []);
console.log("PASS: Five stat filters, filter resets, complete Road to History chronology, puck symbols, accessible labels and deep-dive text.");
