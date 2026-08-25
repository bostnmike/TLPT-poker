/* app.js */
async function loadSiteData() {
  const baseRes = await fetch("/data/generated/site-data.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!baseRes.ok) {
    throw new Error(`Failed to load site-data.json (${baseRes.status})`);
  }

  const baseData = await baseRes.json();

  const eventsRes = await fetch("/data/events.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!eventsRes.ok) {
    throw new Error(`Failed to load events.json (${eventsRes.status})`);
  }

  const eventsData = await eventsRes.json();

  return {
    ...baseData,
    events: eventsData.events || []
  };
}

const DEFAULT_STANDINGS_SORT = "totalWinnings";
const DEFAULT_DASHBOARD_SORT = "profit";
const SHOW_HOME_COMMISSIONER_REPORT = false;

/*
 * Crew experience bands use separate tournament appearances.
 * buyIns counts initial tournament entries; rebuys do not count.
 *
 * 1–2 appearances: RKI / Rookie — visible prospect, not Crew-eligible.
 * 3–4 appearances: PRO / Provisional — Crew-eligible, still unranked.
 * 5+ appearances: Established — Crew-eligible for Power Rank and power tiers.
 */
const CREW_ROOKIE_MIN_BUY_INS = 1;
const CREW_ELIGIBLE_MIN_BUY_INS = 3;
const CREW_PROVISIONAL_MIN_BUY_INS = CREW_ELIGIBLE_MIN_BUY_INS;
const CREW_ESTABLISHED_MIN_BUY_INS = 5;
const CARD_OVERALL_MIN_RATING = 40;
const CARD_OVERALL_MAX_RATING = 99;

/*
 * Hall of Fame qualification:
 * Players must have participated in 25% of TLPT history.
 * Minimum floor prevents the Hall from becoming too easy early.
 */
const HALL_PERCENTAGE = 0.25;
const HALL_MIN_EVENTS = 10;

let currentCrewView = "tier";
let currentArchetypeMode = "primary";
let currentArchetypeFilter = "all";

const STAT_FORMULAS = {
  totalCost: "Total Cost: Buy-ins + Rebuys Cost",
  totalWinnings: "Gross Winnings: Total prize money won before subtracting costs",
  profit: "Profit: Total Take − Total Cost",
  roi: "ROI: Profit ÷ Total Cost",
  cashRate: "Cash Rate: Times Placed ÷ Buy-ins",
  bubbleRate: "Bubble Rate: Bubbles ÷ Buy-ins",
  hitRate: "Hit Rate: Hits ÷ (Buy-ins + Rebuys)",
  entries: "Entries: Buy-ins + Rebuys",
  buyIns: "Buy-ins: Total number of initial tournament entries purchased",
  rebuys: "Rebuys: Total number of re-entry purchases after busting",
  hits: "Hits: Total number of opponents eliminated by the player",
  timesPlaced: "Times Placed: Total number of times the player finished in the money",
  bubbles: "Bubbles: Total number of times the player finished one position outside the money",
  trueSkillScore: "Power Index: (1.4 × normalized ROI) + (1.2 × Clutch) + Aggression + Survival + (0.5 × normalized Luck) + (0.8 × Composure) + appearance bonus (maximum 10)",
  luckIndex: "Luck Index: Profit − Expected Profit, where Expected Profit is based on Cash Rate, Hit Rate, and Bubble Avoidance",
  clutchIndex: "Clutch Index: normalized career cash frequency (Times Placed ÷ Buy-ins)",
  aggressionIndex: "Aggression Index: normalized knockouts per entry (Hits ÷ Entries)",
  survivorIndex: "Survivor Index: normalized weighted score from (0.55 × Cash Rate) + (0.25 × (1 − Bubble Rate)) + (0.20 × Hit Rate)",
  tiltIndex: "Composure Index: fixed 0–100 score rewarding fewer rebuys and fewer bubble finishes, softened toward 50 for small samples",
  expectedProfit: "Expected Profit: Total Cost × expected ROI derived from Cash Rate, Hit Rate, and Bubble Avoidance"
};

const PROFILE_STAT_CONFIG = [
  { key: "totalCost", label: "Total Cost", type: "money", icon: "💸", dashboard: false },
  { key: "totalWinnings", label: "Gross Winnings", type: "money", icon: "🏦", dashboard: false, profitClassFromValue: true },

  { key: "profit", label: "Profit", type: "money", icon: "💰", dashboard: true, profitClass: true },
  { key: "roi", label: "ROI", type: "pct", icon: "📈", dashboard: true },
  { key: "cashRate", label: "Cash Rate", type: "pct", icon: "💵", dashboard: true },
  { key: "bubbleRate", label: "Bubble Rate", type: "pct", icon: "🫧", dashboard: true },
  { key: "hitRate", label: "Hit Rate", type: "pct", icon: "💥", dashboard: true },

  { key: "entries", label: "Entries", type: "text", icon: "🎟️", dashboard: false },
  { key: "buyIns", label: "Buy-ins", type: "text", icon: "🎟️", dashboard: false },
  { key: "rebuys", label: "Rebuys", type: "text", icon: "♻️", dashboard: false },
  { key: "hits", label: "Hits", type: "text", icon: "💥", dashboard: true },
  { key: "timesPlaced", label: "Times Placed", dashboardLabel: "Cashes", type: "text", icon: "💵", dashboard: true },
  { key: "bubbles", label: "Bubbles", type: "text", icon: "🫧", dashboard: true },

  { key: "trueSkillScore", label: "Power Index", dashboardLabel: "Power", type: "num", icon: "💪🏼", dashboard: true },
  { key: "luckIndex", label: "Luck Index", dashboardLabel: "Luck", type: "num", icon: "🍀", dashboard: true },
  { key: "clutchIndex", label: "Clutch Index", dashboardLabel: "Clutch", type: "num", icon: "🎯", dashboard: true },
  { key: "aggressionIndex", label: "Aggression Index", dashboardLabel: "Aggression", type: "num", icon: "⚡", dashboard: true },
  { key: "survivorIndex", label: "Survivor Index", dashboardLabel: "Survivor", type: "num", icon: "🛟", dashboard: true },
  { key: "tiltIndex", label: "Composure Index", dashboardLabel: "Composure", type: "num", icon: "🧊", dashboard: true },
  
  { key: "expectedProfit", label: "Expected Profit", type: "money", icon: "💰", dashboard: false, profitClassFromValue: true }
];

const DASHBOARD_META = Object.fromEntries(
  PROFILE_STAT_CONFIG
    .filter(stat => stat.dashboard)
    .map(stat => [
      stat.key,
      {
        label: stat.dashboardLabel || stat.label,
        icon: stat.icon || "♠",
        formula: STAT_FORMULAS[stat.key] || ""
      }
    ])
);

const DASHBOARD_EDITORIAL = {
  profit: "Who’s actually turning bullets into bankroll.",
  roi: "Efficiency over volume. The cleanest results rise fastest.",
  hits: "Who’s ending hands — and nights — with force.",
  timesPlaced: "The most reliable cashing resumes in the room.",
  bubbles: "Who keeps drifting painfully close without sealing the deal.",
  hitRate: "Who converts entries into knockouts most often.",
  cashRate: "Who finds the money most consistently.",
  bubbleRate: "Who lives closest to the danger line.",
  trueSkillScore: "The strongest all-around résumés in the room.",
  luckIndex: "Who’s running purer than the rest of the table.",
  clutchIndex: "Who closes when the pressure spikes.",
  aggressionIndex: "Who pushes the pace and forces the action.",
  survivorIndex: "Who outlasts the field when stacks get shallow.",
  tiltIndex: "Who stays the steadiest when the session starts getting expensive."
};

const STAT_LEADER_CONFIG = [
  { key: "roi", title: "ROI Leader" },
  { key: "luckIndex", title: "Luck Leader" },
  { key: "aggressionIndex", title: "Aggression Leader" },
  { key: "survivorIndex", title: "Survivor Leader" },
  { key: "tiltIndex", title: "Composure Leader" }
];

const HOME_BADGE_CONFIG = [
  { rule: "Profit Leader", icon: "💰", label: "Show Me Da $" },
  { rule: "Power Leader", icon: "💪🏼", label: "Power Flex" },
  { rule: "Clutch Leader", icon: "🎯", label: "Cap'n Clutch" },
  { rule: "Hit King", icon: "💥", label: "Knockout King" }
];

const NAME_FIXES = {
  "Nasa Al": "NASA Al",
  "Providencemike": "ProvidenceMike",
  "Bostnmike": "BostnMike",
  "Ai-Dave": "A.I. Dave",
  "A.I. Dave": "A.I. Dave",
  "ai-dave": "A.I. Dave",
  "Phattedcalf": "PhattedCalf",
  "Pittdburghbill": "PittsburghBill"
};

const HONOR_RULES = {
  "Profit Leader": { key: "profit", direction: "desc" },
  "Power Leader": { key: "trueSkillScore", direction: "desc" },
  "Clutch Leader": { key: "clutchIndex", direction: "desc" },
  "Hit King": { key: "hits", direction: "desc" },
  "Bubble King": { key: "bubbles", direction: "desc" }
};

const HALL_RULES = {
  bests: [
    {
      title: "The Tax Collector",
      visualClass: "the-money-machine",
      description: "Highest career profit among Hall-qualified players.",
      displayLabel: "Career Profit",
      note: "Everybody pays eventually.",

      propLeft: "images/site/hall/props/hall-prop-coins.png",
      propRight: "images/site/hall/props/hall-prop-coins.png",

      key: "profit",
      direction: "desc"
    },

    {
      title: "Direct Deposit",
      visualClass: "the-complete-player",
      description: "Highest career cash rate among Hall-qualified players.",
      displayLabel: "Career Cash Rate",
      note: "Payout has his routing number.",

      propLeft: "images/site/hall/props/hall-prop-trophy.png",
      propRight: "images/site/hall/props/hall-prop-trophy.png",

      key: "cashRate",
      direction: "desc"
    },

    {
      title: "The Billing Department",
      visualClass: "the-killer",
      description: "Most knockouts per total entry among Hall-qualified players.",
      displayLabel: "Knockouts Per Entry",
      note: "No wasted motion. Invoice attached.",

      propLeft: "images/site/hall/props/hall-prop-boxing-glove-single.png",
      propRight: "images/site/hall/props/hall-prop-boxing-glove-single.png",

      key: "knockoutRate",
      direction: "desc"
    }
  ],

  worsts: [
    {
      title: "The Punch Dummy",
      visualClass: "the-killer",
      description: "Most career bust-outs suffered among Hall-qualified players.",
      displayLabel: "Times Knocked Out",
      note: "Everyone gets a turn.",

      propLeft: "images/site/hall/props/hall-prop-boxing-glove-single.png",
      propRight: "images/site/hall/props/hall-prop-boxing-glove-single.png",

      key: "timesBusted",
      direction: "desc"
    },

    {
      title: "The Lazarus",
      visualClass: "the-variance-victim",
      description: "Most times first out of the tournament and still recovered to cash.",
      displayLabel: "1st Out → Still Cashed",
      note: "Busting him is only a suggestion.",

      propLeft: "images/site/hall/props/hall-prop-card-ah-clean.png",
      propRight: "images/site/hall/props/hall-prop-card-2c-clean.png",

      key: "lazarusCount",
      direction: "desc"
    },

    {
      title: "Boy in the Bubble",
      visualClass: "the-bubble-prisoner",
      description: "Most painful career near misses among Hall-qualified players.",
      displayLabel: "Career Bubbles",
      note: "So close it hurts.",

      propLeft: "images/site/hall/props/hall-prop-bubbles.png",
      propRight: "images/site/hall/props/hall-prop-bubbles.png",

      key: "bubbles",
      direction: "desc"
    }
  ]
};

const RECORD_RULES = {
  "Most Cashes": { key: "timesPlaced", direction: "desc" },
  "Worst Luck Index": { key: "luckIndex", direction: "asc" },
  "Lowest Profit": { key: "profit", direction: "asc" },
  "Most Rebuys": { key: "rebuys", direction: "desc" },
  "Most Entries": { key: "entries", direction: "desc" }
};

const ARCHETYPE_GUIDE = [
  { emoji: "💥", name: "The Hitman" },
  { emoji: "🔒", name: "The Closer" },
  { emoji: "⚙️", name: "The Grinder" },
  { emoji: "😈", name: "The Lucky Devil" },
  { emoji: "🌀", name: "The Wildcard" },
  { emoji: "🫧", name: "The Bubble Magnet" },
  { emoji: "🧠", name: "The Technician" }
];

const TIER_GUIDE = [
  { emoji: "🦈", name: "The Apex Predator" },
  { emoji: "⚔️", name: "The Table Crusher" },
  { emoji: "☄️", name: "The Shot Maker" },
  { emoji: "🎲", name: "The Gambler" },
  { emoji: "🍣", name: "The League Sponsor" }
];

const CHIP_SET_TEXT = {
  "40k": {
    "T-25": 20,
    "T-100": 20,
    "T-500": 15,
    "T-1000": 15,
    "T-5000": 3,
    "T-10000": 0,
    "T-25000": 0
  },
  "500k": {
    "T-500": 20,
    "T-1000": 20,
    "T-5000": 20,
    "T-10000": 12,
    "T-25000": 6,
    "T-100000": 1,
    "T-250000": 0
  }
};

const RULES_FORMATS = {
  "40k": {
    title: "40K Small Blind Ante",
    runtimeMinutes: 300,
    chips: [
      { label: "T-25", image: "images/site/chip-T-25.png" },
      { label: "T-100", image: "images/site/chip-T-100.png" },
      { label: "T-500", image: "images/site/chip-T-500.png" },
      { label: "T-1000", image: "images/site/chip-T-1000.png" },
      { label: "T-5000", image: "images/site/chip-T-5000.png" },
      { label: "T-10000", image: "images/site/chip-T-10000.png" },
      { label: "T-25000", image: "images/site/chip-T-25000.png" }
    ],
    levels: [
      { type: "level", level: "1", sb: "50", bb: "100", ante: "", eff: "400 BB" },
      { type: "level", level: "2", sb: "75", bb: "150", ante: "", eff: "266 BB" },
      { type: "level", level: "3", sb: "125", bb: "250", ante: "", eff: "160 BB" },
      { type: "level", level: "4", sb: "200", bb: "400", ante: "", eff: "100 BB" },
      { type: "break", note: "BREAK — Chip up T-25" },
      { type: "level", level: "5", sb: "300", bb: "600", ante: "300", eff: "66 BB" },
      { type: "level", level: "6", sb: "500", bb: "1,000", ante: "500", eff: "40 BB" },
      { type: "level", level: "7", sb: "800", bb: "1,600", ante: "800", eff: "25 BB" },
      { type: "break", note: "BREAK — Chip up T-100" },
      { type: "level", level: "8", sb: "1,000", bb: "2,000", ante: "1000", eff: "Rebuys Closed" },
      { type: "level", level: "9", sb: "1,500", bb: "3,000", ante: "1,500", eff: "Rebuys Closed" },
      { type: "level", level: "10", sb: "2,500", bb: "5,000", ante: "2,500", eff: "Rebuys Closed" },
      { type: "break", note: "BREAK — Chip up T-500" },
      { type: "level", level: "11", sb: "4,000", bb: "8,000", ante: "4,000", eff: "Rebuys Closed" },
      { type: "level", level: "12", sb: "6,000", bb: "12,000", ante: "6,000", eff: "Rebuys Closed" },
      { type: "level", level: "13", sb: "10,000", bb: "20,000", ante: "10,000", eff: "Rebuys Closed" },
      { type: "level", level: "14", sb: "15,000", bb: "30,000", ante: "15,000", eff: "Rebuys Closed" },
      { type: "break", note: "BREAK — Chip up T-1000 & T-5000" },
      { type: "level", level: "15", sb: "25,000", bb: "50,000", ante: "25,000", eff: "Rebuys Closed" },
      { type: "level", level: "16", sb: "40,000", bb: "80,000", ante: "40,000", eff: "Rebuys Closed" },
      { type: "level", level: "17", sb: "50,000", bb: "100,000", ante: "60,000", eff: "Rebuys Closed" }
    ]
  },
  "500k": {
    title: "500K Small Blind Ante",
    runtimeMinutes: 300,
    chips: [
      { label: "T-500", image: "images/site/chip-T-500.png" },
      { label: "T-1000", image: "images/site/chip-T-1000.png" },
      { label: "T-5000", image: "images/site/chip-T-5000.png" },
      { label: "T-10000", image: "images/site/chip-T-10000.png" },
      { label: "T-25000", image: "images/site/chip-T-25000.png" },
      { label: "T-100000", image: "images/site/chip-T-100000.png" },
      { label: "T-250000", image: "images/site/chip-T-250000.png" }
    ],
    levels: [
      { type: "level", level: "1", sb: "500", bb: "1,000", ante: "", eff: "500 BB" },
      { type: "level", level: "2", sb: "1,000", bb: "2,000", ante: "", eff: "250 BB" },
      { type: "level", level: "3", sb: "1,500", bb: "3,000", ante: "", eff: "166 BB" },
      { type: "level", level: "4", sb: "2,500", bb: "5,000", ante: "", eff: "100 BB" },
      { type: "break", note: "BREAK — Chip up T-500" },
      { type: "level", level: "5", sb: "4,000", bb: "8,000", ante: "4,000", eff: "62 BB" },
      { type: "level", level: "6", sb: "6,000", bb: "12,000", ante: "6,000", eff: "41 BB" },
      { type: "level", level: "7", sb: "10,000", bb: "20,000", ante: "10,000", eff: "25 BB" },
      { type: "break", note: "BREAK — Chip up T-1000" },
      { type: "level", level: "8", sb: "15,000", bb: "30,000", ante: "15,000", eff: "Rebuys Closed" },
      { type: "level", level: "9", sb: "25,000", bb: "50,000", ante: "25,000", eff: "Rebuys Closed" },
      { type: "level", level: "10", sb: "40,000", bb: "80,000", ante: "40,000", eff: "Rebuys Closed" },
      { type: "break", note: "BREAK — Chip up T-5000" },
      { type: "level", level: "11", sb: "60,000", bb: "120,000", ante: "60,000", eff: "Rebuys Closed" },
      { type: "level", level: "12", sb: "100,000", bb: "200,000", ante: "100,000", eff: "Rebuys Closed" },
      { type: "level", level: "13", sb: "150,000", bb: "300,000", ante: "150,000", eff: "Rebuys Closed" },
      { type: "break", note: "BREAK — Chip up T-10000" },
      { type: "level", level: "14", sb: "200,000", bb: "400,000", ante: "200,000", eff: "Rebuys Closed" },
      { type: "level", level: "15", sb: "300,000", bb: "600,000", ante: "300,000", eff: "Rebuys Closed" },
      { type: "level", level: "16", sb: "500,000", bb: "1,000,000", ante: "500,000", eff: "Rebuys Closed" }
    ]
  }
};

function normalizeQuoteName(name) {
  const trimmed = (name || "").trim();
  if (["A.I. Dave", "A.I Dave", "A.l. Dave", "A.l Dave"].includes(trimmed)) {
    return "A.I. Dave";
  }
  return trimmed;
}

function ensureQuoted(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return "“They just haven't said anything funny... yet!”";
  const unwrapped = cleaned.replace(/^["“”]+|["“”]+$/g, "").trim();
  return `“${unwrapped}”`;
}

