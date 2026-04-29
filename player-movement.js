const DATA_URL = "data/generated/site-data.json";

let players = [];
let previousRanks = {};

const DEFAULT_EVENT_FILES = [
  "2025-05-24.json",
  "2025-06-14.json",
  "2025-06-21.json",
  "2025-06-28.json",
  "2025-07-26.json",
  "2025-08-23.json",
  "2025-10-03.json",
  "2025-10-25.json",
  "2025-11-01.json",
  "2025-11-15.json",
  "2025-11-30.json",
  "2025-12-06.json",
  "2025-12-13.json",
  "2025-12-21.json",
  "2025-12-27.json",
  "2026-01-03.json",
  "2026-01-17.json",
  "2026-01-24.json",
  "2026-01-30.json",
  "2026-02-07.json",
  "2026-02-13.json",
  "2026-02-21.json",
  "2026-02-27.json",
  "2026-03-07.json",
  "2026-03-13.json",
  "2026-03-14.json",
  "2026-03-27.json",
  "2026-03-28.json",
  "2026-04-04.json",
  "2026-04-17.json",
  "2026-04-18.json",
  "2026-04-24.json"
];

const KNOWN_PLAYER_ALIASES = {
  "buffalomike": ["mike-g", "mikeg", "buffalo mike"],
  "ai-dave": ["a.i. dave", "ai dave", "aidave"],
  "nasa-al": ["nasa al", "nasaal"],
  "li-fo": ["lifo", "li fo"],
  "providencemike": ["providence mike"],
  "bostnmike": ["bostn mike", "bostnmike"],
  "the-architect": ["architect", "the architect", "billy b"],
  "wild-bill": ["wild bill"],
  "pittsburghbill": ["pittsburgh bill"],
  "phattedcalf": ["phatted calf"]
};

/* =========================================
   🔐 NORMALIZATION + MATCHING
========================================= */

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function playerKeys(player) {
  const keys = [
    player.name,
    player.slug,
    ...(player.aliases || [])
  ];

  const aliasList = KNOWN_PLAYER_ALIASES[player.slug] || [];
  aliasList.forEach(alias => keys.push(alias));

  return [...new Set(keys.map(normalize).filter(Boolean))];
}

function rowKeys(row) {
  return [
    row && row.name,
    row && row.player,
    row && row.slug
  ].map(normalize).filter(Boolean);
}

function isSamePlayer(player, rawName, rawSlug) {
  const pKeys = playerKeys(player);
  const rKeys = [rawName, rawSlug].map(normalize).filter(Boolean);
  return rKeys.some(key => pKeys.includes(key));
}

function isSamePlayerRow(player, row) {
  const pKeys = playerKeys(player);
  const rKeys = rowKeys(row);
  return rKeys.some(key => pKeys.includes(key));
}

/* =========================================
   🚀 INIT
========================================= */

async function init() {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();

    players = data.players || [];

    let eventFiles = [...DEFAULT_EVENT_FILES];

    try {
      const indexRes = await fetch("data/parsed/events/index.json");

      if (indexRes && indexRes.ok) {
        const indexJson = await indexRes.json();

        if (Array.isArray(indexJson) && indexJson.length) {
          eventFiles = [...new Set([...DEFAULT_EVENT_FILES, ...indexJson])];
        }
      }
    } catch (err) {
      console.warn("No data/parsed/events/index.json found. Using built-in event file list.");
    }

    const eventData = (await Promise.all(
      eventFiles.map(file =>
        fetch(`data/parsed/events/${file}`)
          .then(response => {
            if (!response.ok) throw new Error(`Missing event file: ${file}`);
            return response.json();
          })
          .catch(err => {
            console.warn("Could not load event file:", file, err);
            return null;
          })
      )
    )).filter(Boolean);

    eventData.sort((a, b) =>
      new Date(a.date || a.eventId) - new Date(b.date || b.eventId)
    );

    const enriched = buildAnalytics(players, eventData);
    bindControls(enriched);

  } catch (err) {
    console.error("Player Form init failed:", err);

    const grid = document.getElementById("pm-player-grid");
    if (grid) {
      grid.innerHTML = `
        <div class="pm-error">
          Player Form could not load. Check the browser console for details.
        </div>
      `;
    }
  }
}

/* =========================================
   🧠 EVENT MODEL
========================================= */

