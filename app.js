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

function getPlayerQuote(name) {
  return PLAYER_QUOTES[name] || "They just haven't said anything funny... yet!";
}

function fmtMoney(n) {
  const sign = Number(n) < 0 ? "-" : "";
  return `${sign}$${Math.abs(Number(n)).toFixed(0)}`;
}

function fmtPct(n) {
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function fmtNum(n) {
  return Number(n).toFixed(1);
}

function sortPlayers(players, key) {
  return [...players].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));
}

function initialsFromName(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function displayPlayerName(player) {
  return player.entries < 5 ? `${player.name}*` : player.name;
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
  return player[key];
}

function badgeList(player, data) {
  const players = data.players;
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
  if (player.entries < 5) badges.push("✳️ Small Sample");

  return badges;
}

function badgesMarkup(player, data) {
  const badges = badgeList(player, data);
  if (!badges.length) return "";
  return `
    <div class="button-row stat-leader-badges" style="margin:10px 0 0 0;">
      ${badges.map(b => {
        const icon = b.split(" ")[0];
        const text = b.substring(icon.length).trim();
        return `<span class="stat-badge-text"><span class="stat-badge-icon">${icon}</span><span class="stat-badge-label">${text}</span></span>`;
      }).join("")}
    </div>
  `;
}

function formatRsvpLine(rsvp) {
  const confirmed = rsvp.confirmed ?? 0;
  const maybe = rsvp.maybe ?? 0;
  const tbd = rsvp.tbd ?? 0;
  const out = rsvp.out ?? 0;
  return `${confirmed} yes • ${maybe} maybe • ${tbd} tbd • ${out} no`;
}

function projectedTableSize(rsvp, maxSeats = 9) {
  const confirmed = rsvp.confirmed ?? 0;
  const maybe = rsvp.maybe ?? 0;
  const tbd = rsvp.tbd ?? 0;

  const minPlayers = Math.min(confirmed, maxSeats);
  const maxPlayers = Math.min(confirmed + maybe + tbd, maxSeats);

  if (minPlayers === maxPlayers) {
    return `${minPlayers} players`;
  }

  return `${minPlayers}–${maxPlayers} players`;
}

function tableFillPercent(rsvp, maxSeats = 9) {
  const confirmed = rsvp.confirmed ?? 0;
  return Math.min((confirmed / maxSeats) * 100, 100);
}

function tableFillMarkup(rsvp, maxSeats = 9) {
  const confirmed = rsvp.confirmed ?? 0;
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

function renderHomePage(data) {
  const eventsEl = document.getElementById("home-events-list");
  if (eventsEl) {
    const homeEvents = [
      {
        ...data.events[0],
        rsvp_counts: { confirmed: 6, maybe: 0, tbd: 2, out: 3 }
      },
      {
        ...data.events[1],
        rsvp_counts: { confirmed: 4, maybe: 2, tbd: 2, out: 3 }
      }
    ];

    eventsEl.innerHTML = homeEvents.map((event) => `
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

  const profit = sortPlayers(data.players, "profit")[0];
  const power = sortPlayers(data.players, "trueSkillScore")[0];
  const hits = sortPlayers(data.players, "hits")[0];
  const bubbles = sortPlayers(data.players, "bubbles")[0];

  const profitEl = document.getElementById("home-profit-leader");
  const powerEl = document.getElementById("home-power-leader");
  const hitEl = document.getElementById("home-hit-leader");
  const bubbleEl = document.getElementById("home-bubble-leader");

  if (profitEl) profitEl.innerHTML = leaderInlineMarkup(profit, fmtMoney(profit.profit), "small");
  if (powerEl) powerEl.innerHTML = leaderInlineMarkup(power, fmtNum(power.trueSkillScore), "small");
  if (hitEl) hitEl.innerHTML = leaderInlineMarkup(hits, hits.hits, "small");
  if (bubbleEl) bubbleEl.innerHTML = leaderInlineMarkup(bubbles, bubbles.bubbles, "small");

  const tbody = document.querySelector("#home-standings-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  sortPlayers(data.players, "profit").slice(0, 8).forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${playerInlineMarkup(p, "tiny")}</td>
      <td>${p.entries}</td>
      <td>${p.timesPlaced}</td>
      <td>${fmtMoney(p.profit)}</td>
      <td>${fmtNum(p.trueSkillScore)}</td>
      <td>${p.hits}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderStandings(key) {
  const tbody = document.querySelector("#standings-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  sortPlayers(window.siteData.players, key).forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${playerInlineMarkup(p, "tiny")}</td>
      <td>${p.entries}</td>
      <td>${p.hits}</td>
      <td>${p.timesPlaced}</td>
      <td>${p.bubbles}</td>
      <td>${fmtMoney(p.profit)}</td>
      <td>${fmtPct(p.roi)}</td>
      <td>${fmtNum(p.trueSkillScore)}</td>
      <td>${fmtNum(p.luckIndex)}</td>
      <td>${fmtNum(p.clutchIndex)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDashboardSortable(key) {
  const el = document.getElementById("dashboard-grid");
  if (!el) return;
  const sorted = sortPlayers(window.siteData.players, key);

  el.innerHTML = sorted.map((p, i) => `
    <a class="player-card player-card-rich" href="player.html?name=${encodeURIComponent(p.name)}">
      <div class="player-card-top">
        ${playerImageMarkup(p, "medium")}
        <div class="player-card-meta">
          <div class="kicker">#${i + 1} • ${formatStatLabel(key)}</div>
          <h3>${displayPlayerName(p)}</h3>
        </div>
      </div>
      <div class="player-card-stats">
        <p class="muted"><strong>${formatStatLabel(key)}:</strong> ${formatStatValue(p, key)}</p>
        <p class="muted">Profit: ${fmtMoney(p.profit)}</p>
        <p class="muted">Power: ${fmtNum(p.trueSkillScore)}</p>
        <p class="muted">Hits: ${p.hits}</p>
        <p class="muted">Cashes: ${p.timesPlaced}</p>
        ${badgesMarkup(p, window.siteData)}
      </div>
    </a>
  `).join("");
}

function renderPlayers(data) {
  const el = document.getElementById("players-grid");
  if (!el) return;
  el.innerHTML = data.players.map((p) => `
    <a class="player-card player-card-rich" href="player.html?name=${encodeURIComponent(p.name)}">
      <div class="player-card-top">
        ${playerImageMarkup(p, "medium")}
        <div class="player-card-meta">
          <div class="kicker">Player</div>
          <h3>${displayPlayerName(p)}</h3>
        </div>
      </div>
      <div class="player-card-stats">
        <p class="muted">Profit: ${fmtMoney(p.profit)}</p>
        <p class="muted">Power: ${fmtNum(p.trueSkillScore)}</p>
        <p class="muted">Hits: ${p.hits}</p>
        <p class="muted">Cashes: ${p.timesPlaced}</p>
        ${badgesMarkup(p, data)}
      </div>
    </a>
  `).join("");
}

function renderPlayerProfile(data) {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");
  const p = data.players.find(x => x.name === name) || data.players[0];
  const el = document.getElementById("player-profile");

  if (el) {
    el.innerHTML = `
      <div class="profile-shell">
        <div class="profile-hero">
          <div class="profile-hero-left">
            ${playerImageMarkup(p, "large")}
            <div>
              <div class="kicker">Player Profile</div>
              <h2>${displayPlayerName(p)}</h2>
              <p class="profile-quote">${getPlayerQuote(p.name)}</p>
              ${badgesMarkup(p, data)}
            </div>
          </div>
        </div>

        <div class="profile-grid">
          <div class="profile-stat"><span class="kicker">Entries</span><div class="metric">${p.entries}</div></div>
          <div class="profile-stat"><span class="kicker">Buy-ins</span><div class="metric">${p.buyIns}</div></div>
          <div class="profile-stat"><span class="kicker">Rebuys</span><div class="metric">${p.rebuys}</div></div>
          <div class="profile-stat"><span class="kicker">Hits</span><div class="metric">${p.hits}</div></div>
          <div class="profile-stat"><span class="kicker">Cashes</span><div class="metric">${p.timesPlaced}</div></div>
          <div class="profile-stat"><span class="kicker">Bubbles</span><div class="metric">${p.bubbles}</div></div>
          <div class="profile-stat"><span class="kicker">Profit</span><div class="metric ${p.profit < 0 ? "negative":"positive"}">${fmtMoney(p.profit)}</div></div>
          <div class="profile-stat"><span class="kicker">ROI</span><div class="metric">${fmtPct(p.roi)}</div></div>
          <div class="profile-stat"><span class="kicker">Power</span><div class="metric">${fmtNum(p.trueSkillScore)}</div></div>
          <div class="profile-stat"><span class="kicker">Luck</span><div class="metric">${fmtNum(p.luckIndex)}</div></div>
          <div class="profile-stat"><span class="kicker">Clutch</span><div class="metric">${fmtNum(p.clutchIndex)}</div></div>
          <div class="profile-stat"><span class="kicker">Cash Rate</span><div class="metric">${fmtPct(p.cashRate)}</div></div>
          <div class="profile-stat"><span class="kicker">Bubble Rate</span><div class="metric">${fmtPct(p.bubbleRate)}</div></div>
          <div class="profile-stat"><span class="kicker">Hit Rate</span><div class="metric">${fmtPct(p.hitRate)}</div></div>
          <div class="profile-stat"><span class="kicker">Aggression</span><div class="metric">${fmtNum(p.aggressionIndex)}</div></div>
          <div class="profile-stat"><span class="kicker">Survivor</span><div class="metric">${fmtNum(p.survivorIndex)}</div></div>
          <div class="profile-stat"><span class="kicker">Tilt</span><div class="metric">${fmtNum(p.tiltIndex)}</div></div>
        </div>
      </div>
    `;
  }

  const navEl = document.getElementById("player-nav");
  if (!navEl) return;
  const idx = data.players.findIndex(x => x.name === p.name);
  const prev = data.players[(idx - 1 + data.players.length) % data.players.length];
  const next = data.players[(idx + 1) % data.players.length];

  navEl.innerHTML = `
    <a class="btn" href="player.html?name=${encodeURIComponent(prev.name)}">← Previous: ${displayPlayerName(prev)}</a>
    <a class="btn" href="players.html">All Players</a>
    <a class="btn" href="player.html?name=${encodeURIComponent(next.name)}">Next: ${displayPlayerName(next)} →</a>
  `;
}

function renderSchedule(data) {
  const el = document.getElementById("schedule-list");
  if (!el) return;

  const scheduleEvents = [
    {
      ...data.events[0],
      rsvp_counts: { confirmed: 6, maybe: 0, tbd: 2, out: 3 }
    },
    {
      ...data.events[1],
      rsvp_counts: { confirmed: 4, maybe: 2, tbd: 2, out: 3 }
    }
  ];

  el.innerHTML = scheduleEvents.map((e) => `
    <div class="event-card">
      <div class="event-card-topline">
        <div class="kicker">${e.title}</div>
        <div class="event-icon event-icon-card">♠</div>
      </div>
      <h3>${e.date}</h3>
      <p class="muted"><strong>Start:</strong> ${e.time}</p>
      <p class="muted"><strong>Estimated End:</strong> ${e.endTime || ""}</p>
      <p class="muted"><strong>Location:</strong> ${e.location}</p>
      <p class="muted">${e.address || ""}</p>
      <p class="muted"><strong>Projected Table Size:</strong> ${projectedTableSize(e.rsvp_counts, 9)}</p>
      ${tableFillMarkup(e.rsvp_counts, 9)}
      <p class="muted">${formatRsvpLine(e.rsvp_counts)}</p>
      <a class="btn btn-rsvp" href="${e.apple_invite_url}" target="_blank" rel="noopener">RSVP on Apple Invites</a>
    </div>
  `).join("");
}

function renderChampions(data) {
  const honorsEl = document.getElementById("champions-list");
  const recordsEl = document.getElementById("records-list");

  if (honorsEl) {
    honorsEl.innerHTML = data.honors.map((h) => {
      const p = data.players.find(player => player.name === h.name);
      return `
        <div class="champ-card stat-card-visual">
          <div class="player-card-top">
            ${p ? playerImageMarkup(p, "small") : ""}
            <div>
              <div class="kicker">${h.type}</div>
              <h3>${p ? displayPlayerName(p) : h.name}</h3>
            </div>
          </div>
          <p class="muted">${h.note}</p>
        </div>
      `;
    }).join("");
  }

  if (recordsEl) {
    recordsEl.innerHTML = data.records.map((r) => {
      const p = data.players.find(player => player.name === r.name);
      return `
        <div class="champ-card stat-card-visual">
          <div class="player-card-top">
            ${p ? playerImageMarkup(p, "small") : ""}
            <div>
              <div class="kicker">${r.label}</div>
              <h3>${p ? displayPlayerName(p) : r.name}</h3>
            </div>
          </div>
          <p class="muted">${r.value}</p>
        </div>
      `;
    }).join("");
  }
}
