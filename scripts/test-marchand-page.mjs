#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "marchand.html"), "utf8");
const css = fs.readFileSync(path.join(root, "marchand.css"), "utf8");
const script = fs.readFileSync(path.join(root, "marchand.js"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const payload = JSON.parse(fs.readFileSync(path.join(root, "data", "marchand-pucks.json"), "utf8"));

assert.equal(payload.meta.records, 106, "collection total must match the authoritative populated rows");
assert.equal(payload.meta.goalsAndGames, 71, "goals and games count drifted");
assert.equal(payload.meta.milestones, 35, "milestone count drifted");
assert.equal(payload.meta.videos, 71, "video count drifted");
assert.equal(payload.records.length, payload.meta.records, "metadata and record count differ");
assert.equal(new Set(payload.records.map((record) => record.key)).size, payload.records.length, "record keys must be unique");
assert.equal(payload.records.filter((record) => record.videoUrl).length, payload.meta.videos, "video total differs from records");

for (const record of payload.records) {
  assert.ok(record.key, "every record needs a key");
  assert.ok(Number.isFinite(record.inventoryId), `${record.key} needs a numeric inventory ID`);
  assert.ok(record.team, `${record.key} needs a team`);
  assert.ok(record.category, `${record.key} needs a category`);
  if (!record.videoUrl) continue;
  assert.ok(["youtube", "nhl"].includes(record.videoProvider), `${record.key} has an unsupported video provider`);
  assert.ok(record.videoId, `${record.key} is missing its embed video ID`);
  assert.match(record.videoUrl, /^https:\/\/(?:www\.)?(?:youtube\.com|nhl\.com)\//, `${record.key} has an unexpected video host`);
}

const row58 = payload.records.find((record) => record.sourceSheet === "Goals & Games" && record.sourceRow === 58);
const row60 = payload.records.find((record) => record.sourceSheet === "Goals & Games" && record.sourceRow === 60);
assert.equal(row58?.videoId, "6363508247112", "source row 58 video drifted");
assert.equal(row60?.videoId, "6383495592112", "source row 60 video drifted");

for (const id of [
  "collection-search",
  "team-filter",
  "category-filter",
  "arena-filter",
  "puck-filter",
  "video-filter",
  "collection-table-shell",
  "collection-body",
  "artifact-dialog",
  "artifact-video",
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `marchand.html is missing #${id}`);
}

assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/, "hidden page must stay out of search indexes");
assert.match(html, /marchand\.css\?v=20260920-1/, "Marchand stylesheet cache key drifted");
assert.match(html, /marchand\.js\?v=20260920-1/, "Marchand script cache key drifted");
assert.doesNotMatch(sitemap, /marchand\.html/, "hidden page must not appear in the sitemap");
assert.doesNotMatch(html.match(/<nav class="nav">[\s\S]*?<\/nav>/)?.[0] || "", /marchand\.html/, "hidden page must not link to itself from public navigation");

assert.match(css, /\.marchand-page\[data-era="boston"\]/, "Boston museum theme is missing");
assert.match(css, /\.marchand-page\[data-era="florida"\]/, "Florida museum theme is missing");
assert.match(css, /\.marchand-page\[data-era="canada"\]/, "Canada museum theme is missing");
assert.match(script, /youtube-nocookie\.com\/embed/, "privacy-enhanced YouTube player is missing");
assert.match(script, /players\.brightcove\.net\/6415718365001/, "official NHL Brightcove player is missing");
assert.match(script, /data\/marchand-pucks\.json/, "collection data source is missing");

console.log(`PASS: Marchand museum page — ${payload.meta.records} artifacts, ${payload.meta.videos} videos, three team themes.`);