function getEventModel(event) {
  const rows = Array.isArray(event.players) ? event.players : [];
  const actions = Array.isArray(event.actions) ? event.actions : [];

  const winners =
    Array.isArray(event.winners) && event.winners.length
      ? event.winners.map((w, index) => ({
          name: w.name || w.player,
          slug: w.slug,
          rank: toNumber(w.rank, index + 1)
        }))
      : actions
          .filter(a => a.type === "payout")
          .map((a, index) => ({
            name: a.player || a.name,
            slug: a.slug,
            rank: toNumber(a.rank, index + 1)
          }));

  const summaryEntries = toNumber(event.summary && event.summary.entries, 0);
  const summaryBuyIns = toNumber(event.summary && event.summary.buyIns, 0);
  const summaryRebuys = toNumber(event.summary && event.summary.rebuys, 0);

  const rowEntries = rows.reduce(
    (sum, row) => sum + toNumber(row.entries, 0),
    0
  );

  const actionEntries = actions.filter(
    action => action.type === "buyin" || action.type === "rebuy"
  ).length;

  const totalEntries =
    summaryEntries ||
    (summaryBuyIns + summaryRebuys) ||
    rowEntries ||
    actionEntries ||
    rows.filter(row =>
      toNumber(row.entries, 0) > 0 ||
      toNumber(row.buyIns, 0) > 0 ||
      toNumber(row.rebuys, 0) > 0
    ).length;

  const participantRows = rows.filter(row =>
    toNumber(row.entries, 0) > 0 ||
    toNumber(row.buyIns, 0) > 0 ||
    toNumber(row.rebuys, 0) > 0
  );

  const finishByKey = new Map();
  const usedPositions = new Set();

  function addFinishForRow(row, finishPosition, source) {
    if (!row || !finishPosition || !totalEntries) return;

    const cleanFinish = Math.max(
      1,
      Math.min(totalEntries, toNumber(finishPosition, 0))
    );

    const finish = {
      finishPosition: cleanFinish,
      totalEntries,
      finishPct: cleanFinish / totalEntries,
      finishLabel: `${cleanFinish}/${totalEntries}`,
      source
    };

    rowKeys(row).forEach(key => {
      finishByKey.set(key, finish);
    });

    usedPositions.add(cleanFinish);
  }

  winners.forEach((winner, index) => {
    const winnerRank = toNumber(winner.rank, index + 1);

    const row = participantRows.find(r =>
      isSamePlayer(
        { name: winner.name, slug: winner.slug, aliases: [] },
        r.name,
        r.slug
      )
    );

    if (row) {
      addFinishForRow(row, winnerRank, "winner");
    }
  });

  const bustouts = actions.filter(action => action.type === "bustout");

  bustouts.forEach((action, index) => {
    const row = participantRows.find(r =>
      isSamePlayer(
        { name: action.player, slug: action.slug, aliases: [] },
        r.name,
        r.slug
      )
    );

    if (!row) return;

    const alreadyWinner = winners.some(winner =>
      isSamePlayer(
        { name: winner.name, slug: winner.slug, aliases: [] },
        row.name,
        row.slug
      )
    );

    if (alreadyWinner) return;

    const finishPosition = totalEntries - index;

    const existing = rowKeys(row)
      .map(key => finishByKey.get(key))
      .find(Boolean);

    if (!existing || finishPosition < existing.finishPosition) {
      addFinishForRow(row, finishPosition, "bustout");
    }
  });

  participantRows.forEach(row => {
    const alreadyHasFinish = rowKeys(row).some(key => finishByKey.has(key));
    if (alreadyHasFinish) return;

    const openPositions = [];
    for (let pos = totalEntries; pos >= 1; pos--) {
      if (!usedPositions.has(pos)) openPositions.push(pos);
    }

    const fallbackPosition = openPositions.length ? openPositions[0] : totalEntries;

    console.warn("Missing finish action; assigned fallback finish:", {
      event: event.eventId || event.date || event.title,
      player: row.name,
      finish: `${fallbackPosition}/${totalEntries}`
    });

    addFinishForRow(row, fallbackPosition, "fallback");
  });

  return {
    event,
    rows: participantRows,
    totalEntries,
    finishByKey
  };
}

function getRowForPlayer(model, player) {
  return model.rows.find(row => isSamePlayerRow(player, row)) || null;
}

function getFinishForPlayer(model, player) {
  const keys = playerKeys(player);

  for (const key of keys) {
    if (model.finishByKey.has(key)) {
      return model.finishByKey.get(key);
    }
  }

  return null;
}

/* =========================================
   🧮 FORM SCORING
========================================= */

