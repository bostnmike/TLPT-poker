const DATA_URL = "data/generated/site-data.json";

let players = [];
let previousRanks = {};

/* ========================================= */
function normalize(str) {
  return (str || "").toLowerCase().replace(/\s+/g, "").trim();
}

function isSamePlayer(player, rawName) {
  if (!rawName) return false;

  const nRaw = normalize(rawName);

  if (player.slug && normalize(player.slug) === nRaw) return true;

  const allNames = [player.name, ...(player.aliases || [])];
  return allNames.some(n => normalize(n) === nRaw);
}

/* ========================================= */
async function init() {
  try {
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

  } catch (err) {
    console.error("INIT ERROR:", err);
  }
}

/* ========================================= */
function buildAnalytics(players, events) {

  return players.map(player => {

    const playerEvents = [];

    events.forEach(event => {

      const row = (event.players || []).find(p =>
        isSamePlayer(player, p.name)
      );

      if (!row) return;

      const finishPosition = Number(row.place);
      const totalPlayers =
        Number(event.summary?.entries) ||
        Number(event.players?.length) ||
        0;

      if (!finishPosition || !totalPlayers) return;

      const finishPct = finishPosition / totalPlayers;

      if (!isFinite(finishPct)) return;

      const rebuys = Number(row.rebuys || 0);
      const hits = Number(row.hits || 0);

      let score = 0;

      if (finishPct <= 0.15) score += 100;
      else if (finishPct <= 0.35) score += 70;
      else if (finishPct <= 0.55) score += 40;
      else if (finishPct <= 0.75) score += 10;
      else if (finishPct <= 0.9) score -= 15;
      else score -= 35;

      score += hits * 10;
      score -= rebuys * 15;

      if (rebuys === 0) score += 10;

      playerEvents.push({
        score,
        finishPct,
        finishLabel: `${finishPosition}/${totalPlayers}`
      });
    });

    if (playerEvents.length < 4) return null;

    const recent = playerEvents.slice(-6);

    const trend = recent.map(e =>
      isFinite(e.finishPct) ? (1 - e.finishPct) : 0.5
    );

    const avgFinishPct =
      recent.reduce((sum, e) => sum + e.finishPct, 0) / recent.length;

    const best = recent.reduce((best, e) =>
      !best || e.finishPct < best.finishPct ? e : best
    );

    return {
      ...player,
      trend,
      finishes: recent.map(e => e.finishLabel || "--"),
      avgFinishPct,
      bestFinish: best.finishLabel,
      momentum: calcMomentum(trend),
      volatility: calcStdDev(trend)
    };

  }).filter(Boolean);
}

/* ========================================= */
function calcMomentum(arr) {
  if (!arr || arr.length < 2) return 0;

  let total = 0;
  let weightTotal = 0;

  for (let i = 1; i < arr.length; i++) {
    const weight = i + 1;
    total += (arr[i] - arr[i - 1]) * weight;
    weightTotal += weight;
  }

  return weightTotal ? Number((total / weightTotal).toFixed(2)) : 0;
}

/* ========================================= */
function calcStdDev(arr) {
  if (!arr || arr.length < 2) return 0;

  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  return Math.sqrt(arr.reduce((s,v)=>s+(v-mean)**2,0)/arr.length);
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
    p.rankChange = previousRanks[p.slug]
      ? previousRanks[p.slug] - p.rank
      : 0;

    previousRanks[p.slug] = p.rank;
  });

  return sorted;
}

/* ========================================= */
function bindControls(players) {

  const buttons = document.querySelectorAll(".pm-btn");

  const update = (mode, label, emoji) => {

    const ranked = applyRanking(players, mode);

    const title = document.getElementById("pm-top-title");
    if (title) {
      title.innerHTML = `${emoji} ${label}`;
    }

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
function createCard(p) {

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
        Avg Finish: ${(p.avgFinishPct * 100).toFixed(0)}%<br/>
        Best Finish: ${p.bestFinish}<br/>
        Momentum: ${p.momentum}<br/>
        ${p.finishes.join(" | ")}
      </div>
    </div>
  `;
}

/* ========================================= */
function drawAllSparklines() {

  document.querySelectorAll(".pm-sparkline").forEach(canvas => {

    let data = canvas.dataset.trend.split(",").map(Number);

    if (data.some(isNaN)) {
      data = data.map(v => isNaN(v) ? 0.5 : v);
    }

    if (data.length < 2) {
      data = [0.5, 0.5];
    }

    const ctx = canvas.getContext("2d");

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

/* ========================================= */
function renderTopMovers(players) {
  const el = document.getElementById("pm-top-movers");
  if (!el) return;

  el.innerHTML = players.slice(0,5).map(createCard).join("");
}

function renderAllPlayers(players) {
  const el = document.getElementById("pm-player-grid");
  if (!el) return;

  el.innerHTML = players.map(createCard).join("");
  drawAllSparklines();
}

init();
