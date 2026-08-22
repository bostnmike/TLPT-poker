#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const data = readJson("data/generated/site-data.json");
const config = readJson("data/league-config.json");
const index = readJson("data/parsed/events/index.json");
const events = index.map(file => readJson(`data/parsed/events/${file}`));
const errors = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) errors.push(message);
}

function close(a, b, tolerance = 1e-8) {
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

function makeContext() {
  const document = {
    readyState: "loading",
    documentElement: { clientWidth: 1280, clientHeight: 800 },
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; },
    getElementById() { return null; },
    createElement() { return { style: {}, classList: { add() {}, remove() {}, toggle() {} } }; }
  };
  const window = {
    document,
    innerWidth: 1280,
    innerHeight: 800,
    scrollY: 0,
    location: { search: "", href: "" },
    addEventListener() {},
    setTimeout() { return 0; },
    clearTimeout() {},
    requestAnimationFrame(callback) { return callback(0); }
  };
  const context = {
    window,
    document,
    console,
    URLSearchParams,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    Map,
    Set,
    Promise,
    performance: { now: () => 0 },
    requestAnimationFrame: window.requestAnimationFrame,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    setInterval() { return 0; },
    clearInterval() {},
    fetch: async () => { throw new Error("Network access is disabled in page audit"); }
  };
  window.window = window;
  context.globalThis = context;
  return vm.createContext(context);
}

function loadScript(relative, transform = source => source) {
  const context = makeContext();
  const source = transform(fs.readFileSync(path.join(root, relative), "utf8"));
  vm.runInContext(source, context, { filename: relative });
  return {
    context,
    get(name) { return vm.runInContext(name, context); },
    set(name, value) { context[name] = value; }
  };
}

const app = loadScript("app.js");
const sortPlayers = app.get("sortPlayers");
const getPlayerTierScore = app.get("getPlayerTierScore");
const playerCardOverallRating = app.get("playerCardOverallRating");
const playerCardAttributes = app.get("playerCardAttributes");
const playerCardTierMeta = app.get("playerCardTierMeta");
const playerCardRatingComparator = app.get("playerCardRatingComparator");
const getLeaderByRule = app.get("getLeaderByRule");
const getHallPlayers = app.get("getHallPlayers");

const players = data.players || [];
const established = players.filter(player => Number(player.buyIns || 0) >= 5);

function manualTierScore(player) {
  const buyIns = Number(player.buyIns || 0);
  let sample = -2;
  if (buyIns >= 20) sample = 3;
  else if (buyIns >= 15) sample = 2;
  else if (buyIns >= 10) sample = 1;
  else if (buyIns >= 5) sample = 0.25;
  else if (buyIns >= 3) sample = 0;
  return Number(player.trueSkillScore || 0) * 1.5
    + Number(player.clutchIndex || 0) * 1.1
    + Number(player.aggressionIndex || 0) * 0.65
    + Number(player.survivorIndex || 0)
    + Number(player.tiltIndex || 0) * 1.25
    + sample
    - Number(player.rebuys || 0) * 0.6;
}

function ratingPool(allPlayers) {
  const primary = allPlayers.filter(player => Number(player.buyIns || 0) >= 5);
  if (primary.length >= 2) return primary;
  const provisional = allPlayers.filter(player => Number(player.buyIns || 0) >= 3);
  return provisional.length >= 2 ? provisional : allPlayers;
}

function manualRating(player, allPlayers, key, minRating = 40, maxRating = 96) {
  const values = ratingPool(allPlayers).map(item => Number(item[key] || 0));
  if (!values.length) return 68;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const normalized = max === min ? 0.5 : (Number(player[key] || 0) - min) / (max - min);
  return Math.max(1, Math.min(99, Math.round(minRating + Math.max(0, Math.min(1, normalized)) * (maxRating - minRating))));
}

const establishedRank = [...established].sort((a, b) => manualTierScore(b) - manualTierScore(a));
const attributeSpecs = [
  ["CLT", "clutchIndex"], ["ITM", "cashRate"], ["AGR", "aggressionIndex"],
  ["HIT", "hitRate"], ["SUR", "survivorIndex"]
];

