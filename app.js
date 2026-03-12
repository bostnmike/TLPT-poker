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
  "A.I. Dave": "\"Oh man! I caught some of that $hit!\"",
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

function renderStandings(key) {
  const tbody = document.querySelector("#standings-table tbody");
  if (!tbody || !window.siteData?.players) return;

  tbody.innerHTML = "";
  sortPlayers(window.siteData.players, key).forEach((player, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${playerInlineMarkup(player, "tiny")}</td>
      <td>${player.entries ?? "-"}</td>
      <td>${player.hits ?? "-"}</td>
      <td>${player.timesPlaced ?? "-"}</td>
      <td>${player.bubbles ?? "-"}</td>
      <td>${fmtMoney(player.profit)}</td>
      <td>${fmtPct(player.roi)}</td>
      <td>${fmtNum(player.trueSkillScore)}</td>
      <td>${fmtNum(player.luckIndex)}</td>
      <td>${fmtNum(player.clutchIndex)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDashboardSortable(key) {
  const grid = document.getElementById("dashboard-grid");
  if (!grid || !window.siteData?.players) return;

  const sorted = sortPlayers(window.siteData.players, key);
  grid.innerHTML = sorted.map((player, i) => `
    <a class="player-card player-card-rich" href="player.html?name=${encodeURIComponent(player.name)}">
      <div class="player-card-top">
        ${playerImageMarkup(player, "medium")}
        <div class="player-card-meta">
          <div class="kicker">#${i + 1} • ${formatStatLabel(key)}</div>
          <h3>${displayPlayerName(player)}</h3>
        </div>
      </div>
      <div class="player-card-stats">
        <p class="muted"><strong>${formatStatLabel(key)}:</strong> ${formatStatValue(player, key)}</p>
        <p class="muted">Profit: ${fmtMoney(player.profit)}</p>
        <p class="muted">Power: ${fmtNum(player.trueSkillScore)}</p>
        <p class="muted">Hits: ${player.hits ?? "-"}</p>
        <p class="muted">Cashes: ${player.timesPlaced ?? "-"}</p>
        ${badgesMarkup(player, window.siteData)}
      </div>
    </a>
  `).join("");
}

function renderPlayers(data) {
  const grid = document.getElementById("players-grid");
  if (!grid || !data.players) return;

  grid.innerHTML = data.players.map(player => `
    <a class="player-card player-card-rich" href="player.html?name=${encodeURIComponent(player.name)}">
      <div class="player-card-top">
        ${playerImageMarkup(player, "medium")}
        <div class="player-card-meta">
          <div class="kicker">Player</div>
          <h3>${displayPlayerName(player)}</h3>
        </div>
      </div>
      <div class="player-card-stats">
        <p class="muted">Profit: ${fmtMoney(player.profit)}</p>
        <p class="muted">Power: ${fmtNum(player.trueSkillScore)}</p>
        <p class="muted">Hits: ${player.hits ?? "-"}</p>
        <p class="muted">Cashes: ${player.timesPlaced ?? "-"}</p>
        ${badgesMarkup(player, data)}
      </div>
    </a>
  `).join("");
}

function renderPlayerProfile(data) {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");
  const players = data.players || [];
  if (!players.length) return;

  const player = players.find(p => p.name === name) || players[0];
  const container = document.getElementById("player-profile");

  if (container) {
    container.innerHTML = `
      <div class="profile-shell">
        <div class="profile-hero">
          <div class="profile-hero-left">
            ${playerImageMarkup(player, "large")}
            <div>
              <div class="kicker">Player Profile</div>
              <h2>${displayPlayerName(player)}</h2>
              <p class="profile-quote">${getPlayerQuote(player.name)}</p>
              ${badgesMarkup(player, data)}
            </div>
          </div>
        </div>

        <div class="profile-grid">
          <div class="profile-stat"><span class="kicker">Entries</span><div class="metric">${player.entries ?? "-"}</div></div>
          <div class="profile-stat"><span class="kicker">Buy-ins</span><div class="metric">${player.buyIns ?? "-"}</div></div>
          <div class="profile-stat"><span class="kicker">Rebuys</span><div class="metric">${player.rebuys ?? "-"}</div></div>
          <div class="profile-stat"><span class="kicker">Hits</span><div class="metric">${player.hits ?? "-"}</div></div>
          <div class="profile-stat"><span class="kicker">Cashes</span><div class="metric">${player.timesPlaced ?? "-"}</div></div>
          <div class="profile-stat"><span class="kicker">Bubbles</span><div class="metric">${player.bubbles ?? "-"}</div></div>
          <div class="profile-stat"><span class="kicker">Profit</span><div class="metric ${Number(player.profit) < 0 ? "negative" : "positive"}">${fmtMoney(player.profit)}</div></div>
          <div class="profile-stat"><span class="kicker">ROI</span><div class="metric">${fmtPct(player.roi)}</div></div>
          <div class="profile-stat"><span class="kicker">Power</span><div class="metric">${fmtNum(player.trueSkillScore)}</div></div>
          <div class="profile-stat"><span class="kicker">Luck</span><div class="metric">${fmtNum(player.luckIndex)}</div></div>
          <div class="profile-stat"><span class="kicker">Clutch</span><div class="metric">${fmtNum(player.clutchIndex)}</div></div>
          <div class="profile-stat"><span class="kicker">Cash Rate</span><div class="metric">${fmtPct(player.cashRate)}</div></div>
          <div class="profile-stat"><span class="kicker">Bubble Rate</span><div class="metric">${fmtPct(player.bubbleRate)}</div></div>
          <div class="profile-stat"><span class="kicker">Hit Rate</span><div class="metric">${fmtPct(player.hitRate)}</div></div>
          <div class="profile-stat"><span class="kicker">Aggression</span><div class="metric">${fmtNum(player.aggressionIndex)}</div></div>
          <div class="profile-stat"><span class="kicker">Survivor</span><div class="metric">${fmtNum(player.survivorIndex)}</div></div>
          <div class="profile-stat"><span class="kicker">Tilt</span><div class="metric">${fmtNum(player.tiltIndex)}</div></div>
        </div>
      </div>
    `;
  }

  const navEl = document.getElementById("player-nav");
  if (!navEl) return;

  const index = players.findIndex(p => p.name === player.name);
  const prev = players[(index - 1 + players.length) % players.length];
  const next = players[(index + 1) % players.length];

  navEl.innerHTML = `
    <a class="btn" href="player.html?name=${encodeURIComponent(prev.name)}">← Previous: ${displayPlayerName(prev)}</a>
    <a class="btn" href="players.html">All Players</a>
    <a class="btn" href="player.html?name=${encodeURIComponent(next.name)}">Next: ${displayPlayerName(next)} →</a>
  `;
}

function renderSchedule(data) {
  const list = document.getElementById("schedule-list");
  if (!list) return;

  const scheduleEvents = getCurrentEvents(data);

  list.innerHTML = scheduleEvents.map(event => `
    <div class="event-card">
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
