async function loadSiteData() {
  const res = await fetch("site-data.json");
  return await res.json();
}

function playerAvatar(name, size="small") {
  const safe = name.replace(/\s+/g,"-").toLowerCase();
  const path = `images/players/${safe}.jpg`;

  return `
  <span class="player-avatar-wrap">
    <img
      src="${path}"
      class="player-avatar ${size}"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    />
    <span class="player-avatar-fallback ${size}" style="display:none">
      ${name.charAt(0)}
    </span>
  </span>
  `;
}

function entryStar(entries){
  if(entries < 5) return " *";
  return "";
}

function renderPlayers(data){

  const grid = document.getElementById("players-grid");
  if(!grid) return;

  grid.innerHTML = data.players.map(p => `
    <div class="player-card player-card-rich">

      <img class="card-chip-accent" src="images/site/chip-100.jpg">

      <div class="player-card-top">
        ${playerAvatar(p.name,"medium")}
        <div class="player-card-meta">
          <div class="kicker">Player</div>
          <h3>${p.name}${entryStar(p.entries)}</h3>
        </div>
      </div>

      <div class="player-card-stats">
        <p><strong>Entries:</strong> ${p.entries}</p>
        <p><strong>Profit:</strong> ${p.profit}</p>
        <p><strong>ROI:</strong> ${p.roi}</p>
      </div>

      <div style="margin-top:10px">
        <a class="btn small" href="player.html?name=${encodeURIComponent(p.name)}">
          Profile
        </a>
      </div>

    </div>
  `).join("");
}

function renderStandings(data){

  const body = document.querySelector("#standings-body");
  if(!body) return;

  body.innerHTML = "";

  const players = [...data.players];

  players.sort((a,b)=> b.profit - a.profit);

  players.forEach(p=>{

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <div class="player-inline">
          ${playerAvatar(p.name,"tiny")}
          ${p.name}${entryStar(p.entries)}
        </div>
      </td>
      <td>${p.buyIns}</td>
      <td>${p.rebuys}</td>
      <td>${p.entries}</td>
      <td>${p.timesPlaced}</td>
      <td>${p.bubbles}</td>
      <td>${p.profit}</td>
      <td>${p.roi}</td>
    `;

    body.appendChild(tr);
  });

}

function renderDashboardSortable(stat){

  const grid = document.getElementById("dashboard-grid");
  if(!grid) return;

  const players = [...window.siteData.players];

  players.sort((a,b)=> (b[stat] || 0) - (a[stat] || 0));

  grid.innerHTML = players.map(p=>{

    let value = p[stat];

    return `
      <div class="player-card player-card-rich">

        <img class="card-chip-accent" src="images/site/chip-500.jpg">

        <div class="player-card-top">
          ${playerAvatar(p.name,"small")}
          <div class="player-card-meta">
            <h3>${p.name}${entryStar(p.entries)}</h3>
          </div>
        </div>

        <div class="metric">${value ?? "-"}</div>

        <div class="muted">${stat}</div>

        <div style="margin-top:10px">
          <a class="btn small" href="player.html?name=${encodeURIComponent(p.name)}">
            Profile
          </a>
        </div>

      </div>
    `;
  }).join("");

}

function renderPlayerPage(data){

  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");

  if(!name) return;

  const player = data.players.find(p=>p.name===name);
  if(!player) return;

  document.getElementById("player-name").textContent = player.name;

  document.getElementById("player-avatar").innerHTML =
    playerAvatar(player.name,"large");

  const grid = document.getElementById("player-stats");

  grid.innerHTML = `
    <div class="profile-stat"><strong>Entries</strong><br>${player.entries}</div>
    <div class="profile-stat"><strong>Profit</strong><br>${player.profit}</div>
    <div class="profile-stat"><strong>ROI</strong><br>${player.roi}</div>
    <div class="profile-stat"><strong>Hits</strong><br>${player.hits}</div>
    <div class="profile-stat"><strong>Placed</strong><br>${player.timesPlaced}</div>
    <div class="profile-stat"><strong>Bubbles</strong><br>${player.bubbles}</div>
  `;

  const index = data.players.indexOf(player);

  const prev = data.players[index-1];
  const next = data.players[index+1];

  const nav = document.getElementById("player-nav");

  nav.innerHTML = `
    ${prev ? `<a class="btn small" href="player.html?name=${encodeURIComponent(prev.name)}">← ${prev.name}</a>` : ""}
    ${next ? `<a class="btn small" href="player.html?name=${encodeURIComponent(next.name)}">${next.name} →</a>` : ""}
  `;

}

function renderSchedule(data){

  const list = document.getElementById("schedule-list");
  if(!list) return;

  list.innerHTML = data.events.map(e=>{

    const seats = e.yes + e.maybe;
    const pct = Math.min(seats/9,1) * 100;

    return `
      <div class="event-card">

        <div class="event-card-topline">
          <h3>${e.title}</h3>
          <div class="event-icon-card">🂡</div>
        </div>

        <p><strong>Date:</strong> ${e.date}</p>
        <p><strong>Start:</strong> ${e.start}</p>
        <p><strong>Location:</strong> ${e.location}</p>

        <div class="fill-widget">

          <div class="fill-header">
            <span class="fill-label">Projected Table</span>
            <span class="fill-seats">${seats}/9</span>
          </div>

          <div class="fill-bar">
            <div class="fill-bar-value" style="width:${pct}%"></div>
          </div>

        </div>

        <p class="rsvp-line">Yes: ${e.yes}</p>
        <p class="rsvp-line">Maybe: ${e.maybe}</p>
        <p class="rsvp-line">No: ${e.no}</p>
        <p class="rsvp-line">TBD: ${e.tbd}</p>

        <a class="btn small" href="${e.invite}" target="_blank">
          View Invite
        </a>

      </div>
    `;

  }).join("");

}

document.addEventListener("DOMContentLoaded", async () => {

  const data = await loadSiteData();
  window.siteData = data;

  renderPlayers(data);
  renderStandings(data);
  renderPlayerPage(data);
  renderSchedule(data);

});
