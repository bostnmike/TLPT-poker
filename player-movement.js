const DATA_URL = "data/generated/site-data.json";

let players = [];
let previousRanks = {};

/* =========================================
   🚀 INIT
========================================= */
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

  bindControls(enriched);
}

/* =========================================
   🧠 ANALYTICS
========================================= */
function buildAnalytics(players, events) {

  return players
    .map(player => {

      const names = [player.name, ...(player.aliases || [])]
        .map(n => n.toLowerCase());

      const playerEvents = [];

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

        let score = 0;
        let result = "bust";

        /* =========================================
           🏆 PLACEMENT SCORING (NEW)
        ========================================== */

        if (event.winners && event.winners.length) {

          const placementIndex = event.winners.findIndex(w =>
            names.includes(w.name.toLowerCase())
          );

          if (placementIndex === 0) {
            score += 100;
            result = "win";
          }
          else if (placementIndex === 1) {
            score += 70;
            result = "deep";
          }
          else if (placementIndex === 2) {
            score += 50;
            result = "deep";
          }
        }

        /* =========================================
           💣 BUBBLE DETECTION
        ========================================== */

        if (event.exits && event.exits.length) {
          const lastExit = event.exits[event.exits.length - 1];

          const exitName =
            typeof lastExit === "string"
              ? lastExit.toLowerCase()
              : lastExit.name.toLowerCase();

          if (names.includes(exitName)) {
            score += 25;
            result = "bubble";
          }
        }

        /* =========================================
           ⚔️ ACTIVITY + COST
        ========================================== */

        score += hits * 10;
        score -= rebuys * 15;
        score -= buyins * 5;

        playerEvents.push({ score, result });
      });

      if (playerEvents.length < 3) return null;

      const recent = playerEvents.slice(-6);
      const trend = recent.map(e => e.score);

      return {
        ...player,
        trend,
        lastResult: recent[recent.length - 1].result,
        momentum: calcMomentum(trend),
        volatility: calcStdDev(trend),
        streak: calcStreak(recent)
      };

    })
    .filter(Boolean);
}

/* =========================================
   📈 MOMENTUM (WEIGHTED)
========================================= */
function calcMomentum(trend) {

  if (trend.length < 2) return 0;

  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 1; i < trend.length; i++) {
    const weight = i + 1;
    const delta = trend[i] - trend[i - 1];

    weightedSum += delta * weight;
    weightTotal += weight;
  }

  return Number((weightedSum / weightTotal).toFixed(2));
}

/* =========================================
   🎢 VOLATILITY (WEIGHTED)
========================================= */
function calcStdDev(arr) {

  const weights = arr.map((_, i) => i + 1);

  const weightedMean =
    arr.reduce((sum, val, i) => sum + val * weights[i], 0) /
    weights.reduce((a, b) => a + b, 0);

  const variance =
    arr.reduce((sum, val, i) =>
      sum + weights[i] * Math.pow(val - weightedMean, 2), 0
    ) / weights.reduce((a, b) => a + b, 0);

  return Math.sqrt(variance);
}

/* =========================================
   🔥 STREAK
========================================= */
function calcStreak(events) {
  let streak = 0;

  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].score > 60) streak++;
    else break;
  }

  return streak;
}

/* =========================================
   🎯 RANKING
========================================= */
function applyRanking(players, mode) {

  let sorted = [...players];

  switch (mode) {
    case "momentum":
      sorted.sort((a, b) => b.momentum - a.momentum);
      break;
    case "cold":
      sorted.sort((a, b) => a.momentum - b.momentum);
      break;
    case "consistent":
      sorted.sort((a, b) =>
        (b.momentum - b.volatility) - (a.momentum - a.volatility)
      );
      break;
    case "volatile":
      sorted.sort((a, b) => b.volatility - a.volatility);
      break;
  }

  sorted.forEach((p, i) => {
    p.rank = i + 1;
    p.rankChange = previousRanks[p.slug]
      ? previousRanks[p.slug] - p.rank
      : 0;

    previousRanks[p.slug] = p.rank;
  });

  return sorted;
}

/* =========================================
   🎛 CONTROLS
========================================= */
function bindControls(players) {

  const buttons = document.querySelectorAll(".pm-btn");

  const update = (mode, label, emoji) => {

    const ranked = applyRanking(players, mode);

    document.getElementById("pm-top-title").innerHTML =
      `${emoji} ${label}`;

    renderTopMovers(ranked);
    renderAllPlayers(ranked);
    drawAllSparklines();
  };

  buttons.forEach(btn => {

    btn.addEventListener("click", () => {

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const type = btn.dataset.sort;

      if (type === "momentum") update(type, "5 Hottest Players", "🔥");
      if (type === "cold") update(type, "5 Coldest Players", "❄️");
      if (type === "consistent") update(type, "5 Most Consistent Players", "🟢");
      if (type === "volatile") update(type, "5 Most Volatile Players", "🎢");
    });

  });

  update("momentum", "5 Hottest Players", "🔥");
}

/* =========================================
   🎴 RENDER
========================================= */
function renderTopMovers(players) {
  document.getElementById("pm-top-movers").innerHTML =
    players.slice(0,5).map(createCard).join("");
}

function renderAllPlayers(players) {
  document.getElementById("pm-player-grid").innerHTML =
    players.map(createCard).join("");
}

/* =========================================
   🎴 CARD
========================================= */
function createCard(p) {

  let arrow = "→";

  if (p.rankChange > 0) {
    arrow = `<span class="up">↑</span>`;
  } else if (p.rankChange < 0) {
    arrow = `<span class="down">↓</span>`;
  }

  let badge = "💀";
  let badgeClass = "pm-bust";

  if (p.lastResult === "win") {
    badge = "🏆";
    badgeClass = "pm-win";
  }
  else if (p.lastResult === "deep") {
    badge = "🎯";
    badgeClass = "pm-deep";
  }
  else if (p.lastResult === "bubble") {
    badge = "💣";
    badgeClass = "pm-bubble";
  }

  const streak =
    p.streak >= 2 ? "🔥".repeat(p.streak) : "";

  return `
    <div class="pm-player-card">
      <div class="pm-player-header">
        <img class="pm-avatar"
          src="${p.image}"
          onerror="this.src='images/players/default.jpg';" />
        <div>
          <strong>${p.name}</strong>
          <div>#${p.rank} ${arrow}</div>
        </div>
      </div>

      <div class="pm-badges">
        <span class="pm-icon ${badgeClass}">${badge}</span>
        <span class="pm-icon pm-streak">${streak}</span>
      </div>

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

    const delta = data[data.length - 1] - data[0];

    ctx.strokeStyle =
      delta > 0 ? "#4caf50" :
      delta < 0 ? "#e53935" :
      "#999";

    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * canvas.width;
      const y = canvas.height - ((val - min) / range) * canvas.height;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  });
}

init();
