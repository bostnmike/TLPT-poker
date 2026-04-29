const DATA_URL = "data/generated/site-data.json";

let players = [];
let previousRanks = {};

/* =========================================
   🔐 NORMALIZATION + MATCHING
========================================= */
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function isSamePlayer(player, rawName) {
  if (!rawName) return false;

  const nRaw = normalize(rawName);

  // slug match (primary)
  if (player.slug && normalize(player.slug) === nRaw) return true;

  // name + aliases (fallback)
  const allNames = [player.name, ...(player.aliases || [])];
  return allNames.some(n => normalize(n) === nRaw);
}

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

  return players.map(player => {

    const playerEvents = [];

    events.forEach(event => {

      const actions = event.actions || [];

      const participated = actions.some(a =>
        (a.type === "buyin" || a.type === "rebuy") &&
        isSamePlayer(player, a.player)
      );

      if (!participated) return;

      const rebuys = actions.filter(a =>
        a.type === "rebuy" &&
        isSamePlayer(player, a.player)
      ).length;

      const hits = actions.filter(a =>
        a.type === "knockout" &&
        isSamePlayer(player, a.player)
      ).length;

      /* =========================================
         🧮 TRUE FIELD SIZE
      ========================================== */
      const winners = event.winners || [];
      const exits = event.exits || [];

      let totalPlayers =
        event.summary?.entries ||
        event.summary?.totalEntries ||
        event.summary?.players ||
        null;

      if (!totalPlayers) {
        totalPlayers = exits.length + winners.length;
      }

      if (!totalPlayers || totalPlayers < 2) return;

      /* =========================================
         🏁 FINISH POSITION
      ========================================== */
      let finishPosition = null;

      // winners
      const winnerIndex = winners.findIndex(w =>
        isSamePlayer(player, w.name)
      );

      if (winnerIndex !== -1) {
        finishPosition = winnerIndex + 1;
      }

      // exits
      if (finishPosition === null) {
        const exitIndex = exits.findIndex(e => {
          const raw = typeof e === "string" ? e : e.name;
          return isSamePlayer(player, raw);
        });

        if (exitIndex !== -1) {
          finishPosition = totalPlayers - exitIndex;
        }
      }

      // 🚨 skip invalid data (NO silent corruption)
      if (!finishPosition) return;

      const finishPct = finishPosition / totalPlayers;

      /* =========================================
         📊 SCORING
      ========================================== */
      let score = 0;

      if (finishPct <= 0.15) score += 100;
      else if (finishPct <= 0.35) score += 70;
      else if (finishPct <= 0.55) score += 40;
      else if (finishPct <= 0.75) score += 10;
      else if (finishPct <= 0.9) score -= 15;
      else score -= 35;

      // bubble
      if (exits.length) {
        const last = exits[exits.length - 1];
        const raw = typeof last === "string" ? last : last.name;
        if (isSamePlayer(player, raw)) score += 20;
      }

      // activity
      score += hits * 10;
      score -= rebuys * 15;

      // clean run
      if (rebuys === 0) score += 10;

      playerEvents.push({
        score,
        finishPct,
        finishPosition,
        totalPlayers
      });
    });

    /* =========================================
       🔥 QUALIFICATION (MIN 4 EVENTS)
    ========================================== */
    if (playerEvents.length < 4) return null;

    const recent = playerEvents.slice(-6);

    const valid = recent.filter(e => e.finishPct != null);

    if (!valid.length) return null;

    /* =========================================
       📉 TREND (FIXED)
    ========================================== */
    const trend = valid.map(e => 1 - e.finishPct);

    const avgFinishPct =
      valid.reduce((sum, e) => sum + e.finishPct, 0) / valid.length;

    const bestFinishRaw =
      valid.reduce((best, e) =>
        !best || e.finishPct < best.finishPct ? e : best,
        null
      );

    return {
      ...player,
      trend,
      avgFinishPct,
      bestFinishRaw,
      momentum: calcMomentum(trend),
      volatility: calcStdDev(trend)
    };

  }).filter(Boolean);
}

/* =========================================
   📈 MOMENTUM
========================================= */
function calcMomentum(arr) {
  let total = 0;
  let weightTotal = 0;

  for (let i = 1; i < arr.length; i++) {
    const weight = i + 1;
    total += (arr[i] - arr[i - 1]) * weight;
    weightTotal += weight;
  }

  return Number((total / weightTotal).toFixed(2));
}

/* =========================================
   🎢 VOLATILITY
========================================= */
function calcStdDev(arr) {
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  return Math.sqrt(arr.reduce((s,v)=>s+(v-mean)**2,0)/arr.length);
}

/* =========================================
   🎯 RANKING
========================================= */
function applyRanking(players, mode) {

  let sorted = [...players];

  if (mode === "momentum") sorted.sort((a,b)=>b.momentum-a.momentum);
  if (mode === "cold") sorted.sort((a,b)=>a.momentum-b.momentum);
  if (mode === "consistent") sorted.sort((a,b)=>(b.momentum-b.volatility)-(a.momentum-a.volatility));
  if (mode === "volatile") sorted.sort((a,b)=>b.volatility-a.volatility);

  sorted.forEach((p,i)=>{
    p.rank = i+1;
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
   🎴 CARD
========================================= */
function createCard(p) {

  const best = p.bestFinishRaw;

  return `
    <div class="pm-player-card">
      <div class="pm-player-header">
        <img class="pm-avatar" src="${p.image}" />
        <div>
          <strong>${p.name}</strong>
          <div>#${p.rank}</div>
        </div>
      </div>

      <canvas class="pm-sparkline" data-trend="${p.trend.join(',')}"></canvas>

      <div class="pm-stats">
        Avg Finish: ${(p.avgFinishPct*100).toFixed(0)}%<br/>
        Best Finish: ${
          best ? `${best.finishPosition} / ${best.totalPlayers}` : "--"
        }<br/>
        Momentum: ${p.momentum}
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

    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((v,i)=>{
      const x = (i/(data.length-1))*120;
      const y = 40 - ((v-min)/range)*40;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });

    ctx.stroke();
  });
}

function renderTopMovers(players) {
  document.getElementById("pm-top-movers").innerHTML =
    players.slice(0,5).map(createCard).join("");
}

function renderAllPlayers(players) {
  document.getElementById("pm-player-grid").innerHTML =
    players.map(createCard).join("");
}

init();