for (const player of players) {
  check(close(getPlayerTierScore(player), manualTierScore(player)), `${player.slug}: Crew tier score differs from published formula`);
  check(playerCardOverallRating(player, players) === manualRating(player, players, "trueSkillScore", 62, 95), `${player.slug}: live card overall rating differs from benchmark formula`);
  const attributes = playerCardAttributes(player, players);
  const byCode = Object.fromEntries(attributes.map(attribute => [attribute.code, attribute.value]));
  const expectedReturn = Math.round(manualRating(player, players, "roi") * 0.65 + manualRating(player, players, "profit") * 0.35);
  check(byCode.RET === expectedReturn, `${player.slug}: RET card rating differs from formula`);
  for (const [code, key] of attributeSpecs) {
    check(byCode[code] === manualRating(player, players, key), `${player.slug}: ${code} card rating differs from formula`);
  }

  const meta = playerCardTierMeta(player, players);
  const appearances = Number(player.buyIns || 0);
  if (appearances < 3) {
    check(meta.code === "RKI" && meta.rank === null, `${player.slug}: Rookie card status/rank is incorrect`);
  } else if (appearances < 5) {
    check(meta.code === "PRO" && meta.rank === null, `${player.slug}: Provisional card status/rank is incorrect`);
  } else {
    const rank = establishedRank.findIndex(item => item.slug === player.slug) + 1;
    const percentile = rank / establishedRank.length;
    const expectedCode = percentile <= 0.15 ? "S" : percentile <= 0.35 ? "A" : percentile <= 0.60 ? "B" : percentile <= 0.80 ? "C" : "D";
    check(meta.rank === rank && meta.code === expectedCode, `${player.slug}: established Crew rank/tier is incorrect`);
  }
}

const crewOrder = players.filter(player => Number(player.buyIns || 0) >= 1).sort(playerCardRatingComparator(players));
for (let indexPos = 1; indexPos < crewOrder.length; indexPos += 1) {
  const before = crewOrder[indexPos - 1];
  const after = crewOrder[indexPos];
  const beforeRating = playerCardOverallRating(before, players);
  const afterRating = playerCardOverallRating(after, players);
  check(beforeRating > afterRating || (beforeRating === afterRating && manualTierScore(before) >= manualTierScore(after)), `Crew card order is inconsistent near ${before.slug}/${after.slug}`);
}

const sortableKeys = [
  "totalWinnings", "profit", "hits", "timesPlaced", "bubbles", "hitRate",
  "cashRate", "bubbleRate", "roi", "trueSkillScore", "luckIndex",
  "clutchIndex", "aggressionIndex", "survivorIndex", "tiltIndex"
];
for (const key of sortableKeys) {
  const actual = sortPlayers(players, key).map(player => player.slug);
  const expected = [...players].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0) || String(a.name).localeCompare(String(b.name))).map(player => player.slug);
  check(JSON.stringify(actual) === JSON.stringify(expected), `Standings/Dashboard sort is incorrect for ${key}`);
}

for (const rule of config.honors || []) {
  const qualified = players.filter(player => Number(player.entries || 0) >= 5);
  const direction = rule.direction === "asc" ? 1 : -1;
  const expected = [...qualified].sort((a, b) => direction * (Number(a[rule.key] || 0) - Number(b[rule.key] || 0)) || String(a.name).localeCompare(String(b.name)))[0];
  const actual = getLeaderByRule(players, rule);
  check(actual?.slug === expected?.slug, `Honors page leader is incorrect for ${rule.type}`);
}

