import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Exercise the real page's event handlers and rendered rows without network access.
const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const html = read("marchand.html");
const payload = JSON.parse(read("data/marchand-pucks.json"));
const decoder = JSON.parse(read("data/marchand-players.json"));
const photoManifest = JSON.parse(read("data/marchand-photos.json"));
const photoLibrary = JSON.parse(read("data/marchand-photo-library.json"));
const storyManifest = JSON.parse(read("data/marchand-stories.json"));
const registeredPhotos = structuredClone(photoManifest.artifacts);
const noPhotoId = payload.records.find((record) => !registeredPhotos[String(record.inventoryId)])?.inventoryId;
assert.ok(noPhotoId, "a no-photo artifact is needed to test the standard fallback");
// Simulate a future upload, with Front intentionally not first.
photoManifest.artifacts["1"] = [{ label: "Back", url: "future-back.png" }, { label: "Front", url: "future-front.png" }];
photoManifest.artifacts["2"] = [{ label: "Back", url: "only-back.png" }];
// Imported profile hyperlinks must also remain plain text in source details.
payload.records.find((r) => r.inventoryId === 1).sourceData.find((f) => f.label === "Primary Assist").url = "https://www.nhl.com/player/example-123";
class Element {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.events = new Map();
    this.value = "";
    this.checked = false;
    this.hidden = false;
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      contains: (name) => classes.has(name),
      toggle: (name, enabled) => { if (enabled ?? !classes.has(name)) classes.add(name); else classes.delete(name); },
    };
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
const sortButtons = ["date", "inventoryId"].map((key) => {
  const button = new Element("button");
  button.dataset.sort = key;
  const indicator = new Element("span");
  const heading = new Element("th");
  button.querySelector = () => indicator;
  button.closest = () => heading;
  return button;
});
const body = new Element("body");
const errors = [];
vm.runInNewContext(read("marchand-labels.js") + "\n" + read("marchand.js"), {
  document: {
    body,
    getElementById: (id) => { assert.ok(ids.has(id), `missing element ${id}`); return ids.get(id); },
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element("fragment"),
    querySelector: (selector) => { assert.equal(selector, "[data-empty-reset]"); return reset; },
    querySelectorAll: (selector) => ({ "[data-collection-filter]": statButtons, "[data-era-button]": eraButtons, "[data-sort]": sortButtons })[selector] || [],
  },
  window: { location: { search: "?artifact=goal-72" }, matchMedia: () => ({ matches: true }) },
  fetch: async (url) => ({ ok: true, json: async () => url.includes("players") ? decoder : url.includes("goalies") ? JSON.parse(read("data/marchand-goalies.json")) : url.includes("photos") ? photoManifest : url.includes("stories") ? storyManifest : url.includes("game-stats") ? JSON.parse(read("data/marchand-game-stats.json")) : payload }),
  console: { error: (...args) => errors.push(args) },
  URLSearchParams, Intl, Date,
});
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(errors, []);
assert.equal(ids.get("artifact-dialog-title").focused, true, "initial dialog focus belongs on the heading, not Close");
assert.notEqual(ids.get("artifact-dialog-close").focused, true);
assert.equal(ids.get("artifact-story-title").textContent, storyManifest.artifacts["goal-72"].title);
assert.equal(ids.get("artifact-game-stats-rows").children.flatMap(row => row.children).length, 13);
const goalieFact = ids.get("artifact-dialog-facts").children.find((fact) => fact.children[0]?.textContent === "Goalie Scored Against");
assert.ok(goalieFact, "linked deep dive must show its goalie");
assert.equal(goalieFact.children[1].textContent, "Steve Mason");
assert.equal(goalieFact.children[1].children.length, 0, "goalie fact must be text-only");
const goalieCard = ids.get("artifact-personnel-grid").children.at(-1);
assert.equal(goalieCard.dataset.role, "goalie");
assert.ok(goalieCard.children[0].children[0].src.endsWith("8473461.png"));
const strengthFact = ids.get("artifact-dialog-facts").children.find((fact) => fact.children[0]?.textContent === "Goal Type");
assert.equal(strengthFact.children[1].textContent, "⚖️ Even-Strength Goal (ESG)");
const element = (id) => ids.get(id);
const rows = () => element("collection-body").children;
const shownIds = () => rows().map((row) => Number(row.children[0].textContent));
const pressStat = (filter) => statButtons.find((button) => button.dataset.collectionFilter === filter).click();
const change = (id, value) => { element(id).value = value; element(id).dispatch("change"); };
const frontPhotos = Object.entries(photoManifest.artifacts)
  .map(([id, photos]) => {
    const front = photos.find((photo) => photo.label.toLowerCase() === "front");
    return [Number(id), front?.thumbnailUrl || front?.url];
  })
  .filter(([, url]) => url);
