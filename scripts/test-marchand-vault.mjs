import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const html = read("marchand-vault/index.html");
const payload = JSON.parse(read("data/marchand-pucks.json"));
class Element {
  constructor(tag = "div") {
    this.tag = tag; this.children = []; this.dataset = {}; this.attributes = new Map();
    this.events = new Map(); this.value = ""; this.hidden = false;
    this.classList = { toggle() {} };
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text || "") + this.children.map((child) => child.textContent).join(""); }
  append(...nodes) { for (const node of nodes) this.children.push(...(node.tag === "fragment" ? node.children : [node])); }
  replaceChildren(...nodes) { this.text = ""; this.children = []; this.append(...nodes); }
  addEventListener(type, handler) { this.events.set(type, handler); }
  dispatch(type) { this.events.get(type)?.({ target: this }); }
  click() { this.dispatch("click"); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key); }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
  querySelectorAll(selector) {
    const descendants = this.children.flatMap((child) => [child, ...child.querySelectorAll("*")]);
    return selector === "*" ? descendants : descendants.filter((child) => child.className === selector.slice(1));
  }
}
const ids = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], new Element()]));
function controls(attribute, key) {
  return [...html.matchAll(new RegExp(`<button[^>]*${attribute}="([^"]+)"[^>]*>`, "g"))].map((match) => {
    const button = new Element("button"); button.dataset[key] = match[1]; return button;
  });
}
const views = controls("data-vault-view", "vaultView");
const eras = controls("data-vault-era-button", "vaultEraButton");
const backLinks = [...html.matchAll(/<a[^>]*data-vault-back[^>]*>/g)].map(() => new Element("a"));
const body = new Element("body");
const errors = [];
const element = (id) => { assert.ok(ids.has(id), `missing ${id}`); return ids.get(id); };
element("vault-sort").value = "count";
vm.runInNewContext(read("marchand-vault.js"), {
  document: {
    body, getElementById: element,
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element("fragment"),
    querySelectorAll: (selector) => ({ "[data-vault-view]": views, "[data-vault-era-button]": eras, "[data-vault-back]": backLinks })[selector] || [],
  },
  window: { location: { search: "" } },
  fetch: async (url) => ({ ok: true, json: async () => url.includes("goalies") ? JSON.parse(read("data/marchand-goalies.json")) : payload }),
  console: { error: (...args) => errors.push(args) },
  URLSearchParams, Intl, Date,
});
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(errors, []);
assert.equal(views.length, 5);
assert.equal(backLinks.length, 2);
const allRows = () => element("vault-breakdown-body").children;
const summaryRows = () => allRows().filter((row) => row.className !== "marchand-breakdown-detail-row");
const details = () => allRows().filter((row) => row.className === "marchand-breakdown-detail-row");
const label = (row) => row.children[0].children[0].textContent.slice(2);
const view = (name) => views.find((button) => button.dataset.vaultView === name).click();
const era = (name) => eras.find((button) => button.dataset.vaultEraButton === name).click();
const change = (id, value, event = "change") => { element(id).value = value; element(id).dispatch(event); };
const open = (name) => summaryRows().find((row) => label(row) === name).children[0].children[0].click();