const hallPlayers = getHallPlayers(data, { eventCount: events.length, events });
const hallMinimum = Math.max(Math.ceil(events.length * 0.25), 10);
const expectedHallSlugs = players.filter(player => Number(player.buyIns || 0) >= hallMinimum).map(player => player.slug).sort();
check(JSON.stringify(hallPlayers.map(player => player.slug).sort()) === JSON.stringify(expectedHallSlugs), "Hall qualification pool is incorrect");
for (const hallPlayer of hallPlayers) {
  let busted = 0;
  let lazarus = 0;
  for (const event of events) {
    const bustouts = (event.actions || []).filter(action => ["bustout", "bustout_uncredited"].includes(action.type) && action.slug);
    busted += bustouts.filter(action => action.slug === hallPlayer.slug).length;
    if (bustouts[0]?.slug === hallPlayer.slug && (event.winners || []).some(winner => winner.slug === hallPlayer.slug)) lazarus += 1;
  }
  check(hallPlayer.timesBusted === busted, `${hallPlayer.slug}: Hall times-busted total is incorrect`);
  check(hallPlayer.lazarusCount === lazarus, `${hallPlayer.slug}: Hall Lazarus total is incorrect`);
  check(close(hallPlayer.knockoutRate, Number(hallPlayer.hits || 0) / Math.max(Number(hallPlayer.entries || 0), 1)), `${hallPlayer.slug}: Hall knockout rate is incorrect`);
}

const movement = loadScript("player-movement.js", source => source.replace(/\ninit\(\);\s*$/, "\n"));
const buildAnalytics = movement.get("buildAnalytics");
const movementRows = buildAnalytics(players, events);
const expectedMovementSlugs = players.filter(player => events.filter(event => (event.players || []).some(row => row.slug === player.slug && Number(row.entries || 0) > 0)).length >= 4).map(player => player.slug).sort();
check(JSON.stringify(movementRows.map(player => player.slug).sort()) === JSON.stringify(expectedMovementSlugs), "Heater Meter omits or adds a qualified player");
for (const player of movementRows) {
  const played = events.filter(event => (event.players || []).some(row => row.slug === player.slug && Number(row.entries || 0) > 0)).length;
  check(player.eventsPlayedForForm === played, `${player.slug}: Heater Meter appearance count is incorrect`);
  check(player.recentEvents.every(event => Number(event.finishPosition) > 0 && Number(event.totalEntries) > 0), `${player.slug}: Heater Meter contains an invalid finish`);
}

const formLab = loadScript("form-lab.js");
formLab.context.__events = events;
formLab.get("FL_STATE").events = events;
const getFormRows = formLab.get("getPlayerEventRowsForPlayer");
for (const player of players) {
  const rows = getFormRows(player);
  const sourceEvents = events.filter(event => (event.players || []).some(row => row.slug === player.slug && Number(row.entries || 0) > 0));
  check(rows.length === sourceEvents.length, `${player.slug}: Form Lab appearance count is incorrect`);
  const sourceByDate = new Map(sourceEvents.map(event => [event.date, event]));
  for (const row of rows) {
    const event = sourceByDate.get(row.dateIso);
    const source = event?.players?.find(item => item.slug === player.slug);
    check(Boolean(source), `${player.slug}/${row.dateIso}: Form Lab row has no source event`);
    if (!source) continue;
    check(row.entriesUsed === Number(source.entries || 0), `${player.slug}/${row.dateIso}: Form Lab entries are incorrect`);
    check(row.hits === Number(source.hits || 0), `${player.slug}/${row.dateIso}: Form Lab hits are incorrect`);
    check(row.cost === Number(source.totalCost || 0), `${player.slug}/${row.dateIso}: Form Lab cost is incorrect`);
    check(row.winnings === Number(source.totalWinnings || 0), `${player.slug}/${row.dateIso}: Form Lab winnings are incorrect`);
    check(row.profit === Number(source.profit || 0), `${player.slug}/${row.dateIso}: Form Lab profit is incorrect`);
    check(row.cashFlag === (Number(source.timesPlaced || 0) > 0 ? 1 : 0), `${player.slug}/${row.dateIso}: Form Lab cash flag is incorrect`);
    check(row.bubbleFlag === (Number(source.bubbles || 0) > 0 ? 1 : 0), `${player.slug}/${row.dateIso}: Form Lab bubble flag is incorrect`);
    check(Number(row.finishPosition) > 0, `${player.slug}/${row.dateIso}: Form Lab finish position is missing`);
  }
}

const result = { status: errors.length ? "FAIL" : "PASS", checks, errorCount: errors.length, errors };
process.stdout.write(JSON.stringify(result));
if (errors.length) process.exitCode = 2;
