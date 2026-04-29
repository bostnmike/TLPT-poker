const DATA_URL = "data/generated/site-data.json";

let players = [];

async function init() {
  const res = await fetch(DATA_URL);
  const data = await res.json();

  players = data.players || [];

  const indexRes = await fetch("data/parsed/events/index.json");
  const eventFiles = await indexRes.json();

  const eventData = (await Promise.all(
    eventFiles.map(file =>
      fetch(`data/parsed/events/${file}`)
        .then(r => r.json())
        .catch(() => null)
    )
  )).filter(Boolean);

  eventData.sort((a, b) => new Date(a.date) - new Date(b.date));

  const enriched = buildAnalytics(players, eventData);

  render(enriched);
  bindControls(enriched);
}

/* =========================================
   🧠 CORE ANALYTICS ENGINE
========================================= */
function buildAnalytics(players, events) {

  return players
    .map(player => {

      const playerEvents = [];

      const names = [player.name, ...(player.aliases || [])]
        .map(n => n.toLowerCase());

      events.forEach(event => {

        const actions = event.actions || [];

        const participated = actions.some(a =>
          (a.type === "buyin" || a.type === "rebuy") &&
          names.includes(a.player.toLowerCase())
        );

        if (!participated) return;

        const buyins = actions.filter(a =>
          a.type === "buyin" &&
          names.includes(a.player.toLowerCase())
        ).length;

        const rebuys = actions.filter(a =>
          a.type === "rebuy" &&
          names.includes(a.player.toLowerCase())
        ).length;

        const hits = actions.filter(a =>
          a.type === "knockout" &&
          names.includes(a.player.toLowerCase())
        ).length;

        const winner = event.winners?.find(w =>
          names.includes(w.name.toLowerCase())
        );

        const fieldSize =
          actions.filter(a => a.type === "buyin").length || 10;

        // 🔥 EVENT SCORE MODEL
        let score = 0;

        // Placement
        if (winner) {
          score += 100;
        } else {
          score += 20; // survived somewhat
        }

        // Deep run proxy
        score += (hits * 8);

        // Aggression
        score += (hits * 5);

        // Rebuy penalty
        score -= (rebuys * 15);

        // Buy-in cost pressure
        score -= (buyins * 5);

        // Normalize by field size
        score += fieldSize * 0.5;

        playerEvents.push(score);
      });

      if (playerEvents.length < 3) return null;

      const recent = playerEvents.slice(-5);

      const momentum = calcMomentum(recent);
      const volatility = calcStdDev(recent);
      const heat = classifyHeat(momentum, volatility);

      return {
        ...player,
        eventsPlayed: playerEvents.length,
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
   🔥 HEAT CLASSIFICATION
========================================= */
function classifyHeat(momentum, volatility) {
  if (volatility > 25) return "🎢";
  if (momentum > 15) return "🔥";
  if (momentum < -15) return "❄️";
  return "😐";
}

/* =========================================
   🎯 RENDER
========================================= */
function render(players) {
  players.sort((a, b) => b.momentum - a.momentum);

  players.forEach((p, i) => {
    p.rank = i + 1;
  });

  renderTopMovers(players);
  renderAllPlayers(players);

  drawAllSparklines();
}

/* =========================================
   🚀 TOP MOVERS
========================================= */
function renderTopMovers(players) {
  const container = document.getElementById("pm-top-movers");
  container.innerHTML = players.slice(0, 5).map(createCard).join("");
}

/* =========================================
   📊 ALL PLAYERS
========================================= */
function renderAllPlayers(players) {
  const container = document.getElementById("pm-player-grid");
  container.innerHTML = players.map(createCard).join("");
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

      <div class="pm-movement">${p.heat}</div>

      <canvas class="pm-sparkline" data-trend="${p.trend.join(',')}"></canvas>

      <div class="pm-stats">
        Momentum: ${p.momentum}<br/>
        Volatility: ${p.volatility.toFixed(1)}
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

  const buttons = document.querySelectorAll(".pm-btn");

  if (!buttons.length) {
    console.warn("No control buttons found");
    return;
  }

  buttons.forEach(btn => {

    btn.addEventListener("click", () => {

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      let sorted = [...players];
      const type = btn.dataset.sort;

      switch (type) {

        case "momentum": // 🔥 HOT
          sorted.sort((a, b) => b.momentum - a.momentum);
          break;

        case "cold": // ❄️ COLD
          sorted.sort((a, b) => a.momentum - b.momentum);
          break;

        case "consistent": // 🟢 LOW VOLATILITY + POSITIVE MOMENTUM
          sorted.sort((a, b) =>
            (b.momentum - b.volatility) - (a.momentum - a.volatility)
          );
          break;

        case "volatile": // 🎢 HIGH VARIANCE
          sorted.sort((a, b) => b.volatility - a.volatility);
          break;

        default:
          sorted.sort((a, b) => b.momentum - a.momentum);
      }

      renderAllPlayers(sorted);
      drawAllSparklines();
    });

  });
}

init();