function fmtMoney(n) {
  const num = Number(n ?? 0);
  const sign = num < 0 ? "-" : "";
  return `${sign}$${Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function fmtPct(n) {
  return `${(Number(n ?? 0) * 100).toFixed(1)}%`;
}

function fmtNum(n) {
  return Number(n ?? 0).toFixed(1);
}

function parseAnimatedValue(text) {
  const raw = String(text ?? "").trim();

  if (!raw) return null;

  const isMoney = raw.includes("$");
  const isPct = raw.includes("%");
  const negative = raw.startsWith("-");

  const numeric = Number(raw.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(numeric)) return null;

  return {
    raw,
    numeric,
    isMoney,
    isPct,
    negative
  };
}

function formatAnimatedValue(value, meta) {
  const safeValue = Number(value) || 0;
  const sign = meta.negative ? "-" : "";

  if (meta.isMoney) {
    return `${sign}$${Math.round(safeValue).toLocaleString("en-US")}`;
  }

  if (meta.isPct) {
    return `${sign}${safeValue.toFixed(1)}%`;
  }

  if (meta.raw.includes(".")) {
    return `${sign}${safeValue.toFixed(1)}`;
  }

  return `${sign}${Math.round(safeValue).toLocaleString("en-US")}`;
}

function animateCountUp(el, duration = 1100) {
  if (!el || el.dataset.countAnimated === "true") return;

  const meta = parseAnimatedValue(el.dataset.targetValue || el.textContent);
  if (!meta) return;

  el.dataset.countAnimated = "true";

  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = meta.numeric * eased;

    el.textContent = formatAnimatedValue(current, meta);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = meta.raw;
    }
  }

  requestAnimationFrame(tick);
}

function initAnimatedCounters(scope = document) {
  scope.querySelectorAll("[data-animate-count]").forEach(el => animateCountUp(el));
}

function formatProfileStatValue(player, config) {
  const value = player?.[config.key];

  if (config.type === "money") return fmtMoney(value);
  if (config.type === "pct") return fmtPct(value);
  if (config.type === "num") return fmtNum(value);

  return String(value ?? "-");
}

function getStatConfig(key) {
  return PROFILE_STAT_CONFIG.find(stat => stat.key === key) || null;
}

function sortPlayers(players, key) {
  return [...(players || [])].sort((a, b) => {
    const aVal = Number(a?.[key] ?? 0);
    const bVal = Number(b?.[key] ?? 0);
    if (bVal !== aVal) return bVal - aVal;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

function formatStatLabel(key) {
  const stat = getStatConfig(key);
  return stat?.dashboardLabel || stat?.label || key;
}

function statIcon(key) {
  const stat = getStatConfig(key);
  return stat?.icon || "♦️";
}

function formatStatValue(player, key) {

  if (key === "hallScore") {
    return `${fmtNum(player?.hallScore ?? 0)} / 100`;
  }

  if (key === "variancePain") {
    return fmtNum(player?.variancePain ?? 0);
  }

  if (key === "knockoutRate") {
    return Number(player?.knockoutRate ?? 0).toFixed(2);
  }

  if (key === "timesBusted" || key === "lazarusCount") {
    return String(Math.round(Number(player?.[key] ?? 0)));
  }

  const stat = getStatConfig(key);

  if (!stat) {
    return String(player?.[key] ?? "-");
  }

  return formatProfileStatValue(player, stat);
}

function getEligiblePlayers(players) {
  return (players || []).filter(player => Number(player?.entries ?? 0) >= 5);
}

function isCrewVisible(player) {
  return Number(player?.buyIns ?? 0) >= CREW_ROOKIE_MIN_BUY_INS;
}

function isCrewRookie(player) {
  const appearances = Number(player?.buyIns ?? 0);
  return appearances >= CREW_ROOKIE_MIN_BUY_INS &&
    appearances < CREW_PROVISIONAL_MIN_BUY_INS;
}

function isCrewProvisional(player) {
  const appearances = Number(player?.buyIns ?? 0);
  return appearances >= CREW_PROVISIONAL_MIN_BUY_INS &&
    appearances < CREW_ESTABLISHED_MIN_BUY_INS;
}

/* Existing site leader pools continue to use the 3-appearance qualification. */
function isCrewEligible(player) {
  return Number(player?.buyIns ?? 0) >= CREW_ELIGIBLE_MIN_BUY_INS;
}

/* Only established players participate in Power Rank and percentile tiers. */
function isCrewEstablished(player) {
  return Number(player?.buyIns ?? 0) >= CREW_ESTABLISHED_MIN_BUY_INS;
}

/*
 * Hall qualification:
 * Uses separate tournament appearances, not entries.
 */
function getHallMinimumAppearances(totalEvents = 0) {
  return Math.max(
    Math.ceil(totalEvents * HALL_PERCENTAGE),
    HALL_MIN_EVENTS
  );
}

function isHallEligible(player, totalEvents = 0) {
  return Number(player?.buyIns ?? 0) >= getHallMinimumAppearances(totalEvents);
}

async function loadHallHistoryData(data) {
  const version = data?.generatedAt
    ? `?v=${encodeURIComponent(data.generatedAt)}`
    : "";

  const indexRes = await fetch(`/data/parsed/events/index.json${version}`, {
    cache: "no-store"
  });

  if (!indexRes.ok) {
    throw new Error(`Failed to load Hall event index (${indexRes.status})`);
  }

  const eventFiles = (await indexRes.json())
    .filter(fileName => /^\d{4}-\d{2}-\d{2}\.json$/.test(String(fileName || "")));

  const events = await Promise.all(
    eventFiles.map(async fileName => {
      const eventRes = await fetch(`/data/parsed/events/${fileName}${version}`);

      if (!eventRes.ok) {
        throw new Error(`Failed to load Hall event ${fileName} (${eventRes.status})`);
      }

      return eventRes.json();
    })
  );

  return {
    eventCount: eventFiles.length,
    events
  };
}

function buildHallHistoryMetrics(historyEvents = []) {
  const timesBusted = new Map();
  const lazarusCount = new Map();

  historyEvents.forEach(event => {
    const actions = Array.isArray(event?.actions) ? event.actions : [];

    actions.forEach(action => {
      if (!["bustout", "bustout_uncredited"].includes(action?.type) || !action?.slug) return;

      const slug = String(action.slug).toLowerCase();
      timesBusted.set(slug, (timesBusted.get(slug) || 0) + 1);
    });

    const firstBustout = actions.find(
      action => ["bustout", "bustout_uncredited"].includes(action?.type) && action?.slug
    );

    const firstOutSlug = String(firstBustout?.slug || "").toLowerCase();
    if (!firstOutSlug) return;

    const recoveredToCash = (event?.winners || []).some(
      winner => String(winner?.slug || "").toLowerCase() === firstOutSlug
    );

    if (recoveredToCash) {
      lazarusCount.set(
        firstOutSlug,
        (lazarusCount.get(firstOutSlug) || 0) + 1
      );
    }
  });

  return {
    timesBusted,
    lazarusCount
  };
}

function getHallPlayers(data, hallHistory = null) {
  const players = data?.players || [];

  /*
   * Hall qualification must use the full parsed TLPT event history.
   * data.events contains the upcoming schedule and is not historical data.
   */
  const totalEvents = Number(hallHistory?.eventCount ?? 0);
  const historyEvents = hallHistory?.events || [];
  const historyMetrics = buildHallHistoryMetrics(historyEvents);

  const eligiblePlayers = players.filter(
    player => isHallEligible(player, totalEvents)
  );

  return eligiblePlayers.map(player => {
    const slug = String(player?.slug || "").toLowerCase();
    const entries = Number(player?.entries ?? 0);
    const hits = Number(player?.hits ?? 0);

    return {
      ...player,
      hallScore: getHallScore(player, eligiblePlayers),
      variancePain: Math.abs(Number(player?.luckIndex ?? 0)),
      knockoutRate: entries > 0 ? hits / entries : 0,
      timesBusted: historyMetrics.timesBusted.get(slug) || 0,
      lazarusCount: historyMetrics.lazarusCount.get(slug) || 0
    };
  });
}

function getLeaderByRule(players, rule, customPool = null) {
  if (!rule || !rule.key) return null;

  const eligiblePlayers = Array.isArray(customPool)
    ? customPool
    : getEligiblePlayers(players);
  if (!eligiblePlayers.length) return null;

  const sorted = [...eligiblePlayers].sort((a, b) => {
    const aVal = Number(a?.[rule.key] ?? 0);
    const bVal = Number(b?.[rule.key] ?? 0);

    if (rule.direction === "asc") {
      if (aVal !== bVal) return aVal - bVal;
    } else {
      if (bVal !== aVal) return bVal - aVal;
    }

    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });

  return sorted[0] || null;
}

function statValueClass(player, key) {
  if (key !== "profit") return "";
  const value = Number(player?.profit ?? 0);
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function valueClassFromMoneyString(value) {
  const raw = String(value || "").replace(/[^0-9.-]/g, "");
  const num = Number(raw);
  if (Number.isNaN(num)) return "";
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "neutral";
}

function isNumericValueText(value) {
  const v = String(value || "").trim();
  return /^-?\$?\d[\d,]*(\.\d+)?%?$/.test(v);
}

function initialsFromName(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function displayPlayerName(player) {
  if (!player) return "";

  let name = player.name || "";

  if (NAME_FIXES[name]) {
    name = NAME_FIXES[name];
  }

  const entries = Number(player?.entries ?? 0);

  if (entries < 5) {
    return `${name}<span class="player-entry-asterisk" title="* fewer than 5 league entries">*</span>`;
  }

  return name;
}

function displayPlayerNamePlain(player) {
  if (!player) return "";

  let name = player.name || "";

  if (NAME_FIXES[name]) {
    name = NAME_FIXES[name];
  }

  return name;
}

function getPlayerArchetypeScores(player) {
  if (!player) return [];

  const aggression = Number(player?.aggressionIndex ?? 0);
  const clutch = Number(player?.clutchIndex ?? 0);
  const survivor = Number(player?.survivorIndex ?? 0);
  const luck = Number(player?.luckIndex ?? 0);
  const composure = Number(player?.tiltIndex ?? 0);
  const bubbles = Number(player?.bubbles ?? 0);
  const rebuys = Number(player?.rebuys ?? 0);
  const hits = Number(player?.hits ?? 0);

  const archetypes = [
    {
      key: "hitman",
      emoji: "💥",
      name: "The Hitman",
      desc: "knocking players out like it’s a contact sport",
      score: aggression + hits * 0.8
    },
    {
      key: "closer",
      emoji: "🔒",
      name: "The Closer",
      desc: "somehow always shows up when the chips matter",
      score: clutch * 1.25
    },
    {
      key: "grinder",
      emoji: "⚙️",
      name: "The Grinder",
      desc: "Joey Knish would be proud, you’re steady and dangerous, if not a little boring.",
      score: survivor * 1.05 + composure * 0.45 - aggression * 0.35
    },
    {
      key: "lucky",
      emoji: "😈",
      name: "The Lucky Devil",
      desc: "running hotter than probability should allow... and yeah the table knows it",
      score: luck * 1.15
    },
    {
      key: "wildcard",
      emoji: "🌀",
      name: "The Wildcard",
      desc: "agent of chaos capable of brilliance or disaster on any orbit",
      score: (100 - composure) * 1.1 + rebuys * 0.8
    },
    {
      key: "bubblemagnet",
      emoji: "🫧",
      name: "The Bubble Magnet",
      desc: "the bridesmaid who's always close enough to smell the money",
      score: bubbles * 4 + clutch * 0.15
    },
    {
      key: "technician",
      emoji: "🧠",
      name: "The Technician",
      desc: "playing strong poker without needing the drama... or the money",
      score: (clutch + survivor + aggression) / 3
    }
  ];

  return archetypes.sort((a, b) => b.score - a.score);
}

function getPlayerArchetypes(player) {
  const ranked = getPlayerArchetypeScores(player);

  const primary = ranked[0] || {
    key: "unknown",
    emoji: "🧍",
    name: "Unknown",
    desc: "still figuring out which end of the deck is up.",
    score: 0
  };

  const secondary = ranked[1] || primary;

  return {
    primary,
    secondary,
    ranked
  };
}

function getPlayerArchetype(player) {
  return getPlayerArchetypes(player).primary;
}

function normalizeHallMetric(players, player, key, higherIsBetter = true) {
  const values = players
    .map(item => Number(item?.[key] ?? 0))
    .filter(value => !Number.isNaN(value));

  if (!values.length) return 0;

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) return 100;

  const value = Number(player?.[key] ?? 0);

  const normalized = higherIsBetter
    ? ((value - min) / (max - min)) * 100
    : ((max - value) / (max - min)) * 100;

  return Math.max(0, Math.min(100, normalized));
}


function getHallScore(player, players = []) {
  if (!player) return 0;

  const profit = normalizeHallMetric(players, player, "profit");
  const roi = normalizeHallMetric(players, player, "roi");
  const cashRate = normalizeHallMetric(players, player, "cashRate");
  const skill = normalizeHallMetric(players, player, "trueSkillScore");
  const longevity = Math.min((Number(player.buyIns ?? 0) / 25) * 100, 100);

  return (
    (profit * 0.30) +
    (roi * 0.25) +
    (cashRate * 0.20) +
    (skill * 0.15) +
    (longevity * 0.10)
  );
}

function getPlayerTierScore(player) {
  if (!player) return -999;

  /*
   * Use buyIns for sample size because buyIns represent separate tournament
   * appearances. Rebuys are handled independently by the rebuy penalty.
   */
  const buyIns = Number(player?.buyIns ?? 0);
  const rebuys = Number(player?.rebuys ?? 0);
  const trueSkill = Number(player?.trueSkillScore ?? 0);
  const clutch = Number(player?.clutchIndex ?? 0);
  const aggression = Number(player?.aggressionIndex ?? 0);
  const survivor = Number(player?.survivorIndex ?? 0);
  const composure = Number(player?.tiltIndex ?? 0);

  let sampleBonus = 0;

  if (buyIns >= 20) {
    sampleBonus = 3.0;
  } else if (buyIns >= 15) {
    sampleBonus = 2.0;
  } else if (buyIns >= 10) {
    sampleBonus = 1.0;
  } else if (buyIns >= CREW_ESTABLISHED_MIN_BUY_INS) {
    sampleBonus = 0.25;
  } else if (buyIns >= CREW_PROVISIONAL_MIN_BUY_INS) {
    /*
     * Provisional players remain visible, but do not receive an established
     * sample bonus or participate in official rankings.
     */
    sampleBonus = 0;
  } else {
    sampleBonus = -2.0;
  }

  const rebuyPenalty = rebuys * 0.6;

  return (
    (trueSkill * 1.5) +
    (clutch * 1.1) +
    (aggression * 0.65) +
    (survivor * 1.0) +
    (composure * 1.25) +
    sampleBonus -
    rebuyPenalty
  );
}

function getArchetypeMix(player) {
  const ranked = getPlayerArchetypeScores(player);

  if (!ranked.length) return [];

  const minScore = Math.min(...ranked.map(item => Number(item.score ?? 0)));
  const shifted = ranked.map(item => {
    const raw = Number(item.score ?? 0);
    const adjusted = minScore < 0 ? raw - minScore + 0.01 : raw + 0.01;
    return {
      ...item,
      adjusted
    };
  });

  const total = shifted.reduce((sum, item) => sum + item.adjusted, 0) || 1;

  return shifted.map(item => ({
    ...item,
    pct: (item.adjusted / total) * 100
  }));
}

function archetypeMixMarkup(player) {
  const mix = getArchetypeMix(player);
  if (!mix.length) return "";

  const toneMap = {
    hitman: "var(--red)",
    closer: "#7ecbff",
    grinder: "#86efac",
    lucky: "#d8b4fe",
    wildcard: "#f9a8d4",
    bubblemagnet: "#93c5fd",
    technician: "var(--gold)"
  };

  return `
    <div class="player-archetype-spectrum-shell">
      <div class="player-archetype-spectrum-head">
        <div class="kicker player-archetype-spectrum-kicker">Archetype Mix</div>
        <div class="player-archetype-spectrum-sub">How much of each table personality is in the tank.</div>
      </div>

      <div class="player-archetype-spectrum-bar" aria-label="Archetype percentage mix">
        ${mix.map(item => `
          <div
            class="player-archetype-spectrum-segment"
            data-archetype-key="${item.key}"
            style="width:${item.pct}%; background:${toneMap[item.key] || 'var(--gold)'};"
            title="${item.emoji} ${item.name}: ${item.pct.toFixed(1)}%"
          ></div>
        `).join("")}
      </div>

      <div class="player-archetype-spectrum-legend">
        ${mix.map(item => `
          <div class="player-archetype-spectrum-chip" data-archetype-key="${item.key}">
            <span
              class="player-archetype-spectrum-dot"
              style="background:${toneMap[item.key] || 'var(--gold)'};"
            ></span>
            <span class="player-archetype-spectrum-label">${item.emoji} ${item.name}</span>
            <span class="player-archetype-spectrum-value">${item.pct.toFixed(1)}%</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function wireArchetypeMixHover(scope = document) {
  const shell = scope.querySelector(".player-archetype-spectrum-shell");
  if (!shell) return;

  const segments = [...shell.querySelectorAll(".player-archetype-spectrum-segment")];
  const chips = [...shell.querySelectorAll(".player-archetype-spectrum-chip")];
  const allTargets = [...segments, ...chips];

  chips.forEach(chip => {
    chip.dataset.defaultBackground = chip.style.background || "";
    chip.dataset.defaultBorderColor = chip.style.borderColor || "";
    chip.dataset.defaultBoxShadow = chip.style.boxShadow || "";
    chip.dataset.defaultTransform = chip.style.transform || "";
  });

  segments.forEach(segment => {
    segment.dataset.defaultFilter = segment.style.filter || "";
    segment.dataset.defaultBoxShadow = segment.style.boxShadow || "";
    segment.dataset.defaultOpacity = segment.style.opacity || "";
  });

  const clearActive = () => {
    segments.forEach(segment => {
      segment.classList.remove("is-hover-match");
      segment.style.filter = segment.dataset.defaultFilter || "";
      segment.style.boxShadow = segment.dataset.defaultBoxShadow || "";
      segment.style.opacity = segment.dataset.defaultOpacity || "";
      // IMPORTANT: do NOT clear segment background
    });

    chips.forEach(chip => {
      chip.classList.remove("is-hover-match");
      chip.style.transform = chip.dataset.defaultTransform || "";
      chip.style.borderColor = chip.dataset.defaultBorderColor || "";
      chip.style.background = chip.dataset.defaultBackground || "";
      chip.style.boxShadow = chip.dataset.defaultBoxShadow || "";
    });
  };

  const activateKey = (key) => {
    if (!key) return;

    segments.forEach(segment => {
      if (segment.dataset.archetypeKey !== key) return;
      segment.classList.add("is-hover-match");
      segment.style.filter = "brightness(1.18)";
      segment.style.boxShadow = "inset 0 0 0 2px rgba(255,255,255,.28)";
      segment.style.opacity = "1";
    });

    chips.forEach(chip => {
      if (chip.dataset.archetypeKey !== key) return;
      chip.classList.add("is-hover-match");
      chip.style.transform = "translateY(-1px)";
      chip.style.borderColor = "rgba(255,184,28,.34)";
      chip.style.background =
        "linear-gradient(180deg, rgba(255,184,28,.10), rgba(255,184,28,.03)), rgba(255,255,255,.02)";
      chip.style.boxShadow =
        "inset 0 1px 0 rgba(255,255,255,.05), 0 8px 18px rgba(0,0,0,.18), 0 0 14px rgba(255,184,28,.10)";
    });
  };

  allTargets.forEach(el => {
    el.addEventListener("mouseenter", () => {
      clearActive();
      activateKey(el.dataset.archetypeKey);
    });

    el.addEventListener("mouseleave", () => {
      clearActive();
    });

    el.addEventListener("focus", () => {
      clearActive();
      activateKey(el.dataset.archetypeKey);
    });

    el.addEventListener("blur", () => {
      clearActive();
    });
  });
}

function getPlayerTier(player, allPlayers = []) {
  if (!player) {
    return {
      emoji: "🧍",
      name: "Unknown",
      desc: "still waiting for enough hands to say anything useful"
    };
  }

  if (!isCrewVisible(player)) {
    return {
      emoji: "⏳",
      name: "Not Yet in the Field",
      desc: "waiting for a first TLPT tournament appearance"
    };
  }

  if (isCrewRookie(player)) {
    return {
      emoji: "🌱",
      name: "Rookie",
      desc: "in the field and building the sample needed for Provisional status"
    };
  }

  if (isCrewProvisional(player)) {
    return {
      emoji: "🧪",
      name: "Provisional",
      desc: "showing early results, but not yet eligible for an official Power Rank"
    };
  }

  const eligiblePlayers = (allPlayers || []).filter(isCrewEstablished);
  const ranked = [...eligiblePlayers].sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a));
  const index = ranked.findIndex(p => p.name === player.name);
  const rank = index >= 0 ? index + 1 : ranked.length + 1;
  const total = Math.max(ranked.length, 1);
  const pct = rank / total;

  if (pct <= 0.15) {
    return {
      emoji: "🦈",
      name: "The Apex Predator",
      desc: "the kind of player who makes a full table suddenly behave... or fold"
    };
  }

  if (pct <= 0.35) {
    return {
      emoji: "⚔️",
      name: "The Table Crusher",
      desc: "consistently dangerous and almost never a comfortable draw"
    };
  }

  if (pct <= 0.60) {
    return {
      emoji: "☄️",
      name: "The Shot Maker",
      desc: "capable of real damage when the cards and courage line up"
    };
  }

  if (pct <= 0.80) {
    return {
      emoji: "🎲",
      name: "The Gambler",
      desc: "volatile, entertaining, and always one orbit from chaos"
    };
  }

  return {
    emoji: "🍣",
    name: "The League Sponsor",
    desc: "keeping the prize pool healthy, one decision at a time"
  };
}

function playerUrl(player) {
  return `player.html?name=${encodeURIComponent(player.name)}`;
}

function playerImageMarkup(player, size = "medium") {
  if (player?.image) {
    return `
      <span class="player-avatar-wrap">
        <img
          class="player-avatar ${size}"
          src="${player.image}"
          alt="${player.name}"
          loading="lazy"
          decoding="async"
          data-image-error-action="show-next"
        />
        <span class="player-avatar-fallback ${size}" hidden>${initialsFromName(player.name)}</span>
      </span>
    `;
  }

  return `
    <span class="player-avatar-wrap">
      <span class="player-avatar-fallback ${size}">${initialsFromName(player?.name)}</span>
    </span>
  `;
}

function playerInlineMarkup(player, size = "small") {
  return `
    <a class="player-inline" href="${playerUrl(player)}">
      ${playerImageMarkup(player, size)}
      <span class="player-inline-name">${displayPlayerName(player)}</span>
    </a>
  `;
}

function badgeMetaFromLabel(label) {
  const text = String(label || "");

  if (text.includes("Profit Leader")) return { rarity: "legendary", tone: "gold" };
  if (text.includes("Power Flex")) return { rarity: "epic", tone: "violet" };
  if (text.includes("Cap'n Clutch")) return { rarity: "rare", tone: "amber" };
  if (text.includes("Luck Leader")) return { rarity: "rare", tone: "green" };
  if (text.includes("Hit King")) return { rarity: "epic", tone: "red" };
  if (text.includes("Bubble King")) return { rarity: "uncommon", tone: "blue" };
  if (text.includes("Small Sample")) return { rarity: "common", tone: "slate" };

  return { rarity: "common", tone: "slate" };
}

function badgeList(player, data, comparisonPlayers = null) {
  const hasCustomPool = Array.isArray(comparisonPlayers);
  const players = hasCustomPool
    ? comparisonPlayers
    : (data?.players || []);

  if (!players.length) return [];

  const eligiblePlayers = hasCustomPool
    ? players
    : getEligiblePlayers(players);

  const badgePool = eligiblePlayers.length
    ? eligiblePlayers
    : players;
  
  const topProfit = sortPlayers(badgePool, "profit")[0]?.name;
  const topPower = sortPlayers(badgePool, "trueSkillScore")[0]?.name;
  const topClutch = sortPlayers(badgePool, "clutchIndex")[0]?.name;
  const topHits = sortPlayers(badgePool, "hits")[0]?.name;

  const topROI = sortPlayers(badgePool, "roi")[0]?.name;
  const topCashRate = sortPlayers(badgePool, "cashRate")[0]?.name;
  const topLuck = sortPlayers(badgePool, "luckIndex")[0]?.name;
  const topAggro = sortPlayers(badgePool, "aggressionIndex")[0]?.name;
  const topSurvivor = sortPlayers(badgePool, "survivorIndex")[0]?.name;
  const topTilt = sortPlayers(badgePool, "tiltIndex")[0]?.name;
  const topBubbleRate = sortPlayers(badgePool, "bubbleRate")[0]?.name;
  const topRebuys = sortPlayers(badgePool, "rebuys")[0]?.name;

  const badges = [];

  if (player.name === topProfit) badges.push({ icon: "💰", label: "Profit Leader", rarity: "legendary", tone: "gold" });
  if (player.name === topPower) badges.push({ icon: "💪🏼", label: "Power Leader", rarity: "epic", tone: "violet" });
  if (player.name === topClutch) badges.push({ icon: "🎯", label: "Clutch Leader", rarity: "rare", tone: "amber" });
  if (player.name === topHits) badges.push({ icon: "💥", label: "Hit King", rarity: "epic", tone: "red" });

  if (player.name === topROI) badges.push({ icon: "📈", label: "ROI Boss", rarity: "rare", tone: "amber" });
  if (player.name === topCashRate) badges.push({ icon: "🏧", label: "Cash Machine", rarity: "rare", tone: "green" });
  if (player.name === topLuck) badges.push({ icon: "😈", label: "Lucky Devil", rarity: "epic", tone: "violet" });
  if (player.name === topAggro) badges.push({ icon: "🦁", label: "Aggro Animal", rarity: "epic", tone: "red" });
  if (player.name === topSurvivor) badges.push({ icon: "🛟", label: "Survivor", rarity: "uncommon", tone: "blue" });
  if (player.name === topTilt) badges.push({ icon: "🧊", label: "Cool Customer", rarity: "common", tone: "slate" });
  if (player.name === topBubbleRate) badges.push({ icon: "🫧", label: "Bubble Trouble", rarity: "uncommon", tone: "blue" });
  if (player.name === topRebuys) badges.push({ icon: "♻️", label: "Rebuy King", rarity: "rare", tone: "amber" });

  if (Number(player.entries ?? 0) < 5) badges.push({ icon: "✳️", label: "Small Sample", rarity: "common", tone: "slate" });

  return badges;
}

function badgesMarkup(player, data, comparisonPlayers = null) {
  const badges = badgeList(player, data, comparisonPlayers);
  if (!badges.length) return "";
  
  return `
    <div class="button-row stat-leader-badges">
      ${badges.map(badge => `
        <span class="stat-badge-text badge-rarity-${badge.rarity} badge-tone-${badge.tone}">
          <span class="stat-badge-icon">${badge.icon}</span>
          <span class="stat-badge-label">${badge.label}</span>
        </span>
      `).join("")}
    </div>
  `;
}

function getRsvpCounts(event) {
  const statuses = Object.values(event?.rsvps || {}).map(value =>
    String(value || "tbd").toLowerCase()
  );

  return {
    yes: statuses.filter(status => status === "yes").length,
    maybe: statuses.filter(status => status === "maybe").length,
    tbd: statuses.filter(status => status === "tbd").length,
    no: statuses.filter(status => status === "no").length
  };
}

function formatRsvpLine(event) {
  const counts = getRsvpCounts(event);
  return `At the Table = ${counts.yes} • On the Rail = ${counts.maybe} • In the Tank = ${counts.tbd} • Folded Pre = ${counts.no}`;
}

function getPlayerBySlug(slug, data) {
  const players = data?.players || [];
  const cleanSlug = String(slug || "").toLowerCase();

  return players.find(player =>
    String(player.slug || "").toLowerCase() === cleanSlug
  );
}

function getDisplayNameForRsvpSlug(slug, data) {
  const player = getPlayerBySlug(slug, data);

  if (player) {
    return displayPlayerNamePlain(player);
  }

  return String(slug || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getRsvpPlayersByStatus(event, data, statusKey) {
  const rsvps = event?.rsvps || {};
  const targetStatus = String(statusKey || "").toLowerCase();

  return Object.entries(rsvps)
    .filter(([, status]) => String(status || "tbd").toLowerCase() === targetStatus)
    .map(([slug]) => getDisplayNameForRsvpSlug(slug, data))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function formatRsvpNameList(names, emptyText = "Nobody yet", options = {}) {
  const {
    maxNames = 8,
    collapseAfter = 12
  } = options;

  if (!names || !names.length) return emptyText;

  if (names.length >= collapseAfter) {
    return `${names.length} players`;
  }

  const visibleNames = names.slice(0, maxNames);
  const remaining = names.length - visibleNames.length;

  return remaining > 0
    ? `${visibleNames.join(", ")} +${remaining} more`
    : visibleNames.join(", ");
}

function eventRsvpForecastMarkup(event, data) {
  const maybePlayers = getRsvpPlayersByStatus(event, data, "maybe");
  const tbdPlayers = getRsvpPlayersByStatus(event, data, "tbd");
  const noPlayers = getRsvpPlayersByStatus(event, data, "no");

  return `
    <div class="event-rsvp-forecast" aria-label="Table forecast">
      <div class="event-rsvp-forecast-title">Table Forecast</div>

      <div class="event-rsvp-forecast-row event-rsvp-forecast-maybe">
        <span class="event-rsvp-forecast-label">On the Rail</span>
        <span class="event-rsvp-forecast-names">${formatRsvpNameList(maybePlayers, "Nobody yet", {
          maxNames: 6,
          collapseAfter: 12
        })}</span>
      </div>

      <div class="event-rsvp-forecast-row event-rsvp-forecast-tbd">
        <span class="event-rsvp-forecast-label">In the Tank</span>
        <span class="event-rsvp-forecast-names">${formatRsvpNameList(tbdPlayers, "Nobody yet", {
          maxNames: 8,
          collapseAfter: 14
        })}</span>
      </div>

      <div class="event-rsvp-forecast-row event-rsvp-forecast-no">
        <span class="event-rsvp-forecast-label">Folded Pre</span>
        <span class="event-rsvp-forecast-names">${formatRsvpNameList(noPlayers, "Nobody yet", {
          maxNames: 4,
          collapseAfter: 8
        })}</span>
      </div>
    </div>
  `;
}

function getConfirmedRsvpPlayers(event, data) {
  const players = data?.players || [];
  const rsvps = event?.rsvps || {};

  return Object.entries(rsvps)
    .filter(([, status]) => String(status || "").toLowerCase() === "yes")
    .map(([slug]) =>
      players.find(player => String(player.slug || "").toLowerCase() === String(slug).toLowerCase())
    )
    .filter(Boolean);
}

function buildRsvpSummaryMarkup(event, extraClass = "") {
  const counts = getRsvpCounts(event);
  const summaryClass = ["event-rsvp-summary", extraClass].filter(Boolean).join(" ");

  return `
    <div class="event-rsvp-summary-wrap">
      <div class="${summaryClass}" aria-label="Table forecast summary">
        <span class="event-rsvp-pill yes">At the Table = ${counts.yes}</span>
        <span class="event-rsvp-pill maybe">On the Rail = ${counts.maybe}</span>
        <span class="event-rsvp-pill tbd">In the Tank = ${counts.tbd}</span>
        <span class="event-rsvp-pill no">Folded Pre = ${counts.no}</span>
      </div>
    </div>
  `;
}

function eventRsvpAvatarMarkup(event, data, maxSeats = 9, options = {}) {
  const confirmedPlayers = getConfirmedRsvpPlayers(event, data);
  const emptySeats = Math.max(maxSeats - confirmedPlayers.length, 0);
  const isHotTable = confirmedPlayers.length / maxSeats >= 0.8;

  const {
    showRotatorNav = false,
    showRotatorLabel = true,
    rotatorDay = "",
    rotatorDotsMarkup = "",
    summaryPlacement = "bottom"
  } = options;

  return `
    <div class="event-rsvp-block">
      <div class="event-rsvp-avatar-row${isHotTable ? " is-hot-table" : ""}">
        <div class="event-rsvp-center-name" aria-hidden="true"></div>
        ${confirmedPlayers.map(player => {
          const displayName = displayPlayerNamePlain(player);
          return `
            <span class="event-rsvp-seat-player" data-player-name="${String(displayName).replace(/"/g, "&quot;")}">
              ${playerImageMarkup(player, "table")}
            </span>
          `;
        }).join("")}
        ${Array.from({ length: emptySeats }).map(() => `
          <span class="event-empty-seat" aria-hidden="true">🪑</span>
        `).join("")}
      </div>

      ${showRotatorNav ? `
        <div class="home-rotator-nav-inline">
          ${showRotatorLabel ? `
            <div class="home-rotator-nav-label">
              Now Showing: <span class="home-event-rotator-day">${rotatorDay}</span>
            </div>
          ` : ""}
          <div class="home-event-rotator-dots home-event-rotator-dots-inline">
            ${rotatorDotsMarkup}
          </div>
        </div>
      ` : ""}

      ${summaryPlacement === "bottom" ? buildRsvpSummaryMarkup(event) : ""}
    </div>
  `;
}

function projectedTableSize(event, maxSeats = 9) {
  const counts = getRsvpCounts(event);
  const minPlayers = Math.min(counts.yes, maxSeats);
  const maxPlayers = Math.min(counts.yes + counts.maybe + counts.tbd, maxSeats);
  return minPlayers === maxPlayers ? `${minPlayers} players` : `${minPlayers}–${maxPlayers} players`;
}

function tableFillPercent(event, maxSeats = 9) {
  const counts = getRsvpCounts(event);
  return Math.min((counts.yes / maxSeats) * 100, 100);
}

function tableFillMarkup(event, maxSeats = 9) {
  const counts = getRsvpCounts(event);
  const fillPct = tableFillPercent(event, maxSeats);

  return `
    <div class="fill-widget">
      <div class="fill-header">
        <span class="fill-label">Table Fill</span>
        <span class="fill-seats">${counts.yes} / ${maxSeats} seats locked</span>
      </div>
      <div class="fill-bar"><div class="fill-bar-value" style="width:${fillPct}%"></div></div>
    </div>
  `;
}

function getEventDayLabel(event) {
  if (event?.day) return String(event.day).trim();

  const rawDate = String(event?.date || "").trim();
  if (/friday/i.test(rawDate)) return "Friday";
  if (/saturday/i.test(rawDate)) return "Saturday";

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", { weekday: "long" });
  }

  return "Event";
}

function getEventButtonLabel(event) {
  return `RSVP for ${getEventDayLabel(event)}`;
}

function getCurrentEvents(data) {
  return [...(data?.events || [])]
    .filter(Boolean)
    .filter(event => String(event?.title || "").trim() !== "")
    .filter(event => String(event?.apple_invite_url || "").trim() !== "")
    .map(event => ({
      ...event,
      day: getEventDayLabel(event)
    }));
}

function getHomeEventRotationIndex(events) {
  if (!events.length) return 0;
  const rotationWindowMs = 10000;
  return Math.floor(Date.now() / rotationWindowMs) % events.length;
}

function buildHomeEventButtonsMarkup(events) {
  return `
    <div class="home-event-fixed-buttons home-event-fixed-buttons-inline">
      ${events.map(event => {
        const day = getEventDayLabel(event).toLowerCase();
        return `
          <a
            class="btn btn-rsvp home-dual-rsvp-btn home-dual-rsvp-btn-${day}"
            href="${event.apple_invite_url}"
            target="_blank"
            rel="noopener"
          >
            ${getEventButtonLabel(event)}
          </a>
        `;
      }).join("")}
    </div>
  `;
}

function buildHomeRotatorDotsMarkup(events, activeIndex) {
  return events.map((dotEvent, dotIndex) => {
    const dayLabel = getEventDayLabel(dotEvent);
    const dayKey = dayLabel.toLowerCase();
    const isActive = dotIndex === activeIndex;

    return `
      <button
        class="home-event-dot${isActive ? " is-active" : ""}"
        type="button"
        data-home-event-index="${dotIndex}"
        data-home-event-day="${dayKey}"
        aria-label="Show ${dayLabel} event"
        aria-pressed="${isActive ? "true" : "false"}"
      ></button>
    `;
  }).join("");
}

function buildHomeEventCard(event, data, allEvents, activeIndex, index) {
  const dayLabel = getEventDayLabel(event);
  const dayKey = dayLabel.toLowerCase();
  const themeClass = dayKey === "friday"
    ? "schedule-event-card-top"
    : "schedule-event-card-bottom";

  const buttonsMarkup = buildHomeEventButtonsMarkup(allEvents);
  const dotsMarkup = allEvents.length > 1
    ? buildHomeRotatorDotsMarkup(allEvents, activeIndex)
    : "";

  return `
    <div
      class="event-card compact-event-card home-event-hero schedule-event-card ${themeClass} home-rotating-event-card"
      data-event-day="${dayLabel}"
    >
      <div class="event-card-topline">
        <div class="kicker event-title-kicker">${event.title}</div>

        <div class="home-event-top-right">
          <div class="schedule-day-pill">${dayLabel}</div>
        </div>
      </div>

      <div class="event-layout-grid">
        <div class="event-details-col">
          <div class="event-format-title">${event.format || ""}</div>
          <div class="event-structure">${event.structure || ""}</div>
          <h3>${event.date}</h3>
          <p class="muted"><strong>Start:</strong> ${event.time}</p>
          <p class="muted"><strong>Estimated End:</strong> ${event.endTime || ""}</p>
          <p class="muted"><strong>Location:</strong> ${event.location}</p>
          <p class="muted">${event.address || ""}</p>
          ${eventRsvpForecastMarkup(event, data)}
          ${buttonsMarkup}
        </div>

        <div class="event-rsvp-col">
          ${eventRsvpAvatarMarkup(event, data, 9, {
            showRotatorNav: allEvents.length > 1,
            showRotatorLabel: false,
            rotatorDotsMarkup: dotsMarkup,
            summaryPlacement: "bottom"
          })}
        </div>
      </div>
    </div>
  `;
}

function ensureHomeCommissionerSection() {
  const eventsList = document.getElementById("home-events-list");
  if (!eventsList) return null;

  const eventsSection = eventsList.closest(".section");
  if (!eventsSection) return null;

  let commissionerSection = document.getElementById("home-commissioner-section");

  if (!commissionerSection) {
    commissionerSection = document.createElement("section");
    commissionerSection.id = "home-commissioner-section";
    commissionerSection.className = "section home-commissioner-section";
    eventsSection.insertAdjacentElement("afterend", commissionerSection);
  }

  commissionerSection.innerHTML = `
    <div class="section-head page-title-row">
      <h2>🌶️ Hot Takes: The Commissioner’s Report</h2>
    </div>
    <div class="home-commissioner-shell">
      <p class="commissioner-typing-target" data-commissioner-report></p>
    </div>
  `;

  return commissionerSection;
}

function ensureStandingsHeadline(sortKey) {
  const table = document.getElementById("standings-table");
  if (!table) return;

  const topShell = document.querySelector(".standings-top-shell");
  const raceStrip = document.getElementById("standings-race-strip");
  let metaShell = document.getElementById("standings-meta-shell");
  let headline = document.getElementById("standings-current-stat");
  let formula = document.getElementById("standings-formula-display");

  if (!metaShell) {
    metaShell = document.createElement("div");
    metaShell.id = "standings-meta-shell";
    metaShell.className = "standings-meta-shell";
  }

  if (!headline) {
    headline = document.createElement("div");
    headline.id = "standings-current-stat";
    headline.className = "standings-current-stat";
  }

  if (!formula) {
    formula = document.createElement("div");
    formula.id = "standings-formula-display";
    formula.className = "standings-formula-display";
  }

  if (headline.parentNode !== metaShell) {
    metaShell.appendChild(headline);
  }

  if (formula.parentNode !== metaShell) {
    metaShell.appendChild(formula);
  }

  if (topShell) {
    if (raceStrip && raceStrip.parentNode === topShell) {
      if (metaShell.parentNode !== topShell || metaShell.previousElementSibling !== raceStrip) {
        topShell.insertBefore(metaShell, raceStrip.nextSibling);
      }
    } else if (metaShell.parentNode !== topShell) {
      topShell.appendChild(metaShell);
    }
  }

  headline.innerHTML = `
    <span class="dashboard-current-icon">${statIcon(sortKey)}</span>
    <span class="standings-current-label">${formatStatLabel(sortKey)}</span>
  `;

  formula.textContent =
    STAT_FORMULAS[sortKey] || "Click a standings stat button to reveal the calculation formula.";
}

function renderStandingsRaceStrip(sortKey, sortedPlayers) {
  const strip = document.getElementById("standings-race-strip");
  if (!strip) return;

  strip.innerHTML = `
    <div class="standings-race-context">
      <strong>Qualified Field:</strong> ${sortedPlayers.length} players with 2+ entries
    </div>
  `;
}

function renderDashboardStudioStrip(sortKey, sortedPlayers) {
  const strip = document.getElementById("dashboard-studio-strip");
  if (!strip) return;

  const meta = DASHBOARD_META[sortKey] || {
    label: formatStatLabel(sortKey),
    icon: statIcon(sortKey),
    formula: ""
  };

  const leader = sortedPlayers[0];
  if (!leader) {
    strip.innerHTML = "";
    return;
  }

strip.innerHTML = `
  <div class="dashboard-studio-copy">${DASHBOARD_EDITORIAL[sortKey] || "A closer look at the league through this stat lens."}</div>

  <div class="dashboard-studio-context">
    <strong>Qualified Field:</strong> ${sortedPlayers.length} players with 2+ entries
  </div>
`;
}

function ensureDashboardHeadline(sortKey) {
  const topShell = document.querySelector(".dashboard-top-shell");
  const studioStrip = document.getElementById("dashboard-studio-strip");
  const metaShell = document.getElementById("dashboard-meta-shell");
  const headline = document.getElementById("dashboard-current-stat");
  const formulaBox = document.getElementById("dashboard-formula-display");

  if (!topShell || !metaShell || !headline) return;

  if (studioStrip && studioStrip.parentNode === topShell) {
    if (metaShell.parentNode !== topShell || metaShell.previousElementSibling !== studioStrip) {
      topShell.insertBefore(metaShell, studioStrip.nextSibling);
    }
  } else if (metaShell.parentNode !== topShell) {
    topShell.appendChild(metaShell);
  }

  const meta = DASHBOARD_META[sortKey] || {
    label: formatStatLabel(sortKey),
    icon: statIcon(sortKey),
    formula: ""
  };

  headline.innerHTML = `
    <span class="dashboard-current-icon">${meta.icon}</span>
    <span class="standings-current-label">${meta.label}</span>
  `;

  if (formulaBox) {
    formulaBox.textContent = meta.formula || "Click a stat button to reveal the calculation formula.";
  }
}

function buildHomeStripCard(title, icon, player, value, valueClass = "") {
  if (!player) return "";

  return `
    <a class="home-strip-card" href="${playerUrl(player)}">
      <div class="home-strip-kicker">${icon} ${title}</div>

      <div class="home-strip-player-row">
        ${playerImageMarkup(player, "table")}
        <div class="home-strip-player">${displayPlayerName(player)}</div>
      </div>

      <div class="home-strip-value ${valueClass}">${value}</div>
    </a>
  `;
}

function buildHomeInsightCard(title, icon, player, value, note, formulaKey, valueClass = "") {
  if (!player) return "";

  return `
    <a class="home-insight-card" href="${playerUrl(player)}" data-formula="${STAT_FORMULAS[formulaKey] || ""}">
      <div class="home-insight-top">
        <div class="home-insight-icon">${icon}</div>
        <div class="home-insight-kicker">${title}</div>
      </div>

      <div class="home-insight-player-row">
        ${playerImageMarkup(player, "table")}
        <div class="home-insight-player">${displayPlayerName(player)}</div>
      </div>

      <div class="home-insight-value ${valueClass}">${value}</div>
    </a>
  `;
}

function buildHomeMiniRow(rank, player, value) {
  if (!player) return "";

  return `
    <div class="home-mini-row">
      <div class="home-mini-rank">#${rank}</div>
      <div class="home-mini-player-wrap">
        ${playerImageMarkup(player, "table")}
        <div class="home-mini-name">${displayPlayerName(player)}</div>
      </div>
      <div class="home-mini-value">${value}</div>
    </div>
  `;
}

function buildHomeBadgeRow(label, player, value, valueClass = "") {
  if (!player) return "";

  return `
    <div class="home-badge-row">
      <div class="home-badge-pill">${label}</div>
      <div class="home-badge-main">
        <div class="home-badge-player-wrap">
          ${playerImageMarkup(player, "table")}
        </div>
        <div class="home-badge-value ${valueClass}">${value}</div>
      </div>
    </div>
  `;
}

function buildHomeBadgeCard(config, player) {
  if (!player) return "";

  const rule = HONOR_RULES[config.rule];
  const key = rule?.key || "profit";
  const value = formatStatValue(player, key);
  const valueClass = key === "profit"
    ? statValueClass(player, "profit")
    : "";

  return buildHomeBadgeRow(config.label, player, value, valueClass);
}

function buildTickerLeader(icon, label, player) {
  if (!player) return "";

  return `
    <a class="league-ticker-item" href="${playerUrl(player)}">
      <span class="league-ticker-label">${icon} ${label}</span>
      <span class="league-ticker-player">
        ${playerImageMarkup(player, "table")}
        <span class="league-ticker-name">${displayPlayerName(player)}</span>
      </span>
    </a>
  `;
}

const COMMISSIONER_REPORTS = [
  "Li-Fo isn’t just winning — he’s auditing the room. The profit is obscene, the cashes are constant, and every week the rest of the league looks more like supporting actors in his tax return.",
  "BostnMike continues to lead the league in violent intentions and inconvenient endings. Nobody kills more players, and nobody finds the bubble with more theatrical consistency.",
  "NASA Al’s numbers still look like somebody typo’d a heater into the spreadsheet. Efficient, ruthless, and suspiciously clean — he plays like he’s billing by the hour.",
  "Ahmed has the energy of a man who thinks every pot should be his by moral right. The aggression is real, the upside is real, and so is the occasional urge to set money on fire just to prove dominance.",
  "Cougar remains the league’s most irritatingly adult presence — low drama, low tilt, no wasted motion, and actual profit. It’s less poker than responsible wealth management.",
  "A.I. Dave keeps posting the kind of profile that says ‘competent human, uncooperative universe.’ The decisions are there. The justice is pending.",
  "Hiro is still one of the league’s busiest contractors — plenty of action, plenty of knockouts, and still somehow waiting for the invoice to clear.",
  "ProvidenceMike continues to confuse effort with outcome. The attendance is commendable, the enthusiasm is admirable, and the balance sheet remains deeply unconvinced.",
  "Red plays like subtlety personally insulted him. The pressure is real, the hit rate is live, and the bankroll keeps responding with a shrug.",
  "Chris O treats every table like it owes him an apology. There’s a lot of action, a lot of heat, and just enough success to keep the experiment ethically questionable.",
  "Nitro remains less a player than a recurring weather event. Fast start, bright flash, structural damage, then somebody else ends up with the furniture.",
  "Wild Bill keeps proving that a man can look beatable for hours and still be there when the checks clear. Not glamorous. Extremely annoying.",
  "The Architect continues to produce structurally sound evenings with load-bearing collapses near the money. Elegant design. Unfortunate occupancy.",
  "Jeff T is still doing long-form tragedy with chips. The commitment is admirable, the returns are fictional, and the deck has not apologized once.",
  "Vish is committed to the idea that aggression and optimism can eventually become profit if you simply keep trying them loudly enough.",
  "Li-Fo cashes so often the rest of the room should start asking whether he’s entering tournaments or collecting subscriptions.",
  "BostnMike’s stat line remains one of the great modern works of art: maximum carnage up front, maximum sadness near the finish line.",
  "NASA Al doesn’t waste hands, bullets, or opportunities. It’s the sort of clean efficiency that makes recreational players suddenly interested in church.",
  "Ahmed is the human embodiment of ‘let’s see what happens.’ Sometimes what happens is dominance. Sometimes what happens is content.",
  "Cougar is what happens when discipline becomes passive-aggressive. He’s not flashy, not noisy, and somehow always around when the money remembers his name.",
  "A.I. Dave keeps turning in respectable work and receiving the kind of compensation package normally reserved for interns and backup drummers.",
  "Hiro has the volume of a grinder, the violence of a hitman, and the accounting of a man still waiting on payroll.",
  "ProvidenceMike is still hosting a masterclass in how to be involved in everything and ahead in almost none of it.",
  "Red’s game has all the markings of danger — pressure, pace, knockouts — and just enough financial ambiguity to keep it morally educational.",
  "Chris O doesn’t seem interested in ‘small edge’ poker. He seems interested in poker with headlights and a police report.",
  "Nitro’s numbers continue to suggest a player whose best hands are often followed immediately by a follow-up donation.",
  "Wild Bill is the kind of player who makes no noise, no headlines, and no obvious mistakes — which is infuriating if you were hoping for one of those three things.",
  "The Architect keeps drawing up respectable blueprints and then inviting variance to do the demolition work personally.",
  "Jeff T is still battling courageously through the sort of run that would make a lesser man take up pickleball.",
  "Vish has fully committed to the lifestyle portion of rebuy culture. The results remain optional, but the enthusiasm is under no such restriction.",
  "Li-Fo and NASA Al currently occupy that lovely tax bracket known as ‘the rest of you are funding this.’",
  "BostnMike kills people at a rate that suggests menace, then bubbles at a rate that suggests community theater. It’s a remarkable dual-threat profile.",
  "Ahmed’s table presence says alpha predator. His stat line says ‘mostly, yes,’ with occasional footnotes written in gasoline.",
  "Cougar’s profile is so clean it almost feels rude. No panic, no waste, no nonsense — just results and the quiet judgment of grown-up poker.",
  "A.I. Dave is one heater away from becoming a problem and one river away from filing a grievance with the cosmos.",
  "Hiro continues to deliver action in bulk. If excitement paid dividends, he’d own half the league by now.",
  "ProvidenceMike is doing the Lord’s work if the Lord’s work involves entering often and redistributing resources with a smile.",
  "Red and Chris O are both excellent reminders that aggression is not a synonym for accounting.",
  "Nitro keeps proving that a nickname can be both branding and a caution label.",
  "Wild Bill’s whole act is ‘how did he get here again,’ followed shortly by ‘dammit, there he is again.’",
  "The Architect is still under construction, though at this point the permit office has questions.",
  "Jeff T’s variance graph probably deserves its own support group and two licensed professionals.",
  "Vish is still playing like every rebuy is a vote of confidence. The ballot box remains mixed.",
  "Li-Fo doesn’t chase the money anymore. At this point the money sees him walk in and starts packing a bag.",
  "NASA Al’s efficiency is so sharp it feels less like poker and more like a targeted extraction.",
  "BostnMike remains the league’s top supplier of busted players and unfinished business. If closure were a stat, he’d still bubble it.",
  "Ahmed shows up with pressure, posture, and enough forward motion to make folding feel like a municipal policy.",
  "Cougar is what happens when a player removes ego from the equation and leaves the rest of you with the receipt.",
  "A.I. Dave is still one of the room’s steadier operators, which makes his current returns feel like a clerical dispute with fate.",
  "Hiro has reached the point where the action is never in doubt — only whether the math will eventually stop laughing.",
  "ProvidenceMike, Red, Chris O, Nitro, Wild Bill, The Architect, Jeff T, and Vish continue to prove the league’s central theorem: somebody’s getting paid, and most of you are helping.",
  "Li-Fo’s ROI is no longer a statistic. It’s a subpoena. Every time he cashes, the rest of the table should receive a charitable giving receipt.",
  "BostnMike remains the league’s premier contradiction: a knockout machine with the emotional finish line awareness of a man carrying groceries through a minefield.",
  "NASA Al plays like he has already simulated the tournament 14 million times and found the one timeline where everybody else pays him.",
  "Ahmed continues to apply pressure like the chips personally wronged his family. It is impressive, expensive, and occasionally requires adult supervision.",
  "Cougar has turned boring poker into an act of violence. He just sits there, avoids nonsense, and lets everyone else discover fire the hard way.",
  "A.I. Dave keeps making the kind of steady decisions that should produce better results, which is adorable if you still believe in justice.",
  "Hiro is basically the league’s action economy. Hands played, bodies dropped, chaos generated — and somehow the profit department is still on lunch.",
  "ProvidenceMike keeps showing up with the confidence of a man who has not checked the spreadsheet recently.",
  "Red’s aggression index keeps saying threat. His profit line keeps saying ‘please define threat.’",
  "Chris O is not playing poker so much as conducting a controlled burn with community cards.",
  "Nitro’s graph looks like a cardiologist found a poker app. Spikes, crashes, urgent concern, and yet somehow everyone keeps watching.",
  "Wild Bill is the league’s carbon monoxide detector: quiet, persistent, and suddenly very important when everyone realizes the danger.",
  "The Architect keeps building respectable tournament structures and then personally approving the collapse inspection.",
  "Jeff T has reached the stage where variance is not a phase. It is a roommate with mail coming to the house.",
  "Vish remains committed to proving that if you rebuy with enough confidence, eventually the universe has to feel embarrassed.",
  "Li-Fo’s cash rate is getting rude. At some point the league needs to stop calling it poker and start calling it direct deposit.",
  "BostnMike’s knockout count says assassin. His finish profile says the assassin forgot where the exit was.",
  "NASA Al’s game is so efficient it makes the rest of the room look like they’re trying to assemble IKEA furniture without the little wrench.",
  "Ahmed’s best nights look terrifying. His worst nights look like the same plan, just with the receipt printed larger.",
  "Cougar is out here playing clean, profitable poker like this is some kind of skill game, which feels deeply inappropriate for the room.",
  "A.I. Dave remains the league’s strongest argument that good process and good fortune are not currently speaking.",
  "Hiro’s hit totals keep saying menace. His bankroll keeps asking when menace gets dental.",
  "ProvidenceMike is basically a loyalty program for the prize pool. The visits are frequent. The rewards appear to be going elsewhere.",
  "Red keeps generating pressure like a broken fire hydrant. Powerful, hard to ignore, and not always pointed at the right thing.",
  "Chris O brings big-pot energy to situations that may have requested medium-pot energy and perhaps a pamphlet on restraint.",
  "Nitro remains the player most likely to make everyone say ‘oh wow’ and then immediately ‘oh no.’",
  "Wild Bill does not need a heater. He just needs everyone else to forget he is still there, which they keep doing like professionals.",
  "The Architect’s tournament plan is usually sound until the river starts making unauthorized renovations.",
  "Jeff T’s results have the emotional range of a prestige drama and the payout structure of a parking ticket.",
  "Vish is proof that hope is not a bankroll management strategy, but it can be extremely well attended.",
  "Li-Fo is currently treating the standings like a guest book at his own vacation home.",
  "NASA Al has the kind of profile that makes you wonder if he is playing poker or simply removing inefficiency from the table.",
  "BostnMike’s season has everything: violence, suspense, near misses, and the recurring theme of ‘why is he still not paid?’",
  "Ahmed’s chips move with purpose. Sometimes the purpose is profit. Sometimes the purpose is dramatic lighting.",
  "Cougar keeps making the responsible play, which is exactly why everyone secretly wants him to lose a flip for the culture.",
  "A.I. Dave’s graph is less ‘down bad’ than ‘awaiting cosmic reimbursement.’",
  "Hiro plays enough hands to qualify for workers’ comp and still manages to make every session feel under-invoiced.",
  "ProvidenceMike continues to provide liquidity, atmosphere, and cautionary educational material.",
  "Red’s table image says danger. His net results say the danger may be to both parties.",
  "Chris O plays like every orbit comes with a dare.",
  "Nitro’s best moments are electric. Unfortunately, electricity is also how buildings catch fire.",
  "Wild Bill’s strategy appears to be patience, timing, and letting everyone else do the stupid part first.",
  "The Architect knows how to build a stack. The zoning issue remains keeping it upright.",
  "Jeff T has been through enough runouts to qualify as a field study in emotional resilience.",
  "Vish continues to chase upside with the dedication of a man who believes spreadsheets are merely opinions.",
  "Li-Fo is no longer running hot. He is running a small regional bank with terrible customer service.",
  "NASA Al keeps extracting value so cleanly it feels like the chips signed a consent form before moving toward him.",
  "BostnMike’s hit rate remains elite, which is great news if the goal is to ruin evenings and less great if the goal is to win them.",
  "Ahmed has the rare ability to make every hand feel expensive before the flop is even done introducing itself.",
  "Cougar is quietly profitable in a way that suggests he has confused poker night with a retirement planning seminar.",
  "A.I. Dave keeps producing competent poker and receiving slapstick outcomes, which is either variance or a very targeted prank.",
  "Hiro remains a premium content provider. Unfortunately, premium content and premium profit are still in separate departments.",
  "ProvidenceMike has the attendance profile of a grinder and the profit profile of a generous community sponsor.",
  "Red is a reminder that applying pressure is powerful, but so is occasionally checking whether the door opens inward.",
  "Chris O’s game is fun to watch in the same way a forklift race through a wine cellar is fun to watch.",
  "Nitro’s nickname remains accurate: explosive, memorable, and not something you want too close to your chip stack.",
  "Wild Bill keeps letting the loud players build the pot, then wanders in late like he found the money under a couch cushion.",
  "The Architect has great instincts, solid structure, and a recurring problem with hostile river permits.",
  "Jeff T’s current run is the kind of thing you show new players when explaining why poker is technically legal cruelty.",
  "Vish keeps investing in chaos futures. The market remains volatile.",
  "Li-Fo’s profit line has started to look less like performance and more like a clerical error nobody has the courage to correct.",
  "NASA Al is playing low-waste poker in a high-waste ecosystem. It’s beautiful, and frankly, a little insulting.",
  "BostnMike is leading the room in removals and emotional property damage. The money, however, continues to file a restraining order.",
  "Ahmed’s aggression is not a dial. It is a light switch, and someone taped it in the on position.",
  "Cougar’s entire brand is making fewer mistakes than everyone else and then having the nerve to cash because of it.",
  "A.I. Dave is one of the few players whose stats say ‘solid’ while the results say ‘have you considered apologizing to a deity?’",
  "Hiro keeps stacking volume like it earns airline miles. At this point, he should be upgraded to Business Class Tilt.",
  "ProvidenceMike’s poker résumé includes commitment, heart, and an impressive ability to help other people achieve their financial goals.",
  "Red and Ahmed at the same table is less a matchup than a pressure system with cupholders.",
  "Chris O and Nitro both play like the tournament clock is personally challenging their masculinity.",
  "Wild Bill is the quiet ending nobody ordered but everyone keeps receiving.",
  "The Architect keeps finding new ways to make a deep run feel like a building inspection after a small earthquake.",
  "Jeff T and Vish are currently locked in a philosophical debate over whether optimism can be itemized as a poker expense.",
  "Li-Fo cashing again has become so routine the recap should probably just have a rubber stamp and a sigh.",
  "NASA Al’s season is a clean spreadsheet in a room full of coffee stains.",
  "BostnMike can eliminate half the table and still somehow arrive at the payout bubble looking surprised to be there.",
  "Ahmed plays like the pot is already his and the rest of you are merely contesting a clerical detail.",
  "Cougar is the player everyone forgets to fear until the payouts start and he’s standing there holding a receipt.",
  "A.I. Dave is building a case file titled ‘Correct Decisions, Incorrect Universe.’",
  "Hiro’s game has horsepower, torque, and the occasional check-engine light near the payout line.",
  "ProvidenceMike continues to be one of the league’s most reliable presences, which is wonderful news for attendance and complicated news for ROI.",
  "Red’s poker style is basically ‘make it uncomfortable and see who can read.’ The answer varies by week and blood pressure.",
  "Chris O’s stack movement often resembles a small-cap stock with rumors, volume, and regulatory concern.",
  "Nitro is the league’s proof that momentum is real, temporary, and sometimes immediately followed by a rebuy.",
  "Wild Bill remains the patron saint of ‘wait, how is he still in?’",
  "The Architect’s season has strong foundation work, questionable weatherproofing, and several concerning cracks near the money.",
  "Jeff T is still grinding through the kind of variance that makes recreational hobbies look like litigation.",
  "Vish approaches poker like a motivational speaker trapped inside a rebuy slip.",
  "Li-Fo and Cougar are giving the league a painful reminder that discipline has better margins than vibes.",
  "NASA Al and Li-Fo are currently playing the role of adults in a room otherwise committed to experimental finance.",
  "BostnMike, Hiro, Red, Ahmed, and Chris O continue to supply the violence. Li-Fo continues to invoice for cleanup.",
  "The league’s economy remains simple: some players create chaos, some players survive chaos, and Li-Fo appears to have monetized both.",
  "If knockouts were the only currency, BostnMike would be a warlord. Unfortunately, the cashier keeps asking about finish position.",
  "If patience were televised, Wild Bill and Cougar would be terrible ratings and excellent investments.",
  "If enthusiasm paid out, ProvidenceMike and Vish would be in tax trouble. Sadly, the prize pool remains more selective.",
  "If justice existed, A.I. Dave would be higher. If restraint existed, Chris O would be lower. Neither premise is currently supported by the data.",
  "The standings continue to suggest that poker rewards discipline, punishes optimism, and occasionally lets Nitro touch the stove again just for television."
];

function getRandomCommissionerReport(previousIndex = -1) {
  if (!COMMISSIONER_REPORTS.length) return "";

  let newIndex;

  do {
    newIndex = Math.floor(Math.random() * COMMISSIONER_REPORTS.length);
  } while (newIndex === previousIndex && COMMISSIONER_REPORTS.length > 1);

  return {
    text: COMMISSIONER_REPORTS[newIndex],
    index: newIndex
  };
}

function archetypeFormulaText(name) {
  if (name === "The Hitman") return "Hitman = Aggression Index + (Hits × 0.8)";
  if (name === "The Closer") return "Closer = Clutch Index × 1.25";
  if (name === "The Grinder") return "Grinder = (Survivor Index × 1.05) + (Composure Index × 0.45) − (Aggression Index × 0.35)";
  if (name === "The Lucky Devil") return "Lucky Devil = Luck Index × 1.15";
  if (name === "The Wildcard") return "Wildcard = ((100 − Composure Index) × 1.1) + (Rebuys × 0.8)";
  if (name === "The Bubble Magnet") return "Bubble Magnet = (Bubbles × 4) + (Clutch Index × 0.15)";
  if (name === "The Technician") return "Technician = (Clutch Index + Survivor Index + Aggression Index) ÷ 3";
  return "";
}

function tierFormulaText(name) {
  const base = "Tier Score = (True Skill × 1.5) + (Clutch × 1.1) + (Aggression × 0.65) + (Survivor × 1.0) + (Composure × 1.25) + sample bonus − rebuy penalty.";

  if (name === "The Apex Predator") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: top 15% of Tier Scores.</span>
      <br><span class="tier-formula-drop">• Relegation line: fall below the 15% cutoff and you drop.</span>
    `;
  }

  if (name === "The Table Crusher") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: 15% to 35%.</span>
      <br><span class="tier-formula-drop">• Relegation line: fall below the 30% cutoff.</span>
    `;
  }

  if (name === "The Shot Maker") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: 35% to 60%.</span>
      <br><span class="tier-formula-drop">• Relegation line: fall below the 60% cutoff.</span>
    `;
  }

  if (name === "The Gambler") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: 60% to 80%.</span>
      <br><span class="tier-formula-drop">• Relegation line: fall below the 80% cutoff.</span>
    `;
  }

  if (name === "The League Sponsor") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: bottom 20% (80% to 100%).</span>
      <br><span class="tier-formula-drop">• Good news, there's nowhere to go but up...</span>
    `;
  }

  return base;
}
 
