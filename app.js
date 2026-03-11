async function loadSiteData() {
  const res = await fetch("site-data.json");
  return await res.json();
}

function fmtMoney(n) {
  const sign = Number(n) < 0 ? "-" : "";
  return `${sign}$${Math.abs(Number(n)).toFixed(0)}`;
}

function fmtPct(n) {
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function sortPlayers(players, key) {
  return [...players].sort((a, b) => Number(b[key]) - Number(a[key]));
}

function topPlayer(players, key) {
  return sortPlayers(players, key)[0];
}

function renderHomePage(data) {
  const next = data.events[0];
  document.getElementById("next-game-title").textContent = next.title;
  document.getElementById("next-game-meta").textContent = `${next.date} • ${next.time} • ${next.location}`;
  document.getElementById("rsvp-link").href = next.apple_invite_url;
  document.getElementById("next-game-rsvp").textContent =
    `${next.rsvp_counts.confirmed} confirmed • ${next.rsvp_counts.maybe} maybe • ${next.rsvp_counts.out} out`;

  const profit = topPlayer(data.players, "profit");
  const roi = topPlayer(data.players, "roi");
  const hits = topPlayer(data.players, "hits");
  const bubbles = topPlayer(data.players, "bubbles");

  document.getElementById("home-profit-leader").textContent = `${profit.name} (${fmtMoney(profit.profit)})`;
  document.getElementById("home-roi-leader").textContent = `${roi.name} (${fmtPct(roi.roi)})`;
  document.getElementById("home-hit-leader").textContent = `${hits.name} (${hits.hits})`;
  document.getElementById("home-bubble-leader").textContent = `${bubbles.name} (${bubbles.bubbles})`;

  const tbody = document.querySelector("#home-standings-table tbody");
  tbody.innerHTML = "";

  sortPlayers(data.players, "profit").slice(0, 8).forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="player.html?name=${encodeURIComponent(p.name)}">${p.name}</a></td>
      <td>${p.entries}</td>
      <td>${p.timesPlaced}</td>
      <td>${fmtMoney(p.profit)}</td>
      <td>${fmtPct(p.roi)}</td>
      <td>${p.hits}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderStandings(key) {
  const tbody = document.querySelector("#standings-table tbody");
  tbody.innerHTML = "";

  sortPlayers(window.siteData.players, key).forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><a href="player.html?name=${encodeURIComponent(p.name)}">${p.name}</a></td>
      <td>${p.buyIns}</td>
      <td>${p.rebuys}</td>
      <td>${p.entries}</td>
      <td>${p.hits}</td>
      <td>${p.timesPlaced}</td>
      <td>${p.bubbles}</td>
      <td>${fmtMoney(p.profit)}</td>
      <td>${fmtPct(p.roi)}</td>
      <td>${fmtPct(p.cashRate)}</td>
      <td>${fmtPct(p.bubbleRate)}</td>
      <td>${fmtPct(p.hitRate)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDashboard(data) {
  const el = document.getElementById("dashboard-grid");

  const cards = [
    ["Profit Leader", topPlayer(data.players, "profit"), p => fmtMoney(p.profit)],
    ["Best ROI", topPlayer(data.players, "roi"), p => fmtPct(p.roi)],
    ["Most Hits", topPlayer(data.players, "hits"), p => p.hits],
    ["Most Cashes", topPlayer(data.players, "timesPlaced"), p => p.timesPlaced],
    ["Best Cash Rate", topPlayer(data.players, "cashRate"), p => fmtPct(p.cashRate)],
    ["Worst Bubble Luck", topPlayer(data.players, "bubbles"), p => p.bubbles]
  ];

  el.innerHTML = cards.map(([title, p, val]) => `
    <div class="dash-card">
      <div class="kicker">${title}</div>
      <h3>${p.name}</h3>
      <div class="metric">${val(p)}</div>
    </div>
  `).join("");
}

function renderPlayers(data) {
  const el = document.getElementById("players-grid");
  el.innerHTML = data.players.map(p => `
    <a class="player-card" href="player.html?name=${encodeURIComponent(p.name)}">
      <div class="kicker">Player</div>
      <h3>${p.name}</h3>
      <p class="muted">Profit: ${fmtMoney(p.profit)}</p>
      <p class="muted">ROI: ${fmtPct(p.roi)}</p>
      <p class="muted">Hits: ${p.hits}</p>
    </a>
  `).join("");
}

function renderPlayerProfile(data) {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");
  const p = data.players.find(x => x.name === name) || data.players[0];
  const el = document.getElementById("player-profile");

  el.innerHTML = `
    <div class="profile-shell">
      <div class="kicker">Player Profile</div>
      <h2>${p.name}</h2>
      <p class="muted">TLPT performance snapshot</p>
      <div class="profile-grid">
        <div class="profile-stat"><span class="kicker">Buy-ins</span><div class="metric">${p.buyIns}</div></div>
        <div class="profile-stat"><span class="kicker">Rebuys</span><div class="metric">${p.rebuys}</div></div>
        <div class="profile-stat"><span class="kicker">Entries</span><div class="metric">${p.entries}</div></div>
        <div class="profile-stat"><span class="kicker">Hits</span><div class="metric">${p.hits}</div></div>
        <div class="profile-stat"><span class="kicker">Cashes</span><div class="metric">${p.timesPlaced}</div></div>
        <div class="profile-stat"><span class="kicker">Bubbles</span><div class="metric">${p.bubbles}</div></div>
        <div class="profile-stat"><span class="kicker">Profit</span><div class="metric ${p.profit < 0 ? "negative":"positive"}">${fmtMoney(p.profit)}</div></div>
        <div class="profile-stat"><span class="kicker">ROI</span><div class="metric">${fmtPct(p.roi)}</div></div>
        <div class="profile-stat"><span class="kicker">Cash Rate</span><div class="metric">${fmtPct(p.cashRate)}</div></div>
        <div class="profile-stat"><span class="kicker">Bubble Rate</span><div class="metric">${fmtPct(p.bubbleRate)}</div></div>
        <div class="profile-stat"><span class="kicker">Hit Rate</span><div class="metric">${fmtPct(p.hitRate)}</div></div>
      </div>
    </div>
  `;
}

function renderSchedule(data) {
  const el = document.getElementById("schedule-list");
  el.innerHTML = data.events.map(e => `
    <div class="event-card">
      <div class="kicker">Weekly Game</div>
      <h3>${e.title}</h3>
      <p class="muted">${e.date} • ${e.time}</p>
      <p class="muted">${e.location}</p>
      <p class="muted">${e.rsvp_counts.confirmed} confirmed • ${e.rsvp_counts.maybe} maybe • ${e.rsvp_counts.out} out</p>
      <a class="btn btn-primary" href="${e.apple_invite_url}" target="_blank" rel="noopener">RSVP on Apple Invites</a>
    </div>
  `).join("");
}

function renderChampions(data) {
  const el = document.getElementById("champions-list");
  el.innerHTML = data.honors.map(h => `
    <div class="champ-card">
      <div class="kicker">${h.type}</div>
      <h3>${h.name}</h3>
      <p class="muted">${h.note}</p>
    </div>
  `).join("");
}
