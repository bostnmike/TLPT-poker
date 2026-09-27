import assert from "node:assert/strict";
import fs from "node:fs";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const { records } = JSON.parse(read("data/marchand-pucks.json"));
const { meta, artifacts } = JSON.parse(read("data/marchand-stories.json"));
assert.equal(meta.records, Object.keys(artifacts).length);
assert.equal(meta.records, records.length, "Every published artifact needs a reviewed game story");
for (const record of records) {
  const story = artifacts[record.key];
  assert.ok(story, `Missing story for ${record.key}`);
  for (const field of ["inventoryId", "date", "team"]) assert.equal(story[field], record[field], `${record.key}: stale story ${field}`);
  assert.ok(Number.isInteger(story.gameId));
  assert.ok(story.title.length > 8 && story.title.length < 100);
  assert.ok(story.paragraphs.length >= 1 && story.paragraphs.length <= 3);
  const text = story.paragraphs.join(" ");
  const words = text.split(/\s+/).length;
  assert.ok(words >= 35 && words <= 120, `${record.key}: keep the story short and substantial (${words} words)`);
  assert.match(text, /Marchand/);
  assert.doesNotMatch(text, /TODO|TBD|Lorem ipsum|pivotal moment|testament to|underscoring|unlock|elevate|synergy/i);
  assert.ok(story.sources.length >= 1);
  for (const source of story.sources) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
    assert.match(url.hostname, /(^|\.)nhle?\.com$/);
    assert.ok(source.label.length > 5);
  }
  assert.equal(story.verification.scoring, `https://api-web.nhle.com/v1/gamecenter/${story.gameId}/landing`);
  assert.equal(story.verification.boxscore, `https://api-web.nhle.com/v1/gamecenter/${story.gameId}/boxscore`);
  const stats = story.verification.marchand;
  assert.equal(stats.goals + stats.assists, stats.points);
}
assert.match(artifacts["goal-1"].paragraphs.join(" "), /first of two/);
assert.match(artifacts["goal-42"].paragraphs.join(" "), /goal-scored puck/);
assert.match(artifacts["milestone-316"].paragraphs.join(" "), /game-used milestone puck/);
assert.match(artifacts["history-503"].paragraphs.join(" "), /warm-up puck/i);
assert.match(artifacts["history-509"].paragraphs.join(" "), /game-used puck/i);
assert.equal(artifacts["history-507"].verification.marchand.points, 3);
const html = read("marchand.html");
assert.ok(html.indexOf('id="artifact-story"') < html.indexOf('id="artifact-video-panel"'));
assert.ok(html.indexOf('id="artifact-video-panel"') < html.indexOf('id="artifact-puck-photo"'));
assert.ok(html.indexOf('id="artifact-puck-image"') < html.indexOf('id="artifact-puck-views"'));
assert.match(html, /id="artifact-dialog-title" tabindex="-1" autofocus/);
console.log(`PASS: ${meta.records} sourced game stories, artifact mappings, milestone distinctions, and deep-dive layout order.`);