function buildArchetypeGuideCard() {
  const defaultItem = ARCHETYPE_GUIDE[0];
  const defaultFormula = archetypeFormulaText(defaultItem.name);

  return `
    <div class="event-card home-guide-card home-guide-card-archetype">
      <div class="home-formula-display" id="home-archetype-formula-display">
        <div class="home-formula-display-title">Archetype Formula</div>
        <div class="home-formula-display-body">${defaultFormula}</div>
      </div>

      <div class="event-guide-rows">
        <div class="player-archetype-line event-guide-line">
          <span class="profile-line-desc">
            ${ARCHETYPE_GUIDE.map(item => `
              <button
                type="button"
                class="home-guide-pill home-guide-pill-reveal"
                data-formula-target="home-archetype-formula-display"
                data-formula-title="Archetype Formula"
                data-formula-text="${archetypeFormulaText(item.name).replace(/"/g, "&quot;")}"
                data-archetype-tone="${item.name
                  .replace(/^The\\s+/i, "")
                  .toLowerCase()
                  .replace(/\\s+/g, "")
                  .replace("luckydevil", "lucky")}"
              >
                ${item.emoji} ${item.name}
              </button>
            `).join("")}
          </span>
        </div>
      </div>
    </div>
  `;
}

function buildTierGuideCard() {
  const defaultItem = TIER_GUIDE[0];
  const defaultFormula = tierFormulaText(defaultItem.name);

  return `
    <div class="event-card home-guide-card home-guide-card-tier">
      <div class="home-formula-display" id="home-tier-formula-display">
        <div class="home-formula-display-title">Tier Formula</div>
        <div class="home-formula-display-body">${defaultFormula}</div>
      </div>

      <div class="event-guide-rows">
        <div class="player-tier-line event-guide-line">
          <span class="profile-line-desc">
            ${TIER_GUIDE.map(item => `
              <button
                type="button"
                class="home-guide-pill home-guide-pill-reveal"
                data-formula-target="home-tier-formula-display"
                data-formula-title="Tier Formula"
                data-formula-text="${tierFormulaText(item.name).replace(/"/g, "&quot;")}"
              >
                ${item.emoji} ${item.name}
              </button>
            `).join("")}
          </span>
        </div>
      </div>
    </div>
  `;
}

