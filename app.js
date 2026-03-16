/* app.js */
async function loadSiteData() {
  const res = await fetch("site-data.json", { cache: "no-store" });
  return await res.json();
}

const DEFAULT_STANDINGS_SORT = "profit";
const DEFAULT_DASHBOARD_SORT = "profit";

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

const STAT_LEADER_CONFIG = [
  { key: "profit", title: "Profit Leader" },
  { key: "roi", title: "ROI Leader" },
  { key: "hits", title: "Hit King" },
  { key: "timesPlaced", title: "Cash King" },
  { key: "bubbles", title: "Bubble King" },
  { key: "trueSkillScore", title: "Power Leader" },
  { key: "luckIndex", title: "Luck Leader" },
  { key: "clutchIndex", title: "Clutch Leader" },
  { key: "aggressionIndex", title: "Aggression Leader" },
  { key: "survivorIndex", title: "Survivor Leader" },
  { key: "tiltIndex", title: "Tilt Leader" }
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
  return `${sign}$${Math.abs(num).toFixed(0)}`;
}

function fmtPct(n) {
  return `${(Number(n ?? 0) * 100).toFixed(1)}%`;
}

function fmtNum(n) {
  return Number(n ?? 0).toFixed(1);
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
  return Number(player?.entries ?? 0) < 5 ? `${player.name}*` : player.name;
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

function badgeList(player, data) {
  const players = data?.players || [];
  if (!players.length) return [];

  const topProfit = sortPlayers(players, "profit")[0]?.name;
  const topPower = sortPlayers(players, "trueSkillScore")[0]?.name;
  const topClutch = sortPlayers(players, "clutchIndex")[0]?.name;
  const topLuck = sortPlayers(players, "luckIndex")[0]?.name;
  const topHits = sortPlayers(players, "hits")[0]?.name;
  const topBubbles = sortPlayers(players, "bubbles")[0]?.name;

  const badges = [];
  if (player.name === topProfit) badges.push("💰 Profit Leader");
  if (player.name === topPower) badges.push("💪🏼 Power Leader");
  if (player.name === topClutch) badges.push("🎯 Clutch Leader");
  if (player.name === topLuck) badges.push("🍀 Luck Leader");
  if (player.name === topHits) badges.push("💥 Hit King");
  if (player.name === topBubbles) badges.push("🫧 Bubble King");
  if (Number(player.entries ?? 0) < 5) badges.push("✳️ Small Sample");
  return badges;
}

function badgesMarkup(player, data) {
  const badges = badgeList(player, data);
  if (!badges.length) return "";
  return `
    <div class="button-row stat-leader-badges">
      ${badges.map(badge => {
        const icon = badge.split(" ")[0];
        const text = badge.slice(icon.length).trim();
        return `<span class="stat-badge-text"><span class="stat-badge-icon">${icon}</span><span class="stat-badge-label">${text}</span></span>`;
      }).join("")}
    </div>
  `;
}

function formatRsvpLine(rsvp) {
  const confirmed = Number(rsvp?.confirmed ?? 0);
  const maybe = Number(rsvp?.maybe ?? 0);
  const tbd = Number(rsvp?.tbd ?? 0);
  const out = Number(rsvp?.out ?? 0);
  return `${confirmed} yes • ${maybe} maybe • ${tbd} tbd • ${out} no`;
}

function projectedTableSize(rsvp, maxSeats = 9) {
  const confirmed = Number(rsvp?.confirmed ?? 0);
  const maybe = Number(rsvp?.maybe ?? 0);
  const tbd = Number(rsvp?.tbd ?? 0);
  const minPlayers = Math.min(confirmed, maxSeats);
  const maxPlayers = Math.min(confirmed + maybe + tbd, maxSeats);
  return minPlayers === maxPlayers ? `${minPlayers} players` : `${minPlayers}–${maxPlayers} players`;
}

function tableFillPercent(rsvp, maxSeats = 9) {
  const confirmed = Number(rsvp?.confirmed ?? 0);
  return Math.min((confirmed / maxSeats) * 100, 100);
}

function tableFillMarkup(rsvp, maxSeats = 9) {
  const confirmed = Number(rsvp?.confirmed ?? 0);
  const fillPct = tableFillPercent(rsvp, maxSeats);
  return `
    <div class="fill-widget">
      <div class="fill-header">
        <span class="fill-label">Table Fill</span>
        <span class="fill-seats">${confirmed} / ${maxSeats} seats locked</span>
      </div>
      <div class="fill-bar"><div class="fill-bar-value" style="width:${fillPct}%"></div></div>
    </div>
  `;
}

function getCurrentEvents(data) {
  return [...(data?.events || [])];
}

function ensureStandingsHeadline(sortKey) {
  const table = document.getElementById("standings-table");
  if (!table) return;

  const parent = table.parentElement;
  if (!parent) return;

  let headline = document.getElementById("standings-current-stat");
  if (!headline) {
    headline = document.createElement("div");
    headline.id = "standings-current-stat";
    headline.className = "dashboard-current-stat standings-current-stat";
    parent.insertBefore(headline, table);
  }

  headline.innerHTML = `
    <span class="dashboard-current-icon">${statIcon(sortKey)}</span>
    <span>${formatStatLabel(sortKey)}</span>
  `;
}

function ensureDashboardHeadline(sortKey) {
  const grid = document.getElementById("dashboard-grid");
  if (!grid) return;

  let headline = document.getElementById("dashboard-current-stat");
  if (!headline) {
    headline = document.createElement("div");
    headline.id = "dashboard-current-stat";
    headline.className = "dashboard-current-stat";
    grid.parentNode.insertBefore(headline, grid);
  }

  const meta = DASHBOARD_META[sortKey] || { label: formatStatLabel(sortKey), icon: statIcon(sortKey), formula: "" };
  headline.innerHTML = `
    <span class="dashboard-current-icon">${meta.icon}</span>
    <span>${meta.label}</span>
  `;

  const formulaBox = document.getElementById("dashboard-formula-display");
  if (formulaBox) {
    formulaBox.textContent = meta.formula || "Click a stat button to reveal the calculation formula.";
  }
}

function renderHomeTopTable(data) {
  const tbody = document.querySelector("#home-standings-table tbody");
  if (!tbody || !data?.players?.length) return;

  tbody.innerHTML = sortPlayers(data.players, "profit").slice(0, 10).map(player => `
    <tr>
      <td>${playerInlineMarkup(player, "table")}</td>
      <td>${player.entries ?? "-"}</td>
      <td>${player.buyIns ?? "-"}</td>
      <td>${player.rebuys ?? "-"}</td>
      <td>${player.timesPlaced ?? "-"}</td>
      <td class="${statValueClass(player, "profit")}">${fmtMoney(player.profit)}</td>
      <td>${fmtNum(player.trueSkillScore)}</td>
      <td>${player.hits ?? "-"}</td>
    </tr>
  `).join("");
}

function renderHomePage(data) {
  const eventsEl = document.getElementById("home-events-list");
  if (eventsEl) {
    const homeEvents = getCurrentEvents(data);
    eventsEl.innerHTML = homeEvents.map(event => `
      <div class="event-card home-event-card compact-event-card">
        <div class="event-card-topline">
          <div class="kicker event-title-kicker">${event.title}</div>
          <div class="event-icon event-icon-card">♠</div>
        </div>
        <h3>${event.date}</h3>
        <p class="muted"><strong>Start:</strong> ${event.time}</p>
        <p class="muted"><strong>Estimated End:</strong> ${event.endTime || ""}</p>
        <p class="muted"><strong>Location:</strong> ${event.location}</p>
        <p class="muted">${event.address || ""}</p>
        <p class="muted"><strong>Projected Table Size:</strong> ${projectedTableSize(event.rsvp_counts, 9)}</p>
        ${tableFillMarkup(event.rsvp_counts, 9)}
        <p class="muted">${formatRsvpLine(event.rsvp_counts)}</p>
        <a class="btn btn-rsvp" href="${event.apple_invite_url}" target="_blank" rel="noopener">RSVP</a>
      </div>
    `).join("");
  }

  renderHomeTopTable(data);
}

function renderStandings(sortKey = DEFAULT_STANDINGS_SORT) {
  const tbody = document.querySelector("#standings-table tbody");
  if (!tbody || !window.siteData?.players) return;

  ensureStandingsHeadline(sortKey);

  const sorted = sortPlayers(window.siteData.players, sortKey);
  tbody.innerHTML = sorted.map((player, index) => `
    <tr>
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
}

function dashboardCardMarkup(player, sortKey) {
  return `
    <a class="player-card player-card-rich dashboard-card" href="${playerUrl(player)}">
      <div class="dashboard-card-top">
        ${playerImageMarkup(player, "dashboard")}
      </div>
      <div class="dashboard-player-name dashboard-player-name-below">${displayPlayerName(player)}</div>
      <div class="dashboard-card-value dashboard-stat-gold ${statValueClass(player, sortKey)}">${formatStatValue(player, sortKey)}</div>
    </a>
  `;
}

function renderDashboard(sortKey = DEFAULT_DASHBOARD_SORT) {
  const grid = document.getElementById("dashboard-grid");
  if (!grid || !window.siteData?.players) return;

  ensureDashboardHeadline(sortKey);
  const sorted = sortPlayers(window.siteData.players, sortKey);
  grid.innerHTML = sorted.map(player => dashboardCardMarkup(player, sortKey)).join("");
  setActiveSortButton("dashboard", sortKey);
}

function crewCardMarkup(player, data) {
  return `
    <a class="player-card player-card-rich crew-card" href="${playerUrl(player)}">
      <div class="player-card-top crew-card-top">
        ${playerImageMarkup(player, "crew")}
        <div class="player-card-meta crew-card-meta">
          <div class="kicker">Player</div>
          <h3>${displayPlayerName(player)}</h3>
        </div>
      </div>
      <div class="crew-summary-row">
        <span class="crew-profit ${statValueClass(player, "profit")}">Profit ${fmtMoney(player.profit)}</span>
        <span class="crew-power">Power ${fmtNum(player.trueSkillScore)}</span>
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

function renderPlayers(data) {
  const grid = document.getElementById("players-grid");
  if (!grid || !data?.players) return;
  const sorted = sortPlayers(data.players, "trueSkillScore");
  grid.innerHTML = sorted.map(player => crewCardMarkup(player, data)).join("");
}

function renderPlayerProfile(data) {
  const container = document.getElementById("player-profile");
  if (!container || !data?.players?.length) return;

  const params = new URLSearchParams(window.location.search);
  const requestedName = params.get("name");
  const players = sortPlayers(data.players, "trueSkillScore");
  const player = players.find(p => p.name === requestedName) || players[0];

  const index = players.findIndex(p => p.name === player.name);
  const prev = players[(index - 1 + players.length) % players.length];
  const next = players[(index + 1) % players.length];
  const quote = ensureQuoted(player?.notes || "");

  const profileStats = PROFILE_STAT_CONFIG.map(config => {

  let valueClass = "";

  if (config.profitClass) {
    valueClass = statValueClass(player, "profit");
  } 
  else if (config.profitClassFromValue) {
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
      <div class="metric player-stat-metric ${stat.valueClass || ""}">${stat.value}</div>
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
          <h2>${displayPlayerName(player)}</h2>
          <p class="profile-quote">${quote}</p>
          <p class="player-formula-help muted">Mouse over any stat to reveal the calculation formula.</p>
          ${badgesMarkup(player, data)}
        </div>
      </div>

      <div id="player-formula-display" class="player-formula-display">&nbsp;</div>

      <div id="player-nav" class="player-nav">
        <a class="btn" href="${playerUrl(prev)}">← Previous: ${displayPlayerName(prev)}</a>
        <a class="btn" href="players.html">The Crew</a>
        <a class="btn" href="${playerUrl(next)}">Next: ${displayPlayerName(next)} →</a>
      </div>

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
}

function renderSchedule(data) {
  const list = document.getElementById("schedule-list");
  if (!list) return;

  const events = getCurrentEvents(data);
  list.innerHTML = events.map(event => `
    <div class="event-card compact-event-card">
      <div class="event-card-topline">
        <div class="kicker event-title-kicker">${event.title}</div>
        <div class="event-icon event-icon-card">♠</div>
      </div>
      <h3>${event.date}</h3>
      <p class="muted"><strong>Start:</strong> ${event.time}</p>
      <p class="muted"><strong>Estimated End:</strong> ${event.endTime || ""}</p>
      <p class="muted"><strong>Location:</strong> ${event.location}</p>
      <p class="muted">${event.address || ""}</p>
      <p class="muted"><strong>Projected Table Size:</strong> ${projectedTableSize(event.rsvp_counts, 9)}</p>
      ${tableFillMarkup(event.rsvp_counts, 9)}
      <p class="muted">${formatRsvpLine(event.rsvp_counts)}</p>
      <a class="btn btn-rsvp" href="${event.apple_invite_url}" target="_blank" rel="noopener">RSVP on Apple Invites</a>
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

  return `
    <a class="champ-card stat-card-visual honors-card ${isTop ? "is-top-rank" : ""}" href="${href}">
      <div class="honors-card-top">
        ${player ? playerImageMarkup(player, "honors") : ""}
        <div class="honors-card-stack">
          <div class="honors-card-icon">${icon}</div>
          <div class="honors-card-label">${category}</div>
          <div class="honors-player-name">${nameMarkup}</div>
        </div>
      </div>
      <div class="honors-card-value ${valueClass}${numericClass}">${valueText}</div>
    </a>
  `;
}

function renderChampions(data) {
  const players = data?.players || [];
  const honorsEl = document.getElementById("champions-list");
  const recordsEl = document.getElementById("records-list");

  if (honorsEl && Array.isArray(data?.honors)) {
    honorsEl.innerHTML = data.honors.map(honor => {
      const player = players.find(p => p.name === honor.name);
      const valueClass = String(honor.type || "").toLowerCase().includes("profit")
        ? statValueClass(player || {}, "profit")
        : "";
      const valueText = String(honor.type || "").toLowerCase().includes("profit") && player
        ? fmtMoney(player.profit)
        : honor.note;
      return honorsCardMarkup(player, honor.type, honorIcon(honor.type), valueText, false, valueClass);
    }).join("");
  }

  if (recordsEl && Array.isArray(data?.records)) {
    recordsEl.innerHTML = data.records.map(record => {
      const player = players.find(p => p.name === record.name);
      const valueClass = String(record.label || "").toLowerCase().includes("profit")
        ? valueClassFromMoneyString(record.value)
        : "";
      return honorsCardMarkup(player, record.label, recordIcon(record.label), record.value, false, valueClass);
    }).join("");
  }
}

function renderStatLeaders(data) {
  const list = document.getElementById("leaders-list");
  if (!list) return;

  const players = data?.players || [];
  if (!players.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = STAT_LEADER_CONFIG.map(stat => {
    const leader = sortPlayers(players, stat.key)[0];
    const statConfig = getStatConfig(stat.key);
    const icon = statConfig?.icon || "🏅";
    const value = formatStatValue(leader, stat.key);
    const valueClass = stat.key === "profit"
      ? statValueClass(leader, "profit")
      : "";

    return `
      <a class="champ-card stat-card-visual honors-card" href="${playerUrl(leader)}">
        <div class="honors-card-top">
          ${playerImageMarkup(leader, "honors")}
          <div class="honors-card-stack">
            <div class="honors-card-icon">${icon}</div>
            <div class="honors-card-label">${stat.title}</div>
            <div class="honors-player-name">${displayPlayerName(leader)}</div>
          </div>
        </div>
        <div class="honors-card-value ${valueClass}${isNumericValueText(value) ? " honors-card-value--numeric" : ""}">
          ${value}
        </div>
      </a>
    `;
  }).join("");
}

function buildRulesTimerRail(format) {
  return `
    <div class="timer-rail">
      <div class="timer-pill">🕒 <strong>Levels:</strong> 20 min</div>
      <div class="timer-pill">☕ <strong>Breaks:</strong> 10 min</div>
      <div class="timer-pill">⏱ <strong>Estimated Runtime:</strong> ${Number(format.runtimeMinutes || 300)} min</div>
    </div>
  `;
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

  return `
    <div class="rules-chip-card" title="${label} • Set per player = ${chipCount}">
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
          <h3 class="format-title">${format.title}</h3>
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
  if (btn40) btn40.addEventListener("click", () => showFormat("40k"));
  if (btn500) btn500.addEventListener("click", () => showFormat("500k"));

  showFormat("40k");
}

function setActiveSortButton(scope, sortKey) {
  document.querySelectorAll(`[data-sort-scope="${scope}"] [data-sort], [data-${scope}-sort]`).forEach(btn => {
    const key = btn.dataset.sort || btn.dataset[`${scope}Sort`];
    btn.classList.toggle("active", key === sortKey);
  });
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

async function main() {
  const data = await loadSiteData();
  window.siteData = data;

  renderHomePage(data);
  renderStandings(DEFAULT_STANDINGS_SORT);
  renderDashboard(DEFAULT_DASHBOARD_SORT);
  renderPlayers(data);
  renderPlayerProfile(data);
  renderSchedule(data);
  renderChampions(data);
  renderStatLeaders(data);
  initRulesPage();
  initSorting();
}

document.addEventListener("DOMContentLoaded", () => {
  main().catch(error => {
    console.error("TLPT site load failed:", error);
  });
});