function scoreEvent(finishPct, row) {
  let score = 0;

  if (finishPct <= 0.15) score += 100;
  else if (finishPct <= 0.35) score += 70;
  else if (finishPct <= 0.55) score += 40;
  else if (finishPct <= 0.75) score += 10;
  else if (finishPct <= 0.90) score -= 15;
  else score -= 35;

  const hits = toNumber(row && row.hits, 0);
  const rebuys = toNumber(row && row.rebuys, 0);
  const bubbles = toNumber(row && row.bubbles, 0);

  score += hits * 10;
  score -= rebuys * 15;

  if (bubbles > 0) score += 20;
  if (rebuys === 0) score += 10;

  return score;
}

/* =========================================
   🧠 ANALYTICS
========================================= */

function buildAnalytics(players, events) {
  const eventModels = events
    .map(getEventModel)
    .filter(model => model.totalEntries > 1);

  return players.map(player => {
    const playerEvents = [];

    eventModels.forEach(model => {
      const row = getRowForPlayer(model, player);
      if (!row) return;

      const finish = getFinishForPlayer(model, player);
      if (!finish) return;

      const score = scoreEvent(finish.finishPct, row);

      playerEvents.push({
        eventId: model.event.eventId || model.event.date || "",
        date: model.event.date || model.event.eventId || "",
        title: model.event.title || "",
        score,
        finishPct: finish.finishPct,
        finishPosition: finish.finishPosition,
        totalEntries: finish.totalEntries,
        finishLabel: finish.finishLabel,
        source: finish.source
      });
    });

    if (playerEvents.length < 4) return null;

    const recent = playerEvents.slice(-6);

    const trend = recent.map(event => 1 - event.finishPct);
    const scores = recent.map(event => event.score);

    const avgFinishPosition =
      recent.reduce((sum, event) => sum + event.finishPosition, 0) / recent.length;

    const avgFieldSize =
      recent.reduce((sum, event) => sum + event.totalEntries, 0) / recent.length;

    const best = recent.reduce(
      (bestEvent, event) =>
        !bestEvent || event.finishPct < bestEvent.finishPct
          ? event
          : bestEvent,
      null
    );

    return {
      ...player,
      eventsPlayedForForm: playerEvents.length,
      recentEvents: recent,
      trend,
      scores,
      finishes: recent.map(event => event.finishLabel),
      avgFinishPosition,
      avgFieldSize,
      avgFinishDisplay: `${avgFinishPosition.toFixed(1)} / ${avgFieldSize.toFixed(1)}`,
      bestFinish: best ? best.finishLabel : "--",
      momentum: calcMomentum(trend),
      volatility: calcStdDev(trend),
      formScore: weightedAverage(scores)
    };
  }).filter(Boolean);
}

/* =========================================
   📈 MATH HELPERS
========================================= */

function calcMomentum(arr) {
  if (!arr || !arr.length) return 0;
  if (arr.length < 2) return 0;

  let total = 0;
  let weightTotal = 0;

  for (let i = 1; i < arr.length; i++) {
    const weight = i + 1;
    total += (arr[i] - arr[i - 1]) * weight;
    weightTotal += weight;
  }

  return weightTotal ? Number((total / weightTotal).toFixed(2)) : 0;
}

function calcStdDev(arr) {
  if (!arr || arr.length < 2) return 0;

  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance =
    arr.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / arr.length;

  return Number(Math.sqrt(variance).toFixed(2));
}

function weightedAverage(values) {
  if (!values || !values.length) return 0;

  let total = 0;
  let weightTotal = 0;

  values.forEach((value, index) => {
    const weight = index + 1;
    total += value * weight;
    weightTotal += weight;
  });

  return weightTotal ? Number((total / weightTotal).toFixed(2)) : 0;
}

/* =========================================
   🎯 RANKING
========================================= */