function wireHomeFormulaReveal(scope = document) {
  scope.querySelectorAll(".home-guide-pill-reveal").forEach(button => {
    button.addEventListener("mouseenter", () => {
      const targetId = button.dataset.formulaTarget;
      const title = button.dataset.formulaTitle || "Formula";
      const text = button.dataset.formulaText || "";

      const host = document.getElementById(targetId);
      if (!host) return;

      host.innerHTML = `
        <div class="home-formula-display-title">${title}</div>
        <div class="home-formula-display-body">${text}</div>
      `;
    });

    button.addEventListener("focus", () => {
      const targetId = button.dataset.formulaTarget;
      const title = button.dataset.formulaTitle || "Formula";
      const text = button.dataset.formulaText || "";

      const host = document.getElementById(targetId);
      if (!host) return;

      host.innerHTML = `
        <div class="home-formula-display-title">${title}</div>
        <div class="home-formula-display-body">${text}</div>
      `;
    });
  });
}

function buildEventCard(event, data, options = {}) {
  const {
    homeMode = false,
    includeCommissioner = false,
    isActive = true,
    rsvpButtonsMarkup = "",
    eventRsvpOptions = {}
  } = options;

  const buttonLabel = getEventButtonLabel(event);

  return `
    <div class="event-card home-event-card home-event-hero compact-event-card${homeMode ? " rotating-home-event-card" : ""}${isActive ? " is-active" : ""}" data-event-day="${getEventDayLabel(event)}">
      <div class="event-card-topline">
        <div class="kicker event-title-kicker">${event.title}</div>

        <div class="home-event-top-right">
          <div class="schedule-day-pill">${getEventDayLabel(event)}</div>
        </div>
      </div>

      <div class="event-layout-grid">
        <div class="event-details-col">
          <div class="event-format-title">${event.format || ""}</div>
          <div class="event-structure">${event.structure || ""}</div>
          <h3>${event.date}</h3>
          <p class="muted"><strong>Start:</strong> ${event.time}</p>
          <p class="muted"><strong>Estimated End:</strong> ${event.endTime || ""}</p>
          <p class="muted"><strong>Location:</strong> ${event.location}</p>
          <p class="muted">${event.address || ""}</p>
          ${eventRsvpForecastMarkup(event, data)}
          ${rsvpButtonsMarkup || `<a class="btn btn-rsvp" href="${event.apple_invite_url}" target="_blank" rel="noopener">${buttonLabel}</a>`}
        </div>

        <div class="event-rsvp-col">
          ${eventRsvpAvatarMarkup(event, data, 9, eventRsvpOptions)}
        </div>
      </div>

      ${includeCommissioner ? `
        <div class="event-commissioner-inline">
          <div class="event-commissioner-inline-title">
            <span class="report-icon">🌶️</span> Hot Takes: The Commissioner's Report
          </div>
          <p class="commissioner-typing-target" data-commissioner-report></p>
        </div>
      ` : ""}
    </div>
  `;
}

function renderHomePage(data) {
  const eventsEl = document.getElementById("home-events-list");

if (eventsEl) {
  const homeEvents = getCurrentEvents(data).slice(0, 2);

  if (SHOW_HOME_COMMISSIONER_REPORT) {
    ensureHomeCommissionerSection();
  }

  if (!homeEvents.length) {
      eventsEl.innerHTML = "";
    } else if (homeEvents.length === 1) {
      eventsEl.innerHTML = `
        <div class="home-event-rotator-shell single-event-week">
          <div class="home-event-rotator-stage">
            <div class="home-event-rotator-panel is-active">
              ${buildHomeEventCard(homeEvents[0], data, homeEvents, 0, 0)}
            </div>
          </div>
        </div>
      `;
    } else {
      const activeIndex = 0;

      eventsEl.innerHTML = `
        <div class="home-event-rotator-shell dual-event-week">
          <div class="home-event-rotator-stage">
            ${homeEvents.map((event, index) => `
              <div
                class="home-event-rotator-panel${index === activeIndex ? " is-active" : ""}"
                data-home-event-panel="${index}"
              >
                ${buildHomeEventCard(event, data, homeEvents, activeIndex, index)}
              </div>
            `).join("")}
          </div>
        </div>
      `;

      const rotatorPanels = eventsEl.querySelectorAll("[data-home-event-panel]");
      const rotatorDots = eventsEl.querySelectorAll("[data-home-event-index]");

      let currentIndex = activeIndex;

      function setHomeEventSlide(index) {
        currentIndex = index;

        rotatorPanels.forEach((panel, panelIndex) => {
          panel.classList.toggle("is-active", panelIndex === index);
        });

        rotatorDots.forEach(dot => {
          const dotIndex = Number(dot.dataset.homeEventIndex || 0);
          const isActive = dotIndex === index;
          dot.classList.toggle("is-active", isActive);
          dot.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
      }

      rotatorDots.forEach(dot => {
        dot.addEventListener("click", () => {
          const nextIndex = Number(dot.dataset.homeEventIndex || 0);
          setHomeEventSlide(nextIndex);
        });
      });

      setHomeEventSlide(activeIndex);
    }
  }

  const allPlayers = data?.players || [];
const leaderStrip = document.getElementById("home-leader-strip");

if (leaderStrip) {
  /*
   * Home page leader cards follow Crew qualification:
   * 3 separate tournament appearances.
   * Rebuys do not count.
   */
  const crewLeaderPool = allPlayers.filter(isCrewEligible);

  const profitLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Profit Leader"],
    crewLeaderPool
  );

  const powerLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Power Leader"],
    crewLeaderPool
  );

  const clutchLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Clutch Leader"],
    crewLeaderPool
  );

  const hitLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Hit King"],
    crewLeaderPool
  );

  leaderStrip.innerHTML = [
    buildHomeStripCard(
      "Profit Leader",
      "💰",
      profitLeader,
      profitLeader ? fmtMoney(profitLeader.profit) : "",
      profitLeader ? statValueClass(profitLeader, "profit") : ""
    ),

    buildHomeStripCard(
      "Power Leader",
      "💪🏼",
      powerLeader,
      powerLeader ? fmtNum(powerLeader.trueSkillScore) : ""
    ),

    buildHomeStripCard(
      "Clutch Leader",
      "🎯",
      clutchLeader,
      clutchLeader ? fmtNum(clutchLeader.clutchIndex) : ""
    ),

    buildHomeStripCard(
      "Knockout King",
      "💥",
      hitLeader,
      hitLeader ? String(hitLeader.hits) : ""
    )
  ].join("");
}

const badgeCluster = document.getElementById("home-badge-cluster");

if (badgeCluster) {
  const crewBadgePool = allPlayers.filter(isCrewEligible);

  const badges = HOME_BADGE_CONFIG.map(config => {
    const leader = getLeaderByRule(
      allPlayers,
      HONOR_RULES[config.rule],
      crewBadgePool
    );

    return leader ? buildHomeBadgeCard(config, leader) : "";
  }).join("");

  badgeCluster.innerHTML = badges;
}

  /*
  * Keep the home ticker aligned with Crew-page eligibility:
  * 3 separate tournament appearances; rebuys do not count.
  */
  const tickerPlayers = allPlayers.filter(isCrewEligible);
  const ticker = document.getElementById("league-ticker-text");

  if (ticker && tickerPlayers.length) {
    const tickerItems = STAT_LEADER_CONFIG.map(stat => {
      const leader = sortPlayers(tickerPlayers, stat.key)[0];
      if (!leader) return "";
      const statConfig = getStatConfig(stat.key);
      const icon = statConfig?.icon || "🏅";
      return buildTickerLeader(icon, stat.title, leader);
    }).join("");

    ticker.innerHTML = `
      <div class="league-ticker-run">
        ${tickerItems}
      </div>
      <div class="league-ticker-run">
        ${tickerItems}
      </div>
    `;
    }

    const archetypeGuide = document.getElementById("home-archetype-guide");
    if (archetypeGuide) {
      archetypeGuide.innerHTML = buildArchetypeGuideCard();
    }

    const tierGuide = document.getElementById("home-tier-guide");
    if (tierGuide) {
      tierGuide.innerHTML = buildTierGuideCard();
    }

wireHomeFormulaReveal();

  const insightsGrid = document.getElementById("home-insights-grid");
  if (insightsGrid) {
  const crewInsightPool = allPlayers.filter(isCrewEligible);

  const profitLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Profit Leader"],
    crewInsightPool
  );

  const powerLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Power Leader"],
    crewInsightPool
  );

  const clutchLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Clutch Leader"],
    crewInsightPool
  );

  const hitLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Hit King"],
    crewInsightPool
  );
    insightsGrid.innerHTML = [
      profitLeader ? buildHomeInsightCard(
        "Profit Leader",
        "💰",
        profitLeader,
        fmtMoney(profitLeader.profit),
        "",
        "profit",
        statValueClass(profitLeader, "profit")
      ) : "",
      powerLeader ? buildHomeInsightCard(
        "Power Leader",
        "💪🏼",
        powerLeader,
        fmtNum(powerLeader.trueSkillScore),
        "",
        "trueSkillScore",
        ""
      ) : "",
      clutchLeader ? buildHomeInsightCard(
        "Clutch Leader",
        "🎯",
        clutchLeader,
        fmtNum(clutchLeader.clutchIndex),
        "",
        "clutchIndex",
        ""
      ) : "",
      hitLeader ? buildHomeInsightCard(
        "Knockout King",
        "💥",
        hitLeader,
        String(hitLeader.hits ?? 0),
        "",
        "hits",
        ""
      ) : ""
    ].join("");
  }

  const insightFormula = document.getElementById("home-insight-formula");
if (insightFormula && insightsGrid) {
  const insightCards = [...insightsGrid.querySelectorAll(".home-insight-card")];

  function setInsightState(card) {
    insightCards.forEach(item => item.classList.remove("is-active"));
    if (!card) {
      insightFormula.textContent = "";
      return;
    }
    card.classList.add("is-active");
    insightFormula.textContent = card.dataset.formula || "";
  }

  insightCards.forEach(card => {
    card.addEventListener("mouseenter", () => setInsightState(card));
    card.addEventListener("focus", () => setInsightState(card));
    card.addEventListener("click", () => setInsightState(card));
    card.addEventListener("mouseleave", () => setInsightState(null));
    card.addEventListener("blur", () => setInsightState(null));
  });
}
}
  
function getFeaturedPlayer(data) {
  const players = (data?.players || []).filter(Boolean);
  if (!players.length) return null;

  /*
   * Featured Player should use the same qualification standard
   * as Crew: 3 separate tournament appearances.
   */
  const eligible = players.filter(isCrewEligible);

  const pool = eligible.length ? eligible : players;

  const rotationWindowMs = 12 * 60 * 60 * 1000;
  const rotationIndex = Math.floor(Date.now() / rotationWindowMs) % pool.length;

  return pool[rotationIndex];
}

function buildFeaturedPlayerCard(player, data) {
  if (!player) return "";

  const players = data?.players || [];
  const overall = playerCardOverallRating(player, players);
  const tierMeta = playerCardTierMeta(player, players);
  const primaryArchetype = getPlayerArchetypes(player).primary;
  const attributes = playerCardAttributes(player, players);
  const featuredEditionId = playerCardFeaturedEditionId(player, data);
  const specialEdition = playerCardSpecialEdition(player, data);
  const specialClass = specialEdition
    ? ` crew-ultimate-card-special crew-ultimate-card-special-${specialEdition.className} crew-ultimate-card-edition-${playerCardEditionClassName(specialEdition)}`
    : "";
  const activeCrewSkinLabel = specialEdition
    ? `${specialEdition.eyebrow}: ${specialEdition.label}`
    : "Base Edition";

  return `
    <div class="home-featured-ultimate-shell crew-page">
      <div class="home-featured-ultimate-kicker">🌟 Featured Player</div>

      <div class="home-featured-card-stage">
        <a
          class="crew-ultimate-card crew-ultimate-card-${tierMeta.className} home-featured-ultimate-card${specialClass}"
          href="${playerUrl(player)}"
          data-featured-edition="${escapeHtmlAttr(featuredEditionId)}"
          ${specialEdition ? `data-special-edition="${escapeHtmlAttr(specialEdition.id)}"` : ""}
          aria-label="Open ${displayPlayerNamePlain(player)} profile. Overall rating ${overall}. ${tierMeta.status} ${tierMeta.name}. Active Crew Skin: ${escapeHtmlAttr(activeCrewSkinLabel)}."
        >
          <div class="crew-ultimate-card-inner">
            <div class="crew-ultimate-metal" aria-hidden="true"></div>

            <header class="crew-ultimate-header">
              <div class="crew-ultimate-rating-block">
                <span class="crew-ultimate-overall">${overall}</span>
                <span class="crew-ultimate-tier-code">${tierMeta.code}</span>
              </div>

              <div class="crew-ultimate-edition">
                <span>TLPT</span>
                <strong>${specialEdition?.shortLabel || "BASE"}</strong>
                ${specialEdition ? `
                  <em title="${escapeHtmlAttr(`Active Crew Skin: ${activeCrewSkinLabel}`)}">
                    ${specialEdition.icon} ${specialEdition.cardLabel || specialEdition.label}
                  </em>
                ` : `
                  <em class="is-base-featured" title="Active Crew Skin: Base Edition">♠ BASE</em>
                `}
              </div>

              <img
                class="crew-ultimate-chip"
                src="images/site/chip-T-1000.png"
                alt=""
                aria-hidden="true"
              />
            </header>

            <div class="crew-ultimate-portrait">
              ${playerImageMarkup(player, "crew")}
            </div>

            <div class="crew-ultimate-identity">
              <h3>${displayPlayerName(player)}</h3>
              <span>${primaryArchetype.emoji} ${primaryArchetype.name}</span>
            </div>
          </div>
        </a>

        <div class="home-featured-attributes" aria-label="Featured player card attributes">
          ${attributes.map(attribute => `
            <div
              class="home-featured-attribute"
              title="${escapeHtmlAttr(`${attribute.label}: ${attribute.raw}. ${attribute.formula}`)}"
            >
              <div class="home-featured-attribute-score">
                <strong>${attribute.value}</strong>
                <span>${attribute.code}</span>
              </div>
              <small>${attribute.label}</small>
            </div>
          `).join("")}
        </div>
      </div>

      <a class="home-featured-profile-link" href="${playerUrl(player)}">
        View Full Player Profile →
      </a>
    </div>
  `;
}

function renderLeagueSnapshot(data) {
  const container = document.getElementById("home-snapshot-grid");
  const featuredContainer = document.getElementById("home-featured-player");
  if (!container) return;

  const players = data?.players || [];

  const totalEntries = players.reduce((sum, p) => sum + (Number(p.entries) || 0), 0);
  const totalRebuys = players.reduce((sum, p) => sum + (Number(p.rebuys) || 0), 0);
  const totalEntryFees = players.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);

  const cards = [
    {
      icon:"👥",
      label:"Players Recorded",
      value:players.length,
      className:"snapshot-purple",
      href:"players.html"
    },
    {
      icon:"💰",
      label:"Historical Prize Pool",
      value:fmtMoney(totalEntryFees),
      valueClass:"money",
      className:"snapshot-green",
      href:"dashboard.html"
    },
    {
      icon:"🎟️",
      label:"Entries",
      value:totalEntries,
      className:"snapshot-silver",
      href:"dashboard.html"
    },
    {
      icon:"♻️",
      label:"Rebuys",
      value:totalRebuys,
      className:"snapshot-blue",
      href:"dashboard.html"
    }
  ];

container.innerHTML = cards.map(card => `
  <a class="snapshot-card ${card.className}" href="${card.href}">
    <div class="snapshot-icon">${card.icon}</div>
    <div
      class="snapshot-value${card.valueClass ? ` ${card.valueClass}` : ""}"
      data-animate-count="true"
      data-target-value="${card.value}"
    >
      ${card.value}
    </div>
    <div class="snapshot-label">${card.label}</div>
    <div class="snapshot-cta">Go deeper →</div>
  </a>
`).join("");
  
    if (featuredContainer) {
    const featuredPlayer = getFeaturedPlayer(data);
    featuredContainer.innerHTML = buildFeaturedPlayerCard(featuredPlayer, data);
  }

  initAnimatedCounters(container.parentElement || document);
}

function renderStandings(sortKey = DEFAULT_STANDINGS_SORT) {
  const table = document.getElementById("standings-table");
  const tbody = table?.querySelector("tbody");
  if (!table || !tbody || !window.siteData?.players) return;

  ensureStandingsHeadline(sortKey);

  const eligiblePlayers = window.siteData.players.filter(
    player => Number(player?.entries ?? 0) >= 2
  );

  const sorted = sortPlayers(eligiblePlayers, sortKey);
  table.dataset.activeStat = sortKey;

  renderStandingsRaceStrip(sortKey, sorted);

  tbody.innerHTML = sorted.map((player, index) => `
    <tr
      class="standings-row-link"
      data-href="${playerUrl(player)}"
      tabindex="0"
      role="link"
      aria-label="Open ${displayPlayerNamePlain(player)} profile"
    >
      <td>${index + 1}</td>
      <td>${playerInlineMarkup(player, "standings")}</td>
      <td>${fmtMoney(player.totalWinnings)}</td>
      <td class="${statValueClass(player, "profit")}">${fmtMoney(player.profit)}</td>
      <td>${player.timesPlaced ?? "-"}</td>
      <td>${player.bubbles ?? "-"}</td>
      <td>${player.hits ?? "-"}</td>
      <td>${player.buyIns ?? "-"}</td>
      <td>${player.rebuys ?? "-"}</td>
      <td>${player.entries ?? "-"}</td>
    </tr>
  `).join("");

  setActiveSortButton("standings", sortKey);

  tbody.querySelectorAll(".standings-row-link").forEach(row => {
    const href = row.dataset.href;
    if (!href) return;

    row.addEventListener("click", event => {
      const link = event.target.closest("a");
      if (link) return;
      window.location.href = href;
    });

    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = href;
      }
    });
  });
}

function dashboardCardMarkup(player, sortKey, rank = null) {
  let medal = "";
  let rankClass = "dashboard-rank-default";

  if (rank === 1) {
    medal = "🥇";
    rankClass = "dashboard-rank-gold";
  } else if (rank === 2) {
    medal = "🥈";
    rankClass = "dashboard-rank-silver";
  } else if (rank === 3) {
    medal = "🥉";
    rankClass = "dashboard-rank-bronze";
  }

  return `
    <a class="player-card player-card-rich dashboard-card ${rankClass}" href="${playerUrl(player)}">
      ${medal ? `<div class="dashboard-rank-medal">${medal}</div>` : ""}
      <div class="dashboard-card-top">
        ${playerImageMarkup(player, "dashboard")}
      </div>
      <div class="dashboard-player-name dashboard-player-name-below">${displayPlayerName(player)}</div>
      <div
        class="dashboard-card-value dashboard-stat-gold ${statValueClass(player, sortKey)}"
        data-animate-count="true"
        data-target-value="${formatStatValue(player, sortKey)}"
      >${formatStatValue(player, sortKey)}</div>
    </a>
  `;
}

function renderDashboard(sortKey = DEFAULT_DASHBOARD_SORT) {
  const grid = document.getElementById("dashboard-grid");
  if (!grid || !window.siteData?.players) return;

  ensureDashboardHeadline(sortKey);

  const eligiblePlayers = window.siteData.players.filter(
    player => Number(player?.entries ?? 0) >= 2
  );

  const sorted = sortPlayers(eligiblePlayers, sortKey);

  renderDashboardStudioStrip(sortKey, sorted);

  grid.innerHTML = sorted.map((player, index) => dashboardCardMarkup(player, sortKey, index + 1)).join("");
  initAnimatedCounters(grid);
  setActiveSortButton("dashboard", sortKey);
}

