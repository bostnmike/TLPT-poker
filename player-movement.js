const DATA_URL = "data/generated/site-data.json";

let players = [];
let previousRanks = {};

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
        let finishPosition = null;

        /* =========================================
           🏆 FINISH POSITION
        ========================================= */

        if (event.winners && event.winners.length) {
          const winnerIndex = event.winners.findIndex(w =>
            names.includes(w.name.toLowerCase())
          );
          if (winnerIndex !== -1) {
            finishPosition = winnerIndex + 1;
          }
        }

        if (finishPosition === null && event.exits && event.exits.length) {
          const exitIndex = event.exits.findIndex(e => {
            const n = typeof e === "string" ? e.toLowerCase() : e.name.toLowerCase();
            return names.includes(n);
          });

          if (exitIndex !== -1) {
            const totalPlayers =
              event.exits.length + (event.winners?.length || 0);
            finishPosition = totalPlayers - exitIndex;
          }
        }

        let finishPct = null;

        if (finishPosition !== null) {

          const totalPlayers =
            (event.exits?.length || 0) + (event.winners?.length || 0);

          finishPct = finishPosition / totalPlayers;

          if (finishPct <= 0.15) {
            score += 100;
            result = "win";
          }
          else if (finishPct <= 0.35) {
            score += 70;
            result = "deep";
          }
          else if (finishPct <= 0.55) {
            score += 40;
            result = "mid";
          }
          else if (finishPct <= 0.75) {
            score += 10;
            result = "mid";
          }
          else if (finishPct <= 0.9) {
            score -= 15;
            result = "early";
          }
          else {
            score -= 35;
            result = "very-early";
          }
        }

        /* 💣 Bubble */
        if (event.exits && event.exits.length) {
          const lastExit = event.exits[event.exits.length - 1];
          const name =
            typeof lastExit === "string"
              ? lastExit.toLowerCase()
              : lastExit.name.toLowerCase();

          if (names.includes(name)) {
            score += 20;
            result = "bubble";
          }
        }

        /* ⚔️ Activity + discipline */
        score += hits * 10;
        score -= rebuys * 15;

        /* 🧼 Clean run */
        if (rebuys === 0) score += 10;

        playerEvents.push({ score, result, finishPct });
      });

      if (playerEvents.length < 3) return null;

      const recent = playerEvents.slice(-6);
      const trend = recent.map(e => e.score);

      const avgFinishPct =
        recent.filter(e => e.finishPct != null).length
          ? recent.reduce((sum, e) => sum + e.finishPct, 0) / recent.length
          : null;

      return {
        ...player,
        trend,
        avgFinishPct,
        lastResult: recent[recent.length - 1].result,
        momentum: calcMomentum(trend),
        volatility: calcStdDev(trend),
        streak: calcStreak(recent)
      };

    })
    .filter(Boolean);
}

/* ========================================= */
function calcMomentum(trend) {
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

function calcStdDev(arr) {
  const weights = arr.map((_, i) => i + 1);

  const mean =
    arr.reduce((sum, val, i) => sum + val * weights[i], 0) /
    weights.reduce((a, b) => a + b, 0);

  const variance =
    arr.reduce((sum, val, i) =>
      sum + weights[i] * Math.pow(val - mean, 2), 0
    ) / weights.reduce((a, b) => a + b, 0);

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

/* ========================================= */
function applyRanking(players, mode) {

  let sorted = [...players];

  if (mode === "momentum") sorted.sort((a,b)=>b.momentum-a.momentum);
  if (mode === "cold") sorted.sort((a,b)=>a.momentum-b.momentum);
  if (mode === "consistent") sorted.sort((a,b)=>(b.momentum-b.volatility)-(a.momentum-a.volatility));
  if (mode === "volatile") sorted.sort((a,b)=>b.volatility-a.volatility);

  sorted.forEach((p,i)=>{
    p.rank = i+1;
    p.rankChange = previousRanks[p.slug] ? previousRanks[p.slug]-p.rank : 0;
    previousRanks[p.slug]=p.rank;
  });

  return sorted;
}

/* ========================================= */
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

/* ========================================= */
function renderTopMovers(players) {
  document.getElementById("pm-top-movers").innerHTML =
    players.slice(0,5).map(createCard).join("");
}

function renderAllPlayers(players) {
  document.getElementById("pm-player-grid").innerHTML =
    players.map(createCard).join("");
}

/* ========================================= */
function createCard(p) {

  let badge = "💀";
  let badgeClass = "pm-bust";

  if (p.lastResult === "win") badge = "🏆";
  else if (p.lastResult === "deep") badge = "🎯";
  else if (p.lastResult === "bubble") badge = "💣";
  else if (p.lastResult === "early") badge = "❄️";
  else if (p.lastResult === "very-early") badge = "🥶";

  return `
    <div class="pm-player-card">
      <div class="pm-player-header">
        <img class="pm-avatar" src="${p.image}" />
        <div>
          <strong>${p.name}</strong>
          <div>#${p.rank}</div>
        </div>
      </div>

      <div class="pm-badges">
        <span class="pm-icon">${badge}</span>
      </div>

      <canvas class="pm-sparkline" data-trend="${p.trend.join(',')}"></canvas>

      <div class="pm-stats">
        Momentum: ${p.momentum}<br/>
        Volatility: ${p.volatility.toFixed(1)}<br/>
        Avg Finish: ${p.avgFinishPct ? (p.avgFinishPct*100).toFixed(0)+"%" : "--"}
      </div>
    </div>
  `;
}

/* ========================================= */
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
    data.forEach((val,i)=>{
      const x = (i/(data.length-1))*120;
      const y = 40 - ((val-min)/range)*40;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
  });
}

init();
