const DATA_URL = "data/generated/site-data.json";

let players = [];

async function init() {
  const res = await fetch(DATA_URL);
  const data = await res.json();

  players = data.players || [];

  // 🔥 LOAD EVENT INDEX
  const indexRes = await fetch("data/parsed/events/index.json");
  const eventFiles = await indexRes.json();

  // 🔥 LOAD ALL EVENTS (SAFE)
  const eventData = (await Promise.all(
    eventFiles.map(file =>
      fetch(`data/parsed/events/${file}`)
        .then(r => {
          if (!r.ok) throw new Error(`Failed to load ${file}`);
          return r.json();
        })
        .catch(err => {
          console.warn(err);
          return null;
        })
    )
  )).filter(Boolean);

  // 🔥 SORT EVENTS (YYYY-MM-DD safe)
  eventData.sort((a, b) => new Date(a.date) - new Date(b.date));

  const enriched = buildAnalytics(players, eventData);

  if (!enriched.length) {
    console.warn("No eligible players for movement analysis");
  }

  render(enriched);
  bindControls(enriched);
}

/* =========================================
   🧠 CORE ANALYTICS ENGINE
========================================= */
function buildAnalytics(players, events) {

  return players
    .map(player => {

      const entries = (player.buyIns || 0) + (player.rebuys || 0);

      // 🔥 FILTER: min 3 entries
      if (entries < 3) return null;

      const playerEvents = [];

      // 🔹 build alias list
      const names = [player.name, ...(player.aliases || [])]
        .map(n => n.toLowerCase());

      events.forEach(event => {

        // 🔹 participation check
        const participated = event.actions?.some(a =>
          (a.type === "buyin" || a.type === "rebuy") &&
          names.includes(a.player.toLowerCase())
        );

        if (!participated) return;

        // 🔹 field size (buy-ins only)
        const fieldSize =
          event.actions?.filter(a => a.type === "buyin").length || 10;

        // 🔹 winner lookup
        const winner = event.winners?.find(w =>
          names.includes(w.name.toLowerCase())
        );

        let score;

        if (winner) {
          // 🏆 higher score = better finish
          score = fieldSize - winner.rank;
        } else {
          // ❌ baseline = bottom third
          score = Math.floor(fieldSize / 3);
        }

        playerEvents.push(score);
      });

      // 🔹 last 5 appearances
      const recent = playerEvents.slice(-5);

      if (recent.length < 3) return null;

      const momentum = calcMomentum(recent);
      const volatility = calcStdDev(recent);
      const heat = classifyHeat(momentum, volatility);

      return {
        ...player,
        entries,
        trend: recent,
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

  // 🔹 assign ranks (based on momentum)
  players.sort((a, b) => b.momentum - a.momentum);

  players.forEach((p, i) => {
    p.rank = i + 1;
  });

  renderTopMovers(players);
  renderAllPlayers(players);

  // 🔹 draw sparklines ONCE
  drawAllSparklines();
}

/* =========================================
   🚀 TOP MOVERS
========================================= */
function renderTopMovers(players) {
  const container = document.getElementById("pm-top-movers");

  const movers = [...players]
    .slice(0, 5);

  container.innerHTML = movers.map(createCard).join("");
}

/* =========================================
   📊 ALL PLAYERS
========================================= */
function renderAllPlayers(players) {
  const container = document.getElementById("pm-player-grid");

  container.innerHTML = players
    .map(createCard)
    .join("");
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
          src="${p.image || `images/players/${p.slug}.jpg`}"
          onerror="this.onerror=null; this.src='images/players/default.jpg';"
        />
        <div>
          <strong>${p.name}</strong>
          <div>#${p.rank}</div>
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
   📉 SPARKLINES
========================================= */
function drawAllSparklines() {
  document.querySelectorAll(".pm-sparkline").forEach(canvas => {
    const ctx = canvas.getContext("2d");

    const data = canvas.dataset.trend.split(",").map(Number);

    canvas.width = 120;
    canvas.height = 40;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.lineWidth = 2;

    const delta = data[data.length - 1] - data[0];
    ctx.strokeStyle =
      delta > 0 ? "#4caf50" :
      delta < 0 ? "#e53935" :
      "#aaa";

    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * canvas.width;
      const y = canvas.height - ((val - min) / range) * canvas.height;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
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
    drawAllSparklines();
  });
}

/* =========================================
   🚀 INIT
========================================= */
init();