function crewCardMarkup(player, data) {
  const players = data?.players || [];
  const overall = playerCardOverallRating(player, players);
  const tierMeta = playerCardTierMeta(player, players);
  const attributes = playerCardAttributes(player, players);
  const primaryArchetype = getPlayerArchetypes(player).primary;
  const specialEditions = playerCardSpecialEditions(player, data);
  const featuredEditionId = playerCardFeaturedEditionId(player, data);
  const specialEdition = playerCardSpecialEdition(player, data);
  const specialCollectionLabel = specialEditions
    .map(edition => `${edition.eyebrow}: ${edition.label}`)
    .join("; ");
  const specialClass = specialEdition
    ? ` crew-ultimate-card-special crew-ultimate-card-special-${specialEdition.className} crew-ultimate-card-edition-${playerCardEditionClassName(specialEdition)}`
    : "";

  return `
    <a
      class="crew-ultimate-card crew-ultimate-card-${tierMeta.className}${specialClass}"
      href="${playerUrl(player)}"
      data-featured-edition="${escapeHtmlAttr(featuredEditionId)}"
      ${specialEdition ? `data-special-edition="${escapeHtmlAttr(specialEdition.id)}"` : ""}
      aria-label="Open ${displayPlayerNamePlain(player)} profile. Overall rating ${overall}. ${tierMeta.status} ${tierMeta.name}. Active Crew Skin: ${specialEdition ? `${specialEdition.eyebrow}, ${specialEdition.label}` : "Base Edition"}.${specialEditions.length ? ` ${specialEditions.length} special edition${specialEditions.length === 1 ? "" : "s"} collected: ${specialCollectionLabel}.` : ""}"
    >
      <div class="crew-ultimate-card-inner">
        <div class="crew-ultimate-metal" aria-hidden="true"></div>

        <header class="crew-ultimate-header">
          <div class="crew-ultimate-rating-block">
            <span class="crew-ultimate-overall">${overall}</span>
            <span class="crew-ultimate-tier-code">${tierMeta.code}</span>
          </div>

          <div class="crew-ultimate-edition">
            <span>TLPT</span>
            <strong>CAREER</strong>
            ${specialEdition ? `
              <em title="${escapeHtmlAttr(`Active Crew Skin: ${specialEdition.eyebrow}: ${specialEdition.label} • ${specialEditions.length} collected`)}">
                ${specialEdition.icon} ${specialEdition.shortLabel}${specialEditions.length > 1 ? ` +${specialEditions.length - 1}` : ""}
              </em>
            ` : `
              <em class="is-base-featured" title="Active Crew Skin: Base Edition">♠ BASE</em>
            `}
          </div>

          <img
            class="crew-ultimate-chip"
            src="images/site/chip-T-1000.png"
            alt=""
            aria-hidden="true"
          />
        </header>

        <div class="crew-ultimate-portrait">
          ${playerImageMarkup(player, "crew")}
        </div>

        <div class="crew-ultimate-identity">
          <h3>${displayPlayerName(player)}</h3>
          <span>${primaryArchetype.emoji} ${primaryArchetype.name}</span>
        </div>

        <div class="crew-ultimate-attributes" aria-label="Player card attributes">
          ${attributes.map(attribute => `
            <div class="crew-ultimate-attribute" title="${attribute.detail}">
              <strong>${attribute.value}</strong>
              <span>${attribute.code}</span>
            </div>
          `).join("")}
        </div>

        <div class="crew-ultimate-footer" aria-hidden="true">
          <span>TLPT</span>
          <span>${tierMeta.status}</span>
        </div>
      </div>
    </a>
  `;
}

function tierSectionMarkup(title, emoji, players, data, maxTierPower = 1, options = {}) {
  if (!players.length) return "";

  const {
    className = "",
    rangeLabel: customRangeLabel = "",
    headerLabel = "",
    unranked = false
  } = options;

  const avgPower =
    players.reduce((sum, p) => sum + (Number(p.trueSkillScore) || 0), 0) /
    players.length;

  const strengthPct = Math.max(
    12,
    Math.min(100, (avgPower / Math.max(maxTierPower, 0.1)) * 100)
  );

  let rangeLabel = customRangeLabel;
  if (!rangeLabel && title === "The Apex Predators") rangeLabel = " (Top 15%)";
  else if (!rangeLabel && title === "The Table Crushers") rangeLabel = " (15–35%)";
  else if (!rangeLabel && title === "The Shot Makers") rangeLabel = " (35–60%)";
  else if (!rangeLabel && title === "The Gamblers") rangeLabel = " (60–80%)";
  else if (!rangeLabel && title === "The League Sponsors") rangeLabel = " (Bottom 20%)";

  const sectionHeaderLabel = headerLabel || `Avg Power ${fmtNum(avgPower)}`;
  
  return `
    <div class="tier-section ${className}">
      <div class="tier-section-head">
        <h3>${emoji} ${title}<span class="tier-section-range">${rangeLabel}</span></h3>
        <div class="tier-header-stats">
          ${sectionHeaderLabel}
        </div>
      </div>

      ${unranked ? "" : `<div class="tier-strength">
        <div class="tier-strength-label">Tier Strength</div>
        <div class="tier-strength-bar">
          <div class="tier-strength-fill" style="width:${strengthPct}%"></div>
        </div>
        <div class="tier-strength-pct">${Math.round(strengthPct)}%</div>
      </div>`}

      <div class="tier-grid">
        ${players.map(player => crewCardMarkup(player, data)).join("")}
      </div>
    </div>
  `;
}

function archetypeMeta(name) {
  const map = {
    "The Hitman": { emoji: "💥", className: "archetype-hitman" },
    "The Closer": { emoji: "🔒", className: "archetype-closer" },
    "The Grinder": { emoji: "⚙️", className: "archetype-grinder" },
    "The Lucky Devil": { emoji: "😈", className: "archetype-lucky-devil" },
    "The Wildcard": { emoji: "🌀", className: "archetype-wildcard" },
    "The Bubble Magnet": { emoji: "🫧", className: "archetype-bubble-magnet" },
    "The Technician": { emoji: "🧠", className: "archetype-technician" }
  };

  return map[name] || { emoji: "🧍", className: "archetype-unknown" };
}

function groupPlayersByArchetype(players, mode = "primary") {
  const groups = new Map();
  const cardRatingSort = playerCardRatingComparator(players);

  players.forEach(player => {
    const archetypes = getPlayerArchetypes(player);
    const selected = mode === "secondary" ? archetypes.secondary : archetypes.primary;
    const meta = archetypeMeta(selected.name);

    if (!groups.has(selected.name)) {
      groups.set(selected.name, {
        title: selected.name,
        emoji: meta.emoji || selected.emoji,
        className: meta.className,
        desc: selected.desc,
        players: []
      });
    } 

    groups.get(selected.name).players.push(player);
  });

  return [...groups.values()]
    .map(group => ({
      ...group,
      players: group.players.sort(cardRatingSort)
    }))
    .sort((a, b) => b.players.length - a.players.length || a.title.localeCompare(b.title));
}

function archetypeFilterMarkup(groups, activeFilter = "all", mode = "primary", explainer = "") {
  const totalPlayers = groups.reduce((sum, group) => sum + group.players.length, 0);

  return `
    <div class="archetype-visual-card">
      <div class="archetype-visual-head">
        <div class="archetype-visual-head-inline">
          <h3>🫟 Archetype Radar:</h3>
          <p class="archetype-helper-bottom">${explainer}</p>
        </div>
      </div>

      <div class="archetype-mode-toggle">
        <button
          type="button"
          class="archetype-mode-btn ${mode === "primary" ? "active" : ""}"
          data-archetype-mode="primary"
          aria-pressed="${mode === "primary" ? "true" : "false"}"
        >
          Primary
        </button>

        <label
          class="archetype-mode-switch"
          for="archetype-mode-switch-input"
          aria-label="Toggle between Primary and Secondary archetypes"
        >
          <input
            id="archetype-mode-switch-input"
            type="checkbox"
            ${mode === "secondary" ? "checked" : ""}
          />
          <span class="archetype-mode-switch-track">
            <span class="archetype-mode-switch-thumb"></span>
          </span>
        </label>

        <button
          type="button"
          class="archetype-mode-btn ${mode === "secondary" ? "active" : ""}"
          data-archetype-mode="secondary"
          aria-pressed="${mode === "secondary" ? "true" : "false"}"
        >
          Secondary
        </button>
      </div>

      <div class="archetype-filters-stack">
        <div class="archetype-filter-row">
          <button
            type="button"
            class="archetype-filter-pill ${activeFilter === "all" ? "active" : ""}"
            data-archetype-filter="all"
            aria-pressed="${activeFilter === "all" ? "true" : "false"}"
          >
            View All
            <span>${totalPlayers}</span>
          </button>

          ${groups.map(group => `
            <button
              type="button"
              class="archetype-filter-pill ${activeFilter === group.title ? "active" : ""} ${group.className}"
              data-archetype-filter="${group.title}"
              aria-pressed="${activeFilter === group.title ? "true" : "false"}"
            >
              ${group.emoji} ${group.title}
              <span>${group.players.length}</span>
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function archetypeSectionMarkup(group, data) {
  if (!group.players.length) return "";

  return `
    <div class="tier-section archetype-section ${group.className}">
      <div class="tier-section-head">
        <h3>${group.emoji} ${group.title}</h3>
        <div class="tier-header-stats">${group.players.length} player${group.players.length === 1 ? "" : "s"}</div>
      </div>

      <p class="muted archetype-section-copy">${group.desc}</p>

      <div class="tier-grid">
        ${group.players.map(player => crewCardMarkup(player, data)).join("")}
        </div>
    </div>
  `;
}

function tierDistributionMarkup(groups) {
  const maxCount = Math.max(...groups.map(group => group.players.length), 1);

  return `
    <div class="tier-distribution">
      <div class="tier-distribution-head">
        <h3>🎖️  Tier Distribution</h3>
      </div>

      <div class="tier-distribution-list">
        ${groups.map(group => {
          const count = group.players.length;
          const pct = Math.max(8, (count / maxCount) * 100);

          return `
            <div class="tier-distribution-row">
              <div class="tier-distribution-label">${group.emoji} ${group.title}</div>
              <div class="tier-distribution-bar">
                <div class="tier-distribution-fill ${group.className}" style="width:${pct}%"></div>
              </div>
              <div class="tier-distribution-count">${count}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderPlayers(data) {
  const grid = document.getElementById("players-grid");
  const visual = document.getElementById("players-visual");
  const helpCopy = document.getElementById("players-help-copy");
  const explainer = document.getElementById("players-explainer");
  const tierBtn = document.getElementById("crew-view-tier");
  const archetypeBtn = document.getElementById("crew-view-archetype");
  const crewViewSwitch = document.getElementById("crew-view-switch-input");

  if (tierBtn) {
    const isActive = currentCrewView === "tier";
    tierBtn.classList.toggle("active", isActive);
    tierBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
  if (archetypeBtn) {
    const isActive = currentCrewView === "archetype";
    archetypeBtn.classList.toggle("active", isActive);
    archetypeBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
  if (crewViewSwitch) crewViewSwitch.checked = currentCrewView === "archetype";

  if (!grid || !data?.players) return;

  const fieldPlayers = [...data.players]
    .filter(isCrewVisible)
    .sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a));

  if (currentCrewView === "archetype") {
    const archetypeGroups = groupPlayersByArchetype(fieldPlayers, currentArchetypeMode);
    const filteredGroups = currentArchetypeFilter === "all"
      ? archetypeGroups
      : archetypeGroups.filter(group => group.title === currentArchetypeFilter);

    if (helpCopy) {
      helpCopy.hidden = false;
      helpCopy.textContent = "Your primary & secondary brands of trouble.";
    }

    if (explainer) {
      explainer.hidden = true;
      explainer.textContent = "";
    }

    if (visual) {
      const archetypeExplainer = currentArchetypeMode === "primary"
        ? "Primary Archetype = Your loudest (perhaps most annoying) table style."
        : "Secondary Archetype = Your backup chaos, hiding underneath, - mostly when you're bluffing.";

      visual.innerHTML = archetypeFilterMarkup(
        archetypeGroups,
        currentArchetypeFilter,
        currentArchetypeMode,
        archetypeExplainer
      );
    }

    grid.innerHTML = filteredGroups
      .map(group => archetypeSectionMarkup(group, data))
      .join("");

    document.querySelectorAll("[data-archetype-filter]").forEach(button => {
      button.addEventListener("click", () => {
        currentArchetypeFilter = button.dataset.archetypeFilter || "all";
        renderPlayers(data);
      });
    });

    document.querySelectorAll("[data-archetype-mode]").forEach(button => {
      button.addEventListener("click", () => {
        currentArchetypeMode = button.dataset.archetypeMode || "primary";
        currentArchetypeFilter = "all";
        renderPlayers(data);
      });
    });

    const archetypeModeSwitch = document.getElementById("archetype-mode-switch-input");
    if (archetypeModeSwitch) {
      archetypeModeSwitch.checked = currentArchetypeMode === "secondary";

      archetypeModeSwitch.addEventListener("change", () => {
        currentArchetypeMode = archetypeModeSwitch.checked ? "secondary" : "primary";
        currentArchetypeFilter = "all";
        renderPlayers(data);
      });
    }

    return;
  }

  const apexPredators = [];
  const tableCrushers = [];
  const shotMakers = [];
  const gamblers = [];
  const leagueSponsors = [];
  const cardRatingSort = playerCardRatingComparator(data.players);
  const provisionalPlayers = fieldPlayers
    .filter(isCrewProvisional)
    .sort(cardRatingSort);
  const rookiePlayers = fieldPlayers
    .filter(isCrewRookie)
    .sort(cardRatingSort);
  const establishedPlayers = fieldPlayers.filter(isCrewEstablished);

  establishedPlayers.forEach(player => {
    const tier = getPlayerTier(player, establishedPlayers);

    if (tier.name === "The Apex Predator") {
      apexPredators.push(player);
    } else if (tier.name === "The Table Crusher") {
      tableCrushers.push(player);
    } else if (tier.name === "The Shot Maker") {
      shotMakers.push(player);
    } else if (tier.name === "The Gambler") {
      gamblers.push(player);
    } else {
      leagueSponsors.push(player);
    }
  });

  apexPredators.sort(cardRatingSort);
  tableCrushers.sort(cardRatingSort);
  shotMakers.sort(cardRatingSort);
  gamblers.sort(cardRatingSort);
  leagueSponsors.sort(cardRatingSort);

  const tierAveragePower = group =>
    group.length
      ? group.reduce((sum, p) => sum + (Number(p.trueSkillScore) || 0), 0) / group.length
      : 0;

  const maxTierPower = Math.max(
    tierAveragePower(apexPredators),
    tierAveragePower(tableCrushers),
    tierAveragePower(shotMakers),
    tierAveragePower(gamblers),
    tierAveragePower(leagueSponsors),
    1
  );

  const tierGroups = [
    { title: "The Apex Predators", emoji: "🦈", players: apexPredators, className: "apex-predators" },
    { title: "The Table Crushers", emoji: "⚔️", players: tableCrushers, className: "table-crushers" },
    { title: "The Shot Makers", emoji: "☄️", players: shotMakers, className: "shot-makers" },
    { title: "The Gamblers", emoji: "🎲", players: gamblers, className: "gamblers" },
    { title: "The League Sponsors", emoji: "🍣", players: leagueSponsors, className: "league-sponsors" },
    { title: "PRO — Provisional", emoji: "🧪", players: provisionalPlayers, className: "provisionals" },
    { title: "RKI — Rookie", emoji: "🌱", players: rookiePlayers, className: "rookies" }
  ];

  if (helpCopy) {
    helpCopy.textContent = "";
    helpCopy.hidden = true;
  }

  if (explainer) {
    explainer.textContent = "";
    explainer.hidden = true;
  }

  if (visual) {
    visual.innerHTML = `
      <p class="players-visual-gold-copy">Tiers sort the killers, the triers, and the occasional spreadsheet fraud.</p>
      ${tierDistributionMarkup(tierGroups)}
    `;
  }

  grid.innerHTML = `
    ${tierSectionMarkup("The Apex Predators", "🦈", apexPredators, data, maxTierPower)}
    ${tierSectionMarkup("The Table Crushers", "⚔️", tableCrushers, data, maxTierPower)}
    ${tierSectionMarkup("The Shot Makers", "☄️", shotMakers, data, maxTierPower)}
    ${tierSectionMarkup("The Gamblers", "🎲", gamblers, data, maxTierPower)}
    ${tierSectionMarkup("The League Sponsors", "🍣", leagueSponsors, data, maxTierPower)}
    ${tierSectionMarkup(
      "PRO — Provisional",
      "🧪",
      provisionalPlayers,
      data,
      maxTierPower,
      {
        className: "tier-section-provisional",
        rangeLabel: " (3–4 Appearances)",
        headerLabel: `${provisionalPlayers.length} Unranked`,
        unranked: true
      }
    )}
    ${tierSectionMarkup(
      "RKI — Rookie",
      "🌱",
      rookiePlayers,
      data,
      maxTierPower,
      {
        className: "tier-section-rookie",
        rangeLabel: " (1–2 Appearances)",
        headerLabel: `${rookiePlayers.length} In the Field`,
        unranked: true
      }
    )}
  `;
}

function clampPct(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function playerDnaMetrics(player) {
  return [
    {
      label: "Aggression",
      value: clampPct(player?.aggressionIndex),
      tone: "red"
    },
    {
      label: "Clutch",
      value: clampPct(player?.clutchIndex),
      tone: "gold"
    },
    {
      label: "Survival",
      value: clampPct(player?.survivorIndex),
      tone: "green"
    },
    {
      label: "Composure",
      value: clampPct(player?.tiltIndex),
      tone: "violet"
    },
    {
      label: "Finish Rate",
      value: clampPct(Number(player?.hitRate ?? 0) * 100),
      tone: "blue"
    },
    {
      label: "Bubble Risk",
      value: clampPct(Number(player?.bubbleRate ?? 0) * 100),
      tone: "slate"
    }
  ];
}

function playerDnaMarkup(player) {
  const metrics = playerDnaMetrics(player);

  return `
    <div class="player-dna-card">
      <div class="player-dna-head">
        <h3>🧬 Player DNA</h3>
        <p class="muted">A visual snapshot of how this player tends to win, wobble, and survive.</p>
      </div>

      <div class="player-dna-grid">
        ${metrics.map(metric => `
          <div class="player-dna-row dna-row-${metric.tone}">
            <div class="player-dna-label-wrap">
              <span class="player-dna-label">${metric.label}</span>
              <span class="player-dna-value">${Math.round(metric.value)}%</span>
            </div>
            <div class="player-dna-bar">
              <div class="player-dna-fill dna-${metric.tone}" style="width:${metric.value}%"></div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function playerCardBenchmarkPool(players) {
  const established = (players || []).filter(isCrewEstablished);

  if (established.length >= 2) return established;

  const crew = (players || []).filter(isCrewEligible);
  return crew.length >= 2 ? crew : (players || []);
}

function playerCardDisplayRating(rating) {
  const safeRating = Math.max(1, Math.min(99, Number(rating) || 0));
  return Math.round(safeRating);
}

function playerCardMetricRating(player, players, key, minRating = 40, maxRating = 96) {
  const pool = playerCardBenchmarkPool(players);
  const values = pool
    .map(item => Number(item?.[key]))
    .filter(Number.isFinite);

  if (!values.length) return playerCardDisplayRating(68);

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const value = Number(player?.[key] ?? 0);

  const normalized = maxValue === minValue
    ? 0.5
    : (value - minValue) / (maxValue - minValue);

  const bounded = Math.max(0, Math.min(1, normalized));
  const rating = minRating + (bounded * (maxRating - minRating));

  return playerCardDisplayRating(rating);
}

function playerCardTierMeta(player, players) {
  const appearances = Number(player?.buyIns ?? 0);
  const tier = getPlayerTier(player, players);
  const eligiblePlayers = (players || [])
    .filter(isCrewEstablished)
    .sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a));
  const rankIndex = eligiblePlayers.findIndex(item => item.name === player?.name);

  const tierMap = {
    "The Apex Predator": { code: "S", className: "s" },
    "The Table Crusher": { code: "A", className: "a" },
    "The Shot Maker": { code: "B", className: "b" },
    "The Gambler": { code: "C", className: "c" },
    "The League Sponsor": { code: "D", className: "d" }
  };

  const mappedTier = tierMap[tier.name] || { code: "—", className: "prospect" };

  if (appearances < CREW_PROVISIONAL_MIN_BUY_INS) {
    const appearancesToProvisional = Math.max(
      CREW_PROVISIONAL_MIN_BUY_INS - appearances,
      0
    );

    return {
      ...tier,
      code: "RKI",
      className: "rookie",
      status: "Rookie",
      statusDetail: `${appearancesToProvisional} more ${appearancesToProvisional === 1 ? "appearance" : "appearances"} for Provisional status; Power Rank begins at 5`,
      rank: null,
      totalRanked: eligiblePlayers.length
    };
  }

  if (appearances < CREW_ESTABLISHED_MIN_BUY_INS) {
    const appearancesToEstablished = CREW_ESTABLISHED_MIN_BUY_INS - appearances;

    return {
      ...tier,
      code: "PRO",
      className: "provisional",
      status: "Provisional",
      statusDetail: `${appearancesToEstablished} more ${appearancesToEstablished === 1 ? "appearance" : "appearances"} for an established rating and Power Rank`,
      rank: null,
      totalRanked: eligiblePlayers.length
    };
  }

  return {
    ...tier,
    ...mappedTier,
    status: "Established",
    statusDetail: `${appearances} career appearances`,
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    totalRanked: eligiblePlayers.length
  };
}

function playerCardOverallRating(player, players) {
  return playerCardMetricRating(
    player,
    players,
    "trueSkillScore",
    CARD_OVERALL_MIN_RATING,
    CARD_OVERALL_MAX_RATING
  );
}

const PLAYER_CARD_TIER_PRIORITY = Object.freeze({
  S: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  PRO: 5,
  RKI: 6
});

function playerCardTierPriority(player, players) {
  const tierCode = playerCardTierMeta(player, players).code;
  return PLAYER_CARD_TIER_PRIORITY[tierCode] ?? 7;
}

function playerCardRatingComparator(players) {
  return (a, b) => {
    const tierDifference =
      playerCardTierPriority(a, players) - playerCardTierPriority(b, players);

    return tierDifference ||
      playerCardOverallRating(b, players) - playerCardOverallRating(a, players) ||
      getPlayerTierScore(b) - getPlayerTierScore(a) ||
      String(a?.name || "").localeCompare(String(b?.name || ""));
  };
}

function playerCardAttributes(player, players, options = {}) {
  const periodLabel = options.periodLabel || "Career";
  const periodDescription = options.periodDescription || "career";
  const returnRating = Math.round(
    (playerCardMetricRating(player, players, "roi") * 0.65) +
    (playerCardMetricRating(player, players, "profit") * 0.35)
  );
  const appearances = Number(player?.buyIns ?? 0);
  const entries = Number(player?.entries ?? 0);
  const cashes = Number(player?.timesPlaced ?? 0);
  const hits = Number(player?.hits ?? 0);

  return [
    {
      code: "RET",
      label: "Return",
      value: returnRating,
      raw: `ROI ${fmtPct(player?.roi)} • ${periodLabel} Profit ${fmtMoney(player?.profit)}`,
      formula: `65% of the ROI rating plus 35% of the ${periodLabel} Profit rating. Both components are scaled against the comparable TLPT ${periodDescription} benchmark pool.`
    },
    {
      code: "CLT",
      label: "Clutch",
      value: playerCardMetricRating(player, players, "clutchIndex"),
      raw: `Clutch Index ${fmtNum(player?.clutchIndex)} • ${cashes} cash${cashes === 1 ? "" : "es"} in ${appearances} appearance${appearances === 1 ? "" : "s"}`,
      formula: `Clutch Index is normalized ${periodDescription} cash frequency: Times Placed ÷ Buy-ins. The result is then scaled to the card-rating range.`
    },
    {
      code: "ITM",
      label: "In the Money",
      value: playerCardMetricRating(player, players, "cashRate"),
      raw: `Cash Rate ${fmtPct(player?.cashRate)} • ${cashes} of ${appearances} appearances`,
      formula: `Cash Rate equals Times Placed ÷ Buy-ins, then scales against the comparable TLPT ${periodDescription} benchmark pool. Rebuys do not count as separate appearances.`
    },
    {
      code: "AGR",
      label: "Aggression",
      value: playerCardMetricRating(player, players, "aggressionIndex"),
      raw: `Aggression Index ${fmtNum(player?.aggressionIndex)} • ${hits} knockout${hits === 1 ? "" : "s"} in ${entries} entr${entries === 1 ? "y" : "ies"}`,
      formula: `Aggression Index normalizes ${periodDescription} knockouts per entry: Hits ÷ Entries. Entries include the initial buy-in and any rebuys.`
    },
    {
      code: "HIT",
      label: "Hit Rate",
      value: playerCardMetricRating(player, players, "hitRate"),
      raw: `Hit Rate ${fmtPct(player?.hitRate)} • ${hits} knockout${hits === 1 ? "" : "s"} in ${entries} entr${entries === 1 ? "y" : "ies"}`,
      formula: `Hit Rate equals Hits ÷ Entries, then scales against the comparable TLPT ${periodDescription} benchmark pool. Every rebuy adds another entry to the denominator.`
    },
    {
      code: "SUR",
      label: "Survival",
      value: playerCardMetricRating(player, players, "survivorIndex"),
      raw: `Survival Index ${fmtNum(player?.survivorIndex)} • Cash ${fmtPct(player?.cashRate)} • Bubble ${fmtPct(player?.bubbleRate)} • Hit ${fmtPct(player?.hitRate)}`,
      formula: `Survival starts with 55% Cash Rate, 25% Bubble Avoidance and 20% Hit Rate. That result is normalized across the TLPT ${periodDescription} benchmark pool and scaled to the card-rating range.`
    }
  ];
}

function playerCardWindowMetrics(players, windowKey) {
  return (players || [])
    .map(player => player?.cardForm?.[windowKey])
    .filter(window => Number(window?.eventCount || 0) > 0 && window?.metrics)
    .map(window => window.metrics);
}

function playerCardWindowDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${Number(match[2])}/${Number(match[3])}/${match[1].slice(2)}`;
}

function playerCardWindowRange(window) {
  const start = playerCardWindowDate(window?.startDate);
  const end = playerCardWindowDate(window?.endDate);
  if (!start && !end) return "No appearances yet";
  return start === end || !start ? (end || start) : `${start}–${end}`;
}

function playerCardMovementMeta(recentOverall, previousOverall, hasComparison) {
  if (!hasComparison) {
    return {
      label: "NEW FORM",
      className: "new",
      title: "A complete preceding five-appearance window is required for movement."
    };
  }

  const delta = recentOverall - previousOverall;
  if (delta > 0) {
    return {
      label: `▲ +${delta}`,
      className: "up",
      title: `${delta} rating point${delta === 1 ? "" : "s"} above the preceding five appearances.`
    };
  }

  if (delta < 0) {
    return {
      label: `▼ ${delta}`,
      className: "down",
      title: `${Math.abs(delta)} rating point${Math.abs(delta) === 1 ? "" : "s"} below the preceding five appearances.`
    };
  }

  return {
    label: "• 0",
    className: "flat",
    title: "Even with the preceding five appearances."
  };
}

function playerCardViewData(player, players) {
  const careerAppearances = Number(player?.buyIns ?? 0);
  const careerOverall = playerCardOverallRating(player, players);
  const career = {
    key: "career",
    edition: "CAREER",
    overall: careerOverall,
    attributes: playerCardAttributes(player, players),
    overallRaw: `Power Index ${fmtNum(player?.trueSkillScore)} • ${careerAppearances} career appearance${careerAppearances === 1 ? "" : "s"}`,
    overallFormula: `${STAT_FORMULAS.trueSkillScore}. The Power Index is scaled to a 40–99 overall card rating against established TLPT players.`,
    context: `Career • ${careerAppearances} appearance${careerAppearances === 1 ? "" : "s"}`,
    caveat: "Career view. The card tier, overall Power Rank and experience status use the full career sample.",
    movement: null
  };

  const recentWindow = player?.cardForm?.recent;
  const recentMetrics = recentWindow?.metrics;
  const recentCount = Number(recentWindow?.eventCount || 0);
  if (!recentMetrics || recentCount < 1) {
    return { career, lastFive: null };
  }

  const previousWindow = player?.cardForm?.previous;
  const previousMetrics = previousWindow?.metrics;
  const previousCount = Number(previousWindow?.eventCount || 0);
  const recentPool = playerCardWindowMetrics(players, "recent");
  const previousPool = playerCardWindowMetrics(players, "previous");
  const recentOverall = playerCardOverallRating(recentMetrics, recentPool);
  const hasComparison = recentCount === 5 && previousCount === 5 && previousMetrics;
  const previousOverall = hasComparison
    ? playerCardOverallRating(previousMetrics, previousPool)
    : null;
  const movement = playerCardMovementMeta(recentOverall, previousOverall, hasComparison);
  const recentLabel = recentCount === 5 ? "Last Five" : `Last ${recentCount}`;
  const range = playerCardWindowRange(recentWindow);

  return {
    career,
    lastFive: {
      key: "lastFive",
      edition: recentCount === 5 ? "LAST FIVE" : `LAST ${recentCount}`,
      overall: recentOverall,
      attributes: playerCardAttributes(recentMetrics, recentPool, {
        periodLabel: recentLabel,
        periodDescription: "recent-form"
      }),
      overallRaw: `Form Power Index ${fmtNum(recentMetrics?.trueSkillScore)} • ${recentCount} recent appearance${recentCount === 1 ? "" : "s"} • ${range}`,
      overallFormula: `${STAT_FORMULAS.trueSkillScore}. The form Power Index is scaled to a 40–99 rating against comparable recent TLPT samples. Movement compares this rating with the preceding five appearances.`,
      context: `${recentLabel} • ${range}`,
      caveat: `${recentLabel} view. Scores use only this player's most recent appearances; the card tier, official Power Rank and experience status remain career-based.`,
      movement
    }
  };
}