function applyRanking(players, mode) {
  const sorted = [...players];

  if (mode === "momentum") {
    sorted.sort((a, b) =>
      (b.momentum - a.momentum) ||
      (b.formScore - a.formScore) ||
      (a.avgFinishPosition - b.avgFinishPosition) ||
      a.name.localeCompare(b.name)
    );
  }

  if (mode === "cold") {
    sorted.sort((a, b) =>
      (a.momentum - b.momentum) ||
      (a.formScore - b.formScore) ||
      (b.avgFinishPosition - a.avgFinishPosition) ||
      a.name.localeCompare(b.name)
    );
  }

  if (mode === "consistent") {
    sorted.sort((a, b) =>
      ((b.formScore - b.volatility) - (a.formScore - a.volatility)) ||
      (a.avgFinishPosition - b.avgFinishPosition) ||
      a.name.localeCompare(b.name)
    );
  }

  if (mode === "volatile") {
    sorted.sort((a, b) =>
      (b.volatility - a.volatility) ||
      (Math.abs(b.momentum) - Math.abs(a.momentum)) ||
      a.name.localeCompare(b.name)
    );
  }

  sorted.forEach((player, index) => {
    player.rank = index + 1;

    player.rankChange = previousRanks[player.slug]
      ? previousRanks[player.slug] - player.rank
      : 0;

    previousRanks[player.slug] = player.rank;
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

    const title = document.getElementById("pm-top-title");
    if (title) {
      title.innerHTML = `${emoji} ${label}`;
    }

    renderTopMovers(ranked);
    renderAllPlayers(ranked);
    drawAllSparklines();
  };

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      button.classList.add("active");

      const type = button.dataset.sort;

      if (type === "momentum") update(type, "5 Hottest Players", "🔥");
      if (type === "cold") update(type, "5 Coldest Players", "❄️");
      if (type === "consistent") update(type, "5 Most Consistent Players", "🟢");
      if (type === "volatile") update(type, "5 Most Volatile Players", "🎢");
    });
  });

  update("momentum", "5 Hottest Players", "🔥");
}

/* =========================================
   🎴 CARD RENDERING
========================================= */

function rankArrowMarkup(player) {
  if (player.rankChange > 0) {
    return `<span class="pm-rank-badge pm-rank-up">↑ ${player.rankChange}</span>`;
  }

  if (player.rankChange < 0) {
    return `<span class="pm-rank-badge pm-rank-down">↓ ${Math.abs(player.rankChange)}</span>`;
  }

  return `<span class="pm-rank-badge pm-rank-flat">→ 0</span>`;
}

function createCard(player) {
  const finishHistory = player.finishes
    .map(finish => escapeHtml(finish))
    .join(" | ");

  return `
    <div class="pm-player-card">
      <div class="pm-player-header">
        <img
          class="pm-avatar"
          src="${escapeHtml(player.image || "images/players/default.jpg")}"
          onerror="this.src='images/players/default.jpg';"
        />
        <div class="pm-player-heading">
          <strong>${escapeHtml(player.name)}</strong>
          <div class="pm-player-subhead">#${player.rank}</div>
        </div>
      </div>

      <canvas
        class="pm-sparkline"
        data-trend="${player.trend.join(",")}"
      ></canvas>

      <div class="pm-card-metrics">
        <div class="pm-metric-list">
          <div class="pm-metric-row">
            <span class="pm-metric-label">Avg Finish</span>
            <span class="pm-metric-value">${escapeHtml(player.avgFinishDisplay)}</span>
          </div>
          <div class="pm-metric-row">
            <span class="pm-metric-label">Best Finish</span>
            <span class="pm-metric-value">${escapeHtml(player.bestFinish)}</span>
          </div>
        </div>

        <div class="pm-rank-change-wrap">
          ${rankArrowMarkup(player)}
        </div>
      </div>

      <div class="pm-stats pm-finish-history">
        <span class="pm-finish-history-label">Recent Finishes:</span>
        <span class="pm-finish-history-values">${finishHistory}</span>
      </div>
    </div>
  `;
}

/* =========================================
   📉 SPARKLINES
========================================= */

function drawAllSparklines() {
  document.querySelectorAll(".pm-sparkline").forEach(canvas => {
    let data = String(canvas.dataset.trend || "")
      .split(",")
      .map(Number)
      .filter(Number.isFinite);

    if (data.length === 0) {
      data = [0.5, 0.5];
    }

    if (data.length === 1) {
      data = [data[0], data[0]];
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 120;
    canvas.height = 40;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const max = Math.max(...data);
    const min = Math.min(...data);
    const flat = max === min;
    const range = flat ? 1 : max - min;

    ctx.strokeStyle = "#ffd54a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * canvas.width;
      const y = flat
        ? canvas.height / 2
        : canvas.height - ((value - min) / range) * canvas.height;

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  });
}

/* =========================================
   🧱 RENDER TARGETS
========================================= */

function renderTopMovers(players) {
  const el = document.getElementById("pm-top-movers");
  if (!el) return;

  el.innerHTML = players
    .slice(0, 5)
    .map(createCard)
    .join("");
}

function renderAllPlayers(players) {
  const el = document.getElementById("pm-player-grid");
  if (!el) return;

  el.innerHTML = players
    .map(createCard)
    .join("");

  drawAllSparklines();
}

init();
