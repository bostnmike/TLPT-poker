async function loadSiteData() {
  const res = await fetch("site-data.json");
  return await res.json();
}

const PLAYER_QUOTES = {
  "Nitro": "\"I don't believe you, Tony.\"",
  "Jeff T": "\"On my big blind?\"",
  "Vish": "\"Vamos!\"",
  "Vic": "\"I don't like it when you call.\"",
  "Brad R": "\"I raise.\"",
  "Red": "\"Variance-free Poker!\"",
  "Hayden D": "\"There's $400 sitting on my table at home.\"",
  "Wild Bill": "\"It's a skill game.\"",
  "Hiro": "\"That's a prime number.\"",
  "A.I. Dave": "\"Oh man! I caught some of that!\"",
  "ProvidenceMike": "\"I should'd be in this hand.\"",
  "The Architect": "\"Un-&^%$%-ing Believeable! How do you get there… Every Time!?\"",
  "Ahmed": "\"Get in there, Man!\"",
  "Chris O": "\"Can I still rebuy?\"",
  "Cougar": "\"Nice hand, you suck!\"",
  "NASA Al": "\"I'm running 5 mins late.\"",
  "BostnMike": "\"Play as tight as you want, Mike\"",
  "LiFo": "\"What's the worst that can happen?\"",
  "Li-Fo": "\"What's the worst that can happen?\"",
  "Nat": "\"Ya Fold\""
};

function normalizeQuoteName(name) {
  const trimmed = (name || "").trim();

  if (
    trimmed === "A.I. Dave" ||
    trimmed === "A.I Dave" ||
    trimmed === "A.l. Dave" ||
    trimmed === "A.l Dave"
  ) {
    return "A.I. Dave";
  }

  return trimmed;
}

function getPlayerQuote(name) {
  const normalized = normalizeQuoteName(name);
  return PLAYER_QUOTES[normalized] || "They just haven't said anything funny... yet!";
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

function sortPlayers(players, key) {
  return [...players].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));
}

