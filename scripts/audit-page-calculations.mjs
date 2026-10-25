#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildRsvpChecklist } from "../cashier/lib/rsvp.mjs";
import { auditRsvpEvent } from "./audit-rsvp.mjs";


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const data = readJson("data/generated/site-data.json");
const config = readJson("data/league-config.json");
const index = readJson("data/parsed/events/index.json");
const events = index.map(file => readJson(`data/parsed/events/${file}`));
const eventHistory = readJson("data/generated/event-history.json");
const errors = [];
const warnings = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) errors.push(message);
}

function close(a, b, tolerance = 1e-8) {
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

check(eventHistory.eventCount === events.length, "Event history count must match the parsed event index");
check(
  JSON.stringify(eventHistory.events) === JSON.stringify(events),
  "Event history bundle must exactly match the authoritative parsed events"
);

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
  vm.runInContext(fs.readFileSync(path.join(root, "roster-display.js"), "utf8"), context);
  const source = transform(fs.readFileSync(path.join(root, relative), "utf8"));
  vm.runInContext(source, context, { filename: relative });
  return {
    context,
    get(name) { return vm.runInContext(name, context); },
    set(name, value) { context[name] = value; }
  };
}

const app = loadScript("app.js");
// Crew's compact counts and optional map are views of existing career data.
const crewSnapshot = JSON.stringify(data.players);
const countTier = app.get("crewCountTier");
for (const [key, emoji] of Object.entries({ s:'🦈', a:'⚔️', b:'☄️', c:'🎲', d:'🍣', provisional:'🧪', rookie:'🌱', unscouted:'🔭' })) {
  check(app.get("CREW_COUNT_TIERS").find(tier => tier[0] === key)?.[2] === emoji, `${key}: lineup button must retain its tier emoji`);
}
const mapPoints = app.get("crewMapPoints");
const allMapPoints = mapPoints(data.players, data.players);
const mapModule = loadScript("crew-map.js").context.window.TLPTCrewMap;
for (const membership of ["active", "alumni", "all"]) {
  const members = app.get("crewRosterPlayers")(data.players, membership);
  const categories = ["s", "a", "b", "c", "d", "provisional", "rookie", "unscouted"];
  check(categories.reduce((sum, tier) => sum + members.filter(p => countTier(p, data.players) === tier).length, 0) === members.length,
    `${membership}: tier counts must cover the full roster, including hidden developing players`);
  const points = mapPoints(members, data.players);
  check(points.length === members.filter(p => app.get("isCrewEstablished")(p) && p.cardForm?.recent?.eventCount === 5).length,
    `${membership}: Crew Map needs five recorded appearances`);
  for (const point of points) {
    const source = data.players.find(p => p.slug === point.slug);
    const views = app.get("playerCardViewData")(source, data.players);
    check(point.career === views.career.overall && point.form === views.lastFive.overall,
      `${point.slug}: Crew Map must use the original career and Last Five card ratings`);
    check(JSON.stringify(point) === JSON.stringify(allMapPoints.find(p => p.slug === point.slug)),
      `${point.slug}: membership filtering must not recalculate map ratings`);
  }
  for (const width of [240, 270, 660, 1120]) {
    const nodes = mapModule.layout(points, width, 380);
    check(nodes.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= p.hit / 2 && p.x <= width - p.hit / 2 && p.y >= p.hit / 2 && p.y <= 380 - p.hit / 2 && p.hit >= 44),
      `${membership}: map targets must fit a ${width}px chart and retain 44px hit areas`);
    check(nodes.every((a, i) => nodes.slice(i + 1).every(b => Math.hypot(a.x - b.x, a.y - b.y) >= (a.hit + b.hit) / 2 - .5)),
      `${membership}: map bubbles must not overlap at ${width}px`);
  }
}
check(mapModule.median([90, 60, 70, 80]) === 75, "Crew Map references use a deterministic median");
check(JSON.stringify(data.players) === crewSnapshot, "Crew Map and counts must never mutate career records");
// White is the unscouted starter; the 100 Club owns the black/gold finish.
for (const [file, selector, prefix] of [
  ["player.css", ".tlpt-compare-card-edition-milestone-100", ""],
  ["players.css", ".crew-ultimate-card-edition-milestone-100", "crew-"],
  ["trophy-room.css", ".trophy-card-edition-milestone-100", ""]
]) {
  const css = fs.readFileSync(path.join(root, file), "utf8");
  const block = css.slice(css.indexOf(`${selector}{`)).split("}")[0];
  check(block.includes(`--${prefix}card-frame:#ffb81c;`) && block.includes(`--${prefix}card-surface-a:#0a1117;`)
    && block.includes(`--${prefix}card-ink:#f7fbff;`), `${file}: 100 Club must retain the black finish, Bruins-gold edge and readable light text`);
}
const starterCss = fs.readFileSync(path.join(root, "player.css"), "utf8");
const starterBlock = starterCss.slice(starterCss.indexOf(".tlpt-player-card-unscouted:not(.tlpt-player-card-special):not(.tlpt-compare-card-special){")).split("}")[0];
check(starterBlock.includes("--card-surface-a:#ffffff;") && starterBlock.includes("--card-ink:#111820;")
  && starterBlock.includes("--card-frame:#dc3545;") && starterBlock.includes("--card-frame-selected:#dc3545;"),
  "Unscouted base finish must be white with dark text and a red outline, without overriding special editions");
// Membership is a display filter, never a new identity or a statistical reset.
const metadataPlayers = readJson("data/player-metadata.json").players;
const alumni = metadataPlayers.filter(player => player.rosterStatus === "alumni");
const rosterSnapshot = JSON.stringify(data.players);
const filterRoster = app.get("crewRosterPlayers");
check(data.players.length === metadataPlayers.length, "Membership must preserve every player identity");
check(JSON.stringify(filterRoster(data.players, "alumni").map(p => p.slug).sort()) === JSON.stringify(alumni.map(p => p.slug).sort()), "Generated alumni must match metadata");
check(filterRoster(data.players, "all").length === data.players.length, "All Players must include the complete roster");
check(filterRoster(data.players).length + alumni.length === data.players.length, "Active and Alumni must partition the full roster");
check(app.get("isPlayerAlumni")({}) === false, "Legacy players must default to active membership");
for (const player of data.players) {
  check(["active", "alumni"].includes(player.rosterStatus), `${player.slug}: invalid membership status`);
  const toggled = { ...player, rosterStatus: player.rosterStatus === "alumni" ? "active" : "alumni" };
  for (const fn of ["playerCardTierMeta", "playerCardOverallRating"]) {
    check(JSON.stringify(app.get(fn)(player, data.players)) === JSON.stringify(app.get(fn)(toggled, data.players)), `${player.slug}: membership must not change ${fn}`);
  }
}
const alumniRsvps = Object.fromEntries(alumni.map(player => [player.slug, "yes"]));
check(app.get("getRsvpCounts")({ rsvps: alumniRsvps }).yes === alumni.length, "Alumni must count toward event RSVPs");
check(app.get("getRsvpPlayersByStatus")({ rsvps: alumniRsvps }, data, "yes").length === alumni.length, "Alumni must appear in RSVP attendee lists");
const alumniChecklist = buildRsvpChecklist({ id: "alumni-regression", rsvps: alumni.map(player => ({ player: player.slug, answer: "yes" })) }, [], metadataPlayers);
check(alumniChecklist.expected === alumni.length && alumniChecklist.rows.every(row => row.known), "Cashier must resolve every alumni RSVP to the existing identity");
check(JSON.stringify(data.players) === rosterSnapshot, "Roster filtering must not mutate player data");
const eventRosterOrder = members => [...members].sort((a, b) => {
  const group = p => p.slug === "bostnmike" ? 0 : p.rosterStatus === "alumni" ? 2 : 1;
  return group(a) - group(b) || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
});
// Manual assignments accept mixed case, just like the production seat lookup.
// Normalize before looking up RSVP answers, while preserving explicit blanks.
const confirmedManualSlots = (table, rsvps) => table
  .map(slug => String(slug || "").toLowerCase())
  .filter(slug => slug === "" || rsvps[slug] === "yes")
  .map(slug => slug || null);
