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

        const winner = event.winners?.find(w =>
          names.includes(w.name.toLowerCase())
        );

        let result = "bust";

         if (winner) {
           result = "win";
         } else if (hits >= 3) {
           result = "deep";
         } else if (buyins > 0 && hits === 0 && rebuys === 0) {
           result = "bubble";
         }
         
        let score = 0;
        if (winner) score += 100;
        else score += 20;

        score += hits * 10;
        score -= rebuys * 15;
        score -= buyins * 5;

        playerEvents.push({ score, result });
      });

      if (playerEvents.length < 3) return null;

      const recent = playerEvents.slice(-5);
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
   📈 HELPERS
========================================= */
function calcMomentum(trend) {
  let delta = 0;
  for (let i = 1; i < trend.length; i++) {
    delta += (trend[i] - trend[i - 1]);
  }
  return Number(delta.toFixed(2));
}

function calcStdDev(arr) {
  const mean = arr.reduce((a,b) => a+b,0) / arr.length;
  const variance = arr.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

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
    <div class="pm-player-card ${p.rankClass || ''}">
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
        <span class="pm-icon pm-badge">${badge}</span>
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

    // 🔥 COLOR FIX
    ctx.strokeStyle =
      delta > 0 ? "#4caf50" :   // green
      delta < 0 ? "#e53935" :   // red
      "#999";                  // neutral

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