function playerCardHistoricalEventCount(data) {
  const streakCounts = Object.values(data?.streaks?.players || {})
    .map(item => Number(item?.playedEvents || 0));
  const appearanceCounts = (data?.players || [])
    .map(item => Number(item?.buyIns || 0));

  return Math.max(0, ...streakCounts, ...appearanceCounts);
}

function playerCardEditionClassName(edition) {
  return String(edition?.id || "base")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "base";
}

function playerCardEditionCatalogRecord(record) {
  const id = String(record?.id || "");
  const fixed = {
    "hall-tax-collector": {
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Tax Collector",
      cardLabel: "Tax Collector",
      shortLabel: "HALL",
      priority: 4
    },
    "hall-direct-deposit": {
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "Direct Deposit",
      cardLabel: "Direct Deposit",
      shortLabel: "HALL",
      priority: 4
    },
    "hall-billing-department": {
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Billing Department",
      cardLabel: "Billing Dept.",
      shortLabel: "HALL",
      priority: 4
    },
    "infamy-boy-in-the-bubble": {
      className: "infamy",
      icon: "🔥",
      eyebrow: "Infamy Edition",
      label: "Boy in the Bubble",
      cardLabel: "Infamy",
      shortLabel: "INFAMY",
      priority: 4
    },
    "leader-profit": {
      className: "leader",
      icon: "💰",
      eyebrow: "League Leader Edition",
      label: "Profit Leader",
      cardLabel: "Profit Leader",
      shortLabel: "LEADER",
      priority: 3
    },
    "leader-knockouts": {
      className: "leader",
      icon: "💥",
      eyebrow: "League Leader Edition",
      label: "Knockout Leader",
      cardLabel: "KO Leader",
      shortLabel: "LEADER",
      priority: 3
    },
    "leader-roi": {
      className: "leader",
      icon: "📈",
      eyebrow: "League Leader Edition",
      label: "ROI Leader",
      cardLabel: "ROI Leader",
      shortLabel: "LEADER",
      priority: 3
    },
    "leader-cash-rate": {
      className: "leader",
      icon: "🏧",
      eyebrow: "League Leader Edition",
      label: "Cash-Rate Leader",
      cardLabel: "Cash Leader",
      shortLabel: "LEADER",
      priority: 3
    }
  };

  let metadata = fixed[id] || null;

  if (!metadata && /^heater-\d+$/.test(id)) {
    const length = Number(record?.streakLength || id.split("-").pop() || 0);
    metadata = {
      className: "heater",
      icon: "🔥",
      eyebrow: "Heater Edition",
      label: `${length}-Game Cash Streak`,
      cardLabel: `${length}-Game Heater`,
      shortLabel: "HEATER",
      priority: 2
    };
  }

  if (!metadata && /^milestone-(10|25|50|75|100)$/.test(id)) {
    const milestone = Number(id.split("-").pop());
    const milestoneIcons = {
      10: "♦",
      25: "◈",
      50: "◆",
      75: "✦",
      100: "100"
    };
    metadata = {
      className: "milestone",
      icon: milestoneIcons[milestone],
      eyebrow: "Milestone Edition",
      label: `${milestone}-Appearance Club`,
      cardLabel: `${milestone} Club`,
      shortLabel: `${milestone} CLUB`,
      priority: 1
    };
  }

  return metadata ? { ...metadata, ...record, id } : null;
}

function playerCardEditionEarnedLabel(edition) {
  const earned = playerCardWindowDate(edition?.earnedDate);
  const upgraded = playerCardWindowDate(edition?.upgradedDate);

  if (earned && upgraded) return `Earned ${earned} • Upgraded ${upgraded}`;
  if (earned) return `Earned ${earned}`;
  return "";
}

function playerCardSpecialEditions(player, data) {
  const players = data?.players || [];
  if (!player || !players.length) return [];

  if (Array.isArray(player?.cardCollection)) {
    return player.cardCollection
      .map(playerCardEditionCatalogRecord)
      .filter(Boolean);
  }

  const samePlayer = candidate => candidate?.slug === player?.slug;
  const editions = [];
  const historicalEvents = playerCardHistoricalEventCount(data);
  const hallPool = players
    .filter(candidate => isHallEligible(candidate, historicalEvents))
    .map(candidate => ({
      ...candidate,
      knockoutRate: Number(candidate?.entries || 0) > 0
        ? Number(candidate?.hits || 0) / Number(candidate.entries)
        : 0
    }));

  const hallEditions = [
    {
      id: "hall-tax-collector",
      key: "profit",
      direction: "desc",
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Tax Collector",
      cardLabel: "Tax Collector",
      shortLabel: "HALL",
      reason: leader => `Highest Hall-qualified career profit at ${fmtMoney(leader?.profit)}.`
    },
    {
      id: "hall-direct-deposit",
      key: "cashRate",
      direction: "desc",
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "Direct Deposit",
      cardLabel: "Direct Deposit",
      shortLabel: "HALL",
      reason: leader => `Highest Hall-qualified career cash rate at ${fmtPct(leader?.cashRate)}.`
    },
    {
      id: "hall-billing-department",
      key: "knockoutRate",
      direction: "desc",
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Billing Department",
      cardLabel: "Billing Dept.",
      shortLabel: "HALL",
      reason: leader => `Highest Hall-qualified knockout efficiency at ${Number(leader?.knockoutRate || 0).toFixed(2)} per entry.`
    },
    {
      id: "infamy-boy-in-the-bubble",
      key: "bubbles",
      direction: "desc",
      className: "infamy",
      icon: "🔥",
      eyebrow: "Infamy Edition",
      label: "Boy in the Bubble",
      cardLabel: "Infamy",
      shortLabel: "INFAMY",
      reason: leader => `Most Hall-qualified career bubbles with ${Number(leader?.bubbles || 0)} near misses.`
    }
  ];

  for (const edition of hallEditions) {
    const leader = getLeaderByRule(hallPool, edition, hallPool);
    if (!samePlayer(leader)) continue;
    editions.push({
      ...edition,
      reason: edition.reason(leader),
      priority: 4
    });
  }

  const establishedPool = players.filter(isCrewEstablished);
  const leaderEditions = [
    {
      id: "leader-profit",
      key: "profit",
      direction: "desc",
      icon: "💰",
      label: "Profit Leader",
      cardLabel: "Profit Leader",
      shortLabel: "LEADER",
      reason: leader => `Current established-player profit leader at ${fmtMoney(leader?.profit)}.`
    },
    {
      id: "leader-knockouts",
      key: "hits",
      direction: "desc",
      icon: "💥",
      label: "Knockout Leader",
      cardLabel: "KO Leader",
      shortLabel: "LEADER",
      reason: leader => `Current established-player knockout leader with ${Number(leader?.hits || 0)} hits.`
    },
    {
      id: "leader-roi",
      key: "roi",
      direction: "desc",
      icon: "📈",
      label: "ROI Leader",
      cardLabel: "ROI Leader",
      shortLabel: "LEADER",
      reason: leader => `Current established-player ROI leader at ${fmtPct(leader?.roi)}.`
    },
    {
      id: "leader-cash-rate",
      key: "cashRate",
      direction: "desc",
      icon: "🏧",
      label: "Cash-Rate Leader",
      cardLabel: "Cash Leader",
      shortLabel: "LEADER",
      reason: leader => `Current established-player cash-rate leader at ${fmtPct(leader?.cashRate)}.`
    }
  ];

  for (const edition of leaderEditions) {
    const leader = getLeaderByRule(establishedPool, edition, establishedPool);
    if (!samePlayer(leader)) continue;
    editions.push({
      ...edition,
      className: "leader",
      eyebrow: "League Leader Edition",
      reason: edition.reason(leader),
      priority: 3
    });
  }

  const cashStreak = data?.streaks?.players?.[player.slug]?.currentCashStreak;
  const streakLength = Number(cashStreak?.length || 0);
  if (streakLength >= 2) {
    editions.push({
      id: `heater-${streakLength}`,
      className: "heater",
      icon: "🔥",
      eyebrow: "Heater Edition",
      label: `${streakLength}-Game Cash Streak`,
      cardLabel: `${streakLength}-Game Heater`,
      shortLabel: "HEATER",
      reason: `Active ${streakLength}-appearance cash streak from ${playerCardWindowDate(cashStreak?.startDate)} through ${playerCardWindowDate(cashStreak?.endDate)}.`,
      priority: 2
    });
  }

  const appearances = Number(player?.buyIns || 0);
  const milestoneIcons = {
    10: "♦",
    25: "◈",
    50: "◆",
    75: "✦",
    100: "100"
  };
  [100, 75, 50, 25, 10].forEach(milestone => {
    if (appearances < milestone) return;
    editions.push({
      id: `milestone-${milestone}`,
      className: "milestone",
      icon: milestoneIcons[milestone],
      eyebrow: "Milestone Edition",
      label: `${milestone}-Appearance Club`,
      cardLabel: `${milestone} Club`,
      shortLabel: `${milestone} CLUB`,
      reason: `${appearances} career tournament appearances and counting.`,
      priority: 1
    });
  });

  return editions;
}

function playerCardSpecialEdition(player, data) {
  const editions = playerCardSpecialEditions(player, data);
  const featuredId = playerCardFeaturedEditionId(player, data);
  return editions.find(edition => edition.id === featuredId) || null;
}

function playerCardFeaturedEditionId(player, data) {
  const editions = playerCardSpecialEditions(player, data);
  return editions[0]?.id || "base";
}

function playerCardComparisonCandidates(player, players) {
  const currentTier = playerCardTierMeta(player, players);
  const currentRating = playerCardOverallRating(player, players);

  return (players || [])
    .filter(candidate => candidate?.slug !== player?.slug)
    .sort((a, b) => {
      const aTier = playerCardTierMeta(a, players);
      const bTier = playerCardTierMeta(b, players);
      const aSameStatus = aTier.status === currentTier.status ? 0 : 1;
      const bSameStatus = bTier.status === currentTier.status ? 0 : 1;
      const aDistance = Math.abs(playerCardOverallRating(a, players) - currentRating);
      const bDistance = Math.abs(playerCardOverallRating(b, players) - currentRating);

      return aSameStatus - bSameStatus ||
        aDistance - bDistance ||
        playerCardRatingComparator(players)(a, b);
    });
}

function playerCardComparisonDelta(value, opposingValue) {
  const delta = Math.round(Number(value || 0) - Number(opposingValue || 0));

  if (delta > 0) {
    return {
      value: delta,
      label: `+${delta}`,
      className: "ahead",
      description: `${delta} point${delta === 1 ? "" : "s"} higher`
    };
  }

  if (delta < 0) {
    return {
      value: delta,
      label: String(delta),
      className: "behind",
      description: `${Math.abs(delta)} point${Math.abs(delta) === 1 ? "" : "s"} lower`
    };
  }

  return {
    value: 0,
    label: "EVEN",
    className: "even",
    description: "even"
  };
}

function playerCardComparisonCardMarkup(player, view, opposingView, players, data, sideLabel) {
  const tierMeta = playerCardTierMeta(player, players);
  const archetype = getPlayerArchetypes(player).primary;
  const specialEdition = playerCardSpecialEdition(player, data);
  const specialClass = specialEdition
    ? ` tlpt-compare-card-special tlpt-compare-card-special-${specialEdition.className} tlpt-compare-card-edition-${playerCardEditionClassName(specialEdition)}`
    : "";
  const opposingAttributes = Object.fromEntries(
    opposingView.attributes.map(attribute => [attribute.code, attribute])
  );
  const overallDelta = playerCardComparisonDelta(view.overall, opposingView.overall);
  const rankText = tierMeta.rank
    ? `Power Rank #${tierMeta.rank} of ${tierMeta.totalRanked}`
    : `${tierMeta.status} • Unranked`;

  return `
    <article
      class="tlpt-compare-card tlpt-player-card-${tierMeta.className}${specialClass}"
      data-compare-card-side="${sideLabel}"
      ${specialEdition ? `data-special-edition="${escapeHtmlAttr(specialEdition.id)}"` : ""}
      aria-label="${escapeHtmlAttr(displayPlayerNamePlain(player))}, ${view.edition} rating ${view.overall}. ${overallDelta.description} than the opposing player.${specialEdition ? ` ${specialEdition.eyebrow}: ${specialEdition.label}.` : ""}"
    >
      <div class="tlpt-compare-card-inner">
        <header class="tlpt-compare-card-head">
          <div class="tlpt-compare-overall">
            <strong>${view.overall}</strong>
            <span>${tierMeta.code}</span>
            <em class="is-${overallDelta.className}" title="${escapeHtmlAttr(overallDelta.description)} versus the opposing player">${overallDelta.label}</em>
          </div>
          <div class="tlpt-compare-edition">
            <span>TLPT</span>
            <strong>${specialEdition?.cardLabel || view.edition}</strong>
            ${specialEdition ? `<small>${view.edition}</small>` : ""}
          </div>
          <img class="tlpt-compare-crest" src="images/site/chip-T-1000.png" alt="" aria-hidden="true" />
        </header>

        <div class="tlpt-compare-portrait">
          ${playerImageMarkup(player, "profile")}
        </div>

        <div class="tlpt-compare-identity">
          <h3>${displayPlayerName(player)}</h3>
          <span>${archetype.emoji} ${archetype.name}</span>
        </div>

        ${specialEdition ? `
          <div class="tlpt-compare-special-tag" title="${escapeHtmlAttr(specialEdition.reason)}">
            <span>${specialEdition.icon}</span>
            <strong>${specialEdition.eyebrow}</strong>
            <small>${specialEdition.label}</small>
          </div>
        ` : `
          <div class="tlpt-compare-special-tag is-empty" aria-hidden="true">
            <span>♦</span>
            <strong>Standard Edition</strong>
            <small>Career Card</small>
          </div>
        `}

        <div class="tlpt-compare-attributes" aria-label="Card attribute comparison">
          ${view.attributes.map(attribute => {
            const opposingAttribute = opposingAttributes[attribute.code];
            const delta = playerCardComparisonDelta(attribute.value, opposingAttribute?.value);
            return `
              <div class="tlpt-compare-attribute">
                <div>
                  <strong>${attribute.value}</strong>
                  <span>${attribute.code}</span>
                </div>
                <small>${attribute.label}</small>
                <em
                  class="is-${delta.className}"
                  title="${escapeHtmlAttr(`${attribute.label}: ${delta.description} than the opposing player`)}"
                >${delta.label}</em>
              </div>
            `;
          }).join("")}
        </div>

        <div class="tlpt-compare-card-context">
          <span>${view.context}</span>
          <strong>${rankText}</strong>
        </div>

        <a class="tlpt-compare-profile-link" href="${playerUrl(player)}">
          View ${escapeHtmlAttr(displayPlayerNamePlain(player))}'s Profile →
        </a>
      </div>
    </article>
  `;
}

function playerCardComparisonMarkup(player, players, data) {
  const candidates = playerCardComparisonCandidates(player, players);
  const opponent = candidates[0];
  if (!opponent) return "";

  const playerViews = playerCardViewData(player, players);
  const opponentViews = playerCardViewData(opponent, players);
  const playerView = playerViews.career;
  const opponentView = opponentViews.career;

  return `
    <section
      id="tlpt-card-comparison"
      class="tlpt-card-compare-overlay"
      data-card-compare-overlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="tlpt-card-comparison-title"
      hidden
    >
      <div class="tlpt-card-compare-dialog">
        <header class="tlpt-card-compare-dialog-head">
          <div>
            <span>TLPT Tale of the Tape</span>
            <h2 id="tlpt-card-comparison-title">Head-to-Head Card Comparison</h2>
          </div>
          <button type="button" data-card-compare-close aria-label="Close player comparison">×</button>
        </header>

        <div class="tlpt-card-compare-controls">
          <label>
            <span>Compare ${escapeHtmlAttr(displayPlayerNamePlain(player))} with</span>
            <select data-card-compare-player>
              ${candidates.map(candidate => {
                const tierMeta = playerCardTierMeta(candidate, players);
                const rating = playerCardOverallRating(candidate, players);
                return `<option value="${escapeHtmlAttr(candidate.slug)}">${escapeHtmlAttr(displayPlayerNamePlain(candidate))} — ${tierMeta.code} • ${rating}</option>`;
              }).join("")}
            </select>
          </label>

          <div class="tlpt-card-compare-period" role="group" aria-label="Comparison time period">
            <button type="button" class="is-active" data-compare-view-control="career" aria-pressed="true">Career</button>
            <button type="button" data-compare-view-control="lastFive" aria-pressed="false">Last Five</button>
          </div>
        </div>

        <p class="tlpt-card-compare-note">
          Both cards use the same period. Green and red markers show the rating-point advantage for that side; official rank and tier remain career-based.
        </p>

        <div class="tlpt-card-compare-arena" data-card-compare-cards aria-live="polite">
          ${playerCardComparisonCardMarkup(player, playerView, opponentView, players, data, "primary")}
          <div class="tlpt-card-compare-versus" aria-hidden="true">VS</div>
          ${playerCardComparisonCardMarkup(opponent, opponentView, playerView, players, data, "opponent")}
        </div>
      </div>
    </section>
  `;
}