for (const event of readJson("data/events.json").events) {
  const report = auditRsvpEvent(event, data, app);
  checks += report.checks;
  errors.push(...report.errors);
  warnings.push(...report.warnings);
}
// Exercise ordinary edits in combinations, rather than locking today's roster.
const unscheduledMtt = { title: "Next MTT | 18-Max", slot: "mtt", day: "Next MTT", date: "Date TBD",
  tables: 2, capacity: 18, apple_invite_url: "", seatAssignments: [Array(9).fill(""), Array(9).fill("")],
  rsvps: Object.fromEntries(data.players.map(player => [player.slug, "tbd"])) };
const unscheduledSnapshot = JSON.stringify(unscheduledMtt);
const unscheduledMarkup = app.get("buildHomeEventCard")(unscheduledMtt, data, [unscheduledMtt], 0, 0);
check(unscheduledMarkup.includes("Date TBD") && unscheduledMarkup.includes("Next MTT Invite Coming Soon")
    && unscheduledMarkup.includes('aria-disabled="true"') && !unscheduledMarkup.includes("Invalid Date")
    && !unscheduledMarkup.includes("data-player-name=")
    && (unscheduledMarkup.match(/class="event-empty-seat"/g) || []).length === 18,
  "Unscheduled MTT must show Date TBD, a disabled invite and 18 empty preview chairs");
check(JSON.stringify(unscheduledMtt) === unscheduledSnapshot, "Rendering an unscheduled MTT must preserve RSVP and manual-preview data");
const editingData = { players: data.players.filter(p => ["bostnmike", "ahmed", "hiro", "p", "rob-f", "wild-bill"].includes(p.slug)) };
const editingLayouts = [undefined, [], [[], []], [["BostnMike", "", "HIRO"], ["P", ""]],
  [["P", "AHMED", ""], ["hiro", "rob-f"]], [["ahmed", "ahmed", ""], ["AHMED", "P", ""]],
  [Array(9).fill(""), Array(9).fill("")], [["wild-bill", "hiro"], []],
  [[...Array(9).fill(""), "P"], []], [[], [], ["P"]]];
for (const ahmed of ["yes", "NO", "Maybe", "TBD"])
  for (const hiro of ["YES", "no", "maybe", "tbd"])
    for (const p of ["Yes", "No", "MAYBE", "tbd"])
      for (const [layoutIndex, seatAssignments] of editingLayouts.entries()) {
        const event = { slot: `editing matrix ${ahmed}/${hiro}/${p}/${layoutIndex}`, tables: 2,
          seatAssignments, rsvps: { P: p, "rob-f": "yes", HIRO: hiro, ahmed, BostnMike: "yes" } };
        const report = auditRsvpEvent(event, editingData, app);
        checks += report.checks;
        errors.push(...report.errors);
      }
for (const tables of [1, 2]) {
  for (const rsvps of [undefined, {}, null, { P: "", HIRO: null },
    Object.fromEntries(editingData.players.map(p => [p.slug, "TBD"])),
    Object.fromEntries(data.players.map(p => [p.slug, "YES"]))]) {
    const report = auditRsvpEvent({ slot: "empty/reset/capacity", tables, rsvps }, data, app);
    checks += report.checks;
    errors.push(...report.errors);
  }
}
for (const invalid of [
  { rsvps: [] }, { rsvps: { ahmed: true } }, { rsvps: { ahmed: "yess" } },
  { rsvps: { ahmed: " yes " } }, { rsvps: { unknown: "yes" } },
  { rsvps: { ahmed: "yes", AHMED: "no" } },
  { seatAssignments: "ahmed" }, { seatAssignments: [null] },
  { seatAssignments: [[null]] }, { seatAssignments: [["unknown"]] }, { tables: 0 }
]) check(auditRsvpEvent({ tables: 2, ...invalid }, editingData, app).errors.length > 0,
  `Invalid RSVP data must fail clearly: ${JSON.stringify(invalid)}`);
const validEditingEvent = { tables: 2, rsvps: { ahmed: "yes", P: "yes" }, seatAssignments: [["P", ""], ["ahmed"]] };
const duplicateEditingReport = auditRsvpEvent({ tables: 2, rsvps: { P: "yes", ahmed: "yes" },
  seatAssignments: [["P", ""], ["p", "ahmed"]] }, editingData, app);
check(!duplicateEditingReport.errors.length && duplicateEditingReport.warnings.some(w => w.includes("duplicate"))
  && duplicateEditingReport.warnings.some(w => w.includes("key order")),
  "Temporary duplicate manual assignments and unsorted RSVP keys must warn without blocking normal edits");
check(!auditRsvpEvent({ tables: 2, seatAssignments: null }, editingData, app).errors.length,
  "Null manual assignments must retain the site's automatic-preview fallback");
for (const brokenFunction of ["getRsvpCounts", "getConfirmedRsvpPlayers", "getEventSeatingTables"]) {
  const brokenApp = { get(name) {
    if (name !== brokenFunction) return app.get(name);
    return () => name === "getRsvpCounts" ? { yes: 99 } : name === "getEventSeatingTables" ? [[], []] : [];
  } };
  check(auditRsvpEvent(validEditingEvent, editingData, brokenApp).errors.length > 0,
    `RSVP checks must catch a genuine ${brokenFunction} regression`);
}
const shuffledRosterEvent = { rsvps: Object.fromEntries([...data.players].reverse().map(p => [p.slug, "yes"])) };
// Manual blanks hold positions; they never become attendees or automatic seats.
const previewData = { players: ["bostnmike", "ahmed", "hiro", "kishan", "red", "vish"].map(slug => data.players.find(p => p.slug === slug)) };
const previewEvent = { tables: 2, seatAssignments: [["bostnmike", "", "hiro"], ["ahmed", ""]],
  rsvps: { bostnmike: "yes", ahmed: "yes", hiro: "yes", kishan: "yes", red: "no", vish: "tbd" } };
