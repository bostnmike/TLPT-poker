const DATA_URL = "data/generated/site-data.json";

let players = [];

async function init() {
  const res = await fetch(DATA_URL);
  const data = await res.json();

  players = buildPlayerData(data.players);

  render();
  bindControls();
}

/* =========================================
   🧠 BUILD DATA
========================================= */
function buildPlayerData(rawPlayers) {
  return rawPlayers.map((p, i) => {

    const prevRank = p.previousRank || (i + Math.floor(Math.random() * 3));
    const movement = prevRank - (i + 1);

    return {
      ...p,
      rank: i + 1,
      movement,
      roi: p.roi ?? 0,
      profit: p.profit ?? 0
    };
  });
}

/* =========================================
   🎯 RENDER
========================================= */
function render() {
  renderTopMovers();
  renderAllPlayers(players);
}

/* =========================================
   🚀 TOP MOVERS
========================================= */
function renderTopMovers() {
  const container = document.getElementById("pm-top-movers");

  const movers = [...players]
    .sort((a, b) => b.movement - a.movement)
    .slice(0, 5);

  container.innerHTML = movers.map(createCard).join("");
}

/* =========================================
   📊 ALL PLAYERS
========================================= */
function renderAllPlayers(list) {
  const container = document.getElementById("pm-player-grid");
  container.innerHTML = list.map(createCard).join("");
}

/* =========================================
   🧩 CARD TEMPLATE
========================================= */
function createCard(p) {

  let movementClass = "pm-neutral";
  let movementSymbol = "→";

  if (p.movement > 0) {
    movementClass = "pm-up";
    movementSymbol = `↑ +${p.movement}`;
  } else if (p.movement < 0) {
    movementClass = "pm-down";
    movementSymbol = `↓ ${p.movement}`;
  }

  return `
    <div class="pm-player-card">

      <div class="pm-player-header">

        <img src="images/players/${p.slug}.jpg" 
             onerror="this.src='images/players/default.jpg'" />

        <div>
          <strong>${p.name}</strong>
          <div>#${p.rank}</div>
        </div>

      </div>

      <div class="pm-movement ${movementClass}">
        ${movementSymbol}
      </div>

      <div class="pm-stats">
        ROI: ${p.roi}%<br/>
        Profit: $${p.profit}
      </div>

    </div>
  `;
}

/* =========================================
   🎛 CONTROLS
========================================= */
function bindControls() {
  document.getElementById("pm-sort").addEventListener("change", (e) => {
    const type = e.target.value;

    let sorted = [...players];

    if (type === "movement") {
      sorted.sort((a, b) => b.movement - a.movement);
    } else if (type === "fallers") {
      sorted.sort((a, b) => a.movement - b.movement);
    } else if (type === "roi") {
      sorted.sort((a, b) => b.roi - a.roi);
    }

    renderAllPlayers(sorted);
  });
}

/* =========================================
   🚀 INIT
========================================= */
init();
