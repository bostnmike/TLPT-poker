/* app.js */
async function loadSiteData() {
  // 🔥 Load base site data (players, stats, etc.)
  const baseRes = await fetch("./data/generated/site-data.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!baseRes.ok) {
    throw new Error(`Failed to load site-data.json (${baseRes.status})`);
  }

  const baseData = await baseRes.json();

  // 🔥 Load LIVE events (this is where your RSVP edits live)
  const eventsRes = await fetch("./data/events.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!eventsRes.ok) {
    throw new Error(`Failed to load events.json (${eventsRes.status})`);
  }

  const eventsData = await eventsRes.json();

  // 🔥 FORCE events to come from events.json
  return {
    ...baseData,
    events: eventsData.events || []
  };
}

const DEFAULT_STANDINGS_SORT = "profit";
const DEFAULT_DASHBOARD_SORT = "profit";
let currentCrewView = "tier";
let currentArchetypeMode = "primary";
let currentArchetypeFilter = "all";

const STAT_FORMULAS = {
  totalCost: "Total Cost: Buy-ins + Rebuys Cost",
  totalWinnings: "Total Winnings: Total prize money won before subtracting costs",
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
  trueSkillScore: "Power Index: (0.40 × ROI) + (0.40 × Cash Rate) + (0.20 × Hit Rate)",
  luckIndex: "Luck Index: Profit − Expected Profit",
  clutchIndex: "Clutch Index: (0.30 × ROI) + (0.30 × Cash Rate) + (0.20 × (1 − Bubble Rate)) + (0.20 × Hit Rate)",
  aggressionIndex: "Aggression Index: Hits ÷ Entries",
  survivorIndex: "Survivor Index: Cash Rate × (1 − Bubble Rate)",
  tiltIndex: "Tilt Index: (0.60 × (Rebuys ÷ Buy-ins)) + (0.40 × Bubble Rate)",
  expectedProfit: "Expected Profit: Entries × League Average Profit per Entry"
};

const PROFILE_STAT_CONFIG = [
  { key: "totalCost", label: "Total Cost", type: "money", icon: "💸", dashboard: false },
  { key: "totalWinnings", label: "Total Winnings", type: "money", icon: "🏦", dashboard: false, profitClassFromValue: true },

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
  { key: "tiltIndex", label: "Tilt Index", dashboardLabel: "Tilt", type: "num", icon: "🫨", dashboard: true },

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
  tiltIndex: "The league’s emotional volatility index."
};

const STAT_LEADER_CONFIG = [
  { key: "roi", title: "ROI Leader" },
  { key: "luckIndex", title: "Luck Leader" },
  { key: "aggressionIndex", title: "Aggression Leader" },
  { key: "survivorIndex", title: "Survivor Leader" },
  { key: "tiltIndex", title: "Tilt Leader" }
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
  const stat = getStatConfig(key);

  if (!stat) {
    return String(player?.[key] ?? "-");
  }

  return formatProfileStatValue(player, stat);
}

function getEligiblePlayers(players) {
  return (players || []).filter(player => Number(player?.entries ?? 0) >= 5);
}