const previewSnapshot = JSON.stringify(previewEvent);
const previewTables = app.get("getEventSeatingTables")(previewEvent, previewData, 3);
const previewSlugs = tables => JSON.stringify(tables.map(table => table.map(p => p?.slug || null)));
const casePreviewData = { players: [...previewData.players, { slug: "p", name: "P" }] };
const casePreviewEvent = { tables: 2, seatAssignments: [["BostnMike", "", "HIRO"], ["AHMED", "P", ""]],
  rsvps: { bostnmike: "yes", hiro: "yes", ahmed: "yes", p: "yes" } };
const casePreviewSnapshot = JSON.stringify(casePreviewEvent);
const casePreviewTables = app.get("getEventSeatingTables")(casePreviewEvent, casePreviewData, 3);
check(previewSlugs(casePreviewTables) === JSON.stringify([["bostnmike", null, "hiro"], ["ahmed", "p", null]]),
  "Mixed-case manual player IDs must resolve without shifting interior or trailing blank positions");
check(JSON.stringify(casePreviewEvent.seatAssignments.map(table => confirmedManualSlots(table, casePreviewEvent.rsvps))) === previewSlugs(casePreviewTables),
  "Manual-position audit must accept uppercase P immediately before a blank, matching the site lookup");
check(JSON.stringify(confirmedManualSlots(["P", "HIRO", "", "AHMED"], { p: "no", hiro: "tbd", ahmed: "yes" })) === JSON.stringify([null, "ahmed"]),
  "Case-insensitive manual audit must still exclude no/TBD players and preserve blanks");
check(JSON.stringify(casePreviewEvent) === casePreviewSnapshot, "Mixed-case manual preview must not rewrite user assignments or RSVP answers");
check(previewSlugs(previewTables) === JSON.stringify([["bostnmike", null, "hiro"], ["ahmed", null, "kishan"]]), "Manual interior/trailing blanks must stay open while new confirmations use remaining positions");
const previewTableHtml = app.get("eventRsvpTableMarkup")(previewTables[0], 3, { showTableHeading: true });
check(previewTableHtml.includes("2 / 3 RSVPs shown") && previewTableHtml.includes("2 of 3 confirmed RSVPs shown"), "Manual blank positions must not inflate visible or accessible RSVP counts");
check(!previewTableHtml.includes("is-hot-table"), "Manual blank positions must not inflate table heat");
check(previewTableHtml.indexOf('data-player-name="BostnMike"') < previewTableHtml.indexOf('class="event-empty-seat"') && previewTableHtml.indexOf('class="event-empty-seat"') < previewTableHtml.indexOf('data-player-name="Hiro"'), "Empty chair must render between its manually assigned neighbors");
const fullPreviewEvent = { ...previewEvent, rsvps: { ...previewEvent.rsvps, red: "yes" } };
const fullPreviewHtml = app.get("eventRsvpAvatarMarkup")(fullPreviewEvent, previewData, 3);
check(fullPreviewHtml.includes("Confirmed, not placed in this preview:</strong> Red."), "Confirmed players blocked by held-open positions must remain visible below the preview");
check(app.get("getRsvpCounts")(fullPreviewEvent).yes === 5, "Unplaced confirmations must still count toward event totals");
const resetPreviewEvent = { ...previewEvent, rsvps: Object.fromEntries(Object.keys(previewEvent.rsvps).map(slug => [slug, "tbd"])) };
const resetPreviewHtml = app.get("eventRsvpAvatarMarkup")(resetPreviewEvent, previewData, 3);
check(!resetPreviewHtml.includes('data-player-name=') && (resetPreviewHtml.match(/class="event-empty-seat"/g) || []).length === 6, "Resetting all RSVPs to TBD must render empty chairs, not avatars");
check(resetPreviewHtml.includes("0 / 3 RSVPs shown"), "Reset previews must report zero confirmed players");
const autoPreviewEvent = { ...previewEvent, seatAssignments: [[], []] };
check(previewSlugs(app.get("getEventSeatingTables")(autoPreviewEvent, previewData, 3)) === JSON.stringify([["bostnmike", "hiro"], ["ahmed", "kishan"]]), "Empty assignment arrays must retain the ordinary balanced fallback");
check(JSON.stringify(previewEvent) === previewSnapshot, "Preview rendering must never rewrite manual overrides or RSVP answers");
const expectedRosterNames = eventRosterOrder(data.players).map(app.get("displayPlayerNamePlain"));
check(JSON.stringify(app.get("getRsvpPlayersByStatus")(shuffledRosterEvent, data, "yes")) === JSON.stringify(expectedRosterNames), "Every RSVP status list must sort independently of input order");
check(expectedRosterNames[0] === "BostnMike", "Commish must retain the first event roster slot");
const mtt = app.get('RULES_FORMATS["two-table"]');
const mttCallout = app.get("buildRulesFormatCallout")(mtt);
const houseRules = fs.readFileSync(path.join(root, "rules.html"), "utf8");
const mttFinancials = readJson("data/event-financials.json").events["2026-10-24"];
const projectedMttPrizes = [38, 24, 16, 12, 10].map(percent => (1040 - 40) * percent / 100).concat(40);
check(JSON.stringify(projectedMttPrizes) === JSON.stringify([380, 240, 160, 120, 100, 40])
    && projectedMttPrizes.every((value, i) => mtt.payoutLabel.includes(`${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"} $${value}`)),
  "MTT projected payouts must reserve sixth before applying percentages");
const completedMttChop = fs.existsSync(path.join(root, "data/parsed/events/2026-10-24.json"))
    && mttFinancials.chopFinalists?.length > 1 && !!mttFinancials.regularPayoutsByPlayer;
check((completedMttChop || (mttFinancials.regularPayoutFixed?.["6"] === 40
    && JSON.stringify(Object.values(mttFinancials.regularPayoutPercentages || {})) === JSON.stringify([38, 24, 16, 12, 10])))
    && mttFinancials.bounty.mode === "optional-rebuy" && mttFinancials.bounty.winnerOnlyRollover === true,
  "MTT must use the planned payout policy or a completed source-audited chop; projected structure stays unchanged");
check(mtt.bounty.text.split(/\s+/).length <= 40 && !mtt.bounty.details,
  "MTT structure bounty summary must remain brief");
check(mttCallout.includes('href="rules.html#rules-mtt-bounties"'),
  "MTT structure must link directly to the full bounty rules");
check(!/rounding|whole-dollar/i.test(mttCallout + houseRules),
  "Public MTT copy must omit rounding commentary");
for (const phrase of ["mandatory $10 bounty", "$50 with a bounty or $40 without",
  "Schnazzy", "receipts for bounty payouts at the end of the night", "new Schnazzy plaque",
  "No Bounty Paid (No Blood from Rocks)", "ONLY to the eventual tournament winner",
  "earlier forfeitures stay in the winner fund", "unanimous agreement and host confirmation"]) {
  check(houseRules.includes(phrase), `Full MTT policy must remain on House Rules: ${phrase}`);
}
const rulesScript = fs.readFileSync(path.join(root, "rules.js"), "utf8");
const bountyChapter = houseRules.match(/<section id="rules-mtt-bounties"[\s\S]*?<\/section>/)?.[0] || "";
check(bountyChapter.includes('rules-chapter') && bountyChapter.includes('class="rules-grid"')
    && (bountyChapter.match(/class="rule-card"/g) || []).length === 4,
  "MTT rules must use the existing four-card chapter layout");
