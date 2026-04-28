const DATA_URL = "data/generated/site-data.json";

let players = [];
let events = [];

async function init() {
  const res = await fetch(DATA_URL);
  const data = await res.json();

  players = data.players || [];
  events = data.events || [];

  const enriched = buildAnalytics(players);

  render(enriched);
  bindControls(enriched);
}

/* =========================================
   🧠 CORE ANALYTICS ENGINE
========================================= */
function buildAnalytics(players) {

  return players
    .map(player => {

      const entries = (player.buyIns || 0) + (player.rebuys || 0);

      // ✅ enforce your rule
      if (entries < 3) return null;

      // 🔹 build FAKE trend from existing metrics (TEMP)
      const base = player.roi ?? 0;

      const trend = [
        base - 2,
        base - 1,
        base,
        base + 1,
        base + 2
      ];

      const momentum = calcMomentum(trend);
      const volatility = calcStdDev(trend);
      const heat = classifyHeat(momentum, volatility);

      return {
        ...player,
        entries,
        trend,
        momentum,
        volatility,
        heat
      };

    })
    .filter(Boolean);
}

/* =========================================
   📈 MOMENTUM
========================================= */
function calcMomentum(trend) {
  if (trend.length < 2) return 0;

  let delta = 0;
  for (let i = 1; i < trend.length; i++) {
    delta += (trend[i] - trend[i - 1]);
  }

  return Number(delta.toFixed(2));
}

/* =========================================
   🎢 VOLATILITY
========================================= */
function calcStdDev(arr) {
  const mean = arr.reduce((a,b) => a+b,0) / arr.length;
  const variance = arr.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

/* =========================================
   🔥 HEAT
========================================= */
function classifyHeat(momentum, volatility) {

  if (volatility > 3) return "🎢";
  if (momentum > 1) return "🔥";
  if (momentum < -1) return "❄️";
  return "😐";
}

/* =========================================
   🎯 RENDER
========================================= */
function render(players) {
  renderTopMovers(players);
  renderAllPlayers(players);
}

/* =========================================
   🚀 TOP MOVERS
========================================= */
function renderTopMovers(players) {
  const container = document.getElementById("pm-top-movers");

  const movers = [...players]
    .sort((a,b) => b.momentum - a.momentum)
    .slice(0,5);

  container.innerHTML = movers.map(createCard).join("");

  drawAllSparklines();
}

/* =========================================
   📊 ALL PLAYERS
========================================= */
function renderAllPlayers(players) {
  const container = document.getElementById("pm-player-grid");

  container.innerHTML = players
    .sort((a,b) => b.momentum - a.momentum)
    .map(createCard)
    .join("");

  drawAllSparklines();
}

/* =========================================
   🧩 CARD TEMPLATE
========================================= */
function createCard(p) {

  return `
    <div class="pm-player-card">

      <div class="pm-player-header">
        <img 
          class="pm-avatar"
          src="${p.image}"
          onerror="this.onerror=null; this.src='images/players/default.jpg';"
        />
        <div>
          <strong>${p.name}</strong>
          <div>#${p.rank || "-"}</div>
        </div>
      </div>

      <div class="pm-movement">
        ${p.heat}
      </div>

      <canvas class="pm-sparkline" data-trend="${p.trend.join(',')}"></canvas>

      <div class="pm-stats">
        Momentum: ${p.momentum}<br/>
        Entries: ${p.entries}
      </div>

    </div>
  `;
}

/* =========================================
   📉 SPARKLINES (CANVAS)
========================================= */
function drawAllSparklines() {
  document.querySelectorAll(".pm-sparkline").forEach(canvas => {
    const ctx = canvas.getContext("2d");

    const data = canvas.dataset.trend.split(",").map(Number);

    canvas.width = 120;
    canvas.height = 40;

    const max = Math.max(...data);
    const min = Math.min(...data);

    ctx.beginPath();
    ctx.lineWidth = 2;

    // color based on trend
    const delta = data[data.length-1] - data[0];
    ctx.strokeStyle = delta > 0 ? "#4caf50" : delta < 0 ? "#e53935" : "#aaa";

    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * canvas.width;
      const y = canvas.height - ((val - min) / (max - min || 1)) * canvas.height;

      if (i === 0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });

    ctx.stroke();
  });
}

/* =========================================
   🎛 CONTROLS
========================================= */
function bindControls(players) {
  document.getElementById("pm-sort").addEventListener("change", (e) => {
    const type = e.target.value;

    let sorted = [...players];

    if (type === "movement") {
      sorted.sort((a,b) => b.momentum - a.momentum);
    } else if (type === "fallers") {
      sorted.sort((a,b) => a.momentum - b.momentum);
    } else if (type === "roi") {
      sorted.sort((a,b) => b.roi - a.roi);
    }

    renderAllPlayers(sorted);
  });
}

/* =========================================
   🚀 INIT
========================================= */
init();
