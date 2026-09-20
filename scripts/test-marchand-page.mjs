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
const decoder = JSON.parse(fs.readFileSync(path.join(root, "data", "marchand-players.json"), "utf8"));

assert.equal(payload.meta.records, 114, "collection total must match the authoritative populated rows");
assert.equal(payload.meta.goalsAndGames, 71, "goals and games count drifted");
assert.equal(payload.meta.milestones, 35, "milestone count drifted");
assert.equal(payload.meta.roadToHistory, 8, "Road to History count drifted");
assert.equal(payload.meta.videos, 71, "video count drifted");
assert.equal(payload.records.length, payload.meta.records, "metadata and record count differ");
assert.equal(new Set(payload.records.map((record) => record.key)).size, payload.records.length, "record keys must be unique");
assert.equal(payload.records.filter((record) => record.videoUrl).length, payload.meta.videos, "video total differs from records");

for (const record of payload.records) {
  assert.ok(record.key, "every record needs a key");
  assert.ok(Number.isFinite(record.inventoryId), `${record.key} needs a numeric inventory ID`);
  assert.ok(record.team, `${record.key} needs a team`);
  assert.ok(record.category, `${record.key} needs a category`);
  assert.ok(record.opponent, `${record.key} needs an opponent`);
  assert.ok(record.arena, `${record.key} needs an arena`);
  const expectedFields = { "Goals & Games": 18, Milestones: 9, "Road to History": 15 }[record.sourceSheet];
  assert.equal(record.sourceData?.length, expectedFields, `${record.key} must expose every spreadsheet column`);
  const sourceFields = Object.fromEntries(record.sourceData.map((field) => [field.label, field.value]));
  assert.ok(sourceFields.Opponent, `${record.key} must expose its opponent in the complete record`);
  assert.ok(sourceFields.Arena, `${record.key} must expose its arena in the complete record`);
  if (!record.videoUrl) continue;
  assert.ok(["youtube", "nhl"].includes(record.videoProvider), `${record.key} has an unsupported video provider`);
  assert.ok(record.videoId, `${record.key} is missing its embed video ID`);
  assert.match(record.videoUrl, /^https:\/\/(?:www\.)?(?:youtube\.com|nhl\.com)\//, `${record.key} has an unexpected video host`);
}

assert.deepEqual(
  payload.records.filter((record) => record.sourceSheet === "Road to History").map((record) => record.inventoryId),
  [501, 502, 503, 504, 505, 506, 507, 508],
  "Road to History inventory is incomplete",
);

assert.equal(decoder.meta.profileCount, 53, "player profile count drifted");
assert.equal(decoder.meta.codeCount, 55, "player code decoder count drifted");
assert.ok(Object.values(decoder.players).every((player) => player.name && player.headshot && player.nhlProfileUrl), "every decoded player needs a name, official headshot, and profile");
const usedPlayerCodes = new Set(payload.records.flatMap((record) => record.playerCodes || []));
const missingCodes = [...usedPlayerCodes].filter((code) => !decoder.players[code]);
assert.deepEqual(missingCodes, [], "every player code used by the workbook must be decoded");

const row58 = payload.records.find((record) => record.sourceSheet === "Goals & Games" && record.sourceRow === 58);
const row60 = payload.records.find((record) => record.sourceSheet === "Goals & Games" && record.sourceRow === 60);
assert.equal(row58?.videoId, "6363508247112", "source row 58 video drifted");
assert.equal(row60?.videoId, "6383495592112", "source row 60 video drifted");

for (const id of [
  "collection-search",
  "team-filter",
  "sheet-filter",
  "category-filter",
  "arena-filter",
  "puck-filter",
  "video-filter",
  "collection-table-shell",
  "collection-body",
  "artifact-dialog",
  "artifact-video",
  "artifact-personnel-grid",
  "artifact-source-grid",
  "artifact-dialog-crest",
  "insight-timeline",
  "artifact-media-grid",
  "artifact-puck-photo",
  "artifact-puck-image",
  "artifact-puck-placeholder",
  "artifact-puck-photo-id",
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `marchand.html is missing #${id}`);
}

assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/, "hidden page must stay out of search indexes");
assert.match(html, /marchand\.css\?v=20260920-5/, "Marchand stylesheet cache key drifted");
assert.match(html, /marchand\.js\?v=20260920-5/, "Marchand script cache key drifted");
assert.doesNotMatch(sitemap, /marchand\.html/, "hidden page must not appear in the sitemap");
assert.doesNotMatch(html, /<header class="site-header">/, "the standalone museum must not include the TLPT masthead");
assert.doesNotMatch(html.match(/<nav class="nav">[\s\S]*?<\/nav>/)?.[0] || "", /marchand\.html/, "hidden page must not link to itself from public navigation");

assert.match(css, /\.marchand-page\[data-era="boston"\]/, "Boston museum theme is missing");
assert.match(css, /\.marchand-page\[data-era="florida"\]/, "Florida museum theme is missing");
assert.match(css, /\.marchand-page\[data-era="canada"\]/, "Canada museum theme is missing");
assert.match(css, /content:"BOSTON"/, "Boston theme identity is missing");
assert.match(css, /content:"FLORIDA"/, "Florida theme identity is missing");
assert.match(css, /data-era="florida"[\s\S]*site-page-hero-title::first-line[\s\S]*color:#c8102e/, "Florida title must use Panthers red");
assert.match(css, /content:"CANADA"/, "Canada theme identity is missing");
assert.match(css, /linear-gradient\(180deg,#6f0011/, "Canada theme must use the red-and-white museum treatment");
assert.match(html, /assets\.nhle\.com\/logos\/nhl\/svg\/BOS_light\.svg/, "Boston team mark is missing");
assert.match(html, /assets\.nhle\.com\/logos\/nhl\/svg\/FLA_light\.svg/, "Florida team mark is missing");
assert.match(html, /upload\.wikimedia\.org\/wikipedia\/en\/5\/5f\/Hockey_Canada\.svg/, "Hockey Canada crest is missing");
assert.match(script, /youtube-nocookie\.com\/embed/, "privacy-enhanced YouTube player is missing");
assert.match(script, /players\.brightcove\.net\/6415718365001/, "official NHL Brightcove player is missing");
assert.match(script, /data\/marchand-pucks\.json/, "collection data source is missing");
assert.match(script, /data\/marchand-players\.json/, "player decoder source is missing");
assert.match(script, /decodedNames\(record\)/, "decoded player names must participate in search");
assert.match(script, /player\.headshot/, "assist headshots are not rendered");
assert.match(script, /renderPuckPhoto\(record\)/, "puck photo slot is not wired into artifact deep dives");
assert.match(script, /record\.imageUrl/, "future puck image URLs are not supported");
assert.match(script, /Boston Bruins Collection · Exhibit 63/, "team-specific museum copy is missing");
assert.match(css, /\.marchand-puck-placeholder/, "puck photo placeholder styling is missing");

console.log(`PASS: Marchand museum page — ${payload.meta.records} artifacts, ${payload.meta.videos} videos, ${decoder.meta.codeCount} player codes, three team themes.`);