for (const [number, slug, name] of [[28, "li-fo", "Li-Fo"], [29, "bostnmike", "BostnMike"], [30, "hiro", "Hiro"], [31, "ahmed", "Ahmed"]]) {
  check(bountyChapter.includes(`dealer-button-number">${number}</span>`) && bountyChapter.includes(name)
      && rulesScript.includes(`${number}: "${slug}"`), `MTT rule ${number} needs its numbered badge, player joke and matching avatar`);
}
for (const phrase of ["after Level 11", "beginning Level 12", "6:40 PM", "10,000", "payment is confirmed"]) {
  check(mtt.blindNote.includes(phrase) && houseRules.includes(phrase), `MTT entry-window policy missing: ${phrase}`);
}
check(!/first-entry only|rebuys carry no bounty/i.test(mttCallout),
  "MTT must not retain obsolete bounty restrictions");
let mttMinutesToClose = 0;
for (const row of mtt.levels) {
  mttMinutesToClose += row.type === "break" ? (row.durationMinutes || mtt.breakMinutes) : mtt.levelMinutes;
  if (row.level === "11") break;
}
check(mttMinutesToClose === 340 && mtt.levelMinutes === 25,
  "MTT approximate 6:40 PM cutoff must follow unchanged levels and breaks from a 1 PM start");
const sortPlayers = app.get("sortPlayers");
const getPlayerTierScore = app.get("getPlayerTierScore");
const playerCardOverallRating = app.get("playerCardOverallRating");
const playerCardAttributes = app.get("playerCardAttributes");
const playerCardViewData = app.get("playerCardViewData");
const getPlayerArchetypes = app.get("getPlayerArchetypes");
const badgeList = app.get("badgeList");
const playerCardComparisonCandidates = app.get("playerCardComparisonCandidates");
const playerCardTierMeta = app.get("playerCardTierMeta");
const playerCardRatingComparator = app.get("playerCardRatingComparator");
const isCrewVisible = app.get("isCrewVisible");
const isCrewRookie = app.get("isCrewRookie");
const isCrewProvisional = app.get("isCrewProvisional");
const isCrewEligible = app.get("isCrewEligible");
const isCrewEstablished = app.get("isCrewEstablished");
const getLeaderByRule = app.get("getLeaderByRule");
const getHallPlayers = app.get("getHallPlayers");
const getHallMinimumAppearances = app.get("getHallMinimumAppearances");
const playerCardSpecialEditions = app.get("playerCardSpecialEditions");
const playerCardFeaturedEditionId = app.get("playerCardFeaturedEditionId");
const playerCardSpecialEdition = app.get("playerCardSpecialEdition");
const buildFeaturedPlayerCard = app.get("buildFeaturedPlayerCard");
const crewCardMarkup = app.get("crewCardMarkup");
const playerCardCollectionMarkup = app.get("playerCardCollectionMarkup");

const players = data.players || [];
const established = players.filter(player => Number(player.buyIns || 0) >= 5);
const isUnscouted = player => Number(player?.buyIns || 0) <= 0;

function manualTierScore(player) {
  const buyIns = Number(player.buyIns || 0);
  if (buyIns <= 0) return 0;
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
  const played = allPlayers.filter(player => !isUnscouted(player));
  return provisional.length >= 2 ? provisional : played;
}

function manualRating(player, allPlayers, key, minRating = 40, maxRating = 96) {
  const values = ratingPool(allPlayers).map(item => Number(item[key] || 0));
  if (!values.length) return 68;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const normalized = max === min ? 0.5 : (Number(player[key] || 0) - min) / (max - min);
  return Math.max(1, Math.min(99, Math.round(minRating + Math.max(0, Math.min(1, normalized)) * (maxRating - minRating))));
}

function manualOverallRating(player) {
  const appearances = Math.max(0, Number(player?.buyIns || 0));
  const powerIndex = Number(player?.trueSkillScore || 0);
  const confidence = appearances / (appearances + 5);
  const adjustedPower = 160 + confidence * (powerIndex - 160);
  return Math.max(40, Math.min(97, Math.round(70 + (adjustedPower - 160) / 4.5)));
}

const establishedRank = [...established].sort((a, b) => manualTierScore(b) - manualTierScore(a));
const attributeSpecs = [
  ["CLT", "clutchIndex"], ["ITM", "cashRate"], ["AGR", "aggressionIndex"],
  ["HIT", "hitRate"], ["SUR", "survivorIndex"]
];