function wirePlayerCardComparison(scope, player, players, data) {
  const overlay = scope.querySelector("[data-card-compare-overlay]");
  const openButton = scope.querySelector("[data-card-compare-open]");
  const closeButton = overlay?.querySelector("[data-card-compare-close]");
  const select = overlay?.querySelector("[data-card-compare-player]");
  const cards = overlay?.querySelector("[data-card-compare-cards]");

  if (!overlay || !openButton || !closeButton || !select || !cards) return null;

  const candidates = playerCardComparisonCandidates(player, players);
  const playerViews = playerCardViewData(player, players);
  let viewKey = "career";
  let lastFocused = null;

  const selectedOpponent = () =>
    candidates.find(candidate => candidate.slug === select.value) || candidates[0];

  const render = () => {
    const opponent = selectedOpponent();
    if (!opponent) return;

    const opponentViews = playerCardViewData(opponent, players);
    const playerView = playerViews[viewKey] || playerViews.career;
    const opponentView = opponentViews[viewKey] || opponentViews.career;

    overlay.querySelectorAll("[data-compare-view-control]").forEach(button => {
      const isActive = button.dataset.compareViewControl === viewKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    cards.innerHTML = `
      ${playerCardComparisonCardMarkup(player, playerView, opponentView, players, data, "primary")}
      <div class="tlpt-card-compare-versus" aria-hidden="true">VS</div>
      ${playerCardComparisonCardMarkup(opponent, opponentView, playerView, players, data, "opponent")}
    `;
  };

  const setView = nextViewKey => {
    if (!playerViews[nextViewKey]) return;
    viewKey = nextViewKey;
    render();
  };

  const open = () => {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    openButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("tlpt-compare-open");
    render();
    select.focus({ preventScroll: true });
  };

  const close = () => {
    overlay.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("tlpt-compare-open");
    if (lastFocused?.focus) lastFocused.focus({ preventScroll: true });
  };

  openButton.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  select.addEventListener("change", render);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });

  overlay.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = [...overlay.querySelectorAll("button:not(:disabled), select, a[href]")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  overlay.querySelectorAll("[data-compare-view-control]").forEach(button => {
    button.addEventListener("click", () => {
      const nextViewKey = button.dataset.compareViewControl;
      const mainViewButton = scope.querySelector(`[data-card-view-control="${nextViewKey}"]`);
      if (mainViewButton && !mainViewButton.disabled) {
        mainViewButton.click();
      } else {
        setView(nextViewKey);
      }
    });
  });

  render();
  return { setView };
}

function playerCardExperienceMeta(player, tierMeta) {
  const appearances = Number(player?.buyIns ?? 0);

  if (appearances < CREW_PROVISIONAL_MIN_BUY_INS) {
    const target = CREW_PROVISIONAL_MIN_BUY_INS;
    return {
      className: "rookie",
      eyebrow: "RKI Sample Status",
      progressNow: appearances,
      progressMax: target,
      progressLabel: `${appearances} of ${target} appearances to PRO`,
      milestone: `${target - appearances} more ${target - appearances === 1 ? "appearance" : "appearances"} to unlock Provisional status`,
      caveat: "Ratings reflect actual career results. RKI identifies a limited sample and remains unranked until five appearances."
    };
  }

  if (appearances < CREW_ESTABLISHED_MIN_BUY_INS) {
    const target = CREW_ESTABLISHED_MIN_BUY_INS;
    return {
      className: "provisional",
      eyebrow: "PRO Sample Status",
      progressNow: appearances,
      progressMax: target,
      progressLabel: `${appearances} of ${target} appearances to Established`,
      milestone: `${target - appearances} more ${target - appearances === 1 ? "appearance" : "appearances"} to unlock Power Rank and an S–D tier`,
      caveat: "Ratings reflect actual career results. PRO identifies a developing sample and does not receive an official Power Rank."
    };
  }

  return {
    className: "established",
    eyebrow: "Established Sample",
    progressNow: CREW_ESTABLISHED_MIN_BUY_INS,
    progressMax: CREW_ESTABLISHED_MIN_BUY_INS,
    progressLabel: `${appearances} career appearances`,
    milestone: tierMeta.rank
      ? `Official Power Rank #${tierMeta.rank} of ${tierMeta.totalRanked}`
      : "Eligible for official Power Rank and S–D tiers",
    caveat: "Ratings reflect actual career results and compare this player with the established TLPT benchmark pool."
  };
}

function playerCardMarkup(player, players, primaryArchetype, tierMeta, cardViews, specialEdition) {
  const careerView = cardViews?.career || playerCardViewData(player, players).career;
  const hasLastFive = Boolean(cardViews?.lastFive);
  const overall = careerView.overall;
  const attributes = careerView.attributes;
  const experience = playerCardExperienceMeta(player, tierMeta);
  const overallRaw = careerView.overallRaw;
  const overallFormula = careerView.overallFormula;
  const specialClass = specialEdition
    ? ` tlpt-player-card-special tlpt-player-card-special-${specialEdition.className} tlpt-player-card-edition-${playerCardEditionClassName(specialEdition)}`
    : "";
  const progressPct = Math.max(
    0,
    Math.min(100, (experience.progressNow / Math.max(experience.progressMax, 1)) * 100)
  );

  return `
    <div class="tlpt-card-stage">
      <div class="tlpt-card-view-bar">
        <div class="tlpt-card-view-actions">
          <div class="tlpt-card-view-switch" role="group" aria-label="Player card time period">
            <button
              type="button"
              class="is-active"
              data-card-view-control="career"
              aria-pressed="true"
            >Career</button>
            <button
              type="button"
              data-card-view-control="lastFive"
              aria-pressed="false"
              ${hasLastFive ? "" : "disabled"}
            >Last Five</button>
          </div>
          <button
            type="button"
            class="tlpt-card-compare-open"
            data-card-compare-open
            aria-controls="tlpt-card-comparison"
            aria-expanded="false"
          >Compare Player</button>
        </div>
        <p data-card-view-context>${careerView.context}</p>
      </div>

      <svg class="tlpt-card-shape-defs" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="tlpt-player-card-shape" clipPathUnits="objectBoundingBox">
            <path d="M .13,.055 C .23,.014 .36,0 .5,0 C .64,0 .77,.014 .87,.055 C .875,.094 .92,.127 1,.14 L 1,.855 C 1,.905 .91,.934 .79,.957 C .67,.98 .56,.993 .5,1 C .44,.993 .33,.98 .21,.957 C .09,.934 0,.905 0,.855 L 0,.14 C .08,.127 .125,.094 .13,.055 Z"></path>
          </clipPath>
        </defs>
      </svg>

      <article
        class="tlpt-player-card tlpt-player-card-${tierMeta.className}${specialClass}"
        data-player-card
        data-card-player-name="${escapeHtmlAttr(displayPlayerNamePlain(player))}"
        data-card-edition-aria="${specialEdition ? escapeHtmlAttr(` ${specialEdition.eyebrow}: ${specialEdition.label}. ${specialEdition.reason}`) : ""}"
        ${specialEdition ? `data-special-edition="${escapeHtmlAttr(specialEdition.id)}"` : ""}
        aria-label="${displayPlayerNamePlain(player)} career player card. Overall rating ${overall}.${specialEdition ? ` ${specialEdition.eyebrow}: ${specialEdition.label}. ${specialEdition.reason}` : ""}"
      >
        <div class="tlpt-player-card-inner">
          <div class="tlpt-player-card-pattern" aria-hidden="true"></div>

          <header class="tlpt-card-header">
            <button
              type="button"
              class="tlpt-card-rating-block is-active"
              data-card-rating-control
              data-rating-title="OVR — Overall"
              data-rating-value="${overall}"
              data-rating-raw="${escapeHtmlAttr(overallRaw)}"
              data-rating-formula="${escapeHtmlAttr(overallFormula)}"
              aria-controls="tlpt-card-rating-explainer"
              aria-pressed="true"
              title="Explain the Overall rating"
            >
              <span class="tlpt-card-overall" data-card-overall>${overall}</span>
              <span class="tlpt-card-tier-code">${tierMeta.code}</span>
            </button>

            <div class="tlpt-card-edition">
              <span>TLPT</span>
              <strong data-card-edition-label>${specialEdition?.cardLabel || "Base Card"}</strong>
              <small data-card-edition>${careerView.edition}</small>
              <em data-card-movement hidden></em>
            </div>

            <div class="tlpt-card-crest-wrap">
              <img
                class="tlpt-card-crest"
                src="images/site/chip-T-1000.png"
                alt=""
                aria-hidden="true"
              />
            </div>
          </header>

          <div class="tlpt-card-portrait">
            ${playerImageMarkup(player, "profile")}
          </div>

          <div class="tlpt-card-identity">
            <h2>${displayPlayerName(player)}</h2>
            <div class="tlpt-card-archetype">${primaryArchetype.emoji} ${primaryArchetype.name}</div>
          </div>

          <div class="tlpt-card-attributes" aria-label="Player card attributes">
            ${attributes.map(attribute => `
              <button
                type="button"
                class="tlpt-card-attribute"
                data-card-rating-control
                data-card-attribute-code="${attribute.code}"
                data-rating-title="${escapeHtmlAttr(`${attribute.code} — ${attribute.label}`)}"
                data-rating-value="${attribute.value}"
                data-rating-raw="${escapeHtmlAttr(attribute.raw)}"
                data-rating-formula="${escapeHtmlAttr(attribute.formula)}"
                aria-controls="tlpt-card-rating-explainer"
                aria-pressed="false"
                title="Explain ${escapeHtmlAttr(attribute.label)}"
              >
                <strong>${attribute.value}</strong>
                <span>${attribute.code}</span>
                <small>${attribute.label}</small>
              </button>
            `).join("")}
          </div>

          <div class="tlpt-card-footer-mark" aria-hidden="true">
            <span>♠</span><span>♥</span><span>♣</span><span>♦</span>
          </div>
        </div>
      </article>

      <div
        class="tlpt-card-special-banner${specialEdition ? ` tlpt-card-special-banner-${specialEdition.className} tlpt-card-special-banner-edition-${playerCardEditionClassName(specialEdition)}` : ""}"
        data-card-special-banner
        ${specialEdition ? "" : "hidden"}
      >
          <span data-card-special-icon aria-hidden="true">${specialEdition?.icon || "♦"}</span>
          <div>
            <strong data-card-special-eyebrow>${specialEdition?.eyebrow || "Special Edition"}</strong>
            <b data-card-special-label>${specialEdition?.label || "Career Card"}</b>
            <small data-card-special-reason>${specialEdition?.reason || ""}</small>
            <em
              data-card-special-earned
              ${playerCardEditionEarnedLabel(specialEdition) ? "" : "hidden"}
            >${playerCardEditionEarnedLabel(specialEdition) ? `Historic Collectible • ${playerCardEditionEarnedLabel(specialEdition)}` : ""}</em>
          </div>
      </div>

      <section class="tlpt-card-experience tlpt-card-experience-${experience.className}" aria-label="Card experience status">
        <div class="tlpt-card-experience-head">
          <span>${experience.eyebrow}</span>
          <strong>${experience.progressLabel}</strong>
        </div>
        <div
          class="tlpt-card-experience-track"
          role="progressbar"
          aria-label="${escapeHtmlAttr(experience.progressLabel)}"
          aria-valuemin="0"
          aria-valuemax="${experience.progressMax}"
          aria-valuenow="${experience.progressNow}"
        >
          <span style="width:${progressPct}%"></span>
        </div>
        <p>${experience.milestone}</p>
        <small
          data-card-experience-caveat
          data-experience-base="${escapeHtmlAttr(experience.caveat)}"
        >${experience.caveat} ${careerView.caveat}</small>
      </section>

      <section
        id="tlpt-card-rating-explainer"
        class="tlpt-card-rating-explainer"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="tlpt-card-rating-explainer-head">
          <span>Rating Breakdown</span>
          <strong data-card-rating-title>OVR — Overall</strong>
          <b data-card-rating-value>${overall}</b>
        </div>
        <p data-card-rating-raw>${overallRaw}</p>
        <small data-card-rating-formula>${overallFormula}</small>
        <em>Choose the overall score or any attribute on the card to see its live calculation.</em>
      </section>
    </div>
  `;
}

function playerCardCollectibleMarkup(
  player,
  players,
  edition,
  isSelected = false,
  isFeatured = false
) {
  const liveTierMeta = playerCardTierMeta(player, players);
  const snapshot = edition?.snapshot || null;
  const tierMeta = snapshot
    ? {
        ...liveTierMeta,
        code: snapshot.tierCode || liveTierMeta.code,
        className: snapshot.tierClassName || liveTierMeta.className,
        status: snapshot.tierStatus || liveTierMeta.status
      }
    : liveTierMeta;
  const overall = snapshot?.overall ?? playerCardOverallRating(player, players);
  const attributes = snapshot?.attributes || playerCardAttributes(player, players);
  const collectible = edition || {
    id: "base",
    className: "base",
    icon: "♠",
    eyebrow: "Base Edition",
    label: "Original Career Card",
    cardLabel: "Base Card",
    shortLabel: "BASE",
    reason: "The original career card using the player's official tier finish."
  };
  const specialClass = edition
    ? ` tlpt-player-card-special tlpt-player-card-special-${edition.className} tlpt-player-card-edition-${playerCardEditionClassName(edition)}`
    : "";
  const earnedLabel = playerCardEditionEarnedLabel(edition);

  return `
    <button
      type="button"
      class="tlpt-card-collectible-button tlpt-player-card-${tierMeta.className}${specialClass}${isSelected ? " is-selected" : ""}${isFeatured ? " is-featured" : ""}"
      data-card-edition-select="${escapeHtmlAttr(collectible.id)}"
      data-card-featured-on-crew="${isFeatured ? "true" : "false"}"
      aria-pressed="${isSelected ? "true" : "false"}"
      aria-label="View ${escapeHtmlAttr(collectible.eyebrow)}, ${escapeHtmlAttr(collectible.label)}. ${earnedLabel ? `${escapeHtmlAttr(earnedLabel)}. ` : ""}${escapeHtmlAttr(collectible.reason)}"
      title="${escapeHtmlAttr(collectible.reason)}"
    >
      <span class="tlpt-card-collectible-frame" aria-hidden="true">
        <span class="tlpt-card-collectible-inner">
          <span class="tlpt-card-collectible-pattern"></span>

          <span class="tlpt-card-collectible-head">
            <span class="tlpt-card-collectible-rating">
              <strong>${overall}</strong>
              <small>${tierMeta.code}</small>
            </span>
            <span class="tlpt-card-collectible-edition">
              <small>TLPT</small>
              <strong>${collectible.shortLabel}</strong>
            </span>
            <img src="images/site/chip-T-1000.png" alt="" />
          </span>

          <span class="tlpt-card-collectible-portrait">
            ${playerImageMarkup(player, "profile")}
          </span>

          <span class="tlpt-card-collectible-name">${displayPlayerName(player)}</span>

          <span class="tlpt-card-collectible-stats">
            ${attributes.map(attribute => `
              <span><strong>${attribute.value}</strong><small>${attribute.code}</small></span>
            `).join("")}
          </span>

          <span class="tlpt-card-collectible-stamp">
            <b>${collectible.icon}</b>
            <strong>${collectible.label}</strong>
          </span>
        </span>
      </span>

      <span class="tlpt-card-collectible-caption">
        <strong>${collectible.eyebrow}</strong>
        <small>${collectible.label}</small>
        ${earnedLabel ? `<em>${earnedLabel}</em>` : ""}
      </span>
      <span class="tlpt-card-collectible-selected">Viewing</span>
      ${isFeatured ? `<span class="tlpt-card-collectible-featured" title="Automatically selected as this player's highest-priority earned Crew skin">Active Crew Skin</span>` : ""}
    </button>
  `;
}

function playerCardCollectionMarkup(player, players, editions, featuredId = "base") {
  const collected = editions || [];
  const featuredEdition = collected.find(edition => edition.id === featuredId) || null;
  const cards = [null, ...collected]
    .map(edition => playerCardCollectibleMarkup(
      player,
      players,
      edition,
      (edition?.id || "base") === featuredId,
      (edition?.id || "base") === featuredId
    ))
    .join("");

  return `
    <section class="tlpt-card-collection" aria-labelledby="tlpt-card-collection-title">
      <header class="tlpt-card-collection-head">
        <div>
          <span>Collectible Career Set</span>
          <h2 id="tlpt-card-collection-title">Ultimate Card Editions</h2>
          <p>Every earned finish stays in the collection with its original date and frozen ratings. The highest-priority earned edition becomes the Active Crew Skin automatically; select any card here to preview it above.</p>
        </div>
        <strong>${collected.length} Special Edition${collected.length === 1 ? "" : "s"} Collected</strong>
      </header>

      <div class="tlpt-card-collection-grid">
        ${cards}
      </div>

      <p class="tlpt-card-collection-status" data-card-collection-status aria-live="polite">
        ${featuredEdition
          ? `Viewing ${featuredEdition.eyebrow}: ${featuredEdition.label}. Active Crew Skin.`
          : `Viewing the Base Edition. Active Crew Skin.${collected.length ? " Select any collectible to preview its frozen historic ratings." : " Special editions unlock automatically as achievements are earned."}`}
      </p>
    </section>
  `;
}

function wirePlayerCardEditionCollection(
  scope,
  player,
  editions,
  ratingController = null,
  initialEditionId = "base"
) {
  const card = scope.querySelector("[data-player-card]");
  const banner = scope.querySelector("[data-card-special-banner]");
  const buttons = [...scope.querySelectorAll("[data-card-edition-select]")];
  if (!card || !banner || !buttons.length) return;

  const collection = editions || [];
  const specialClasses = ["hall", "infamy", "leader", "heater", "milestone"]
    .map(className => `tlpt-player-card-special-${className}`);
  const status = scope.querySelector("[data-card-collection-status]");
  const activeCrewSkinId = initialEditionId;
  const activeCrewEdition = collection.find(edition => edition.id === activeCrewSkinId) || null;
  const activeCrewSkinLabel = activeCrewEdition
    ? `${activeCrewEdition.eyebrow}: ${activeCrewEdition.label}`
    : "Base Edition";
  const cardEditionLabel = card.querySelector("[data-card-edition-label]");
  const icon = banner.querySelector("[data-card-special-icon]");
  const eyebrow = banner.querySelector("[data-card-special-eyebrow]");
  const label = banner.querySelector("[data-card-special-label]");
  const reason = banner.querySelector("[data-card-special-reason]");
  const earned = banner.querySelector("[data-card-special-earned]");
  const overallControl = scope.querySelector(".tlpt-card-rating-block[data-card-rating-control]");
  const overall = scope.querySelector("[data-card-overall]");
  const tierCode = scope.querySelector(".tlpt-card-tier-code");
  const liveTierCode = tierCode?.textContent || "—";
  const editionPeriod = scope.querySelector("[data-card-edition]");
  const movement = scope.querySelector("[data-card-movement]");
  const context = scope.querySelector("[data-card-view-context]");
  const caveat = scope.querySelector("[data-card-experience-caveat]");
  card.dataset.liveCardView = card.dataset.cardView || "career";

  const applyHistoricSnapshot = edition => {
    const snapshot = edition?.snapshot;
    if (!snapshot) return false;

    const earnedLabel = playerCardEditionEarnedLabel(edition);
    const snapshotDate = playerCardWindowDate(
      edition?.upgradedDate || edition?.earnedDate
    );
    const snapshotEvent = edition?.upgradeEvent || edition?.earnedEvent || "historical event";
    const historicRaw = `Frozen collectible snapshot from ${snapshotEvent}${snapshotDate ? ` on ${snapshotDate}` : ""}.`;
    const historicFormula = "Historic edition values are frozen at issuance or upgrade and do not recalculate with later results.";

    card.dataset.historicEdition = edition.id;
    card.dataset.cardView = "historic";
    if (overall) overall.textContent = snapshot.overall;
    if (tierCode) tierCode.textContent = snapshot.tierCode || "—";
    if (editionPeriod) editionPeriod.textContent = "HISTORIC";
    if (context) {
      context.textContent = `${edition.eyebrow}${earnedLabel ? ` • ${earnedLabel}` : ""}`;
    }
    if (caveat) {
      caveat.textContent = `${historicFormula} The Base Edition remains the live career card.`;
    }
    if (movement) {
      movement.hidden = true;
      movement.textContent = "";
      movement.removeAttribute("title");
    }

    scope.querySelectorAll("[data-card-view-control]").forEach(button => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });

    if (overallControl) {
      overallControl.dataset.ratingValue = snapshot.overall;
      overallControl.dataset.ratingRaw = historicRaw;
      overallControl.dataset.ratingFormula = historicFormula;
    }

    (snapshot.attributes || []).forEach(attribute => {
      const control = scope.querySelector(`[data-card-attribute-code="${attribute.code}"]`);
      if (!control) return;
      control.dataset.ratingValue = attribute.value;
      control.dataset.ratingRaw = `${attribute.code} was rated ${attribute.value}. ${historicRaw}`;
      control.dataset.ratingFormula = historicFormula;
      const displayedValue = control.querySelector("strong");
      if (displayedValue) displayedValue.textContent = attribute.value;
    });

    if (overallControl) overallControl.click();
    return true;
  };

  const applyEdition = (editionId, options = {}) => {
    const edition = collection.find(item => item.id === editionId) || null;

    card.classList.remove("tlpt-player-card-special", ...specialClasses);
    [...card.classList]
      .filter(className => className.startsWith("tlpt-player-card-edition-"))
      .forEach(className => card.classList.remove(className));
    delete card.dataset.specialEdition;
    delete card.dataset.historicEdition;
    card.dataset.cardEditionAria = "";

    [...banner.classList]
      .filter(className => (
        className.startsWith("tlpt-card-special-banner-")
        && className !== "tlpt-card-special-banner"
      ))
      .forEach(className => banner.classList.remove(className));

    if (edition) {
      card.classList.add(
        "tlpt-player-card-special",
        `tlpt-player-card-special-${edition.className}`,
        `tlpt-player-card-edition-${playerCardEditionClassName(edition)}`
      );
      card.dataset.specialEdition = edition.id;
      card.dataset.cardEditionAria = ` ${edition.eyebrow}: ${edition.label}. ${edition.reason}`;
      banner.classList.add(`tlpt-card-special-banner-${edition.className}`);
      banner.classList.add(`tlpt-card-special-banner-edition-${playerCardEditionClassName(edition)}`);
      banner.hidden = false;
      if (cardEditionLabel) cardEditionLabel.textContent = edition.cardLabel || edition.label;
      if (icon) icon.textContent = edition.icon;
      if (eyebrow) eyebrow.textContent = edition.eyebrow;
      if (label) label.textContent = edition.label;
      if (reason) reason.textContent = edition.reason;
      const earnedLabel = playerCardEditionEarnedLabel(edition);
      if (earned) {
        earned.hidden = !earnedLabel;
        earned.textContent = earnedLabel ? `Historic Collectible • ${earnedLabel}` : "";
      }
      if (status) {
        const activeCrewSuffix = edition.id === activeCrewSkinId
          ? " Active Crew Skin."
          : ` Active Crew Skin: ${activeCrewSkinLabel}.`;
        status.textContent = `Viewing ${edition.eyebrow}: ${edition.label}.${earnedLabel ? ` ${earnedLabel}.` : ""}${activeCrewSuffix}`;
      }
    } else {
      banner.hidden = true;
      if (cardEditionLabel) cardEditionLabel.textContent = "Base Card";
      if (status) {
        status.textContent = activeCrewSkinId === "base"
          ? "Viewing the Base Edition. Active Crew Skin."
          : `Viewing the Base Edition. Active Crew Skin: ${activeCrewSkinLabel}.`;
      }
      if (earned) {
        earned.hidden = true;
        earned.textContent = "";
      }
    }

    buttons.forEach(button => {
      const isSelected = button.dataset.cardEditionSelect === (edition?.id || "base");
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });

    const isHistoric = applyHistoricSnapshot(edition);
    if (!isHistoric && tierCode) tierCode.textContent = liveTierCode;
    if (!isHistoric && options.restoreView !== false) {
      ratingController?.applyView(card.dataset.liveCardView || "career");
    }

    const viewLabel = isHistoric
      ? "historic collectible"
      : (card.dataset.cardView === "lastFive" ? "last five" : "career");
    const overallValue = scope.querySelector("[data-card-overall]")?.textContent || "";
    card.setAttribute(
      "aria-label",
      `${displayPlayerNamePlain(player)} ${viewLabel} player card. Overall rating ${overallValue}.${card.dataset.cardEditionAria}`
    );
    card.classList.remove("is-edition-changing");
    void card.offsetWidth;
    card.classList.add("is-edition-changing");
  };

  buttons.forEach(button => {
    button.addEventListener("click", () => applyEdition(button.dataset.cardEditionSelect));
  });

  scope.querySelectorAll("[data-card-view-control]").forEach(button => {
    button.addEventListener("click", () => {
      card.dataset.liveCardView = button.dataset.cardViewControl || "career";
      applyEdition("base", { restoreView: false });
    });
  });

  const validInitialEdition = initialEditionId === "base"
    || collection.some(edition => edition.id === initialEditionId);
  applyEdition(validInitialEdition ? initialEditionId : (collection[0]?.id || "base"));
}

