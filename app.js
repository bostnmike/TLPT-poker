async function loadSiteData() {
  const res = await fetch("site-data.json", { cache: "no-store" });
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

const DEFAULT_STANDINGS_SORT = "profit";
const DEFAULT_DASHBOARD_SORT = "trueSkillScore";

const DASHBOARD_META = {
  trueSkillScore: { label: "Power", icon: "🏆" },
  profit: { label: "Profit", icon: "💰" },
  hits: { label: "Hits", icon: "💥" },
  timesPlaced: { label: "Cashes", icon: "💵" },
  bubbles: { label: "Bubbles", icon: "🫧" },
  luckIndex: { label: "Luck", icon: "🍀" },
  clutchIndex: { label: "Clutch", icon: "🎯" },
  roi: { label: "ROI", icon: "📈" }
};

function normalizeQuoteName(name) {
  const trimmed = (name || "").trim();
  if (["A.I. Dave", "A.I Dave", "A.l. Dave", "A.l Dave"].includes(trimmed)) {
    return "A.I. Dave";
  }
  return trimmed;
}

function getPlayerQuote(name) {
  return PLAYER_QUOTES[normalizeQuoteName(name)] || "They just haven't said anything funny... yet!";
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
  return [...(players || [])].sort((a, b) => {
    const aVal = Number(a?.[key] ?? 0);
    const bVal = Number(b?.[key] ?? 0);
    if (bVal !== aVal) return bVal - aVal;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
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

function statIcon(key) {
  const icons = {
    profit: "💰",
    roi: "📈",
    trueSkillScore: "🏆",
    hits: "💥",
    timesPlaced: "💵",
    cashRate: "💵",
    bubbles: "🫧",
    bubbleRate: "🫧",
    hitRate: "💥",
    luckIndex: "🍀",
    clutchIndex: "🎯",
    aggressionIndex: "⚡",
    survivorIndex: "🛟",
    tiltIndex: "🫨",
    entries: "🎟️",
    buyIns: "🎟️",
    rebuys: "♻️"
  };
  return icons[key] || "♠";
}

function formatStatValue(player, key) {
  if (key === "profit") return fmtMoney(player[key]);
  if (["roi", "cashRate", "bubbleRate", "hitRate"].includes(key)) return fmtPct(player[key]);
  if (["trueSkillScore", "luckIndex", "clutchIndex", "aggressionIndex", "survivorIndex", "tiltIndex"].includes(key)) return fmtNum(player[key]);
  return String(player[key] ?? "-");
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
  if (player.name === topPower) badges.push("🏆 Power Leader");
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

function removeTextAboveHeader(pageSelector, forbiddenText) {
  const page = document.querySelector(pageSelector) || document.body;
  const text = forbiddenText.trim().toLowerCase();

  page.querySelectorAll(".kicker, .tag, p, div, span").forEach(el => {
    if (el.children.length === 0 && el.textContent.trim().toLowerCase() === text) {
      el.remove();
    }
  });
}

function ensureHomeEventsHeaderLayout() {
  const titleEl = Array.from(document.querySelectorAll("h1, h2, h3")).find(
    el => el.textContent.trim().toLowerCase() === "this week's events"
  );
  if (!titleEl) return;

  const parent = titleEl.parentElement;
  if (!parent) return;

  if (!parent.classList.contains("events-header-row")) {
    parent.classList.add("events-header-row");
  }

  let suits = parent.querySelector(".events-header-suits");
  if (!suits) {
    suits = document.createElement("div");
    suits.className = "events-header-suits";
    suits.innerHTML = `
      <span class="events-header-suit">♠</span>
      <span class="events-header-suit">♥</span>
      <span class="events-header-suit">♣</span>
      <span class="events-header-suit">♦</span>
    `;
    parent.insertBefore(suits, titleEl);
  }

  titleEl.classList.add("events-header-title");
}

function removeLeagueLeaderSection() {
  const leaderGrid = document.querySelector(".leader-grid");
  if (leaderGrid) {
    const section = leaderGrid.closest(".section") || leaderGrid.parentElement;
    if (section) section.remove();
  }

  document.querySelectorAll("h1, h2, h3").forEach(heading => {
    const text = heading.textContent.trim().toLowerCase();
    if (text.includes("league leader")) {
      const section = heading.closest(".section") || heading.parentElement;
      if (section) section.remove();
    }
  });
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

function renderHomeTopTable(data) {
  const tbody = document.querySelector("#home-standings-table tbody");
  if (!tbody || !data?.players?.length) return;

  tbody.innerHTML = sortPlayers(data.players, "profit").slice(0, 10).map(player => `
    <tr>
      <td>${playerInlineMarkup(player, "table")}</td>
      <td>${player.entries ?? "-"}</td>
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
      <div class="event-card home-event-card">
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
  ensureHomeEventsHeaderLayout();
  removeLeagueLeaderSection();

  const heroSub = Array.from(document.querySelectorAll(".hero-sub, .muted")).find(
    el => el.textContent.includes("Weekly games, live RSVP tracking, projected table size, and the full TLPT stat universe.")
  );
  if (heroSub) heroSub.classList.add("muted-copy");
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
      <td>${player.entries ?? "-"}</td>
      <td>${player.buyIns ?? "-"}</td>
      <td>${player.rebuys ?? "-"}</td>
      <td>${player.hits ?? "-"}</td>
      <td>${player.timesPlaced ?? "-"}</td>
      <td>${player.bubbles ?? "-"}</td>
      <td class="${statValueClass(player, "profit")}">${fmtMoney(player.profit)}</td>
      <td>${fmtPct(player.roi)}</td>
      <td>${fmtNum(player.trueSkillScore)}</td>
      <td>${fmtNum(player.luckIndex)}</td>
      <td>${fmtNum(player.clutchIndex)}</td>
    </tr>
  `).join("");

  setActiveSortButton("standings", sortKey);
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

  const meta = DASHBOARD_META[sortKey] || { label: formatStatLabel(sortKey), icon: statIcon(sortKey) };
  headline.innerHTML = `<span class="dashboard-current-icon">${meta.icon}</span><span>${meta.label}</span>`;
}

function dashboardCardMarkup(player, sortKey, index) {
  return `
    <a class="player-card player-card-rich dashboard-card ${index === 0 ? "is-top-rank" : ""}" href="${playerUrl(player)}">
      <div class="dashboard-card-top">
        ${playerImageMarkup(player, "dashboard")}
        <div class="dashboard-player-name">${displayPlayerName(player)}</div>
      </div>
      <div class="dashboard-card-value dashboard-stat-gold ${statValueClass(player, sortKey)}">${formatStatValue(player, sortKey)}</div>
    </a>
  `;
}

function renderDashboard(sortKey = DEFAULT_DASHBOARD_SORT) {
  const grid = document.getElementById("dashboard-grid");
  if (!grid || !window.siteData?.players) return;

  ensureDashboardHeadline(sortKey);
  const sorted = sortPlayers(window.siteData.players, sortKey);
  grid.innerHTML = sorted.map((player, index) => dashboardCardMarkup(player, sortKey, index)).join("");
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

  removeTextAboveHeader("main, body", "TLPT");
  document.querySelectorAll("p, .muted").forEach(el => {
    if (el.textContent.includes("Mouse over a player for a quick view of some key stats")) {
      el.classList.add("crew-help-copy");
    }
  });
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

  const statsMarkup = `
    <div class="profile-grid">
      <div class="profile-stat"><span class="kicker">${statIcon("entries")} Entries</span><div class="metric">${player.entries ?? "-"}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("buyIns")} Buy-ins</span><div class="metric">${player.buyIns ?? "-"}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("rebuys")} Rebuys</span><div class="metric">${player.rebuys ?? "-"}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("hits")} Hits</span><div class="metric">${player.hits ?? "-"}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("timesPlaced")} Cashes</span><div class="metric">${player.timesPlaced ?? "-"}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("bubbles")} Bubbles</span><div class="metric">${player.bubbles ?? "-"}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("profit")} Profit</span><div class="metric ${statValueClass(player, "profit")}">${fmtMoney(player.profit)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("roi")} ROI</span><div class="metric">${fmtPct(player.roi)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("trueSkillScore")} Power</span><div class="metric">${fmtNum(player.trueSkillScore)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("luckIndex")} Luck</span><div class="metric">${fmtNum(player.luckIndex)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("clutchIndex")} Clutch</span><div class="metric">${fmtNum(player.clutchIndex)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("cashRate")} Cash Rate</span><div class="metric">${fmtPct(player.cashRate)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("bubbleRate")} Bubble Rate</span><div class="metric">${fmtPct(player.bubbleRate)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("hitRate")} Hit Rate</span><div class="metric">${fmtPct(player.hitRate)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("aggressionIndex")} Aggression</span><div class="metric">${fmtNum(player.aggressionIndex)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("survivorIndex")} Survivor</span><div class="metric">${fmtNum(player.survivorIndex)}</div></div>
      <div class="profile-stat"><span class="kicker">${statIcon("tiltIndex")} Tilt</span><div class="metric">${fmtNum(player.tiltIndex)}</div></div>
    </div>
  `;

  container.innerHTML = `
    <div class="profile-shell">
      <div class="profile-hero profile-hero-wide">
        ${playerImageMarkup(player, "profile")}
        <div class="profile-hero-copy">
          <div class="kicker">Player Profile</div>
          <h2>${displayPlayerName(player)}</h2>
          <p class="profile-quote">${getPlayerQuote(player.name)}</p>
          ${badgesMarkup(player, data)}
        </div>
      </div>

      <div id="player-nav" class="player-nav">
        <a class="btn" href="${playerUrl(prev)}">← Previous: ${displayPlayerName(prev)}</a>
        <a class="btn" href="players.html">The Crew</a>
        <a class="btn" href="${playerUrl(next)}">Next: ${displayPlayerName(next)} →</a>
      </div>

      ${statsMarkup}
    </div>
  `;
}

function renderSchedule(data) {
  const list = document.getElementById("schedule-list");
  if (!list) return;

  const events = getCurrentEvents(data);
  list.innerHTML = events.map(event => `
    <div class="event-card">
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

  removeTextAboveHeader("main, body", "The Caahhd Room");
}

function honorIcon(type) {
  const key = String(type || "").toLowerCase();
  if (key.includes("profit")) return "💰";
  if (key.includes("power")) return "🏆";
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
  if (key.includes("power")) return "🏆";
  if (key.includes("clutch")) return "🎯";
  if (key.includes("luck")) return "🍀";
  return "📊";
}

function honorsCardMarkup(player, category, icon, descriptionText, valueText, isTop = false, valueClass = "") {
  const href = player ? playerUrl(player) : "#";
  const nameMarkup = player ? displayPlayerName(player) : "Unknown";

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
      <div class="honors-card-description">${descriptionText}</div>
      <div class="honors-card-value ${valueClass}">${valueText}</div>
    </a>
  `;
}

function ensureHonorsSectionTitles() {
  document.querySelectorAll("h1, h2, h3").forEach(el => {
    const text = el.textContent.trim().toLowerCase();
    if (text === "league honors") el.textContent = "Current League Honors";
    if (text === "league records") el.textContent = "Current League Records";
  });
}

function renderChampions(data) {
  const players = data?.players || [];
  const honorsEl = document.getElementById("champions-list");
  const recordsEl = document.getElementById("records-list");

  ensureHonorsSectionTitles();

  if (honorsEl && Array.isArray(data?.honors)) {
    honorsEl.innerHTML = data.honors.map((honor, index) => {
      const player = players.find(p => p.name === honor.name);
      const valueClass = String(honor.type || "").toLowerCase().includes("profit")
        ? statValueClass(player || {}, "profit")
        : "";
      const valueText = String(honor.type || "").toLowerCase().includes("profit") && player
        ? fmtMoney(player.profit)
        : honor.note;
      return honorsCardMarkup(player, honor.type, honorIcon(honor.type), "Current category leader", valueText, index === 0, valueClass);
    }).join("");
  }

  if (recordsEl && Array.isArray(data?.records)) {
    recordsEl.innerHTML = data.records.map((record, index) => {
      const player = players.find(p => p.name === record.name);
      const valueClass = String(record.label || "").toLowerCase().includes("profit")
        ? valueClassFromMoneyString(record.value)
        : "";
      return honorsCardMarkup(player, record.label, recordIcon(record.label), "Record holder", record.value, index === 0, valueClass);
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

function buildRulesChipCard(chip) {
  const candidates = buildChipImageCandidates(chip);
  const firstCandidate = escapeHtmlAttr(candidates[0] || "");
  const candidateAttr = escapeHtmlAttr(candidates.join("|"));
  const label = escapeHtmlAttr(chip.label);

  return `
    <div class="rules-chip-card" title="${label} • Set per player: ${chip.count}">
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
      <div class="rules-chip-count">Set per player</div>
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
  const host = document.getElementById("format-content");
  if (!host) return;

  const btn40 = document.getElementById("format-btn-40k");
  const btn500 = document.getElementById("format-btn-500k");
  if (btn40) btn40.addEventListener("click", () => showFormat("40k"));
  if (btn500) btn500.addEventListener("click", () => showFormat("500k"));

  showFormat("40k");
  removeTextAboveHeader("main, body", "TLPT");
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
window.renderDashboardSortable = renderDashboard;
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
  initRulesPage();
  initSorting();
}

document.addEventListener("DOMContentLoaded", () => {
  main().catch(error => {
    console.error("TLPT site load failed:", error);
  });
});