for (const player of players) {
  const appearances = Number(player.buyIns || 0);
  check(close(getPlayerTierScore(player), manualTierScore(player)), `${player.slug}: Crew tier score differs from published formula`);
  const overallRating = playerCardOverallRating(player, players);
  if (appearances === 0) {
    check(
      app.get("displayPlayerName")(player) === app.get("displayPlayerNamePlain")(player),
      `${player.slug}: Unscouted display name must not append an entry asterisk`
    );
    check(overallRating === "NR", `${player.slug}: zero-game card overall must be NR`);
  } else {
    check(
      app.get("displayPlayerName")(player).includes("player-entry-asterisk") === (Number(player.entries || 0) < 5),
      `${player.slug}: preserve the existing entry marker for players who have appeared`
    );
    check(overallRating === manualOverallRating(player), `${player.slug}: live card overall rating differs from the fixed sample-adjusted formula`);
    check(overallRating >= 40 && overallRating <= 97, `${player.slug}: live card overall rating is outside the fixed 40–97 range`);
  }
  const attributes = playerCardAttributes(player, players);
  const byCode = Object.fromEntries(attributes.map(attribute => [attribute.code, attribute.value]));
  const expectedReturn = appearances === 0
    ? null
    : Math.round(manualRating(player, players, "roi") * 0.65 + manualRating(player, players, "profit") * 0.35);

  if (appearances === 0) {
    check(
      attributes.length === 6 && attributes.every(attribute => attribute.value === "—"),
      `${player.slug}: zero-game card attributes must all be unrated`
    );

    const cardView = playerCardViewData(player, players).career;
    check(cardView.overall === "NR", `${player.slug}: zero-game career card view must be NR`);
    check(
      cardView.attributes.every(attribute => attribute.value === "—"),
      `${player.slug}: zero-game career card view attributes must be unrated`
    );
    check(
      String(cardView.overallRaw || "").includes("Unrated") &&
        String(cardView.overallFormula || "").includes("first TLPT appearance"),
      `${player.slug}: zero-game rating breakdown must explain the unrated state`
    );

    const archetype = getPlayerArchetypes(player).primary;
    check(
      archetype?.key === "unscouted" && archetype?.name === "Unscouted",
      `${player.slug}: zero-game player must use the Unscouted archetype`
    );
    check(
      badgeList(player, data).length === 0,
      `${player.slug}: zero-game player must not receive performance badges`
    );
    check(
      playerCardComparisonCandidates(player, players).length === 0,
      `${player.slug}: zero-game player must not receive card comparison candidates`
    );
  } else {
    check(byCode.RET === expectedReturn, `${player.slug}: RET card rating differs from formula`);
    for (const [code, key] of attributeSpecs) {
      check(byCode[code] === manualRating(player, players, key), `${player.slug}: ${code} card rating differs from formula`);
    }

    const playedOnly = players.filter(candidate => !isUnscouted(candidate));
    check(
      playerCardOverallRating(player, players) === playerCardOverallRating(player, playedOnly),
      `${player.slug}: adding zero-game metadata must not alter an active player's card rating`
    );
  }

  const meta = playerCardTierMeta(player, players);
  const expectedCrewSkin = player.cardCollection?.find(card => card.id !== "rookie")?.id || "base";
  check(player.featuredCardMode === "automatic", `${player.slug}: Crew skin mode must remain automatic`);
  check(player.featuredCardEdition === expectedCrewSkin, `${player.slug}: active Crew skin must be the highest-priority earned edition`);
  check(isCrewVisible(player) === (appearances >= 1), `${player.slug}: Crew visibility threshold is incorrect`);
  check(isCrewRookie(player) === (appearances >= 1 && appearances < 3), `${player.slug}: RKI band is incorrect`);
  check(isCrewProvisional(player) === (appearances >= 3 && appearances < 5), `${player.slug}: PRO band is incorrect`);
  check(isCrewEligible(player) === (appearances >= 3), `${player.slug}: Crew eligibility threshold is incorrect`);
  check(isCrewEstablished(player) === (appearances >= 5), `${player.slug}: established threshold is incorrect`);
  if (appearances === 0) {
    check(meta.code === "UNS" && meta.status === "Unscouted" && meta.rank === null, `${player.slug}: Unscouted card status/rank is incorrect`);
  } else if (appearances < 3) {
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

const currentLeader = [...established].sort(
  (a, b) => Number(b.trueSkillScore || 0) - Number(a.trueSkillScore || 0)
)[0];
if (currentLeader) {
  const leaderRating = playerCardOverallRating(currentLeader, players);
  const outlierPool = [
    ...players,
    { name: "Scale Outlier", slug: "scale-outlier", buyIns: 100, trueSkillScore: 1000 }
  ];
  check(
    leaderRating === playerCardOverallRating(currentLeader, outlierPool),
    "Live OVR must not change when the comparison pool changes"
  );
}
check(
  playerCardOverallRating({ buyIns: 1, trueSkillScore: 250 }, players)
    < playerCardOverallRating({ buyIns: 20, trueSkillScore: 250 }, players),
  "OVR confidence adjustment must temper small-sample ratings"
);
check(
  playerCardOverallRating({ buyIns: 1, trueSkillScore: 160 }, players) === 70
    && playerCardOverallRating({ buyIns: 50, trueSkillScore: 160 }, players) === 70,
  "The fixed 160 Power Index baseline must always map to 70 OVR"
);

const tierPriority = { S: 0, A: 1, B: 2, C: 3, D: 4, PRO: 5, RKI: 6, UNS: 7 };
check(data.featuredCardConfig?.mode === "automatic", "Generated Crew skin policy must remain automatic");
check(data.featuredCardConfig?.overrideCount === 0, "Generated Crew skin policy must reject manual overrides");
const manualCrewOrder = [...players]
  .filter(player => Number(player.buyIns || 0) >= 1)
  .sort((a, b) => {
    const aTier = playerCardTierMeta(a, players).code;
    const bTier = playerCardTierMeta(b, players).code;
    return (tierPriority[aTier] ?? 7) - (tierPriority[bTier] ?? 7) ||
      playerCardOverallRating(b, players) - playerCardOverallRating(a, players) ||
      manualTierScore(b) - manualTierScore(a) ||
      String(a.name).localeCompare(String(b.name));
  });
const crewOrder = [...players]
  .filter(isCrewVisible)
  .sort(playerCardRatingComparator(players));
check(
  JSON.stringify(crewOrder.map(player => player.slug)) === JSON.stringify(manualCrewOrder.map(player => player.slug)),
  "Crew card order must use tier priority first and rating second"
);

const skinNeutralPlayers = players.map(player => ({
  ...player,
  featuredCardEdition: "base",
  featuredCardMode: "automatic"
}));
const skinNeutralOrder = [...skinNeutralPlayers]
  .filter(isCrewVisible)
  .sort(playerCardRatingComparator(skinNeutralPlayers))
  .map(player => player.slug);
check(
  JSON.stringify(skinNeutralOrder) === JSON.stringify(crewOrder.map(player => player.slug)),
  "Special-edition skins must not affect Crew ordering"
);

for (const player of players) {
  const collection = player.cardCollection || [];
  const rookieCards = collection.filter(card => card.id === "rookie");
  check(rookieCards.length === (Number(player.buyIns || 0) > 0 ? 1 : 0),
    `${player.slug}: exactly one Rookie Card is required after debut, and none before debut`);
  if (rookieCards.length) {
    const rookie = rookieCards[0];
    check(rookie.snapshot?.appearances === 1 && rookie.snapshot?.tierCode === "RKI"
      && Boolean(rookie.earnedDate) && Boolean(rookie.earnedEvent) && !rookie.upgradedDate,
      `${player.slug}: Rookie Card must preserve the first appearance, date, event and rookie tier`);
    check(playerCardFeaturedEditionId({ ...player, cardCollection: [rookie] }, data) === "base",
      `${player.slug}: Rookie Card alone must not replace the live tier skin`);
  }
  const expectedIds = collection.map(card => card.id);
  const expectedSkinId = expectedIds.find(id => id !== "rookie") || "base";
  const editions = playerCardSpecialEditions(player, data);
  const actualIds = editions.map(edition => edition.id);
  const activeEdition = playerCardSpecialEdition(player, data);
  const overall = playerCardOverallRating(player, players);
  const tierCode = playerCardTierMeta(player, players).code;

  check(
    JSON.stringify(actualIds) === JSON.stringify(expectedIds),
    `${player.slug}: Profile renderer collection differs from the permanent ledger`
  );
  check(
    playerCardFeaturedEditionId(player, data) === expectedSkinId,
    `${player.slug}: UI active Crew skin differs from collection priority`
  );
  check(
    (activeEdition?.id || "base") === expectedSkinId,
    `${player.slug}: active Crew skin artwork differs from collection priority`
  );

  const crewMarkup = crewCardMarkup(player, data);
  check(
    crewMarkup.includes(`data-featured-edition="${expectedSkinId}"`),
    `${player.slug}: Crew card does not identify the automatic skin`
  );
  check(
    crewMarkup.includes(`crew-ultimate-overall">${overall}</span>`),
    `${player.slug}: Crew skin changed the live overall rating`
  );
  check(
    crewMarkup.includes(`crew-ultimate-tier-code">${tierCode}</span>`),
    `${player.slug}: Crew skin changed the live tier code`
  );
  check(
    crewMarkup.includes("Active Crew Skin:"),
    `${player.slug}: Crew card is missing the shared active-skin terminology`
  );

  const homeMarkup = buildFeaturedPlayerCard(player, data);
  check(
    homeMarkup.includes(`data-featured-edition="${expectedSkinId}"`),
    `${player.slug}: Home card does not identify the automatic skin`
  );
  check(
    homeMarkup.includes(`crew-ultimate-overall">${overall}</span>`),
    `${player.slug}: Home skin changed the live overall rating`
  );
  check(
    homeMarkup.includes(`crew-ultimate-tier-code">${tierCode}</span>`),
    `${player.slug}: Home skin changed the live tier code`
  );
  check(
    homeMarkup.includes("Active Crew Skin:"),
    `${player.slug}: Home card is missing the shared active-skin terminology`
  );

  const collectionMarkup = playerCardCollectionMarkup(
    player,
    players,
    editions,
    expectedSkinId
  );
  const collectionButtons = [...collectionMarkup.matchAll(
    /<button\b[^>]*data-card-edition-select="([^"]+)"[^>]*data-card-featured-on-crew="(true|false)"[^>]*>/g
  )];
  check(
    JSON.stringify(collectionButtons.map(match => match[1]))
      === JSON.stringify(["base", ...expectedIds]),
    `${player.slug}: Profile collection cards are missing, duplicated, or out of order`
  );
  check(
    collectionButtons.filter(match => match[2] === "true").length === 1
      && collectionButtons.find(match => match[2] === "true")?.[1] === expectedSkinId,
    `${player.slug}: Profile collection active-skin marker is incorrect`
  );
}