function getLeaderByRule(players, rule) {
  if (!rule || !rule.key) return null;

  const eligiblePlayers = getEligiblePlayers(players);
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
  const tilt = Number(player?.tiltIndex ?? 0);
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
      score: survivor * 1.05 - tilt * 0.45 - aggression * 0.35
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
      score: tilt * 1.1 + rebuys * 0.8
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

function getPlayerTierScore(player) {
  if (!player) return -999;

  const entries = Number(player?.entries ?? 0);
  const rebuys = Number(player?.rebuys ?? 0);
  const trueSkill = Number(player?.trueSkillScore ?? 0);
  const clutch = Number(player?.clutchIndex ?? 0);
  const aggression = Number(player?.aggressionIndex ?? 0);
  const survivor = Number(player?.survivorIndex ?? 0);
  const tilt = Number(player?.tiltIndex ?? 0);

  let sampleBonus = 0;
  if (entries >= 20) sampleBonus = 3.0;
  else if (entries >= 15) sampleBonus = 2.0;
  else if (entries >= 10) sampleBonus = 1.0;
  else if (entries >= 5) sampleBonus = 0.25;
  else sampleBonus = -2.0;

  const rebuyPenalty = rebuys * 0.6;

  return (
    (trueSkill * 1.5) +
    (clutch * 1.1) +
    (aggression * 0.65) +
    (survivor * 1.0) -
    (tilt * 1.25) +
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

  const eligiblePlayers = (allPlayers || []).filter(p => Number(p?.entries ?? 0) >= 5);
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
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <span class="player-avatar-fallback ${size}" style="display:none;">${initialsFromName(player.name)}</span>
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

function badgeList(player, data) {
  const players = data?.players || [];
  if (!players.length) return [];

  const eligiblePlayers = getEligiblePlayers(players);
  const badgePool = eligiblePlayers.length ? eligiblePlayers : players;

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
  if (player.name === topTilt) badges.push({ icon: "🫨", label: "Tilt Meter", rarity: "common", tone: "slate" });
  if (player.name === topBubbleRate) badges.push({ icon: "🫧", label: "Bubble Trouble", rarity: "uncommon", tone: "blue" });
  if (player.name === topRebuys) badges.push({ icon: "♻️", label: "Rebuy King", rarity: "rare", tone: "amber" });

  if (Number(player.entries ?? 0) < 5) badges.push({ icon: "✳️", label: "Small Sample", rarity: "common", tone: "slate" });

  return badges;
}

function badgesMarkup(player, data) {
  const badges = badgeList(player, data);
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
  const statuses = Object.values(event?.rsvps || {}).map(value => String(value || "tbd").toLowerCase());

  return {
    yes: statuses.filter(status => status === "yes").length,
    maybe: statuses.filter(status => status === "maybe").length,
    tbd: statuses.filter(status => status === "tbd").length,
    no: statuses.filter(status => status === "no").length
  };
}

function formatRsvpLine(event) {
  const counts = getRsvpCounts(event);
  return `${counts.yes} yes • ${counts.maybe} maybe • ${counts.tbd} tbd • ${counts.no} no`;
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
      <div class="${summaryClass}" aria-label="RSVP summary">
        <span class="event-rsvp-pill yes">Yes = ${counts.yes}</span>
        <span class="event-rsvp-pill no">No = ${counts.no}</span>
        <span class="event-rsvp-pill maybe">Maybe = ${counts.maybe}</span>
        <span class="event-rsvp-pill tbd">TBD = ${counts.tbd}</span>
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
  "ProvidenceMike, Red, Chris O, Nitro, Wild Bill, The Architect, Jeff T, and Vish continue to prove the league’s central theorem: somebody’s getting paid, and most of you are helping."
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
  if (name === "The Grinder") return "Grinder = (Survivor Index × 1.05) − (Tilt Index × 0.45) − (Aggression Index × 0.35)";
  if (name === "The Lucky Devil") return "Lucky Devil = Luck Index × 1.15";
  if (name === "The Wildcard") return "Wildcard = (Tilt Index × 1.1) + (Rebuys × 0.8)";
  if (name === "The Bubble Magnet") return "Bubble Magnet = (Bubbles × 4) + (Clutch Index × 0.15)";
  if (name === "The Technician") return "Technician = (Clutch Index + Survivor Index + Aggression Index) ÷ 3";
  return "";
}

function tierFormulaText(name) {
  const base = "Tier Score = (True Skill × 1.5) + (Clutch × 1.1) + (Aggression × 0.65) + (Survivor × 1.0) − (Tilt × 1.25) + sample bonus − rebuy penalty.";

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
    ensureHomeCommissionerSection();

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
  const qualifiedPlayers = allPlayers.filter(player => Number(player?.entries ?? 0) >= 5);
  const activePlayers = allPlayers.filter(player => Number(player?.entries ?? 0) >= 5);

  const leaderStrip = document.getElementById("home-leader-strip");
  if (leaderStrip) {
    const profitLeader = getLeaderByRule(allPlayers, HONOR_RULES["Profit Leader"]);
    const powerLeader = getLeaderByRule(allPlayers, HONOR_RULES["Power Leader"]);
    const clutchLeader = getLeaderByRule(allPlayers, HONOR_RULES["Clutch Leader"]);
    const hitLeader = getLeaderByRule(allPlayers, HONOR_RULES["Hit King"]);

    leaderStrip.innerHTML = [
      buildHomeStripCard("Profit Leader", "💰", profitLeader, profitLeader ? fmtMoney(profitLeader.profit) : "", profitLeader ? statValueClass(profitLeader, "profit") : ""),
      buildHomeStripCard("Power Leader", "💪🏼", powerLeader, powerLeader ? fmtNum(powerLeader.trueSkillScore) : ""),
      buildHomeStripCard("Clutch Leader", "🎯", clutchLeader, clutchLeader ? fmtNum(clutchLeader.clutchIndex) : ""),
      buildHomeStripCard("Knockout King", "💥", hitLeader, hitLeader ? String(hitLeader.hits) : "")
    ].join("");
  }

  const badgeCluster = document.getElementById("home-badge-cluster");
  if (badgeCluster) {
    const badges = HOME_BADGE_CONFIG.map(config => {
      const leader = getLeaderByRule(qualifiedPlayers, HONOR_RULES[config.rule]);
      return leader ? buildHomeBadgeCard(config, leader) : "";
    }).join("");
    badgeCluster.innerHTML = badges;
  }

  const ticker = document.getElementById("league-ticker-text");
  if (ticker && qualifiedPlayers.length) {
    const tickerItems = STAT_LEADER_CONFIG.map(stat => {
      const leader = sortPlayers(qualifiedPlayers, stat.key)[0];
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
    const profitLeader = getLeaderByRule(qualifiedPlayers, HONOR_RULES["Profit Leader"]);
    const powerLeader = getLeaderByRule(qualifiedPlayers, HONOR_RULES["Power Leader"]);
    const clutchLeader = getLeaderByRule(qualifiedPlayers, HONOR_RULES["Clutch Leader"]);
    const hitLeader = getLeaderByRule(qualifiedPlayers, HONOR_RULES["Hit King"]);

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

  const eligible = players.filter(player => Number(player?.entries ?? 0) >= 5);
  const pool = eligible.length ? eligible : players;

  const rotationWindowMs = 12 * 60 * 60 * 1000;
  const rotationIndex = Math.floor(Date.now() / rotationWindowMs) % pool.length;

  return pool[rotationIndex];
}

function buildFeaturedPlayerCard(player, data) {
  if (!player) return "";

  const archetypes = getPlayerArchetypes(player);
  const primaryArchetype = archetypes.primary;
  const secondaryArchetype = archetypes.secondary;
  const tier = getPlayerTier(player, data?.players || []);
  const badges = badgeList(player, data).slice(0, 3);
  const quote = ensureQuoted(player?.notes || "");

  return `
    <a class="featured-player-card" href="${playerUrl(player)}">
      <div class="featured-player-kicker">🌟 Featured Player</div>

      <div class="featured-player-top">
        <div class="featured-player-avatar">
          ${playerImageMarkup(player, "crew")}
        </div>

        <div class="featured-player-meta">
          <h3>${displayPlayerNamePlain(player)}</h3>
          <div class="featured-player-tier">${tier.emoji} ${tier.name}</div>

          <div class="featured-player-archetype featured-player-archetype-primary ${primaryArchetype.key}">
            <strong>Primary:</strong> ${primaryArchetype.emoji} ${primaryArchetype.name}
          </div>

          <div class="featured-player-archetype featured-player-archetype-secondary ${secondaryArchetype.key}">
            <strong>Secondary:</strong> ${secondaryArchetype.emoji} ${secondaryArchetype.name}
          </div>
        </div>
      </div>

      <p class="featured-player-quote">${quote}</p>

      <div class="featured-player-stats">
        <div class="featured-player-stat featured-player-stat-green">
          <span class="featured-player-stat-label">Entries</span>
          <span class="featured-player-stat-value">${player.entries ?? "-"}</span>
        </div>

        <div class="featured-player-stat featured-player-stat-purple">
          <span class="featured-player-stat-label">Cashes</span>
          <span class="featured-player-stat-value">${player.timesPlaced ?? "-"}</span>
        </div>

        <div class="featured-player-stat featured-player-stat-yellow">
          <span class="featured-player-stat-label">Bubbles</span>
          <span class="featured-player-stat-value">${player.bubbles ?? "-"}</span>
        </div>

        <div class="featured-player-stat featured-player-stat-red">
          <span class="featured-player-stat-label">Hits</span>
          <span class="featured-player-stat-value">${player.hits ?? "-"}</span>
        </div>

        <div class="featured-player-stat featured-player-stat-blue">
          <span class="featured-player-stat-label">Winnings</span>
          <span class="featured-player-stat-value">${fmtMoney(player.totalWinnings)}</span>
        </div>

        <div class="featured-player-stat featured-player-stat-pink">
          <span class="featured-player-stat-label">ROI</span>
          <span class="featured-player-stat-value">${fmtPct(player.roi)}</span>
        </div>
      </div>

      ${badges.length ? `
        <div class="featured-player-badges">
          ${badges.map(badge => `
            <span class="featured-player-badge stat-badge-text badge-rarity-${badge.rarity} badge-tone-${badge.tone}">
              <span class="stat-badge-icon">${badge.icon}</span>
              <span class="stat-badge-label">${badge.label}</span>
            </span>
          `).join("")}
        </div>
      ` : ""}

      <div class="featured-player-link">View full profile →</div>
    </a>
  `;
}

function renderLeagueSnapshot(data) {
  const container = document.getElementById("home-snapshot-grid");
  const featuredContainer = document.getElementById("home-featured-player");
  if (!container) return;

  const players = data?.players || [];

  const totalEntries = players.reduce((sum, p) => sum + (Number(p.entries) || 0), 0);
  const totalRebuys = players.reduce((sum, p) => sum + (Number(p.rebuys) || 0), 0);
  const totalHits = players.reduce((sum, p) => sum + (Number(p.hits) || 0), 0);
  const totalEntryFees = players.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
  const avgROI =
    players.reduce((sum, p) => sum + (Number(p.roi) || 0), 0) /
    Math.max(players.length, 1);

    const cards = [
  { icon:"👥", label:"Players", value:players.length, className:"snapshot-purple", href:"players.html" },
  { icon:"🎟️", label:"Entries", value:totalEntries, className:"snapshot-silver", href:"dashboard.html" },
  { icon:"♻️", label:"Rebuys", value:totalRebuys, className:"snapshot-blue", href:"dashboard.html" },
  { icon:"💥", label:"Knockouts", value:totalHits, className:"snapshot-yellow", href:"dashboard.html" },
  { icon:"💰", label:"Total Entry Fees", value:fmtMoney(totalEntryFees), className:"snapshot-green", href:"dashboard.html" },
  { icon:"📈", label:"Avg ROI", value:fmtPct(avgROI), className:"snapshot-red", href:"standings.html" }
];

container.innerHTML = cards.map(card => `
  <a class="snapshot-card ${card.className}" href="${card.href}">
    <div class="snapshot-icon">${card.icon}</div>
    <div
      class="snapshot-value${card.label === "Total Entry Fees" ? " money" : ""}"
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
      <td class="${statValueClass(player, "profit")}">${fmtMoney(player.profit)}</td>
      <td>${fmtPct(player.roi)}</td>
      <td>${fmtNum(player.trueSkillScore)}</td>
      <td>${player.hits ?? "-"}</td>
      <td>${player.timesPlaced ?? "-"}</td>
      <td>${player.bubbles ?? "-"}</td>
      <td>${fmtNum(player.luckIndex)}</td>
      <td>${fmtNum(player.clutchIndex)}</td>
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

function crewCardMarkup(player, data, tierPlayers = []) {
  const tier = getPlayerTier(player, data?.players || []);
  const tierRank = [...tierPlayers]
    .sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a))
    .findIndex(p => p.name === player.name) + 1;

  const tierClass = tier.name
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `
    <a class="player-card player-card-rich crew-card" href="${playerUrl(player)}">
      <div class="crew-card-topline">
        <span class="crew-tier-badge ${tierClass}">${tier.emoji} ${tier.name}</span>
        <span class="crew-tier-rank">#${tierRank}</span>
      </div>

      <div class="player-card-top crew-card-top">
        ${playerImageMarkup(player, "crew")}
        <div class="player-card-meta crew-card-meta">
          <div class="kicker">Player</div>
          <h3>${displayPlayerName(player)}</h3>
        </div>
      </div>

      <div class="crew-summary-row">
        <span class="crew-profit ${statValueClass(player, "profit")}">Profit ${fmtMoney(player.profit)}</span>
        <span class="crew-power">Tier Score ${fmtNum(getPlayerTierScore(player))}</span>
      </div>

      <div class="player-card-stats crew-card-stats">
        <p class="muted"><strong>Entries:</strong> ${player.entries ?? "-"}</p>
        <p class="muted"><strong>Hits:</strong> ${player.hits ?? "-"}</p>
        <p class="muted"><strong>Cashes:</strong> ${player.timesPlaced ?? "-"}</p>
        <p class="muted"><strong>Bubble Rate:</strong> ${fmtPct(player.bubbleRate)}</p>
        ${badgesMarkup(player, data)}
      </div>
    </a>
  `;
}

function tierSectionMarkup(title, emoji, players, data, maxTierPower = 1) {
  if (!players.length) return "";

  const avgPower =
    players.reduce((sum, p) => sum + (Number(p.trueSkillScore) || 0), 0) /
    players.length;

  const strengthPct = Math.max(
    12,
    Math.min(100, (avgPower / Math.max(maxTierPower, 0.1)) * 100)
  );

  let rangeLabel = "";
  if (title === "The Apex Predators") rangeLabel = " (Top 15%)";
  else if (title === "The Table Crushers") rangeLabel = " (15–35%)";
  else if (title === "The Shot Makers") rangeLabel = " (35–60%)";
  else if (title === "The Gamblers") rangeLabel = " (60–80%)";
  else if (title === "The League Sponsors") rangeLabel = " (Bottom 20%)";
  
  return `
    <div class="tier-section">
      <div class="tier-section-head">
        <h3>${emoji} ${title}<span class="tier-section-range">${rangeLabel}</span></h3>
        <div class="tier-header-stats">
          Avg Power ${fmtNum(avgPower)}
        </div>
      </div>

      <div class="tier-strength">
        <div class="tier-strength-label">Tier Strength</div>
        <div class="tier-strength-bar">
          <div class="tier-strength-fill" style="width:${strengthPct}%"></div>
        </div>
        <div class="tier-strength-pct">${Math.round(strengthPct)}%</div>
      </div>

      <div class="tier-grid">
        ${players.map(player => crewCardMarkup(player, data, players)).join("")}
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
      players: group.players.sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a))
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
          >
            View All
            <span>${totalPlayers}</span>
          </button>

          ${groups.map(group => `
            <button
              type="button"
              class="archetype-filter-pill ${activeFilter === group.title ? "active" : ""} ${group.className}"
              data-archetype-filter="${group.title}"
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
        ${group.players.map(player => crewCardMarkup(player, data, group.players)).join("")}
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

  if (tierBtn) tierBtn.classList.toggle("active", currentCrewView === "tier");
  if (archetypeBtn) archetypeBtn.classList.toggle("active", currentCrewView === "archetype");
  if (crewViewSwitch) crewViewSwitch.checked = currentCrewView === "archetype";

  if (!grid || !data?.players) return;

  const eligiblePlayers = [...data.players]
    .filter(player => Number(player?.entries ?? 0) >= 5)
    .sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a));

  if (currentCrewView === "archetype") {
    const archetypeGroups = groupPlayersByArchetype(eligiblePlayers, currentArchetypeMode);
    const filteredGroups = currentArchetypeFilter === "all"
      ? archetypeGroups
      : archetypeGroups.filter(group => group.title === currentArchetypeFilter);

    if (helpCopy) {
      helpCopy.style.display = "";
      helpCopy.textContent = "Your primary & secondary brands of trouble.";
    }

    if (explainer) {
      explainer.style.display = "none";
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

  eligiblePlayers.forEach(player => {
    const tier = getPlayerTier(player, eligiblePlayers);

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

  const tierSort = (a, b) => getPlayerTierScore(b) - getPlayerTierScore(a);

  apexPredators.sort(tierSort);
  tableCrushers.sort(tierSort);
  shotMakers.sort(tierSort);
  gamblers.sort(tierSort);
  leagueSponsors.sort(tierSort);

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
    { title: "The League Sponsors", emoji: "🍣", players: leagueSponsors, className: "league-sponsors" }
  ];

  if (helpCopy) {
    helpCopy.textContent = "";
    helpCopy.style.display = "none";
  }

  if (explainer) {
    explainer.textContent = "";
    explainer.style.display = "none";
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
      label: "Tilt Risk",
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
  const quote = ensureQuoted(player?.notes || "");
  const archetypes = getPlayerArchetypes(player);
  const primaryArchetype = archetypes.primary;
  const secondaryArchetype = archetypes.secondary;
  const tier = getPlayerTier(player, players);

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
        <div class="player-profile-left">
          ${playerImageMarkup(player, "profile")}
        </div>

        <div class="profile-hero-copy player-profile-copy">
          <div class="kicker player-profile-kicker">Player Profile</div>

          <div class="player-profile-title-row">
            <h2>${displayPlayerName(player)}</h2>
            <p class="profile-quote player-profile-quote-inline">${quote}</p>
          </div>

          <div class="player-archetype-line">
            <span class="profile-line-label">Primary Archetype:</span>
            <span class="profile-line-emoji">${primaryArchetype.emoji}</span>
            <span class="profile-line-name">${primaryArchetype.name}</span>
            <span class="profile-line-desc">— ${primaryArchetype.desc}</span>
          </div>

          <div class="player-archetype-line secondary-archetype-line">
            <span class="profile-line-label">Secondary Archetype:</span>
            <span class="profile-line-emoji">${secondaryArchetype.emoji}</span>
            <span class="profile-line-name">${secondaryArchetype.name}</span>
            <span class="profile-line-desc">— ${secondaryArchetype.desc}</span>
          </div>
          
          <div class="player-tier-line">
            <span class="profile-line-label">Player Tier:</span>
            <span class="profile-line-emoji">${tier.emoji}</span>
            <span class="profile-line-name">${tier.name}</span>
            <span class="profile-line-desc">— ${tier.desc}</span>
          </div>
          
          ${badgesMarkup(player, data)}
          
        </div>
      </div>

      ${playerDnaMarkup(player)}

      ${archetypeMixMarkup(player)}

      <div id="player-nav" class="player-nav">
        <a class="btn" href="${playerUrl(prev)}">← Previous: ${displayPlayerName(prev)}</a>
        <a class="btn" href="players.html">The Crew</a>
        <a class="btn" href="${playerUrl(next)}">Next: ${displayPlayerName(next)} →</a>
      </div>

      <div id="player-formula-display" class="player-formula-display">&nbsp;</div>

            <p class="player-formula-help muted">Mouse over any stat to reveal the calculation.</p>

      <div class="profile-grid player-stat-grid-enhanced">
        ${statsMarkup}
      </div>
    </div>
  `;

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
  const numericClass = isNumericValueText(valueText) ? " honors-card-value--numeric" : "";
  const cardSlug = String(category || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `
    <a class="champ-card stat-card-visual honors-card honors-card-${cardSlug} ${isTop ? "is-top-rank" : ""}" href="${href}">
      <div class="leader-banner-top">
        <div class="leader-banner-crown">${icon}</div>
        <div class="leader-banner-title">${category}</div>
      </div>

      <div class="honors-card-top leader-banner-body">
        ${player ? playerImageMarkup(player, "honors") : ""}
        <div class="honors-card-stack">
          <div class="honors-player-name">${nameMarkup}</div>
        </div>
      </div>

      <div
        class="honors-card-value ${valueClass}${numericClass}"
        data-animate-count="${isNumericValueText(valueText) ? "true" : "false"}"
        data-target-value="${valueText}"
      >${valueText}</div>
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
      { key: "tiltIndex", title: "On Tilt", icon: "😵‍💫" }
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
          <div class="honors-card-stack">
            <div class="honors-player-name">${displayPlayerName(leader)}</div>
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

window.tlptHandleRuleChipError = function tlptHandleRuleChipError(img) {
  const candidates = String(img.dataset.candidates || "")
    .split("|")
    .map(item => item.trim())
    .filter(Boolean);

  const currentIndex = Number(img.dataset.candidateIndex || 0);
  const nextIndex = currentIndex + 1;

  if (nextIndex < candidates.length) {
    img.dataset.candidateIndex = String(nextIndex);
    img.src = candidates[nextIndex];
    return;
  }

  img.classList.add("is-missing");
  const fallback = img.nextElementSibling;
  if (fallback && fallback.classList.contains("rules-chip-fallback")) {
    fallback.classList.add("is-visible");
  }
};

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
        loading="lazy"
        decoding="async"
        onerror="window.tlptHandleRuleChipError(this)"
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
    if (btn) btn.classList.toggle("active", key === formatKey);
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
    btn.classList.toggle("active", key === sortKey);
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
  renderChampions(data);
  renderStatLeaders(data);
  renderHonorsSummary(data);
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