function initialsFromName(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function displayPlayerName(player) {
  return Number(player.entries ?? 0) < 5 ? `${player.name}*` : player.name;
}

function playerImageMarkup(player, size = "medium") {
  if (player.image && player.image.trim() !== "") {
    return `
      <div class="player-avatar-wrap">
        <img
          class="player-avatar ${size}"
          src="${player.image}"
          alt="${player.name}"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="player-avatar-fallback ${size}" style="display:none;">
          ${initialsFromName(player.name)}
        </div>
      </div>
    `;
  }

  return `
    <div class="player-avatar-wrap">
      <div class="player-avatar-fallback ${size}">
        ${initialsFromName(player.name)}
      </div>
    </div>
  `;
}

function playerInlineMarkup(player, size = "small") {
  return `
    <div class="player-inline">
      ${playerImageMarkup(player, size)}
      <a href="player.html?name=${encodeURIComponent(player.name)}">${displayPlayerName(player)}</a>
    </div>
  `;
}

function leaderInlineMarkup(player, value, size = "small") {
  return `
    <div class="leader-inline">
      ${playerImageMarkup(player, size)}
      <span class="leader-inline-icon-text">${displayPlayerName(player)} (${value})</span>
    </div>
  `;
}

function formatStatLabel(key) {
  const labels = {
    trueSkillScore: "Power",
    buyIns: "Buy-ins",
    rebuys: "Rebuys",
    entries: "Entries",
    hits: "Hits",
    timesPlaced: "Cashes",
    bubbles: "Bubbles",
    profit: "Profit",
    roi: "ROI",
    cashRate: "Cash Rate",
    bubbleRate: "Bubble Rate",
    hitRate: "Hit Rate",
    luckIndex: "Luck",
    clutchIndex: "Clutch",
    aggressionIndex: "Aggression",
    survivorIndex: "Survivor",
    tiltIndex: "Tilt"
  };
  return labels[key] || key;
}

function formatStatValue(player, key) {
  if (key === "profit") return fmtMoney(player[key]);
  if (["roi", "cashRate", "bubbleRate", "hitRate"].includes(key)) return fmtPct(player[key]);
  if (["trueSkillScore", "luckIndex", "clutchIndex", "aggressionIndex", "survivorIndex", "tiltIndex"].includes(key)) return fmtNum(player[key]);
  return player[key] ?? "-";
}

function badgeList(player, data) {
  const players = data.players || [];
  if (!players.length) return [];

  const topProfit = sortPlayers(players, "profit")[0]?.name;
  const topPower = sortPlayers(players, "trueSkillScore")[0]?.name;
  const topClutch = sortPlayers(players, "clutchIndex")[0]?.name;
  const topLuck = sortPlayers(players, "luckIndex")[0]?.name;
  const topHits = sortPlayers(players, "hits")[0]?.name;
  const topBubbles = sortPlayers(players, "bubbles")[0]?.name;

  const badges = [];
  if (player.name === topProfit) badges.push("💰 Profit Leader");
  if (player.name === topPower) badges.push("🏆 Power Leader");
  if (player.name === topClutch) badges.push("🎯 Clutch Leader");
  if (player.name === topLuck) badges.push("🔥 Running Hot");
  if (player.name === topHits) badges.push("💥 Hit King");
  if (player.name === topBubbles) badges.push("🫧 Bubble King");
  if (Number(player.entries ?? 0) < 5) badges.push("✳️ Small Sample");

  return badges;
}

function badgesMarkup(player, data) {
  const badges = badgeList(player, data);
  if (!badges.length) return "";

  return `
    <div class="button-row stat-leader-badges" style="margin:10px 0 0 0;">
      ${badges.map(badge => {
        const icon = badge.split(" ")[0];
        const text = badge.substring(icon.length).trim();
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

  if (minPlayers === maxPlayers) {
    return `${minPlayers} players`;
  }

  return `${minPlayers}–${maxPlayers} players`;
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
      <div class="fill-bar">
        <div class="fill-bar-value" style="width:${fillPct}%"></div>
      </div>
    </div>
  `;
}

function getCurrentEvents(data) {
  const events = data.events || [];
  if (events.length < 2) return events;

  return [
    {
      ...events[0],
      rsvp_counts: { confirmed: 7, maybe: 1, tbd: 2, out: 4 }
    },
    {
      ...events[1],
      rsvp_counts: { confirmed: 5, maybe: 1, tbd: 2, out: 4 }
    }
  ];
}

function renderHomePage(data) {
  const eventsEl = document.getElementById("home-events-list");
  if (eventsEl) {
    const homeEvents = getCurrentEvents(data);

    eventsEl.innerHTML = homeEvents.map(event => `
      <div class="event-card home-event-card">
        <div class="event-card-topline">
          <div class="kicker">${event.title}</div>
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

  const players = data.players || [];
  if (!players.length) return;

  const profit = sortPlayers(players, "profit")[0];
  const power = sortPlayers(players, "trueSkillScore")[0];
  const hits = sortPlayers(players, "hits")[0];
  const bubbles = sortPlayers(players, "bubbles")[0];

  const profitEl = document.getElementById("home-profit-leader");
  const powerEl = document.getElementById("home-power-leader");
  const hitEl = document.getElementById("home-hit-leader");
  const bubbleEl = document.getElementById("home-bubble-leader");

  if (profitEl && profit) profitEl.innerHTML = leaderInlineMarkup(profit, fmtMoney(profit.profit), "small");
  if (powerEl && power) powerEl.innerHTML = leaderInlineMarkup(power, fmtNum(power.trueSkillScore), "small");
  if (hitEl && hits) hitEl.innerHTML = leaderInlineMarkup(hits, hits.hits, "small");
  if (bubbleEl && bubbles) bubbleEl.innerHTML = leaderInlineMarkup(bubbles, bubbles.bubbles, "small");

  const tbody = document.querySelector("#home-standings-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  sortPlayers(players, "profit").slice(0, 8).forEach(player => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${playerInlineMarkup(player, "tiny")}</td>
      <td>${player.entries ?? "-"}</td>
      <td>${player.timesPlaced ?? "-"}</td>
      <td>${fmtMoney(player.profit)}</td>
      <td>${fmtNum(player.trueSkillScore)}</td>
      <td>${player.hits ?? "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderStandingsPage(data) {
  const tbody = document.querySelector("#standings-table tbody");
  if (!tbody) return;

  const players = sortPlayers(data.players || [], "profit");
  tbody.innerHTML = "";

  players.forEach(player => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${playerInlineMarkup(player, "tiny")}</td>
      <td>${player.entries ?? "-"}</td>
      <td>${player.buyIns ?? "-"}</td>
      <td>${player.rebuys ?? "-"}</td>
      <td>${player.timesPlaced ?? "-"}</td>
      <td>${player.bubbles ?? "-"}</td>
      <td>${player.hits ?? "-"}</td>
      <td>${fmtMoney(player.profit)}</td>
      <td>${fmtPct(player.roi)}</td>
      <td>${fmtNum(player.trueSkillScore)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function statCardMarkup(title, value, subtitle, icon = "♠", badge = "") {
  return `
    <div class="stat-card stat-card-visual">
      <div class="stat-topline">
        <div class="stat-icon-wrap"><span class="stat-icon">${icon}</span></div>
        ${badge ? `<div class="stat-badge">${badge}</div>` : ""}
      </div>
      <h3>${title}</h3>
      <p class="value">${value}</p>
      <p class="muted">${subtitle}</p>
    </div>
  `;
}

function renderDashboardPage(data) {
  const host = document.getElementById("dashboard-grid");
  if (!host) return;

  const players = data.players || [];
  if (!players.length) return;

  const profit = sortPlayers(players, "profit")[0];
  const power = sortPlayers(players, "trueSkillScore")[0];
  const luck = sortPlayers(players, "luckIndex")[0];
  const clutch = sortPlayers(players, "clutchIndex")[0];
  const hits = sortPlayers(players, "hits")[0];
  const bubbles = sortPlayers(players, "bubbles")[0];

  host.innerHTML = [
    statCardMarkup("Profit Leader", fmtMoney(profit.profit), displayPlayerName(profit), "💰", "Leader"),
    statCardMarkup("Power Leader", fmtNum(power.trueSkillScore), displayPlayerName(power), "🏆", "Top"),
    statCardMarkup("Luck Leader", fmtNum(luck.luckIndex), displayPlayerName(luck), "🍀", "Hot"),
    statCardMarkup("Clutch Leader", fmtNum(clutch.clutchIndex), displayPlayerName(clutch), "🎯", "Closer"),
    statCardMarkup("Hit Leader", `${hits.hits}`, displayPlayerName(hits), "💥", "KO"),
    statCardMarkup("Bubble Leader", `${bubbles.bubbles}`, displayPlayerName(bubbles), "🫧", "Ouch")
  ].join("");
}

function buildPlayerStatCards(player) {
  const keys = [
    "entries",
    "buyIns",
    "rebuys",
    "hits",
    "timesPlaced",
    "bubbles",
    "profit",
    "roi",
    "cashRate",
    "bubbleRate",
    "hitRate",
    "trueSkillScore",
    "luckIndex",
    "clutchIndex",
    "aggressionIndex",
    "survivorIndex",
    "tiltIndex"
  ];

  return keys.map(key => `
    <div class="profile-stat">
      <div class="kicker">${formatStatLabel(key)}</div>
      <div class="metric ${key === "profit" ? (Number(player[key]) >= 0 ? "positive" : "negative") : ""}">
        ${formatStatValue(player, key)}
      </div>
    </div>
  `).join("");
}

function renderPlayersPage(data) {
  const grid = document.getElementById("players-grid");
  if (!grid) return;

  const players = sortPlayers(data.players || [], "trueSkillScore");
  grid.innerHTML = players.map(player => `
    <div class="player-card">
      <div class="player-card-top">
        ${playerImageMarkup(player, "medium")}
        <div style="min-width:0;">
          <div class="kicker">Player</div>
          <h3><a href="player.html?name=${encodeURIComponent(player.name)}">${displayPlayerName(player)}</a></h3>
          <p class="muted">Power ${fmtNum(player.trueSkillScore)} • Profit ${fmtMoney(player.profit)}</p>
        </div>
      </div>
      <p class="muted"><strong>Entries:</strong> ${player.entries ?? "-"}</p>
      <p class="muted"><strong>Cashes:</strong> ${player.timesPlaced ?? "-"}</p>
      <p class="muted"><strong>Hits:</strong> ${player.hits ?? "-"}</p>
      <p class="muted"><strong>Bubble Rate:</strong> ${fmtPct(player.bubbleRate)}</p>
      ${badgesMarkup(player, data)}
    </div>
  `).join("");
}

function renderSinglePlayerPage(data) {
  const shell = document.getElementById("player-profile");
  if (!shell) return;

  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");
  if (!name) return;

  const player = (data.players || []).find(p => p.name === name);
  if (!player) {
    shell.innerHTML = `<div class="section"><p>Player not found.</p></div>`;
    return;
  }

  shell.innerHTML = `
    <div class="profile-shell">
      <div class="profile-hero">
        ${playerImageMarkup(player, "medium")}
        <div>
          <div class="kicker">Player Profile</div>
          <h2 style="margin:0;">${displayPlayerName(player)}</h2>
          <p class="profile-quote">${getPlayerQuote(player.name)}</p>
          ${badgesMarkup(player, data)}
        </div>
      </div>
      <div class="profile-grid">
        ${buildPlayerStatCards(player)}
      </div>
    </div>
  `;
}

function renderSchedulePage(data) {
  const host = document.getElementById("schedule-list");
  if (!host) return;

  const events = getCurrentEvents(data);

  host.innerHTML = events.map(event => `
    <div class="event-card">
      <div class="event-card-topline">
        <div class="kicker">${event.title}</div>
        <div class="event-icon event-icon-card">♦</div>
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
  const key = (type || "").toLowerCase();
  if (key.includes("champ")) return "🏆";
  if (key.includes("player")) return "⭐";
  if (key.includes("mvp")) return "👑";
  if (key.includes("rookie")) return "🌟";
  if (key.includes("bubble")) return "🫧";
  if (key.includes("luck")) return "🍀";
  if (key.includes("clutch")) return "🎯";
  return "🏅";
}

function recordIcon(label) {
  const key = (label || "").toLowerCase();
  if (key.includes("profit")) return "💰";
  if (key.includes("roi")) return "📈";
  if (key.includes("hit")) return "💥";
  if (key.includes("cash")) return "💵";
  if (key.includes("bubble")) return "🫧";
  if (key.includes("power")) return "🏆";
  return "📊";
}

function renderChampions(data) {
  const honorsEl = document.getElementById("champions-list");
  const recordsEl = document.getElementById("records-list");

  if (honorsEl && Array.isArray(data.honors)) {
    honorsEl.innerHTML = data.honors.map(honor => {
      const player = (data.players || []).find(p => p.name === honor.name);
      return `
        <div class="champ-card stat-card-visual">
          <div class="honor-card-icon">${honorIcon(honor.type)}</div>
          <div class="player-card-top">
            ${player ? playerImageMarkup(player, "small") : ""}
            <div>
              <div class="kicker">${honor.type}</div>
              <h3>${player ? displayPlayerName(player) : honor.name}</h3>
            </div>
          </div>
          <p class="muted">${honor.note}</p>
        </div>
      `;
    }).join("");
  }

  if (recordsEl && Array.isArray(data.records)) {
    recordsEl.innerHTML = data.records.map(record => {
      const player = (data.players || []).find(p => p.name === record.name);
      return `
        <div class="champ-card stat-card-visual">
          <div class="honor-card-icon">${recordIcon(record.label)}</div>
          <div class="player-card-top">
            ${player ? playerImageMarkup(player, "small") : ""}
            <div>
              <div class="kicker">${record.label}</div>
              <h3>${player ? displayPlayerName(player) : record.name}</h3>
            </div>
          </div>
          <p class="muted">${record.value}</p>
        </div>
      `;
    }).join("");
  }
}

/* Rules page */

const RULES_FORMATS = {
  "40k": {
    title: "40K Small Blind Ante",
    subtitle: "Starting stack: 40,000 • All levels 20 minutes • All breaks 10 minutes",
    runtimeMinutes: 300,
    chips: [
      { label: "T-25", count: 20, image: "images/site/chip-T-25.png" },
      { label: "T-100", count: 20, image: "images/site/chip-T-100.png" },
      { label: "T-500", count: 15, image: "images/site/chip-T-500.png" },
      { label: "T-1000", count: 15, image: "images/site/chip-T-1000.png" },
      { label: "T-5000", count: 3, image: "images/site/chip-T-5000.png" },
      { label: "T-10000", count: 0, image: "images/site/chip-T-10000.png" },
      { label: "T-25000", count: 0, image: "images/site/chip-T-25000.png" }
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
      { type: "level", level: "8", sb: "1,500", bb: "3,000", ante: "1,500", eff: "" },
      { type: "level", level: "9", sb: "2,500", bb: "5,000", ante: "2,500", eff: "" },
      { type: "level", level: "10", sb: "4,000", bb: "8,000", ante: "4,000", eff: "" },
      { type: "break", note: "BREAK — Chip up T-500" },
      { type: "level", level: "11", sb: "6,000", bb: "12,000", ante: "6,000", eff: "" },
      { type: "level", level: "12", sb: "10,000", bb: "20,000", ante: "10,000", eff: "" },
      { type: "level", level: "13", sb: "15,000", bb: "30,000", ante: "15,000", eff: "" },
      { type: "break", note: "BREAK — Chip up T-1000 & T-5000" },
      { type: "level", level: "14", sb: "25,000", bb: "50,000", ante: "25,000", eff: "" },
      { type: "level", level: "15", sb: "40,000", bb: "80,000", ante: "40,000", eff: "" },
      { type: "level", level: "16", sb: "60,000", bb: "120,000", ante: "60,000", eff: "" }
    ]
  },
  "500k": {
    title: "500K Small Blind Ante",
    subtitle: "Starting stack: 500,000 • All levels 20 minutes • All breaks 10 minutes",
    runtimeMinutes: 300,
    chips: [
      { label: "T-500", count: 20, image: "images/site/chip-T-500.png" },
      { label: "T-1000", count: 20, image: "images/site/chip-T-1000.png" },
      { label: "T-5000", count: 20, image: "images/site/chip-T-5000.png" },
      { label: "T-10000", count: 12, image: "images/site/chip-T-10000.png" },
      { label: "T-25000", count: 6, image: "images/site/chip-T-25000.png" },
      { label: "T-100000", count: 1, image: "images/site/chip-T-100000.png" },
      { label: "T-250000", count: 0, image: "images/site/chip-T-250000.png" }
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
      { type: "level", level: "8", sb: "15,000", bb: "30,000", ante: "15,000", eff: "" },
      { type: "level", level: "9", sb: "25,000", bb: "50,000", ante: "25,000", eff: "" },
      { type: "level", level: "10", sb: "40,000", bb: "80,000", ante: "40,000", eff: "" },
      { type: "break", note: "BREAK — Chip up T-5000" },
      { type: "level", level: "11", sb: "60,000", bb: "120,000", ante: "60,000", eff: "" },
      { type: "level", level: "12", sb: "100,000", bb: "200,000", ante: "100,000", eff: "" },
      { type: "level", level: "13", sb: "150,000", bb: "300,000", ante: "150,000", eff: "" },
      { type: "break", note: "BREAK — Chip up T-10000" },
      { type: "level", level: "14", sb: "200,000", bb: "400,000", ante: "200,000", eff: "" },
      { type: "level", level: "15", sb: "300,000", bb: "600,000", ante: "300,000", eff: "" },
      { type: "level", level: "16", sb: "500,000", bb: "1,000,000", ante: "500,000", eff: "" }
    ]
  }
};

function buildRulesTimerRail(format) {
  const totalLevels = format.levels.filter(row => row.type === "level").length;
  const totalBreaks = format.levels.filter(row => row.type === "break").length;
  const calculatedMinutes = (totalLevels * 20) + (totalBreaks * 10);
  const totalMinutes = Number(format.runtimeMinutes ?? calculatedMinutes);

  return `
    <div class="timer-rail">
      <div class="timer-pill">⏱ <strong>Levels:</strong> ${totalLevels} × 20 min</div>
      <div class="timer-pill">☕ <strong>Breaks:</strong> ${totalBreaks} × 10 min</div>
      <div class="timer-pill">🕒 <strong>Estimated Runtime:</strong> ${totalMinutes} min</div>
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
  const extMatch = original.match(/\.([a-zA-Z0-9]+)$/);
  const originalExt = extMatch ? extMatch[1].toLowerCase() : "png";
  const exts = [originalExt, "png", "webp", "jpg", "jpeg"];
  const baseVariants = [
    `chip-T-${labelNumber}`,
    `chip-T${labelNumber}`,
    `chip-t-${labelNumber}`,
    `chip-t${labelNumber}`
  ];

  const candidates = [];
  if (original) candidates.push(original);

  baseVariants.forEach(base => {
    exts.forEach(ext => {
      candidates.push(`${dir}${base}.${ext}`);
    });
  });

  return [...new Set(candidates.filter(Boolean))];
}

window.tlptHandleRuleChipError = function tlptHandleRuleChipError(img) {
  const candidates = (img.dataset.candidates || "")
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

function buildRulesChipCard(chip) {
  const candidates = buildChipImageCandidates(chip);
  const candidateAttr = escapeHtmlAttr(candidates.join("|"));
  const firstCandidate = escapeHtmlAttr(candidates[0] || "");
  const label = escapeHtmlAttr(chip.label);
  const countText = `Starting count per player: ${chip.count}`;

  return `
    <div class="rules-chip-card" title="${label} • ${countText}">
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
      <div class="rules-chip-count">${countText}</div>
    </div>
  `;
}

function buildRulesChipPanel(format) {
  return `
    <div class="rules-chip-panel">
      <div class="rules-chip-grid">
        ${format.chips.map(chip => buildRulesChipCard(chip)).join("")}
      </div>
    </div>
  `;
}

function buildRulesBlindTable(format) {
  let rowIndex = 0;

  const rows = format.levels.map(row => {
    if (row.type === "break") {
      return `
        <tr class="blind-break">
          <td colspan="5">${row.note}</td>
        </tr>
      `;
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
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p class="blind-note">Gold rows mark 10-minute breaks and chip-up points. Black and gray rows are 20-minute live levels.</p>
    </div>
  `;
}

function setActiveFormatButton(formatKey) {
  const btn40 = document.getElementById("format-btn-40k");
  const btn500 = document.getElementById("format-btn-500k");
  if (btn40) btn40.classList.toggle("active", formatKey === "40k");
  if (btn500) btn500.classList.toggle("active", formatKey === "500k");
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
          <p class="format-subtitle">${format.subtitle}</p>
        </div>
      </div>

      ${buildRulesTimerRail(format)}
      ${buildRulesChipPanel(format)}
      ${buildRulesBlindTable(format)}
    </div>
  `;
}

function initRulesPage() {
  if (!document.getElementById("format-content")) return;
  showFormat("40k");
}

function renderMediaPage(data) {
  const host = document.getElementById("media-grid");
  if (!host || !Array.isArray(data.media)) return;

  host.innerHTML = data.media.map(item => {
    const isYouTube = item.type === "youtube";
    const isX = item.type === "x";
    const isLink = item.type === "link";

    let embed = "";
    if (isYouTube) {
      embed = `
        <div class="media-frame">
          <div class="media-embed-wrap">
            <iframe
              src="${item.embed}"
              title="${item.title}"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen>
            </iframe>
          </div>
        </div>
      `;
    } else if (isX) {
      embed = `
        <div class="media-frame">
          <div class="media-x-wrap">
            <blockquote class="twitter-tweet">
              <a href="${item.url}">${item.title}</a>
            </blockquote>
          </div>
        </div>
      `;
    } else if (isLink) {
      embed = `
        <a class="media-frame media-frame-link" href="${item.url}" target="_blank" rel="noopener">
          <div class="media-link-panel">
            <div class="media-link-icon">${item.icon || "🔗"}</div>
            <div class="kicker">${item.kicker || "Link"}</div>
            <strong>${item.title}</strong>
          </div>
        </a>
      `;
    }

    return `
      <div class="media-card">
        ${embed}
        <div class="media-copy">
          <div class="kicker">${item.kicker || "Media"}</div>
          <h3>${item.title}</h3>
          <p class="muted">${item.description || ""}</p>
          ${item.url ? `<a class="btn" href="${item.url}" target="_blank" rel="noopener">Open</a>` : ""}
        </div>
      </div>
    `;
  }).join("");

  if (window.twttr && typeof window.twttr.widgets?.load === "function") {
    window.twttr.widgets.load();
  }
}

async function main() {
  const data = await loadSiteData();

  renderHomePage(data);
  renderStandingsPage(data);
  renderDashboardPage(data);
  renderPlayersPage(data);
  renderSinglePlayerPage(data);
  renderSchedulePage(data);
  renderChampions(data);
  initRulesPage();
  renderMediaPage(data);
}

main();