const bountyFallbackPlayers = players.map(player => {
  const { cardCollection, ...fallbackPlayer } = player;
  return { ...fallbackPlayer, bountiesWon: 0 };
});
const bountyFallbackLeader = bountyFallbackPlayers.find(isCrewEstablished);
if (bountyFallbackLeader) {
  bountyFallbackLeader.bountiesWon = 4;
  const bountyFallbackData = { ...data, players: bountyFallbackPlayers };
  const bountyEdition = playerCardSpecialEditions(
    bountyFallbackLeader,
    bountyFallbackData
  ).find(edition => edition.id === "leader-bounties");
  check(
    bountyEdition?.label === "Bounty Hunter"
      && bountyEdition?.reason?.includes("4 bounties"),
    "Bounty Hunter fallback card must identify the established career bounty leader"
  );

  const zeroBountyPlayers = bountyFallbackPlayers.map(player => ({
    ...player,
    bountiesWon: 0
  }));
  check(
    zeroBountyPlayers.every(player => !playerCardSpecialEditions(
      player,
      { ...data, players: zeroBountyPlayers }
    ).some(edition => edition.id === "leader-bounties")),
    "Bounty Hunter must not be awarded before a real bounty is recorded"
  );
}

const trophy = loadScript("trophy-room.js", source => source.replace(
  /\n\}\)\(\);\s*$/,
  `\n  globalThis.__TLPT_TROPHY_AUDIT__ = { editionMetadata, flattenCollections, cardMarkup };\n})();\n`
));
const trophyAudit = trophy.get("__TLPT_TROPHY_AUDIT__");
const bountyTrophyMetadata = trophyAudit.editionMetadata({ id: "leader-bounties" });
check(
  bountyTrophyMetadata?.label === "Bounty Hunter"
    && bountyTrophyMetadata?.order === 14,
  "Trophy Room must recognize the Bounty Hunter career card"
);
const trophyCards = trophyAudit.flattenCollections(data);
check(trophyAudit.editionMetadata({ id: "rookie" })?.type === "rookie",
  "Trophy Room must recognize and filter Rookie Cards separately");
for (const [file, selector] of [
  ["player.css", ".tlpt-compare-card-edition-rookie{"],
  ["trophy-room.css", ".trophy-card-edition-rookie{"]
]) {
  const css = fs.readFileSync(path.join(root, file), "utf8");
  const block = css.slice(css.indexOf(selector)).split("}")[0];
  check(block.includes("--card-surface-a:#ffffff;") && block.includes("--card-frame:#dc3545;")
    && block.includes("--card-ink:#111820;"), `${file}: Rookie Cards must be white, red-outlined and readable`);
}
const expectedTrophyCount = players.reduce(
  (total, player) => total + (player.cardCollection || []).length,
  0
);
check(
  trophyCards.length === expectedTrophyCount,
  "Trophy Room card count differs from the permanent collection ledger"
);

const trophyCardsByKey = new Map(
  trophyCards.map(card => [`${card.player.slug}/${card.id}`, card])
);
for (const player of players) {
  const expectedSkinId = player.cardCollection?.find(card => card.id !== "rookie")?.id || "base";
  for (const record of player.cardCollection || []) {
    const key = `${player.slug}/${record.id}`;
    const card = trophyCardsByKey.get(key);
    check(Boolean(card), `${key}: Trophy Room omitted a permanent collectible`);
    if (!card) continue;
    check(
      JSON.stringify(card.snapshot) === JSON.stringify(record.snapshot),
      `${key}: Trophy Room changed the frozen historic snapshot`
    );
    check(
      card.isFeatured === (record.id === expectedSkinId),
      `${key}: Trophy Room active-skin marker differs from collection priority`
    );
    const markup = trophyAudit.cardMarkup(card);
    check(
      markup.includes(`data-card-id="${record.id}"`),
      `${key}: Trophy Room markup lost the edition id`
    );
    check(
      markup.includes(`trophy-card-rating">\n                <strong>${record.snapshot.overall}</strong>`),
      `${key}: Trophy Room markup changed the frozen overall rating`
    );
    check(
      markup.includes(`data-featured-on-crew="${record.id === expectedSkinId ? "true" : "false"}"`),
      `${key}: Trophy Room markup active-skin state is incorrect`
    );
  }
}

const knockoutPage = loadScript("knockouts.js", source => source.replace(
  /\n\}\)\(\);\s*$/,
  `\n  globalThis.__TLPT_KNOCKOUT_AUDIT__ = { buildPlayerMap, hasBountyData, renderBountyView };\n})();\n`
));
const knockoutAudit = knockoutPage.get("__TLPT_KNOCKOUT_AUDIT__");
const knockoutData = readJson("data/generated/knockouts.json");
const noBountyPlayers = players.map(player => ({
  ...player,
  bountiesWon: 0,
  bountyPaid: 0,
  bountyCollected: 0,
  bountyRetained: 0,
  bountyWinnings: 0,
  bountyNet: 0
}));
const emptyBountyMarkup = knockoutAudit.renderBountyView(
  noBountyPlayers,
  knockoutAudit.buildPlayerMap(noBountyPlayers),
  { ...knockoutData, bounties: { claims: [], eventsProcessed: [] } }
);
check(
  !knockoutAudit.hasBountyData(noBountyPlayers)
    && emptyBountyMarkup.includes("No bounty results in this view")
    && !emptyBountyMarkup.includes("Bounty Ledger"),
  "Knockout Central must keep the bounty view closed until real bounty data exists"
);
const actualBountyMarkup = knockoutAudit.renderBountyView(
  players,
  knockoutAudit.buildPlayerMap(players),
  knockoutData
);
check(
  actualBountyMarkup.includes("Bounty Ledger")
    === players.some(player => Number(player.bountyPaid || 0) > 0),
  "Knockout Central must open its bounty ledger when actual bounty events exist"
);

