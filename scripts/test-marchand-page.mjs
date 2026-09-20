#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "marchand.html"), "utf8");
const vaultHtml = fs.readFileSync(path.join(root, "marchand-vault", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "marchand.css"), "utf8");
const script = fs.readFileSync(path.join(root, "marchand.js"), "utf8");
const vaultScript = fs.readFileSync(path.join(root, "marchand-vault.js"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const canadaCrest = fs.readFileSync(path.join(root, "images", "site", "hockey-canada-crest.png"));
const payload = JSON.parse(fs.readFileSync(path.join(root, "data", "marchand-pucks.json"), "utf8"));
const decoder = JSON.parse(fs.readFileSync(path.join(root, "data", "marchand-players.json"), "utf8"));

assert.equal(payload.meta.records, 114, "collection total must match the authoritative populated rows");
assert.equal(payload.meta.goalsAndGames, 71, "goals and games count drifted");
assert.equal(payload.meta.milestones, 35, "milestone count drifted");
assert.equal(payload.meta.roadToHistory, 8, "Road to History count drifted");
assert.equal(payload.meta.videos, 100, "video count drifted");
assert.equal(payload.records.length, payload.meta.records, "metadata and record count differ");
assert.equal(new Set(payload.records.map((record) => record.key)).size, payload.records.length, "record keys must be unique");
assert.equal(payload.records.filter((record) => record.videoUrl).length, payload.meta.videos, "video total differs from records");

const scoringArtifacts = payload.records.filter((record) => {
  if (record.sourceSheet === "Goals & Games") return true;
  if (record.inventoryId === 507) return false;
  return /goal|gwg|assist|point|20\+|multi-goal/i.test(record.description || "") || record.puckType === "Goal Scored Puck";
});
assert.ok(scoringArtifacts.length > payload.meta.goalsAndGames, "scoring-event audit must include milestone and record-run pucks");
assert.deepEqual(scoringArtifacts.filter((record) => !record.videoUrl), [], "every scoring-event puck needs a video");
assert.deepEqual([...new Set(payload.records.map((record) => record.puckType))].sort(), ["Game Used Puck", "Goal Scored Puck", "Warm-Up Used Puck"], "puck types must use the normalized Goal Scored Puck label");
assert.equal(payload.records.some((record) => record.sourceData?.some((field) => field.label === "Puck Type" && field.value === "Goal Scored")), false, "source records still contain the retired Goal Scored label");

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
const exhibit334 = payload.records.find((record) => record.inventoryId === 334);
assert.equal(row58?.videoId, "6363508247112", "source row 58 video drifted");
assert.equal(row60?.videoId, "6383495592112", "source row 60 video drifted");
assert.equal(exhibit334?.videoId, "SdPYYLtnm5E", "Exhibit 334 must use the ESPN broadcast of the TD Garden tribute");

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
  "artifact-video-dialog",
  "artifact-video-only",
  "artifact-video-only-source",
  "artifact-personnel-grid",
  "artifact-source-grid",
  "artifact-dialog-crest",
  "artifact-media-grid",
  "artifact-puck-photo",
  "artifact-puck-image",
  "artifact-puck-placeholder",
  "artifact-puck-photo-id",
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `marchand.html is missing #${id}`);
}

assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/, "hidden page must stay out of search indexes");
assert.match(vaultHtml, /<meta name="robots" content="noindex,nofollow,noarchive">/, "hidden vault page must stay out of search indexes");
assert.match(html, /marchand\.css\?v=20260920-15/, "Marchand stylesheet cache key drifted");
assert.match(html, /marchand\.js\?v=20260920-13/, "Marchand script cache key drifted");
assert.match(vaultHtml, /marchand\.css\?v=20260920-15/, "vault stylesheet cache key drifted");
assert.match(vaultHtml, /marchand-vault\.js\?v=20260920-1/, "vault script cache key drifted");
assert.doesNotMatch(html, /Names behind the codes/i, "removed deep-dive label returned");
assert.doesNotMatch(sitemap, /marchand\.html/, "hidden page must not appear in the sitemap");
assert.doesNotMatch(sitemap, /marchand-vault/, "hidden vault page must not appear in the sitemap");
assert.doesNotMatch(html, /<header class="site-header">/, "the standalone museum must not include the TLPT masthead");
assert.doesNotMatch(vaultHtml, /<header class="site-header">/, "the standalone vault exhibit must not include the TLPT masthead");
assert.doesNotMatch(html.match(/<nav class="nav">[\s\S]*?<\/nav>/)?.[0] || "", /marchand\.html/, "hidden page must not link to itself from public navigation");
assert.doesNotMatch(html, /id="insights-title"/, "Inside the Vault analytics must not delay the collection registry");
assert.match(html, /href="marchand-vault\/"/, "collection page must link to the dedicated Inside the Vault exhibit");
assert.match(vaultHtml, /href="\.\.\/marchand\.html"/, "Inside the Vault exhibit must link back to the collection");
for (const id of ["vault-insights", "vault-result-count", "insight-sheets", "insight-goals", "insight-timeline", "insight-arenas"]) {
  assert.match(vaultHtml, new RegExp(`id=["']${id}["']`), `vault exhibit is missing #${id}`);
}

