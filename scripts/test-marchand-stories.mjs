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
  if (![705,708].includes(record.inventoryId)) assert.ok(Number.isInteger(story.gameId));
  assert.ok(story.title.length > 8 && story.title.length < 100);
  assert.ok(story.paragraphs.length >= 1 && story.paragraphs.length <= 3);
  const text = story.paragraphs.join(" ");
  const words = text.split(/\s+/).length;
  const minimumWords = record.inventoryId === 705 ? 15 : /warm.up/i.test(record.puckType) || [701,703,710,712,714].includes(record.inventoryId) ? 20 : 35;
  assert.ok(words >= minimumWords && words <= 120, `${record.key}: keep the story short and substantial (${words} words)`);
  if (record.inventoryId !== 705) assert.match(text, /Marchand/);
  assert.doesNotMatch(text, /TODO|TBD|Lorem ipsum|pivotal moment|testament to|underscoring|unlock|elevate|synergy/i);
  if (/warm.up/i.test(record.puckType)) {
    assert.doesNotMatch(text, /not (?:attributed|tied|linked) to (?:a |the )?(?:specific )?(?:goal|scoring play)|warm.up puck represent(?:ing|s) the game|this is the dated warm.up puck|adds another view/i, `${record.key}: omit warm-up disclaimers and filler`);
    assert.doesNotMatch(record.notes || '', /warm.up puck representing the game|not attributed to a scoring play/i, `${record.key}: omit boilerplate catalog notes`);
  }
  assert.ok(story.sources.length >= 1 || record.inventoryId === 708);
  for (const source of story.sources) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
    const rescheduledHfcSource = record.inventoryId === 705 && source.url === "https://www.boston.com/things-to-do/events/bruins-bringing-the-fight-to-cancer-and-the-carolina-hurricanes/";
    assert.ok(/(^|\.)nhle?\.com$/.test(url.hostname) || rescheduledHfcSource || (record.inventoryId === 50 && ["https://bostnmike.github.io/marchand-puck-images/images/pucks/50/coa.webp","https://www.espn.com/nhl/game/_/gameId/310502015/bruins-flyers"].includes(source.url)), "Source must be NHL or the verified artifact-specific evidence");
    assert.ok(source.label.length > 5);
  }
  if (!story.gameId) {
    if (record.inventoryId === 705) {
      assert.equal(story.verification.status, "Rescheduled; COA matched");
      assert.equal(story.verification.coaDate, "2022-02-10");
      assert.equal(record.sourceData.find(field => field.label === "COA Filename").value, "images/pucks/705/coa.webp");
      assert.doesNotMatch(record.notes, /not established|unverified/i);
    } else assert.ok(["Postponed","Unresolved"].includes(story.verification.status));
    continue;
  }
  assert.equal(story.verification.scoring, `https://api-web.nhle.com/v1/gamecenter/${story.gameId}/landing`);
  assert.equal(story.verification.boxscore, `https://api-web.nhle.com/v1/gamecenter/${story.gameId}/boxscore`);
  const stats = story.verification.marchand;
  if (record.inventoryId === 703) assert.equal(stats, null); else assert.equal(stats.goals + stats.assists, stats.points);
}
assert.match(artifacts["goal-1"].paragraphs.join(" "), /first of two/);
assert.match(artifacts["goal-42"].paragraphs.join(" "), /goal-scored puck/);
assert.match(artifacts["milestone-316"].paragraphs.join(" "), /game-used milestone puck/);
assert.match(records.find(record => record.key === "history-503").puckType, /warm-up/i);
assert.match(artifacts["history-509"].paragraphs.join(" "), /game-used puck/i);
assert.equal(artifacts["hfc-705"].date, "2021-12-21", "Retain the printed date on artifact 705");
assert.equal(artifacts["hfc-705"].verification.rescheduledGameDate, "2022-02-10");
assert.match(artifacts["hfc-705"].paragraphs.join(" "), /COVID-19 protocols.*February 10, 2022/);
assert.doesNotMatch(artifacts["hfc-705"].title, /never became a game/i);
assert.equal(artifacts["history-507"].verification.marchand.points, 3);
const point152 = records.find((record) => record.inventoryId === 625);
assert.equal(point152.sourceSheet, "Road to Repeat");
assert.equal(point152.category, "Assist");
assert.equal(point152.puckType, "Goal Scored Puck");
assert.equal(point152.careerStat, 152);
assert.equal(point152.seasonStat, 14);
assert.equal(point152.scorerCode, "AL15");
assert.equal(point152.primaryAssist, "BM63");
assert.equal(point152.secondaryAssist, "");
assert.equal(point152.time, "11:59");
assert.equal(point152.goalType, "ESG");
assert.equal(point152.videoId, "6373588933112");
assert.equal(point152.goalieScoredAgainst, "Frederik Andersen");
assert.match(artifacts[point152.key].title, /152/);
assert.doesNotMatch(artifacts[point152.key].paragraphs.join(" "), /game-used puck|game-winning goal/);
assert.equal(artifacts[point152.key].verification.careerPlayoffPoint.before2025 + artifacts[point152.key].verification.careerPlayoffPoint.throughGame2025, 152);
const html = read("marchand.html");
assert.ok(html.indexOf('id="artifact-story"') < html.indexOf('id="artifact-video-panel"'));
assert.ok(html.indexOf('id="artifact-video-panel"') < html.indexOf('id="artifact-puck-photo"'));
assert.ok(html.indexOf('id="artifact-video-panel"') < html.indexOf('id="artifact-game-stats"'));
assert.ok(html.indexOf('id="artifact-game-stats"') < html.indexOf('id="artifact-puck-photo"'));
assert.ok(html.indexOf('id="artifact-puck-image"') < html.indexOf('id="artifact-puck-views"'));
assert.match(html, /id="artifact-dialog-title" tabindex="-1" autofocus/);
console.log(`PASS: ${meta.records} sourced game stories, artifact mappings, milestone distinctions, and deep-dive layout order.`);