for (const [id, expectedUrl] of frontPhotos) {
  const button = rows().find((row) => Number(row.children[0].textContent) === id).children[1].children[0];
  const portrait = button.children.find((child) => child.tag === "img");
  assert.equal(portrait.src, expectedUrl, "every artifact must automatically use its registered Front photo");
  assert.equal(portrait.hidden, false, "lazy images need a layout box while the fallback remains visible");
  assert.equal(button.classList.contains("has-puck-photo"), false);
  portrait.dispatch("load");
  assert.equal(portrait.hidden, false);
  assert.equal(button.classList.contains("has-puck-photo"), true);
  button.click();
  assert.equal(element("artifact-dialog-number").textContent, `Artifact No. ${id}`);
  portrait.dispatch("error");
  assert.equal(portrait.hidden, true, "failed photos must reveal the standard button");
  assert.equal(button.classList.contains("has-puck-photo"), false);
  button.click();
  assert.equal(element("artifact-dialog-number").textContent, `Artifact No. ${id}`, "fallback must remain clickable");
}
for (const id of [2, noPhotoId]) {
  const button = rows().find((row) => Number(row.children[0].textContent) === id).children[1].children[0];
  assert.equal(button.children.some((child) => child.tag === "img"), false, "no Front photo means the standard Deep Dive button");
}
for (const [id, photos] of Object.entries(registeredPhotos).filter(([id]) => !["1", "2"].includes(id))) {
  const inventoryId = Number(id);
  const expectedViews = photos.length;
  const row = rows().find((entry) => Number(entry.children[0].textContent) === inventoryId);
  row.children[1].children[0].click();
  const views = element("artifact-puck-views");
  assert.equal(views.children.length, expectedViews);
  assert.equal(views.hidden, expectedViews < 2, "single-image exhibits do not need a thumbnail selector");
  assert.equal(element("artifact-puck-image").src, photos[0].url);
  for (const [index, button] of views.children.entries()) {
    button.click();
    assert.equal(button.getAttribute("aria-pressed"), "true");
    assert.ok(element("artifact-puck-caption").textContent.includes(`${index + 1} of ${expectedViews}`));
    const selectedImage = element("artifact-puck-image").src;
    if (selectedImage.startsWith(photoLibrary.baseUrl)) {
      const relative = selectedImage.slice(photoLibrary.baseUrl.length).split("?")[0];
      assert.ok(photoLibrary.assets[relative]?.bytes > 100, `Unregistered library image: ${selectedImage}`);
    } else {
      assert.ok(fs.existsSync(new URL(`../${selectedImage}`, import.meta.url)));
    }
    assert.equal(element("artifact-puck-placeholder").hidden, true);
    const isCertificate = /^COA(?: \d+)?$/.test(photos[index].label);
    assert.equal(element("artifact-coa-full-size").hidden, !isCertificate);
    if (isCertificate) assert.equal(element("artifact-coa-full-size").href, photos[index].url);
  }
  element("artifact-puck-image").onerror();
  assert.equal(element("artifact-puck-placeholder").hidden, false);
  views.children[0].click();
  assert.equal(element("artifact-puck-placeholder").hidden, true);
}
rows().find((entry) => Number(entry.children[0].textContent) === noPhotoId).children[1].children[0].click();
assert.equal(element("artifact-puck-views").hidden, true);
assert.equal(element("artifact-puck-views").children.length, 0);
assert.equal(element("artifact-puck-image").hidden, true);
assert.equal(statButtons.length, 7);
assert.equal(rows().length, 170);
assert.equal(element("sheet-filter").children.find((option) => option.value === "Goals & Games").textContent, "Goals");
assert.equal(element("puck-filter").children.find((option) => option.value === "Warm-Up Puck").textContent, "Warm-Up Puck");
change("team-filter", "Florida Panthers");
assert.equal(rows().length, 50);
assert.ok(shownIds().includes(335));
change("team-filter", "Boston Bruins");
assert.equal(rows().length, 119);
assert.ok(!shownIds().includes(335));
change("team-filter", "");
assert.equal(element("artifact-dialog").open, true, "vault artifact links should open the requested deep dive on page load");
assert.equal(element("artifact-dialog-number").textContent, `Artifact No. ${noPhotoId}`);
element("artifact-dialog-close").click();
assert.equal(element("road-to-history-story").hidden, true);
element("collection-search").value = "Perfection Line";
element("collection-search").dispatch("input");
assert.deepEqual(shownIds().sort((a,b) => a-b), [6, 51, 71, 74]);
for (const row of rows()) {
  assert.ok(row.children[6].textContent.includes("🤌🏻 Perfection Line"));
  row.children[1].children[0].click();
  const fact = element("artifact-dialog-facts").children.find((entry) => entry.children[0]?.textContent === "Line Combination");
  assert.equal(fact.children[1].textContent, "🤌🏻 Perfection Line");
  element("artifact-dialog-close").click();
}
element("collection-search").value = "";
element("collection-search").dispatch("input");
const lineOption = element("category-filter").children.filter((option) => option.value === "Perfection Line");
assert.equal(lineOption.length, 1);
assert.equal(lineOption[0].textContent, "Perfection Line");
change("category-filter", "Perfection Line");
assert.deepEqual(shownIds().sort((a,b) => a-b), [6, 51, 71, 74]);
change("team-filter", "Florida Panthers");
assert.equal(rows().length, 0, "Perfection Line must combine with the selected team");
element("clear-filters").click();
assert.equal(rows().length, 170);
assert.equal(element("category-filter").value, "");
change("category-filter", "PO Goal");
assert.ok(shownIds().includes(51), "Perfection Line pucks must retain their original category");
change("category-filter", "");