const syntheticBountyPlayers = players.map((player, index) => ({
  ...player,
  bountiesWon: index === 0 ? 2 : 0,
  bountyPaid: index < 2 ? 10 : 0,
  bountyCollected: index === 0 ? 20 : 0,
  bountyRetained: index === 0 ? 10 : 0,
  bountyWinnings: index === 0 ? 30 : 0,
  bountyNet: index === 0 ? 20 : index === 1 ? -10 : 0
}));
const syntheticClaims = [
  { eventId: "2026-10-24", killer: syntheticBountyPlayers[0].slug, victim: syntheticBountyPlayers[1].slug, amount: 10 },
  { eventId: "2026-10-24", killer: syntheticBountyPlayers[0].slug, victim: syntheticBountyPlayers[2].slug, amount: 10 }
];
const syntheticBountyMarkup = knockoutAudit.renderBountyView(
  syntheticBountyPlayers,
  knockoutAudit.buildPlayerMap(syntheticBountyPlayers),
  { ...knockoutData, bounties: { claims: syntheticClaims, eventsProcessed: ["2026-10-24"] } }
);
check(
  syntheticBountyMarkup.includes("Bounty Ledger")
    && syntheticBountyMarkup.includes("Verified Bounty Claims")
    && syntheticBountyMarkup.includes("10/24/26")
    && syntheticBountyMarkup.includes("2 bounties"),
  "Knockout Central must render career bounty money and verified killer-to-victim claims"
);

const rebuyBountyMarkup = knockoutAudit.renderBountyView(
  syntheticBountyPlayers,
  knockoutAudit.buildPlayerMap(syntheticBountyPlayers),
  { bounties: { claims: [{ ...syntheticClaims[0], victimEntry: 3, killerEntry: 2 }] } }
);
check(rebuyBountyMarkup.includes("entry #3 bounty")
    && rebuyBountyMarkup.includes("winner-only prize money"),
  "Optional rebuy claims must display the victim entry and exclude forfeitures from bounty wins");