assert.equal(summaryRows().length, 50, "all 50 goalies must be available, including one-goal entries");
assert.equal(element("vault-breakdown-body").querySelectorAll(".marchand-goalie-portrait").length, 50);
assert.ok(element("vault-breakdown-body").querySelectorAll(".marchand-goalie-portrait").every((portrait) => portrait.children[0].src.startsWith("https://assets.nhle.com/mugs/nhl/")));
assert.equal(summaryRows().reduce((sum, row) => sum + Number(row.children[1].textContent), 0), 68, "duplicate pucks must not inflate the distinct goalie goal count");
assert.equal(summaryRows().reduce((sum, row) => sum + Number(row.children[2].textContent), 0), 69);
assert.ok(!summaryRows().some((row) => label(row) === "Empty net (no goaltender)"));
const mrazek = summaryRows().find((row) => label(row) === "Petr Mrazek");
assert.equal(mrazek.children[1].textContent, "2");
assert.equal(mrazek.children[2].textContent, "3");
open("Petr Mrazek");
assert.equal(details().filter((row) => !row.hidden).length, 1);
const cards = details().find((row) => !row.hidden).querySelectorAll(".marchand-explorer-puck");
assert.equal(cards.length, 3);
assert.deepEqual(cards.map((card) => new URL(card.children[0].href, "https://tlpt.org/marchand-vault/").searchParams.get("artifact")), ["goal-44", "goal-45", "goal-49"]);
open("Petr Mrazek");
assert.equal(details().filter((row) => !row.hidden).length, 0);
change("vault-search", "kochetkov", "input");
assert.equal(summaryRows().length, 1);
assert.equal(label(summaryRows()[0]), "Pyotr Kochetkov");
change("vault-search", "no such goalie", "input");
assert.equal(summaryRows().length, 0);
assert.equal(element("vault-no-results").hidden, false);

view("arenas");
assert.equal(summaryRows().length, 37, "all 37 catalogued arena names must be listed");
assert.equal(element("vault-search").value, "");
assert.equal(element("vault-no-results").hidden, true);
assert.equal(summaryRows().reduce((sum, row) => sum + Number(row.children[2].textContent), 0), 122);
change("vault-sort", "name");
const names = summaryRows().map(label);
assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
change("vault-sort", "recent");
const latest = summaryRows().map((row) => Date.parse(row.children[4].textContent));
assert.deepEqual(latest, [...latest].sort((a, b) => b - a));

view("years");
assert.deepEqual(summaryRows().map(label), [...new Set(payload.records.map((record) => record.date.slice(0, 4)))].sort());
view("goals");
assert.ok(summaryRows().some((row) => label(row) === "Even Strength"));
assert.ok(!element("vault-breakdown-body").textContent.includes("unmarked"));
assert.equal(summaryRows().reduce((sum, row) => sum + Number(row.children[1].textContent), 0), 75);
assert.equal(summaryRows().reduce((sum, row) => sum + Number(row.children[2].textContent), 0), 76, "both assist records must be excluded from goal types");
view("sheets");
assert.equal(summaryRows().length, 3);
const road = summaryRows().find((row) => label(row) === "Road to History");
assert.equal(road.children[1].textContent, "8");
assert.equal(road.children[2].textContent, "9");
open("Road to History");
assert.equal(element("vault-history-story").hidden, false);
assert.equal(element("vault-history-story").scrolled, true);
assert.equal(details().find((row) => !row.hidden).querySelectorAll(".marchand-explorer-puck").length, 9);

for (const team of ["boston", "florida", "canada"]) {
  era(team);
  view("arenas");
  assert.equal(element("vault-history-story").hidden, true);
  const expected = payload.records.filter((record) => record.team.toLowerCase().includes(team === "boston" ? "boston" : team === "florida" ? "florida" : "canada"));
  assert.equal(element("vault-result-count").textContent, String(expected.length));
  assert.equal(summaryRows().reduce((sum, row) => sum + Number(row.children[2].textContent), 0), expected.length);
  assert.ok(backLinks.every((link) => link.href === `../marchand.html?team=${team}`));
  assert.equal(body.dataset.era, team);
}
element("vault-reset").click();
assert.equal(summaryRows().length, 50);
assert.equal(element("vault-result-count").textContent, "122");
assert.ok(backLinks.every((link) => link.href === "../marchand.html"));
assert.equal(views.filter((button) => button.getAttribute("aria-pressed") === "true").length, 1);
assert.deepEqual(errors, []);
console.log("PASS: Complete vault breakdowns, distinct goals vs pucks, search, sorting, expanded puck records, deep-dive links and all team filters.");