assert.match(css, /\.marchand-page\[data-era="boston"\]/, "Boston museum theme is missing");
assert.match(css, /\.marchand-page\[data-era="florida"\]/, "Florida museum theme is missing");
assert.match(css, /\.marchand-page\[data-era="canada"\]/, "Canada museum theme is missing");
assert.match(css, /content:"BOSTON"/, "Boston theme identity is missing");
assert.match(css, /content:"FLORIDA"/, "Florida theme identity is missing");
assert.match(css, /data-era="florida"[\s\S]*site-page-hero-title::first-line[\s\S]*color:#041e42/, "Florida title must use Panthers navy");
assert.match(css, /data-era="florida"\]\{[\s\S]*--gold:#ffffff;[\s\S]*--museum-accent:#c8102e;[\s\S]*--museum-page-top:#a30725;/, "Florida theme must use a red backdrop with high-contrast white links");
assert.match(css, /linear-gradient\(180deg,#a30725 0%,#680016 48%,#21040b 100%\)/, "Florida page backdrop must be Panthers red");
assert.match(css, /linear-gradient\(126deg,#a80a29 0%,#790017 58%,#31050e 100%\)/, "Florida hero must use the red museum treatment");
assert.match(css, /data-era="florida"[\s\S]*marchand-era-button\.is-active[\s\S]*color:#fff;/, "Florida team controls need high-contrast active text");
assert.doesNotMatch(css, /d4af37|212,175,55/i, "Florida surfaces must not retain the old gold accent");
assert.match(css, /content:"CANADA"/, "Canada theme identity is missing");
assert.match(css, /data-era="canada"[\s\S]*site-page-hero-title::first-line[\s\S]*color:#d80621/, "Canada title must use red");
assert.match(css, /linear-gradient\(180deg,#6f0011/, "Canada theme must use the red-and-white museum treatment");
assert.match(css, /--museum-hero-diagonal-start:66%;\s*--museum-hero-diagonal-end:72%;/, "all hero themes must use Canada's six-point diagonal accent width");
assert.equal((css.match(/var\(--museum-hero-diagonal-start\).*?var\(--museum-hero-diagonal-end\)/g) || []).length, 3, "all three team themes must share the hero diagonal width");
assert.match(html, /assets\.nhle\.com\/logos\/nhl\/svg\/BOS_light\.svg/, "Boston team mark is missing");
assert.match(html, /assets\.nhle\.com\/logos\/nhl\/svg\/FLA_light\.svg/, "Florida team mark is missing");
assert.equal((html.match(/images\/site\/hockey-canada-crest\.png/g) || []).length, 2, "both Canada filter controls must use the transparent PNG crest");
assert.match(script, /TEAM_CANADA_CREST = "images\/site\/hockey-canada-crest\.png"/, "Canada deep dives must use the transparent PNG crest");
assert.equal(canadaCrest.subarray(1, 4).toString("ascii"), "PNG", "Hockey Canada crest must be a PNG asset");
assert.equal(canadaCrest[25], 6, "Hockey Canada PNG must include an alpha channel");
assert.doesNotMatch(html + script, /Hockey_Canada\.svg/, "the white-backed Canada SVG must not remain in the page");
assert.doesNotMatch(css, /marchand-(?:team-crest-canada|dialog\[data-team="canada"\] \.marchand-dialog-crest)\{background:#fff\}/, "Canada crests must not have white tile backgrounds");
assert.equal((html.match(/class="marchand-team-crest[^\"]*"[^>]*data-era-button=/g) || []).length, 3, "all three header crests must be team-filter buttons");
assert.match(html, /aria-label="Show the Boston Bruins collection"/, "Boston crest needs an accessible filter label");
assert.match(html, /aria-label="Show the Florida Panthers collection"/, "Florida crest needs an accessible filter label");
assert.match(html, /aria-label="Show the Team Canada collection"/, "Canada crest needs an accessible filter label");
assert.match(script, /youtube-nocookie\.com\/embed/, "privacy-enhanced YouTube player is missing");
assert.match(script, /players\.brightcove\.net\/6415718365001/, "official NHL Brightcove player is missing");
assert.match(script, /data\/marchand-pucks\.json/, "collection data source is missing");
assert.match(script, /data\/marchand-players\.json/, "player decoder source is missing");
assert.match(script, /decodedNames\(record\)/, "decoded player names must participate in search");
assert.match(script, /player\.headshot/, "assist headshots are not rendered");
assert.match(script, /const CATEGORY_LABELS = Object\.freeze/, "expanded category names are missing");
for (const label of ["4 Nations Faceoff", "Assist", "Milestone", "Playoff Goal", "Road to History", "Regular Season Goal", "Regular Season Point"]) {
  assert.ok(script.includes(`"${label}"`) || script.includes(`${label}:`), `${label} category label is missing`);
}
for (const arena of new Set(payload.records.map((record) => record.arena))) {
  assert.ok(script.includes(`"${arena}"`), `${arena} is missing a city/region mapping`);
}
assert.match(script, /assets\.nhle\.com\/logos\/nhl\/svg\/\$\{code\}_light\.svg/, "opponent NHL logos are not wired into the hall");
assert.match(script, /marchand-player-chip/, "compact player headshot chips are not wired into the hall");
assert.match(html, /data-sort="inventoryId">ID#/, "Artifact Hall must begin with ID#");
assert.match(html, /data-sort="location">City \/ Region/, "Artifact Hall city/region column is missing");
assert.match(html, /Players Involved/, "Artifact Hall players column is missing");
assert.doesNotMatch(html.match(/<table class="marchand-table">[\s\S]*?<\/table>/)?.[0] || "", /data-sort="team"|data-sort="category">Artifact/, "retired Team or Artifact columns remain in the hall");
assert.match(script, /renderPuckPhoto\(record\)/, "puck photo slot is not wired into artifact deep dives");
assert.match(script, /record\.imageUrl/, "future puck image URLs are not supported");
assert.match(script, /deepDive\.addEventListener\("click", \(\) => openArtifact\(record\)\)/, "puck-shaped Deep Dive control must open the existing artifact view");
assert.match(script, /watch\.addEventListener\("click", \(\) => openVideo\(record\)\)/, "Watch control must open the standalone video player");
assert.match(script, /watch\.disabled = !record\.videoUrl/, "records without film must disable the Watch control");
assert.match(script, /aria-hidden="true">🎥<\/span>/, "Watch controls must use the video camera icon");
assert.doesNotMatch(script, /Watch video and explore/, "Watch and Deep Dive actions must remain separate");
assert.match(vaultScript, /row\.setAttribute\("aria-pressed"/, "vault bars must expose their active filter state");
assert.match(vaultScript, /item\.setAttribute\("aria-pressed"/, "vault timeline years must expose their active filter state");
assert.match(vaultScript, /const records = filteredRecords\(\)/, "vault statistics must recalculate from the active exhibit lens");
assert.match(script, /payload\.records\.filter\(\(record\) => record\.videoUrl\)\.length/, "film archive total must be calculated from records");
assert.match(script, /Boston Bruins Collection · Exhibit 63/, "team-specific museum copy is missing");
assert.match(css, /\.marchand-puck-placeholder/, "puck photo placeholder styling is missing");
assert.match(css, /\.marchand-deep-dive-button\{[\s\S]*border-radius:50%/, "Deep Dive control must use the circular puck treatment");
assert.match(css, /\.marchand-opponent-logo\{[\s\S]*border-radius:50%;[\s\S]*#f3f0e7/, "opponent logos need an off-white circular backing");
assert.match(css, /\.marchand-watch-button\{[\s\S]*width:44px;[\s\S]*border-radius:50%/, "Watch controls must use the circular icon treatment");
assert.match(css, /\.marchand-watch-dialog/, "standalone video dialog styling is missing");

console.log(`PASS: Marchand museum and Inside the Vault exhibit — ${payload.meta.records} artifacts, ${payload.meta.videos} videos, ${decoder.meta.codeCount} player codes, three team themes.`);