const sortableKeys = [
  "totalWinnings", "profit", "hits", "timesPlaced", "bubbles", "hitRate",
  "cashRate", "bubbleRate", "roi", "trueSkillScore", "luckIndex",
  "clutchIndex", "aggressionIndex", "survivorIndex", "tiltIndex",
  "bountiesWon", "bountyNet"
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
check(getHallMinimumAppearances(events.length) === hallMinimum, "Hall minimum must remain 25% of completed events with a floor of 10");
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
const formLabRequests = [];
formLab.set("fetch", async (url, options) => {
  formLabRequests.push({ url, options });
  return { ok: true, json: async () => url.includes("event-history.json") ? eventHistory : data };
});
const freshlyLoadedFormLab = await formLab.get("loadFormLabData")();
check(formLabRequests.length === 2 && formLabRequests.every(r => /\?v=\d+$/.test(r.url) && r.options.cache === "no-store")
    && formLabRequests[0].url.split("?")[1] === formLabRequests[1].url.split("?")[1]
    && freshlyLoadedFormLab.events.length === events.length,
  "Form Lab must bypass stale cached data for both current players and the event history");
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

// A bounty receipt without a prize-pool payout must never create a cash.
const bountyOnlyPlayer = { name: "A.I. Dave", slug: "ai-dave" };
const bountyOnlyEvent = {
  date: "2026-10-17", eventId: "2026-10-17",
  summary: { buyIns: 7, paidSpots: 3 },
  winners: [], actions: [],
  players: [{ ...bountyOnlyPlayer, buyIns: 1, entries: 1, rebuys: 0,
    totalWinnings: 10, tournamentWinnings: 0, bountyWinnings: 10,
    totalCost: 35, profit: -25, timesPlaced: 0, bubbles: 0 }]
};
const bountyOnlyRow = formLab.get("buildPlayerEventRow")(bountyOnlyEvent, bountyOnlyPlayer, "ai-dave");
check(bountyOnlyRow.cashFlag === 0, "Bounty-only take-home must not create a Form Lab cash");
check(bountyOnlyRow.winnings === 10 && bountyOnlyRow.profit === -25,
  "Form Lab must include bounty receipts and costs in take-home and profit");
const settlementEvent = JSON.parse(JSON.stringify(bountyOnlyEvent));
settlementEvent.players[0].totalWinnings = 20;
settlementEvent.players[0].profit = -15;
settlementEvent.players[0].settlementAdjustment = 10;
delete settlementEvent.players[0].tournamentWinnings;
const settlementRow = formLab.get("buildPlayerEventRow")(settlementEvent, bountyOnlyPlayer, "ai-dave");
check(settlementRow.tournamentWinnings === 0 && settlementRow.cashFlag === 0 && settlementRow.settlementAdjustment === 10
    && settlementRow.winnings === 20 && settlementRow.profit === -15,
  "Confirmed settlement money must affect take-home without becoming a bounty or tournament cash");
for (const player of players) {
  check(close(player.totalWinnings, player.tournamentWinnings + player.bountyWinnings + (player.settlementAdjustment || 0)),
    `${player.slug}: take-home must equal prize money + bounty returns + confirmed settlement adjustments`);
  check(close(player.totalCost, player.tournamentCost + player.bountyPaid),
    `${player.slug}: total cost must include bounty purchases`);
  check(close(player.profit, player.tournamentProfit + player.bountyNet + (player.settlementAdjustment || 0)),
    `${player.slug}: overall profit must include bounty net and settlement adjustments once`);
}

for (const [amount, expected] of [[157.5, "$157.50"], [132.5, "$132.50"], [-65.5, "-$65.50"], [65, "$65"], [0.01, "$0.01"]]) {
  check(app.get("fmtMoney")(amount) === expected, `Shared money display must preserve cents for ${amount}`);
  check(formLab.get("moneyFmt")(amount) === expected, `Form Lab money display must preserve cents for ${amount}`);
}

// Exercise actual grouped renderers, not just the underlying ranking formula.
const groupedApp = loadScript("app.js");
const membership = groupedApp.context.window.TLPTRoster;
const sampleMembers = [
  { slug: "alum-first", rosterStatus: "alumni" },
  { slug: "active-first", rosterStatus: "active" },
  { slug: "alum-second", rosterStatus: "alumni" },
  { slug: "legacy-active" }
];
const frozenMembers = JSON.stringify(sampleMembers);
const groupedMarkup = membership.sections(sampleMembers, (p, index) => `<p>${p.slug}:${index + 1}</p>`);
check(groupedMarkup.indexOf("active-first:2") < groupedMarkup.indexOf('data-roster-section="alumni"'), "Active rows must precede the Alumni subsection");
check(groupedMarkup.includes("alum-first:1") && groupedMarkup.includes("alum-second:3"), "Grouping must retain original global ranks");
check(!membership.sections([], () => "x").length, "Empty lists must not produce empty membership headings");
check(!membership.sections([sampleMembers[1]], () => "active").includes("Alumni"), "Active-only lists must not invent an Alumni section");
check(!membership.sections([sampleMembers[0]], () => "alum").includes("Active players"), "Alumni-only lists must not show an empty Active section");
check(JSON.stringify(sampleMembers) === frozenMembers, "Grouping must not mutate source records");
const groupedOptions = membership.options(sampleMembers, p => `<option value="${p.slug}">${p.slug}</option>`);
check(groupedOptions.indexOf('label="Active players"') < groupedOptions.indexOf('label="Alumni"'), "Selectors must group active players before Alumni");
check((groupedOptions.match(/<option /g) || []).length === sampleMembers.length, "All player selector options must be retained");
const sampleTrophyData = { ...data, players: data.players.map(p => ({ ...p, rosterStatus: p.slug === "bostnmike" ? "alumni" : p.rosterStatus })) };
const sampleTrophies = trophyAudit.flattenCollections(sampleTrophyData);
check(sampleTrophies.filter(card => card.player.slug === "bostnmike").every(card => card.player.rosterStatus === "alumni"), "Trophy cards must carry current membership separately from frozen snapshots");
check(JSON.stringify(sampleTrophies.map(card => card.snapshot)) === JSON.stringify(trophyCards.map(card => card.snapshot)), "Membership must never alter earned-card snapshots");
const orderedTrophies = membership.ordered(sampleTrophies, card => card.player);
const firstAlumniCard = orderedTrophies.findIndex(card => card.player.rosterStatus === "alumni");
check(firstAlumniCard > 0 && orderedTrophies.slice(firstAlumniCard).every(card => card.player.rosterStatus === "alumni"), "Trophy pagination must finish active collectors before Alumni cards");
check(orderedTrophies.length === sampleTrophies.length, "Trophy grouping must preserve every earned card");

const host = () => ({ innerHTML: "", querySelectorAll: () => [], querySelector: () => null,
  insertAdjacentHTML(_where, markup) { this.innerHTML += markup; } });
const groupedGrid = host(), groupedBody = host(), crewGrid = host(), crewVisual = host();
const groupedTable = { dataset: {}, querySelector: () => groupedBody, querySelectorAll: () => [] };
const hosts = { "dashboard-grid": groupedGrid, "standings-table": groupedTable, "players-grid": crewGrid, "players-visual": crewVisual };
groupedApp.context.document.getElementById = id => hosts[id] || null;
groupedApp.context.window.siteData = data;
for (const name of ["syncDashboardSelector", "ensureDashboardHeadline", "renderDashboardStudioStrip", "initAnimatedCounters", "setActiveSortButton", "ensureStandingsHeadline", "renderStandingsRaceStrip", "wireMobileJumpNavCues"]) groupedApp.set(name, () => {});
for (const metric of ["hits", "profit", "roi", "bountyNet"]) {
  groupedApp.get("renderDashboard")(metric);
  const expected = groupedApp.get("sortPlayers")(groupedApp.get("dashboardPlayersForMetric")(data.players, metric), metric);
  for (const [index, player] of expected.entries()) {
    check(groupedGrid.innerHTML.includes(groupedApp.get("dashboardCardMarkup")(player, metric, index + 1)), `${metric}/${player.slug}: grouping changed Dashboard card or league rank`);
  }
  const alumniStart = groupedGrid.innerHTML.indexOf('data-roster-section="alumni"');
  for (const player of expected) {
    const cardAt = groupedGrid.innerHTML.indexOf(`href="${groupedApp.get("playerUrl")(player)}"`);
    check(alumniStart < 0 || (player.rosterStatus === "alumni" ? cardAt > alumniStart : cardAt < alumniStart), `${metric}/${player.slug}: Dashboard membership subsection is wrong`);
  }
}
groupedApp.get("renderStandings")("profit");
check(groupedBody.innerHTML.includes('colspan="10" scope="rowgroup"'), "Standings membership headings must span the complete table");
const standingPlayers = groupedApp.get("sortPlayers")(data.players.filter(p => Number(p.entries) >= 2), "profit");
check((groupedBody.innerHTML.match(/class="standings-row-link"/g) || []).length === standingPlayers.length, "Standings must preserve every eligible row");
for (const [index, player] of standingPlayers.entries()) {
  check(groupedBody.innerHTML.includes(`data-league-rank="${index + 1}"\n      data-href="${groupedApp.get("playerUrl")(player)}"`), `${player.slug}: podium styling must use the actual league rank, not membership header positions`);
}
groupedApp.get('currentCrewRoster = "all"');
for (const view of ["tier", "archetype"]) {
  groupedApp.get(`currentCrewView = "${view}"`);
  groupedApp.get("renderPlayers")(data);
  check((crewGrid.innerHTML.match(/aria-label="Open /g) || []).length === data.players.length, `All Players ${view} must contain every card exactly once`);
  for (const [, anchor] of crewGrid.innerHTML.matchAll(/href="#(crew-tier-[^"]+)"/g)) {
    check(crewGrid.innerHTML.includes(`id="${anchor}"`), `Crew jump link ${anchor} must reach a rendered section`);
  }
  const alumniStart = crewGrid.innerHTML.indexOf(view === "tier" ? 'id="crew-tier-alumni"' : 'data-roster-section="alumni"');
  check(alumniStart >= 0, `All Players ${view} needs one consolidated Alumni section`);
  for (const player of data.players) {
    const cardAt = crewGrid.innerHTML.indexOf(`aria-label="Open ${groupedApp.get("displayPlayerNamePlain")(player)} profile.`);
    check(player.rosterStatus === "alumni" ? cardAt > alumniStart : cardAt < alumniStart, `${player.slug}: ${view} Crew card appears in wrong membership section`);
  }
}
const forecastMarkup = groupedApp.get("eventRsvpForecastMarkup")({ rsvps: Object.fromEntries(data.players.map(p => [p.slug, "maybe"])) }, data);
check(!forecastMarkup.includes("Active:") && !forecastMarkup.includes("Alumni:") && forecastMarkup.includes(`${data.players.length} players`), "Event forecasts must combine active and alumni attendees in one count");
for (const status of ["maybe", "tbd", "no"]) {
  const mixedForecast = groupedApp.get("eventRsvpForecastMarkup")({ rsvps: { "rob-f": status, ahmed: status, bostnmike: status } }, data);
  check(mixedForecast.includes("BostnMike, Ahmed, Bob"), `${status}: event forecasts must retain alumni alongside active names with the Commish first`);
  check(!mixedForecast.includes("Alumni:") && !mixedForecast.includes("Active:"), `${status}: event forecasts must not label separate membership sections`);
}
for (const page of ["index", "champions", "dashboard", "standings", "players", "player", "schedule", "structures", "form-lab", "trophy-room", "knockouts", "streaks", "player-movement", "voice-of-god"]) {
  const html = fs.readFileSync(path.join(root, `${page}.html`), "utf8");
  check(html.includes('roster-display.css?v=20261018-2') && html.includes('roster-display.js?v=20261018-1'), `${page}: shared roster display assets missing`);
  check(html.indexOf('roster-display.js') > html.indexOf('site-shell.js'), `${page}: shared shell must initialize before roster helpers`);
}

const result = { status: errors.length ? "FAIL" : "PASS", checks, errorCount: errors.length, errors, warningCount: warnings.length, warnings };
process.stdout.write(JSON.stringify(result));
if (errors.length) process.exitCode = 2;