for (const [filter, expected] of [["Goals & Games", 75], ["Milestones", 41], ["Road to History", 10], ["Road to Repeat", 27], ["Hockey Fights Cancer", 10], ["Warm-Up Pucks", 8], ["all", 170]]) {
  change("team-filter", "Florida Panthers");
  element("collection-search").value = "conflicting search";
  pressStat(filter);
  assert.equal(rows().length, expected, `${filter} should open the full collection represented by its count`);
  assert.equal(statButtons.find((button) => button.dataset.collectionFilter === filter).getAttribute("aria-pressed"), "true");
  assert.equal(element("road-to-history-story").hidden, filter !== "Road to History");
  assert.equal(element("archive-title").focused, true);
  assert.equal(element("archive-title").scrolled, true);
  if (filter === "Road to History") {
    assert.deepEqual(shownIds(), [501, 502, 503, 509, 504, 510, 505, 506, 507, 508]);
    assert.equal(body.dataset.era, "boston");
  }
  if (filter === "video") assert.ok(shownIds().every((id) => payload.records.find((record) => record.inventoryId === id).videoUrl));
}
change("sheet-filter", "Road to History");
assert.equal(element("road-to-history-story").hidden, false);
change("sheet-filter", "");
change("category-filter", "Road to History");
assert.equal(rows().length, 10);
assert.equal(element("road-to-history-story").hidden, false);
element("clear-filters").click();
assert.equal(rows().length, 170);
assert.equal(element("road-to-history-story").hidden, true);
assert.equal(statButtons[0].getAttribute("aria-pressed"), "true");