function wirePlayerCardRatingControls(scope, cardViews, onViewChange) {
  const controls = [...scope.querySelectorAll("[data-card-rating-control]")];
  const explainer = scope.querySelector("#tlpt-card-rating-explainer");
  if (!controls.length || !explainer) return;

  const title = explainer.querySelector("[data-card-rating-title]");
  const value = explainer.querySelector("[data-card-rating-value]");
  const raw = explainer.querySelector("[data-card-rating-raw]");
  const formula = explainer.querySelector("[data-card-rating-formula]");

  const activate = control => {
    controls.forEach(item => {
      const isActive = item === control;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (title) title.textContent = control.dataset.ratingTitle || "Rating";
    if (value) value.textContent = control.dataset.ratingValue || "—";
    if (raw) raw.textContent = control.dataset.ratingRaw || "";
    if (formula) formula.textContent = control.dataset.ratingFormula || "";
  };

  const applyView = viewKey => {
    const view = cardViews?.[viewKey];
    if (!view) return;

    const activeControl = controls.find(control => control.classList.contains("is-active"));
    const activeAttributeCode = activeControl?.dataset.cardAttributeCode || null;
    const overallControl = scope.querySelector(".tlpt-card-rating-block[data-card-rating-control]");
    const card = scope.querySelector("[data-player-card]");
    const overall = scope.querySelector("[data-card-overall]");
    const edition = scope.querySelector("[data-card-edition]");
    const movement = scope.querySelector("[data-card-movement]");
    const context = scope.querySelector("[data-card-view-context]");
    const caveat = scope.querySelector("[data-card-experience-caveat]");

    scope.querySelectorAll("[data-card-view-control]").forEach(button => {
      const isActive = button.dataset.cardViewControl === viewKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (card) {
      card.dataset.cardView = viewKey;
      card.classList.remove("is-view-changing");
      void card.offsetWidth;
      card.classList.add("is-view-changing");
      card.setAttribute(
        "aria-label",
        `${card.dataset.cardPlayerName || "Player"} ${viewKey === "career" ? "career" : "last five"} player card. Overall rating ${view.overall}.${card.dataset.cardEditionAria || ""}`
      );
    }

    if (overall) overall.textContent = view.overall;
    if (edition) edition.textContent = view.edition;
    if (context) context.textContent = view.context;
    if (caveat) {
      const base = caveat.dataset.experienceBase || "";
      caveat.textContent = `${base} ${view.caveat}`.trim();
    }

    if (movement) {
      movement.className = "tlpt-card-movement";
      if (view.movement) {
        movement.hidden = false;
        movement.textContent = view.movement.label;
        movement.title = view.movement.title;
        movement.classList.add(`is-${view.movement.className}`);
      } else {
        movement.hidden = true;
        movement.textContent = "";
        movement.removeAttribute("title");
      }
    }

    if (overallControl) {
      overallControl.dataset.ratingValue = view.overall;
      overallControl.dataset.ratingRaw = view.overallRaw;
      overallControl.dataset.ratingFormula = view.overallFormula;
    }

    view.attributes.forEach(attribute => {
      const control = scope.querySelector(`[data-card-attribute-code="${attribute.code}"]`);
      if (!control) return;
      control.dataset.ratingValue = attribute.value;
      control.dataset.ratingRaw = attribute.raw;
      control.dataset.ratingFormula = attribute.formula;
      const displayedValue = control.querySelector("strong");
      if (displayedValue) displayedValue.textContent = attribute.value;
    });

    const nextActive = activeAttributeCode
      ? scope.querySelector(`[data-card-attribute-code="${activeAttributeCode}"]`)
      : overallControl;
    if (nextActive) activate(nextActive);
    if (typeof onViewChange === "function") onViewChange(viewKey);
  };

  controls.forEach(control => {
    control.addEventListener("click", () => activate(control));
    control.addEventListener("focus", () => activate(control));
    control.addEventListener("mouseenter", () => activate(control));
  });

  scope.querySelectorAll("[data-card-view-control]").forEach(button => {
    button.addEventListener("click", () => applyView(button.dataset.cardViewControl));
  });

  const overallControl = scope.querySelector(".tlpt-card-rating-block[data-card-rating-control]");
  if (overallControl) activate(overallControl);
  if (typeof onViewChange === "function") onViewChange("career");
  return { applyView };
}

function playerProfileStreakMeta(player, data) {
  const streakData = data?.streaks?.players?.[player?.slug] || {};
  const cashStreak = streakData.currentCashStreak;
  const droughtStreak = streakData.currentDroughtStreak;

  if (cashStreak?.length) {
    return {
      tone: "hot",
      label: "Current Form",
      value: `🔥 ${cashStreak.length}-game cash streak`
    };
  }

  if (droughtStreak?.length) {
    return {
      tone: "cold",
      label: "Current Form",
      value: `🥶 ${droughtStreak.length}-game cash drought`
    };
  }

  return {
    tone: "steady",
    label: "Current Form",
    value: "No active streak"
  };
}

function playerProfileSnapshotMarkup(player, data, primaryArchetype, secondaryArchetype, tierMeta, quote) {
  const streak = playerProfileStreakMeta(player, data);
  const rankValue = tierMeta.rank ? `#${tierMeta.rank}` : "—";
  const rankDetail = tierMeta.rank
    ? `of ${tierMeta.totalRanked} established players`
    : `${tierMeta.status} — Power Rank begins at 5 appearances`;

  const snapshotStats = [
    { label: "Career Profit", value: fmtMoney(player?.profit), className: statValueClass(player, "profit") },
    { label: "ROI", value: fmtPct(player?.roi) },
    { label: "Cash Rate", value: fmtPct(player?.cashRate) },
    { label: "Appearances", value: String(player?.buyIns ?? 0) },
    { label: "Cashes", value: String(player?.timesPlaced ?? 0) },
    { label: "Knockouts", value: String(player?.hits ?? 0) }
  ];

  return `
    <section class="tlpt-player-summary" aria-labelledby="tlpt-player-summary-title">
      <div class="kicker tlpt-player-summary-kicker">TLPT Ultimate Player Card</div>

      <div class="tlpt-player-summary-title-row">
        <div>
          <h2 id="tlpt-player-summary-title">${displayPlayerName(player)}</h2>
          <p class="tlpt-player-summary-quote">${quote}</p>
        </div>
      </div>

      <div class="tlpt-player-status-row">
        <div class="tlpt-player-status-card">
          <span>Power Rank</span>
          <strong>${rankValue}</strong>
          <small>${rankDetail}</small>
        </div>

        <div class="tlpt-player-status-card">
          <span>Power Tier</span>
          <strong>${tierMeta.emoji} ${tierMeta.name}</strong>
          <small>${tierMeta.desc}</small>
        </div>

        <div class="tlpt-player-status-card tlpt-player-status-${streak.tone}">
          <span>${streak.label}</span>
          <strong>${streak.value}</strong>
          <small>${tierMeta.status}: ${tierMeta.statusDetail}</small>
        </div>
      </div>

      <div class="tlpt-player-snapshot-grid" aria-label="Career snapshot">
        ${snapshotStats.map(stat => `
          <div class="tlpt-player-snapshot-stat">
            <span>${stat.label}</span>
            <strong class="${stat.className || ""}">${stat.value}</strong>
          </div>
        `).join("")}
      </div>

      <div class="tlpt-player-archetype-pair">
        <div class="tlpt-player-archetype-card primary">
          <span>Primary Archetype</span>
          <strong>${primaryArchetype.emoji} ${primaryArchetype.name}</strong>
          <small>${primaryArchetype.desc}</small>
        </div>

        <div class="tlpt-player-archetype-card secondary">
          <span>Secondary Archetype</span>
          <strong>${secondaryArchetype.emoji} ${secondaryArchetype.name}</strong>
          <small>${secondaryArchetype.desc}</small>
        </div>
      </div>

      <div class="tlpt-player-summary-badges">
        ${badgesMarkup(
          player,
          data,
          (data?.players || []).filter(isCrewEligible)
        )}
      </div>
    </section>
  `;
}

function syncTopPlayerNavigation(prev, next) {
  const previousLink = document.getElementById("player-top-prev");
  const nextLink = document.getElementById("player-top-next");

  if (previousLink && prev) {
    previousLink.href = playerUrl(prev);
    previousLink.textContent = `← Previous: ${displayPlayerNamePlain(prev)}`;
    previousLink.hidden = false;
  }

  if (nextLink && next) {
    nextLink.href = playerUrl(next);
    nextLink.textContent = `Next: ${displayPlayerNamePlain(next)} →`;
    nextLink.hidden = false;
  }
}

function renderPlayerProfile(data) {
  const container = document.getElementById("player-profile");
  if (!container || !data?.players?.length) return;

  const params = new URLSearchParams(window.location.search);
  let requestedName = params.get("name");

  const players = sortPlayers(data.players, "trueSkillScore");

  const normalizeName = (value) => String(value || "").trim().toLowerCase();

  const defaultPlayer =
    players.find(p => normalizeName(p.name) === "bostnmike") || players[0];

  if (!requestedName) {
    requestedName = defaultPlayer.name;
    params.set("name", requestedName);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }

  const player =
    players.find(p => normalizeName(p.name) === normalizeName(requestedName)) ||
    defaultPlayer;

  const index = players.findIndex(p => p.name === player.name);
  const prev = players[(index - 1 + players.length) % players.length];
  const next = players[(index + 1) % players.length];
  syncTopPlayerNavigation(prev, next);
  const quote = ensureQuoted(player?.notes || "");
  const archetypes = getPlayerArchetypes(player);
  const primaryArchetype = archetypes.primary;
  const secondaryArchetype = archetypes.secondary;
  const tierMeta = playerCardTierMeta(player, players);
  const cardViews = playerCardViewData(player, players);
  const specialEditions = playerCardSpecialEditions(player, data);
  const featuredEditionId = playerCardFeaturedEditionId(player, data);
  const specialEdition = playerCardSpecialEdition(player, data);

  const profileStats = PROFILE_STAT_CONFIG.map(config => {
    let valueClass = "";

    if (config.profitClass) {
      valueClass = statValueClass(player, "profit");
    } else if (config.profitClassFromValue) {
      valueClass = statValueClass({ profit: player?.[config.key] }, "profit");
    }

    return {
      key: config.key,
      label: config.label,
      value: formatProfileStatValue(player, config),
      valueClass
    };
  });

  const statsMarkup = profileStats.map(stat => `
    <div class="profile-stat player-stat-card" data-stat-formula="${STAT_FORMULAS[stat.key] || ""}" tabindex="0">
      <span class="kicker player-stat-kicker">${statIcon(stat.key)} ${stat.label}</span>
      <div
        class="metric player-stat-metric ${stat.valueClass || ""}"
        data-animate-count="true"
        data-target-value="${stat.value}"
      >${stat.value}</div>
    </div>
  `).join("");

  container.innerHTML = `
    <div class="profile-shell player-profile-shell">
      <div class="profile-hero profile-hero-wide player-profile-hero">
        ${playerCardMarkup(player, players, primaryArchetype, tierMeta, cardViews, specialEdition)}
        ${playerProfileSnapshotMarkup(
          player,
          data,
          primaryArchetype,
          secondaryArchetype,
          tierMeta,
          quote
        )}
      </div>

      ${playerCardComparisonMarkup(player, players, data)}

      ${playerCardCollectionMarkup(player, players, specialEditions, featuredEditionId)}

      ${playerDnaMarkup(player)}

      ${archetypeMixMarkup(player)}

      <div id="player-formula-display" class="player-formula-display">&nbsp;</div>

            <p class="player-formula-help muted">Mouse over any stat to reveal the calculation.</p>

      <div class="profile-grid player-stat-grid-enhanced">
        ${statsMarkup}
      </div>
    </div>
  `;

  const comparisonController = wirePlayerCardComparison(container, player, players, data);
  const ratingController = wirePlayerCardRatingControls(
    container,
    cardViews,
    viewKey => comparisonController?.setView(viewKey)
  );
  wirePlayerCardEditionCollection(
    container,
    player,
    specialEditions,
    ratingController,
    featuredEditionId
  );

  const formulaDisplay = document.getElementById("player-formula-display");
  const statCards = container.querySelectorAll("[data-stat-formula]");

    statCards.forEach(card => {
    const formula = card.dataset.statFormula || "";
    const showFormula = () => {
      if (formulaDisplay) formulaDisplay.textContent = formula || "\u00A0";
    };
    const clearFormula = () => {
      if (formulaDisplay) formulaDisplay.innerHTML = "&nbsp;";
    };

    card.addEventListener("mouseenter", showFormula);
    card.addEventListener("focusin", showFormula);
    card.addEventListener("mouseleave", clearFormula);
    card.addEventListener("focusout", clearFormula);
  });

initAnimatedCounters(container);

if (typeof wirePlayerFormulaCards === "function") {
  wirePlayerFormulaCards(container);
}

wireArchetypeMixHover(container);
}
  
function renderSchedule(data) {
  const list = document.getElementById("schedule-list");
  if (!list) return;

  const events = getCurrentEvents(data).slice(0, 2);

  list.innerHTML = events.map((event, index) => `
    <div class="event-card compact-event-card home-event-hero schedule-event-card schedule-event-card-${index === 0 ? "top" : "bottom"}">
      <div class="event-card-topline">
        <div class="kicker event-title-kicker">${event.title}</div>
        <div class="schedule-day-pill">${getEventDayLabel(event)}</div>
      </div>

      <div class="event-layout-grid">
        <div class="event-details-col">
          <div class="event-format-title">${event.format || ""}</div>
          <div class="event-structure">${event.structure || ""}</div>
          <h3>${event.date}</h3>
          <p class="muted"><strong>Start:</strong> ${event.time}</p>
          <p class="muted"><strong>Estimated End:</strong> ${event.endTime || ""}</p>
          <p class="muted"><strong>Location:</strong> ${event.location}</p>
          <p class="muted">${event.address || ""}</p>
          ${eventRsvpForecastMarkup(event, data)}
          <a class="btn btn-rsvp" href="${event.apple_invite_url}" target="_blank" rel="noopener">${getEventButtonLabel(event)}</a>
        </div>

        <div class="event-rsvp-col">
          ${eventRsvpAvatarMarkup(event, data)}
        </div>
      </div>
    </div>
  `).join("");
}

function honorIcon(type) {
  const key = String(type || "").toLowerCase();
  if (key.includes("profit")) return "💰";
  if (key.includes("power")) return "💪🏼";
  if (key.includes("clutch")) return "🎯";
  if (key.includes("hit")) return "💥";
  if (key.includes("bubble")) return "🫧";
  if (key.includes("luck")) return "🍀";
  if (key.includes("cash")) return "💵";
  if (key.includes("roi")) return "📈";
  return "🏅";
}

function honorsPageLabel(type) {
  if (type === "Profit Leader") return "Show Me Da $";
  if (type === "Power Leader") return "Power Flex";
  if (type === "Clutch Leader") return "Cap'n Clutch";
  return type;
}

function recordIcon(label) {
  const key = String(label || "").toLowerCase();
  if (key.includes("profit")) return "💰";
  if (key.includes("roi")) return "📈";
  if (key.includes("hit")) return "💥";
  if (key.includes("cash")) return "💵";
  if (key.includes("bubble")) return "🫧";
  if (key.includes("power")) return "💪🏼";
  if (key.includes("clutch")) return "🎯";
  if (key.includes("luck")) return "🍀";
  return "📊";
}

function honorsCardMarkup(player, category, icon, valueText, isTop = false, valueClass = "") {

  const href = player ? playerUrl(player) : "#";
  const nameMarkup = player ? displayPlayerName(player) : "Unknown";

  const numericClass = isNumericValueText(valueText)
    ? " hall-card-score-numeric"
    : "";

  const cardSlug = String(category || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `
    <a class="hall-card hall-card-${cardSlug}" href="${href}">

      <div class="hall-card-title">
        <span class="hall-card-icon">${icon}</span>
        <span>${category}</span>
      </div>

      <div class="hall-card-portrait">
        ${player ? playerImageMarkup(player, "honors") : ""}
      </div>

      <div class="hall-card-player">
        ${nameMarkup}
      </div>

      <div class="hall-card-score ${valueClass}${numericClass}">
        ${valueText}
      </div>

    </a>
  `;
}

function hallLaurelMarkup(tone = "best") {

  const leafSrc =
    tone === "worst"
      ? "images/site/hall/hall-leaf-withered.png"
      : "images/site/hall/hall-leaf-gold.png";

  return `
    <div class="hall-plaque-laurels" aria-hidden="true">

      <img
        class="hall-laurel-image hall-laurel-image-left"
        src="${leafSrc}"
        alt=""
      />

      <img
        class="hall-laurel-image hall-laurel-image-right"
        src="${leafSrc}"
        alt=""
      />

    </div>
  `;
}

function hallCardMarkup(player, rule, tone = "best") {

  const href = player ? playerUrl(player) : "#";

  const nameMarkup = player
    ? displayPlayerName(player)
    : "Unknown";

  const valueText = player
    ? `${formatStatValue(player, rule.key)}${rule.suffix || ""}`
    : "—";

  const cardSlug = String(rule?.visualClass || rule?.title || "hall-card")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let valueTone = "";

  if (rule?.key === "profit") {

    const profit = Number(player?.profit ?? 0);

    if (profit > 0) {
      valueTone = " hall-plaque-stat-value--positive";
    }

    if (profit < 0) {
      valueTone = " hall-plaque-stat-value--negative";
    }

  }

  return `
    <a
      class="
        hall-plaque
        hall-plaque--${tone}
        hall-plaque-${cardSlug}
      "
      href="${href}"
    >

      <div class="hall-plaque-title-row">

        <span class="hall-plaque-title">
          ${rule.title}
        </span>

      </div>


      <div class="hall-plaque-portrait-stage">

        ${hallLaurelMarkup(tone)}

        <div class="hall-plaque-avatar">
          ${player ? playerImageMarkup(player, "hall") : ""}
        </div>

      </div>


      <div class="hall-plaque-nameplate">
        ${nameMarkup}
      </div>


      <div class="hall-plaque-stat-stage">

  ${rule.propLeft ? `
    <img
      class="hall-plaque-prop hall-plaque-prop-left"
      src="${rule.propLeft}"
      alt=""
      aria-hidden="true"
    />
  ` : ""}


  <div class="hall-plaque-stat-panel">

    <div class="hall-plaque-stat-label">
      ${rule.displayLabel}
    </div>

    <div
      class="
        hall-plaque-stat-value
        ${valueTone}
      "
    >
      ${valueText}
    </div>

    <div class="hall-plaque-stat-note">
      ${rule.note || rule.description || ""}
    </div>

  </div>


  ${rule.propRight ? `
    <img
      class="hall-plaque-prop hall-plaque-prop-right"
      src="${rule.propRight}"
      alt=""
      aria-hidden="true"
    />
  ` : ""}

  </div>


    </a>
  `;
}

function getBalancedHonorsSections(data) {
  return {
    statLeaders: [
      { key: "roi", title: "Mr. ROI", icon: "🤑" },
      { key: "luckIndex", title: "Lucky Duck", icon: "🐥" },
      { key: "aggressionIndex", title: "Mr. Aggro", icon: "😤" },
      { key: "survivorIndex", title: "The Survivor", icon: "🛟" },
      { key: "tiltIndex", title: "Cool Customer", icon: "🧊" }
    ],
    recordItems: [
      { label: "Most Cashes", title: "Cash Cow", icon: "🐮" },
      { label: "Worst Luck Index", title: "Cursed Duck", icon: "🦤" },
      { label: "Lowest Profit", title: "The Donor", icon: "🩸" },
      { label: "Most Rebuys", title: "Mr. Rebuy", icon: "♻️" },
      { label: "Most Entries", title: "Entry King", icon: "🎟️" }
    ]
  };
}

async function renderHall(data) {

  const bestsEl =
    document.getElementById("hall-bests");

  const worstsEl =
    document.getElementById("hall-worsts");


  /*
   * app.js runs on every TLPT page. Only load the full historical event set
   * when the Hall page is actually present.
   */
  if (!bestsEl && !worstsEl) return;


  try {
    const hallHistory = await loadHallHistoryData(data);
    const players = getHallPlayers(data, hallHistory);

    if (!players.length) return;


    /* Rename the room without requiring a champions.html edit. */
    if (worstsEl) {
      const infamyRoom = worstsEl.closest(".hall-room");
      const infamyTitle = infamyRoom?.querySelector(".hall-room-title h3");
      const infamyCopy = infamyRoom?.querySelector(".hall-room-header p");

      if (infamyTitle) {
        infamyTitle.textContent = "All-Time Infamy";
      }

      if (infamyCopy) {
        infamyCopy.textContent =
          "The careers that became legends for all the wrong reasons.";
      }
    }


    function findHallLeader(rule) {

      return [...players].sort((a, b) => {

        const aVal =
          Number(a?.[rule.key] ?? 0);

        const bVal =
          Number(b?.[rule.key] ?? 0);


        if (rule.direction === "asc") {

          if (aVal !== bVal) {
            return aVal - bVal;
          }

        } else if (bVal !== aVal) {

          return bVal - aVal;

        }


        return String(a?.name || "")
          .localeCompare(
            String(b?.name || "")
          );

      })[0];

    }


    if (bestsEl) {

      bestsEl.innerHTML =
        HALL_RULES.bests
          .map(rule =>
            hallCardMarkup(
              findHallLeader(rule),
              rule,
              "best"
            )
          )
          .join("");

    }


    if (worstsEl) {

      worstsEl.innerHTML =
        HALL_RULES.worsts
          .map(rule =>
            hallCardMarkup(
              findHallLeader(rule),
              rule,
              "worst"
            )
          )
          .join("");

    }

  } catch (error) {
    console.error("TLPT Hall history load failed:", error);
  }

}
function renderChampions(data) {
  const players = data?.players || [];
  const honorsEl = document.getElementById("champions-list");
  const recordsEl = document.getElementById("records-list");
  const { recordItems } = getBalancedHonorsSections(data);

  if (honorsEl && Array.isArray(data?.honors)) {
    honorsEl.innerHTML = data.honors.map(honor => {
      const rule = HONOR_RULES[honor.type];
      const player = getLeaderByRule(players, rule);
      if (!player) return "";

      const valueClass = rule?.key === "profit"
        ? statValueClass(player, "profit")
        : "";

      let valueText = honor.note || "";

      if (rule?.key === "profit") {
        valueText = fmtMoney(player.profit);
      } else if (rule?.key) {
        valueText = formatStatValue(player, rule.key);
      }

      return honorsCardMarkup(
        player,
        honorsPageLabel(honor.type),
        honorIcon(honor.type),
        valueText,
        false,
        valueClass
      );
    }).join("");

    initAnimatedCounters(honorsEl);
  }

  if (recordsEl) {
    recordsEl.innerHTML = recordItems.map(record => {
      const rule = RECORD_RULES[record.label];
      const player = getLeaderByRule(players, rule);
      if (!player) return "";

      const valueClass = rule?.key === "profit"
        ? statValueClass(player, "profit")
        : rule?.key === "luckIndex"
          ? statValueClass({ profit: player?.luckIndex }, "profit")
          : "";

      const valueText = rule?.key
        ? formatStatValue(player, rule.key)
        : (record.value || "");

      return honorsCardMarkup(
        player,
        record.title || record.label,
        record.icon || recordIcon(record.label),
        valueText,
        false,
        valueClass
      );
    }).join("");

    initAnimatedCounters(recordsEl);
  }
}

function renderStatLeaders(data) {
  const list = document.getElementById("leaders-list");
  if (!list) return;

  const allPlayers = data?.players || [];
  const eligiblePlayers = allPlayers.filter(player => Number(player?.entries ?? 0) >= 5);
  const { statLeaders } = getBalancedHonorsSections(data);

  if (!eligiblePlayers.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = statLeaders.map(stat => {
    const leader = sortPlayers(eligiblePlayers, stat.key)[0];
    if (!leader) return "";

    const statConfig = getStatConfig(stat.key);
    const icon = stat.icon || statConfig?.icon || "🏅";
    const value = formatStatValue(leader, stat.key);
    const valueClass = stat.key === "profit"
      ? statValueClass(leader, "profit")
      : "";

    return `
      <a class="champ-card stat-card-visual honors-card leader-banner-card" href="${playerUrl(leader)}">
        <div class="leader-banner-top">
          <div class="leader-banner-crown">${icon}</div>
          <div class="leader-banner-title">${stat.title}</div>
        </div>

        <div class="honors-card-top leader-banner-body">
          ${playerImageMarkup(leader, "honors")}
          <div class="hall-card-stack">
            <div class="hall-player-name">${displayPlayerName(leader)}</div>
          </div>
        </div>

        <div
          class="honors-card-value ${valueClass}${isNumericValueText(value) ? " honors-card-value--numeric" : ""}"
          data-animate-count="${isNumericValueText(value) ? "true" : "false"}"
          data-target-value="${value}"
        >
          ${value}
        </div>
      </a>
    `;
  }).join("");

  initAnimatedCounters(list);
}

function renderHonorsSummary() {
  const strip = document.getElementById("honors-summary-strip");
  const comment = document.getElementById("honors-summary-comment");

  if (strip) strip.remove();
  if (comment) comment.remove();
}

function escapeHtmlAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildChipImageCandidates(chip) {
  const original = String(chip.image || "").trim();
  const labelNumber = String(chip.label || "").replace(/[^0-9]/g, "");
  const dir = original.includes("/") ? original.slice(0, original.lastIndexOf("/") + 1) : "";
  const exts = ["png", "webp", "jpg", "jpeg"];
  const bases = [
    `chip-T-${labelNumber}`,
    `chip-T${labelNumber}`,
    `chip-t-${labelNumber}`,
    `chip-t${labelNumber}`,
    `Chip-T-${labelNumber}`,
    `Chip-T${labelNumber}`
  ];
  const candidates = [];
  if (original) candidates.push(original);
  bases.forEach(base => exts.forEach(ext => candidates.push(`${dir}${base}.${ext}`)));
  return [...new Set(candidates.filter(Boolean))];
}

function buildRulesChipCard(chip, formatKey) {
  const candidates = buildChipImageCandidates(chip);
  const firstCandidate = escapeHtmlAttr(candidates[0] || "");
  const candidateAttr = escapeHtmlAttr(candidates.join("|"));
  const label = escapeHtmlAttr(chip.label);
  const chipCount = CHIP_SET_TEXT[formatKey]?.[chip.label] ?? 0;
  const chipClass = `chip-${String(chip.label).replace(/[^0-9]/g, "")}`;

  return `
    <div class="rules-chip-card ${chipClass}" title="${label} • Set per player = ${chipCount}">
    <img
        class="rules-chip-image"
        src="${firstCandidate}"
        alt="${label}"
        data-candidates="${candidateAttr}"
        data-candidate-index="0"
        data-image-error-action="candidate-list"
        loading="lazy"
        decoding="async"
      >
      <div class="rules-chip-fallback">${label}</div>
      <div class="rules-chip-label">${label}</div>
      <div class="rules-chip-count">Set per player = ${chipCount}</div>
    </div>
  `;
}

function buildRulesChipPanel(format, formatKey) {
  return `
    <div class="rules-chip-panel">
      <div class="rules-chip-grid">
        ${format.chips.map(chip => buildRulesChipCard(chip, formatKey)).join("")}
      </div>
    </div>
  `;
}

function buildRulesTimerRail(format) {
  const runtime = Number(format?.runtimeMinutes ?? 300);
  const levelMinutes = 20;
  const breakMinutes = 10;

  const breaks = Array.isArray(format?.levels)
    ? format.levels.filter(row => row.type === "break").length
    : 0;

  const playableLevels = Array.isArray(format?.levels)
    ? format.levels.filter(row => row.type === "level").length
    : 0;

  return `
    <div class="timer-rail">
      <div class="timer-pill"><strong>Levels:</strong> ${playableLevels}</div>
      <div class="timer-pill"><strong>Level Length:</strong> ${levelMinutes} min</div>
      <div class="timer-pill"><strong>Breaks:</strong> ${breaks} × ${breakMinutes} min</div>
      <div class="timer-pill"><strong>Estimated Runtime:</strong> ${runtime} min</div>
    </div>
  `;
}

function buildRulesBlindTable(format) {
  let rowIndex = 0;
  const rows = format.levels.map(row => {
    if (row.type === "break") {
      return `<tr class="blind-break"><td colspan="5">${row.note}</td></tr>`;
    }
    const zebra = rowIndex % 2 === 0 ? "blind-row-dark" : "blind-row-light";
    rowIndex += 1;
    return `
      <tr class="${zebra}">
        <td>${row.level}</td>
        <td>${row.sb}</td>
        <td>${row.bb}</td>
        <td>${row.ante}</td>
        <td>${row.eff}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="blind-sheet">
      <table class="blind-table">
        <thead>
          <tr>
            <th>Level</th>
            <th>Small Blind</th>
            <th>Big Blind</th>
            <th>Ante</th>
            <th>Effective BB</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="blind-note">Gold rows mark 10-minute breaks and chip-up points. Black and gray rows are 20-minute live levels.</p>
    </div>
  `;
}

function setActiveFormatButton(formatKey) {
  ["40k", "500k"].forEach(key => {
    const btn = document.getElementById(`format-btn-${key}`);
    if (btn) {
      const isActive = key === formatKey;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  });

  const toggle = document.getElementById("format-switch-input");
  if (toggle) {
    toggle.checked = formatKey === "500k";
  }
}

function showFormat(formatKey) {
  const format = RULES_FORMATS[formatKey];
  const host = document.getElementById("format-content");
  if (!format || !host) return;

  setActiveFormatButton(formatKey);

  host.innerHTML = `
    <div class="rules-format">
      <div class="format-head">
        <div>
          <h3 class="format-title format-title-${formatKey}">${format.title}</h3>
        </div>
      </div>
      ${buildRulesTimerRail(format)}
      ${buildRulesChipPanel(format, formatKey)}
      ${buildRulesBlindTable(format)}
    </div>
  `;
}

function initRulesPage() {
  const host = document.getElementById("format-content");
  if (!host) return;

  const btn40 = document.getElementById("format-btn-40k");
  const btn500 = document.getElementById("format-btn-500k");
  const toggle = document.getElementById("format-switch-input");

  if (btn40) {
    btn40.addEventListener("click", () => showFormat("40k"));
  }

  if (btn500) {
    btn500.addEventListener("click", () => showFormat("500k"));
  }

  if (toggle) {
    toggle.addEventListener("change", () => {
      showFormat(toggle.checked ? "500k" : "40k");
    });
  }

  showFormat("40k");
}

function setActiveSortButton(scope, sortKey) {
  document.querySelectorAll(`[data-sort-scope="${scope}"] [data-sort], [data-${scope}-sort]`).forEach(btn => {
    const key = btn.dataset.sort || btn.dataset[`${scope}Sort`];
    const isActive = key === sortKey;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function initCrewViewToggle() {
  const tierBtn = document.getElementById("crew-view-tier");
  const archetypeBtn = document.getElementById("crew-view-archetype");
  const crewViewSwitch = document.getElementById("crew-view-switch-input");

  if (!tierBtn || !archetypeBtn) return;

  tierBtn.addEventListener("click", () => {
    currentCrewView = "tier";
    currentArchetypeMode = "primary";
    currentArchetypeFilter = "all";
    if (crewViewSwitch) crewViewSwitch.checked = false;
    renderPlayers(window.siteData);
  });

  archetypeBtn.addEventListener("click", () => {
    currentCrewView = "archetype";
    currentArchetypeMode = "primary";
    currentArchetypeFilter = "all";
    if (crewViewSwitch) crewViewSwitch.checked = true;
    renderPlayers(window.siteData);
  });

  if (crewViewSwitch) {
    crewViewSwitch.addEventListener("change", () => {
      currentCrewView = crewViewSwitch.checked ? "archetype" : "tier";
      currentArchetypeMode = "primary";
      currentArchetypeFilter = "all";
      renderPlayers(window.siteData);
    });
  }
}

function initSorting() {
  document.querySelectorAll(`[data-sort-scope="standings"] [data-sort], [data-standings-sort]`).forEach(btn => {
    btn.addEventListener("click", () => renderStandings(btn.dataset.sort || btn.dataset.standingsSort || DEFAULT_STANDINGS_SORT));
  });

  document.querySelectorAll(`[data-sort-scope="dashboard"] [data-sort], [data-dashboard-sort]`).forEach(btn => {
    btn.addEventListener("click", () => renderDashboard(btn.dataset.sort || btn.dataset.dashboardSort || DEFAULT_DASHBOARD_SORT));
  });
}

window.renderStandings = renderStandings;
window.renderDashboard = renderDashboard;
window.renderPlayers = renderPlayers;
window.renderPlayerProfile = renderPlayerProfile;
window.showFormat = showFormat;

function typeTextIntoElement(element, text, speed = 18) {
  if (!element) return;

  element.textContent = "";
  element.classList.remove("is-typing-done");

  let index = 0;

  function tick() {
    element.textContent = text.slice(0, index);
    index += 1;

    if (index <= text.length) {
      window.setTimeout(tick, speed);
    } else {
      element.classList.add("is-typing-done");
    }
  }

  tick();
}

function initEventRsvpNameHover() {
  document.addEventListener("mouseover", event => {
    const seat = event.target.closest(".event-rsvp-seat-player");
    if (!seat) return;

    const row = seat.closest(".event-rsvp-avatar-row");
    const label = row?.querySelector(".event-rsvp-center-name");
    if (!label) return;

    label.textContent = seat.dataset.playerName || "";
    label.classList.add("is-visible");
  });

  document.addEventListener("mouseout", event => {
    const seat = event.target.closest(".event-rsvp-seat-player");
    if (!seat) return;

    if (seat.contains(event.relatedTarget)) return;

    const row = seat.closest(".event-rsvp-avatar-row");
    const label = row?.querySelector(".event-rsvp-center-name");
    if (!label) return;

    label.classList.remove("is-visible");
    label.textContent = "";
  });

  document.addEventListener("focusin", event => {
    const seat = event.target.closest(".event-rsvp-seat-player");
    if (!seat) return;

    const row = seat.closest(".event-rsvp-avatar-row");
    const label = row?.querySelector(".event-rsvp-center-name");
    if (!label) return;

    label.textContent = seat.dataset.playerName || "";
    label.classList.add("is-visible");
  });

  document.addEventListener("focusout", event => {
    const seat = event.target.closest(".event-rsvp-seat-player");
    if (!seat) return;

    const row = seat.closest(".event-rsvp-avatar-row");
    const label = row?.querySelector(".event-rsvp-center-name");
    if (!label) return;

    label.classList.remove("is-visible");
    label.textContent = "";
  });
}

async function main() {
  const data = await loadSiteData();
  window.siteData = data;

  renderHomePage(data);
  renderLeagueSnapshot(data);
  renderStandings(DEFAULT_STANDINGS_SORT);
  renderDashboard(DEFAULT_DASHBOARD_SORT);
  renderPlayers(data);
  renderPlayerProfile(data);
  renderSchedule(data);
  await renderHall(data);
  initRulesPage();
  initSorting();
  initCrewViewToggle();
  initEventRsvpNameHover();
}

document.addEventListener("DOMContentLoaded", () => {
  main()
    .then(() => {
      const reportEls = document.querySelectorAll("[data-commissioner-report]");

      if (!reportEls.length) return;

      let currentIndex = -1;

      function renderNewReport() {
        const result = getRandomCommissionerReport(currentIndex);
        currentIndex = result.index;

        reportEls.forEach(reportEl => {
          reportEl.classList.add("is-fading");
        });

        setTimeout(() => {
          reportEls.forEach(reportEl => {
            reportEl.textContent = "";
            reportEl.classList.remove("is-typing-done");
            reportEl.classList.remove("is-fading");
            typeTextIntoElement(reportEl, result.text, 10);
          });
        }, 450);
      }

      const initial = getRandomCommissionerReport();
      currentIndex = initial.index;

      reportEls.forEach(reportEl => {
        typeTextIntoElement(reportEl, initial.text, 10);
      });

      setInterval(renderNewReport, 45 * 1000);
    })
    .catch(error => {
      console.error("TLPT site load failed:", error);
    });
});