const cellValue = (parentId, label) => element(parentId).children.find((child) => child.children[0].textContent === label)?.children[1].textContent;
for (const [id, emoji, label] of [[72, "🍪", "Goal Scored Puck"], [57, "🍎", "Assist · Game Used Puck"], [59, "🍎", "Assist · Goal Scored Puck"], [316, "🏒", "Game Used Puck"], [503, "🏒", "Warm-Up Puck"]]) {
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
    const cards = element("artifact-personnel-grid").children;
    assert.equal(cards[0].dataset.player, id === 57 ? "CK45" : "EL27");
    assert.ok(cards[0].textContent.includes("Goal Scorer"));
    assert.equal(cards[1].dataset.player, "BM63");
    assert.ok(cards[1].textContent.includes("Primary Assist"));
    assert.equal(cards.at(-1).dataset.role, "goalie");
    assert.ok(cards.at(-1).textContent.includes(id === 57 ? "Connor Ingram" : "Jeremy Swayman"));
  }
  if (id === 316 || id === 503) assert.ok(!element("artifact-personnel-grid").children.some((card) => card.dataset.role === "goalie"));
  element("artifact-dialog-close").click();
}
assert.deepEqual(errors, []);
const emptyNet = rows().find((item) => Number(item.children[0].textContent) === 3);
emptyNet.children[1].children[0].click();
assert.ok(!element("artifact-personnel-grid").children.some((card) => card.dataset.role === "goalie"));
function assertNoPlayerLinks(node) {
  assert.notEqual(node.tag, "a", "no part of a player card may link away from the collection");
  assert.equal(node.href, undefined);
  assert.equal(node.events.has("click"), false, "player cards must not navigate via a click handler");
  node.children.forEach(assertNoPlayerLinks);
}
for (const row of rows()) {
  const record = payload.records.find((r) => r.inventoryId === Number(row.children[0].textContent));
  row.children[1].children[0].click();
  const story = storyManifest.artifacts[record.key];
  assert.equal(element("artifact-story-title").textContent, story.title);
  assert.equal(element("artifact-story-copy").textContent, story.paragraphs.join(""));
  assert.equal(element("artifact-story-sources").children.length, story.sources.length);
  for (const source of element("artifact-story-sources").children) {
    assert.equal(source.target, "_blank");
    assert.equal(source.rel, "noopener noreferrer");
  }
  for (const card of element("artifact-personnel-grid").children) {
    assert.equal(card.tag, "article", "player and goalie cards must not be outbound links");
    assertNoPlayerLinks(card);
  }
  if (record.sourceSheet === "Goals & Games") {
    assert.equal(cellValue("artifact-dialog-facts", "Collection wing"), "Goals");
    assert.ok(!element("artifact-provenance").textContent.includes("Goals & Games"));
  }
  if (/\bENG\b/.test(record.goalType)) {
    assert.equal(cellValue("artifact-dialog-facts", "Goalie Scored Against"), "—");
    assert.equal(cellValue("artifact-source-grid", "Goalie Scored Against"), "—");
  }
  if (record.puckType === "Warm-Up Used Puck") {
    assert.equal(cellValue("artifact-dialog-facts", "Puck type"), "🏒 Warm-Up Puck");
    if (record.inventoryId < 600 && ![336,337,338].includes(record.inventoryId)) {
      assert.equal(element("artifact-dialog-title").textContent, "Warm-Up Puck");
      assert.equal(cellValue("artifact-source-grid", "Description"), "Warm-Up Puck");
    } else {
      assert.doesNotMatch(element("artifact-dialog-title").textContent, /warm-up|Warm-up/);
      assert.doesNotMatch(cellValue("artifact-source-grid", "Description"), /warm-up|Warm-up/);
    }
  }
  if (record.videoUrl) {
    const sourceUrl = record.videoProvider === "nhl" ? `https://players.brightcove.net/6415718365001/default_default/index.html?videoId=${record.videoId}&autoplay=false&muted=false&applicationId=nhl` : record.videoUrl;
    assert.equal(element("artifact-video-source").href, sourceUrl);
    assert.equal(element("artifact-video-source").target, "_blank");
    assert.equal(element("artifact-video-source").rel, "noopener noreferrer");
    for (const field of element("artifact-source-grid").children) {
      if (field.children[1].tag === "a") {
        assert.equal(field.children[1].target, "_blank");
        assert.equal(field.children[1].href, sourceUrl);
      }
    }
    row.children[8].children[0].click();
    assert.equal(element("artifact-video-only-source").href, sourceUrl);
    assert.equal(element("artifact-video-only-source").target, "_blank");
    assert.equal(element("artifact-video-only-source").rel, "noopener noreferrer");
    element("artifact-video-dialog-close").click();
  }
  element("artifact-dialog-close").click();
}
pressStat("Road to History");
const checkNavigation = () => {
  const orderedIds = shownIds();
  rows()[0].children[1].children[0].click();
  assert.equal(element("artifact-previous").disabled, true);
  element("artifact-previous").click();
  assert.equal(element("artifact-dialog-number").textContent, `Artifact No. ${orderedIds[0]}`);
  for (const [index, id] of orderedIds.entries()) {
    assert.equal(element("artifact-dialog-number").textContent, `Artifact No. ${id}`);
    assert.equal(element("artifact-dialog").open, true);
    assert.equal(element("artifact-navigation-position").textContent, `Puck ${index + 1} of ${orderedIds.length} in this view`);
    assert.equal(element("artifact-previous").disabled, index === 0);
    assert.equal(element("artifact-next").disabled, index === orderedIds.length - 1);
    for (const [buttonId, offset] of [["artifact-previous", -1], ["artifact-next", 1]]) {
      const button = element(buttonId), destinationId = orderedIds[index + offset];
      const icon = button.children[0], image = icon.children.find(child => child.tag === "img");
      const front = (photoManifest.artifacts[destinationId] || []).find(photo => photo.label.toLowerCase() === "front");
      assert.equal(Boolean(image), Boolean(front), "only the actual destination's front may appear in navigation");
      assert.equal(icon.children.at(-1).textContent, offset < 0 ? "←" : "→");
      if (destinationId) assert.ok(button.getAttribute("aria-label").includes(`Artifact ${destinationId}`));
      if (front) {
        assert.equal(image.src, front.thumbnailUrl || front.url);
        image.dispatch("load");
        assert.equal(image.hidden, false);
        assert.equal(icon.classList.contains("has-puck-photo"), true);
        image.dispatch("error");
        assert.equal(image.hidden, true);
        assert.equal(icon.classList.contains("has-puck-photo"), false, "failed images must restore the generic puck");
      }
    }
    if (photoManifest.artifacts[id]?.length) assert.equal(element("artifact-puck-image").src, photoManifest.artifacts[id][0].url);
    else assert.equal(element("artifact-puck-views").hidden, true);
    element("artifact-next").click();
  }
  assert.equal(element("artifact-dialog-number").textContent, `Artifact No. ${orderedIds.at(-1)}`);
  for (let index = orderedIds.length - 2; index >= 0; index--) {
    element("artifact-previous").click();
    assert.equal(element("artifact-dialog-number").textContent, `Artifact No. ${orderedIds[index]}`);
  }
  element("artifact-dialog-close").click();
};
checkNavigation();
sortButtons.find((button) => button.dataset.sort === "date").click();
assert.equal(shownIds()[0], 508, "descending date order must change the browsing sequence");
checkNavigation();
sortButtons.find((button) => button.dataset.sort === "inventoryId").click();
assert.equal(shownIds().at(-1), 510, "ID order must change the browsing sequence");
checkNavigation();
element("clear-filters").click();
checkNavigation(); // Includes no-photo and back-only destinations as well as front-not-first ordering.
change("team-filter", "Canada");
assert.equal(rows().length, 1);
checkNavigation();
console.log("PASS: Filters, deep-dive details, photo views, and previous/next puck navigation including sort order, filters and boundaries.");
