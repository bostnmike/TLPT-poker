/* form-lab.js */

const FORM_LAB_STATE = {
  data: null,
  players: [],
  events: [],
  selectedPlayerSlug: "",
  preset: "form-volatility",
  xMetric: "volatility",
  yMetric: "formScore",
  window: "6",
  showLabels: true,
  showTrend: true,
  showAverage: true,
  selectedEventId: ""
};

const FORM_LAB_PRESETS = {
  "form-volatility": {
    label: "Form vs. Volatility",
    xMetric: "volatility",
    yMetric: "formScore",
    description: "Who is heating up, who is steady, and who is turning every night into a weather event."
  },
  "finish-rebuys": {
    label: "Finish Depth vs. Rebuy Load",
    xMetric: "rebuys",
    yMetric: "finishDepth",
    description: "Deep runs look a lot cleaner when they do not require a wheelbarrow full of second chances."
  },
  "profit-finish": {
    label: "Profit vs. Finish Depth",
    xMetric: "finishDepth",
    yMetric: "profit",
    description: "Because running deep is nice, but cashing checks is the part people remember."
  },
  "hits-finish": {
    label: "Hits vs. Finish Depth",
    xMetric: "hits",
    yMetric: "finishDepth",
    description: "Did the violence actually help, or was it just loud cardio?"
  },
  "profit-rebuys": {
    label: "Profit vs. Rebuys",
    xMetric: "rebuys",
    yMetric: "profit",
    description: "A sober look at whether the extra bullets were genius, denial, or performance art."
  },
  "bubble-pain": {
    label: "Bubble Pain Map",
    xMetric: "finishDepth",
    yMetric: "painIndex",
    description: "For nights when the result was technically close and emotionally criminal."
  },
  custom: {
    label: "Custom",
    xMetric: "rebuys",
    yMetric: "finishDepth",
    description: "Pick your own axes and make your own deeply unnecessary case."
  }
};

const FORM_LAB_METRICS = {
  formScore: {
    label: "Form Score",
    short: "Form",
    format: value => numberFmt(value, 1),
    description: "A weighted event score using finish depth, profit, hits, rebuys, cashing, and bubble pain."
  },
  finishDepth: {
    label: "Finish Depth",
    short: "Depth",
    format: value => `${numberFmt(value, 0)}%`,
    description: "Normalized finish strength. Higher means a deeper run."
  },
  finishPosition: {
    label: "Finish Position",
    short: "Finish",
    format: value => value ? ordinal(value) : "-",
    invertAxis: true,
    description: "Actual finishing place. Lower is better."
  },
  fieldSize: {
    label: "Field Size",
    short: "Field",
    format: value => numberFmt(value, 0),
    description: "Effective field size for that event."
  },
  rebuys: {
    label: "Rebuys",
    short: "Rebuys",
    format: value => numberFmt(value, 0),
    description: "Player rebuys in that event."
  },
  entriesUsed: {
    label: "Entries Used",
    short: "Entries",
    format: value => numberFmt(value, 0),
    description: "Buy-in plus rebuys used by the player."
  },
  hits: {
    label: "Hits",
    short: "Hits",
    format: value => numberFmt(value, 0),
    description: "Knockouts credited to the player in that event."
  },
  profit: {
    label: "Profit",
    short: "Profit",
    format: moneyFmt,
    description: "Event winnings minus buy-in/rebuy cost."
  },
  cost: {
    label: "Cost",
    short: "Cost",
    format: moneyFmt,
    description: "Event cost based on buy-in plus rebuys."
  },
  winnings: {
    label: "Winnings",
    short: "Won",
    format: moneyFmt,
    description: "Event payout/winnings."
  },
  bubbleFlag: {
    label: "Bubble Flag",
    short: "Bubble",
    format: value => Number(value) ? "Yes" : "No",
    description: "1 if the player bubbled, 0 otherwise."
  },
  cashFlag: {
    label: "Cash Flag",
    short: "Cash",
    format: value => Number(value) ? "Yes" : "No",
    description: "1 if the player cashed, 0 otherwise."
  },
  efficiencyScore: {
    label: "Efficiency Score",
    short: "Efficiency",
    format: value => numberFmt(value, 1),
    description: "Finish depth adjusted for rebuy load."
  },
  chaosScore: {
    label: "Chaos Score",
    short: "Chaos",
    format: value => numberFmt(value, 1),
    description: "Rebuys, hits, and swingy outcomes rolled into one chaos-friendly number."
  },
  painIndex: {
    label: "Pain Index",
    short: "Pain",
    format: value => numberFmt(value, 1),
    description: "Near-miss misery: bubble pain, deep-run disappointment, and negative profit."
  },
  killerValue: {
    label: "Killer Value",
    short: "Killer",
    format: value => numberFmt(value, 2),
    description: "Hits per entry used."
  },
  survivalValue: {
    label: "Survival Value",
    short: "Survival",
    format: value => numberFmt(value, 1),
    description: "Finish depth relative to event size and entry use."
  },
  volatility: {
    label: "Event Volatility",
    short: "Volatility",
    format: value => numberFmt(value, 1),
    description: "How swingy the event was for the player."
  }
};

document.addEventListener("DOMContentLoaded", initFormLab);

async function initFormLab() {
  try {
    const data = await loadFormLabData();
    FORM_LAB_STATE.data = data;
    FORM_LAB_STATE.players = normalizePlayers(data.players || []);
    FORM_LAB_STATE.events = data.events || [];

    populatePlayerSelect();
    populateMetricSelects();
    wireFormLabControls();

    const defaultPlayer =
      FORM_LAB_STATE.players.find(player => player.slug === "bostnmike") ||
      FORM_LAB_STATE.players[0];

    FORM_LAB_STATE.selectedPlayerSlug = defaultPlayer?.slug || "";

    const playerSelect = document.getElementById("fl-player-select");
    if (playerSelect) playerSelect.value = FORM_LAB_STATE.selectedPlayerSlug;

    applyPreset("form-volatility", false);
    renderFormLab();
  } catch (err) {
    console.error("Form Lab failed to initialize:", err);
    const root = document.getElementById("form-lab-root");
    if (root) {
      root.innerHTML = `
        <section class="fl-shell fl-error-shell">
          <h2>Form Lab could not load.</h2>
          <p>Something went wrong loading the event data. Check the browser console and make sure the parsed event files exist.</p>
        </section>
      `;
    }
  }
}

async function loadFormLabData() {
  const siteRes = await fetch("data/generated/site-data.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!siteRes.ok) {
    throw new Error(`Failed to load site-data.json (${siteRes.status})`);
  }

  const siteData = await siteRes.json();

  const indexRes = await fetch("data/parsed/events/index.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!indexRes.ok) {
    throw new Error(`Failed to load parsed event index (${indexRes.status})`);
  }

  const indexData = await indexRes.json();
  const files = normalizeEventIndexFiles(indexData);

  const eventResponses = await Promise.all(
    files.map(async file => {
      const cleanFile = String(file || "").replace(/^\/+/, "");
      const url = cleanFile.includes("/")
        ? cleanFile
        : `data/parsed/events/${cleanFile}`;

      const res = await fetch(`${url}?v=${Date.now()}`, {
        cache: "no-store"
      });

      if (!res.ok) {
        console.warn(`Skipping event file ${url}: ${res.status}`);
        return null;
      }

      return res.json();
    })
  );

  return {
    ...siteData,
    events: eventResponses.filter(Boolean)
  };
}

function normalizeEventIndexFiles(indexData) {
  if (Array.isArray(indexData)) return indexData;

  if (Array.isArray(indexData?.events)) {
    return indexData.events.map(item => {
      if (typeof item === "string") return item;
      return item.file || item.path || item.filename || "";
    }).filter(Boolean);
  }

  if (Array.isArray(indexData?.files)) return indexData.files;

  return [];
}

function normalizePlayers(players) {
  return [...players]
    .filter(player => player && player.name)
    .map(player => ({
      ...player,
      slug: canonicalSlug(player.slug || player.name)
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function populatePlayerSelect() {
  const select = document.getElementById("fl-player-select");
  if (!select) return;

  select.innerHTML = FORM_LAB_STATE.players.map(player => `
    <option value="${escapeAttr(player.slug)}">${escapeHtml(displayName(player))}</option>
  `).join("");
}

function populateMetricSelects() {
  const xSelect = document.getElementById("fl-x-metric");
  const ySelect = document.getElementById("fl-y-metric");
  const options = Object.entries(FORM_LAB_METRICS).map(([key, meta]) => `
    <option value="${escapeAttr(key)}">${escapeHtml(meta.label)}</option>
  `).join("");

  if (xSelect) xSelect.innerHTML = options;
  if (ySelect) ySelect.innerHTML = options;
}

function wireFormLabControls() {
  const playerSelect = document.getElementById("fl-player-select");
  if (playerSelect) {
    playerSelect.addEventListener("change", () => {
      FORM_LAB_STATE.selectedPlayerSlug = playerSelect.value;
      FORM_LAB_STATE.selectedEventId = "";
      renderFormLab();
    });
  }

  document.querySelectorAll("[data-fl-preset]").forEach(button => {
    button.addEventListener("click", () => {
      applyPreset(button.dataset.flPreset || "custom");
      renderFormLab();
    });
  });

  const xSelect = document.getElementById("fl-x-metric");
  const ySelect = document.getElementById("fl-y-metric");

  if (xSelect) {
    xSelect.addEventListener("change", () => {
      FORM_LAB_STATE.xMetric = xSelect.value;
      FORM_LAB_STATE.preset = "custom";
      syncControls();
      renderFormLab();
    });
  }

  if (ySelect) {
    ySelect.addEventListener("change", () => {
      FORM_LAB_STATE.yMetric = ySelect.value;
      FORM_LAB_STATE.preset = "custom";
      syncControls();
      renderFormLab();
    });
  }

  const windowSelect = document.getElementById("fl-window");
  if (windowSelect) {
    windowSelect.addEventListener("change", () => {
      FORM_LAB_STATE.window = windowSelect.value;
      FORM_LAB_STATE.selectedEventId = "";
      renderFormLab();
    });
  }

  wireCheckbox("fl-show-labels", "showLabels");
  wireCheckbox("fl-show-trend", "showTrend");
  wireCheckbox("fl-show-average", "showAverage");
}

function wireCheckbox(id, stateKey) {
  const checkbox = document.getElementById(id);
  if (!checkbox) return;

  checkbox.addEventListener("change", () => {
    FORM_LAB_STATE[stateKey] = checkbox.checked;
    renderFormLab();
  });
}

function applyPreset(presetKey, sync = true) {
  const preset = FORM_LAB_PRESETS[presetKey] || FORM_LAB_PRESETS["form-volatility"];

  FORM_LAB_STATE.preset = presetKey;
  FORM_LAB_STATE.xMetric = preset.xMetric;
  FORM_LAB_STATE.yMetric = preset.yMetric;

  if (sync) syncControls();
}

function syncControls() {
  document.querySelectorAll("[data-fl-preset]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.flPreset === FORM_LAB_STATE.preset);
  });

  const xSelect = document.getElementById("fl-x-metric");
  const ySelect = document.getElementById("fl-y-metric");
  const windowSelect = document.getElementById("fl-window");

  if (xSelect) xSelect.value = FORM_LAB_STATE.xMetric;
  if (ySelect) ySelect.value = FORM_LAB_STATE.yMetric;
  if (windowSelect) windowSelect.value = FORM_LAB_STATE.window;

  const labels = document.getElementById("fl-show-labels");
  const trend = document.getElementById("fl-show-trend");
  const average = document.getElementById("fl-show-average");

  if (labels) labels.checked = FORM_LAB_STATE.showLabels;
  if (trend) trend.checked = FORM_LAB_STATE.showTrend;
  if (average) average.checked = FORM_LAB_STATE.showAverage;
}

function renderFormLab() {
  syncControls();

  const player = getSelectedPlayer();
  const allRows = getPlayerEventRows(player);
  const rows = applyWindow(allRows);

  renderPlayerSummary(player, allRows, rows);
  renderPresetDescription(rows);
  renderScatterChart(rows, player);
  renderSelectedEventPanel(rows, player);
  renderTimeline(rows);
}

function getSelectedPlayer() {
  return FORM_LAB_STATE.players.find(player => player.slug === FORM_LAB_STATE.selectedPlayerSlug) || FORM_LAB_STATE.players[0] || null;
}

function getPlayerEventRows(player) {
  if (!player) return [];

  const playerSlug = canonicalSlug(player.slug || player.name);
  const rows = [];

  FORM_LAB_STATE.events.forEach(event => {
    const row = buildPlayerEventRow(event, player, playerSlug);
    if (row) rows.push(row);
  });

  return rows.sort((a, b) => new Date(a.dateIso || a.dateRaw) - new Date(b.dateIso || b.dateRaw));
}

function buildPlayerEventRow(event, player, playerSlug) {
  const eventPlayers = getEventPlayers(event);
  const found = eventPlayers.find(candidate => {
    const candidateSlug = canonicalSlug(candidate.slug || candidate.playerSlug || candidate.name || candidate.player || "");
    const candidateNameSlug = canonicalSlug(candidate.name || candidate.player || "");
    return candidateSlug === playerSlug || candidateNameSlug === playerSlug;
  });

  if (!found) return null;

  const dateIso = getEventDateIso(event);
  const finishPosition = getFinishPosition(found, event);
  const fieldSize = getFieldSize(event);
  const rebuys = getNumeric(found.rebuys ?? found.rebuyCount ?? found.rebuysUsed ?? 0);
  const entriesUsed = 1 + rebuys;
  const hits = getPlayerHits(event, playerSlug, found);
  const winnings = getNumeric(found.winnings ?? found.prize ?? found.payout ?? found.totalWinnings ?? 0);
  const cost = entriesUsed * 30;
  const profit = Number.isFinite(getNumeric(found.profit)) && found.profit !== undefined
    ? getNumeric(found.profit)
    : winnings - cost;

  const paidSpots = getPaidSpots(event);
  const bubblePosition = paidSpots > 0 ? paidSpots + 1 : null;
  const cashFlag = winnings > 0 || (paidSpots > 0 && finishPosition > 0 && finishPosition <= paidSpots);
  const bubbleFlag = bubblePosition && finishPosition === bubblePosition ? 1 : 0;

  const finishDepth = calculateFinishDepth(finishPosition, fieldSize);
  const rebuyPenalty = rebuys * 7;
  const cashBonus = cashFlag ? 12 : 0;
  const bubblePenalty = bubbleFlag ? 12 : 0;
  const hitBonus = hits * 10;
  const profitComponent = clamp(profit / 3, -35, 35);
  const formScore = clamp(finishDepth + hitBonus + cashBonus + profitComponent - rebuyPenalty - bubblePenalty, -50, 175);

  const efficiencyScore = finishDepth - (rebuys * 12) + (cashFlag ? 8 : 0);
  const chaosScore = (rebuys * 16) + (hits * 10) + Math.abs(profit / 10);
  const painIndex = Math.max(0, (bubbleFlag ? 45 : 0) + (finishDepth * 0.25) - (profit > 0 ? profit / 10 : profit / 4));
  const killerValue = hits / Math.max(entriesUsed, 1);
  const survivalValue = finishDepth / Math.max(entriesUsed, 1);
  const volatility = Math.abs(profit / 10) + (rebuys * 14) + (hits * 6) + (bubbleFlag ? 16 : 0);

  const id = `${dateIso || event.id || event.date || "event"}-${playerSlug}`;

  return {
    id,
    event,
    player,
    dateIso,
    dateRaw: event.date || event.eventDate || event.id || "",
    title: event.title || event.name || event.eventName || dateIso || "Event",
    finishPosition,
    fieldSize,
    rebuys,
    entriesUsed,
    hits,
    winnings,
    cost,
    profit,
    paidSpots,
    cashFlag: cashFlag ? 1 : 0,
    bubbleFlag: bubbleFlag ? 1 : 0,
    finishDepth,
    formScore,
    efficiencyScore,
    chaosScore,
    painIndex,
    killerValue,
    survivalValue,
    volatility
  };
}

function getEventPlayers(event) {
  if (Array.isArray(event.players)) return event.players;
  if (Array.isArray(event.results)) return event.results;
  if (Array.isArray(event.standings)) return event.standings;
  if (Array.isArray(event.entries)) return event.entries;
  if (Array.isArray(event.finishers)) return event.finishers;
  return [];
}

function getFinishPosition(playerResult, event) {
  const direct = getNumeric(
    playerResult.finishPosition ??
    playerResult.finish ??
    playerResult.place ??
    playerResult.rank ??
    playerResult.position
  );

  if (direct > 0) return direct;

  const players = getEventPlayers(event);
  const index = players.findIndex(item => item === playerResult);
  return index >= 0 ? index + 1 : 0;
}

function getFieldSize(event) {
  const direct = getNumeric(event.fieldSize ?? event.entries ?? event.totalEntries ?? event.buyIns ?? event.playersCount);
  if (direct > 0) return direct;

  const players = getEventPlayers(event);
  return players.length || 1;
}

function getPaidSpots(event) {
  return getNumeric(event.paidSpots ?? event.payouts?.paidSpots ?? event.summary?.paidSpots ?? 0);
}

function getPlayerHits(event, playerSlug, found) {
  const direct = getNumeric(found.hits ?? found.knockouts ?? found.kos);
  if (direct > 0) return direct;

  const eliminations = event.eliminations || event.knockouts || event.hits || [];
  if (!Array.isArray(eliminations)) return 0;

  return eliminations.filter(item => {
    const hitter = canonicalSlug(item.hitman || item.killer || item.eliminator || item.by || item.player || "");
    return hitter === playerSlug;
  }).length;
}

function getEventDateIso(event) {
  const raw = event.dateIso || event.dateISO || event.eventDateIso || event.eventDate || event.date || event.id || "";
  const text = String(raw || "").trim();

  const isoMatch = text.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return text;
}

function applyWindow(rows) {
  const sorted = [...rows].sort((a, b) => new Date(a.dateIso || a.dateRaw) - new Date(b.dateIso || b.dateRaw));

  if (FORM_LAB_STATE.window === "all") return sorted;

  const count = Number(FORM_LAB_STATE.window || 6);
  return sorted.slice(Math.max(0, sorted.length - count));
}

function renderPlayerSummary(player, allRows, rows) {
  const el = document.getElementById("fl-player-summary");
  if (!el) return;

  if (!player) {
    el.innerHTML = `<p class="fl-muted">No player selected.</p>`;
    return;
  }

  const avgFinishDepth = average(rows.map(row => row.finishDepth));
  const totalProfit = rows.reduce((sum, row) => sum + row.profit, 0);
  const totalHits = rows.reduce((sum, row) => sum + row.hits, 0);
  const totalRebuys = rows.reduce((sum, row) => sum + row.rebuys, 0);

  el.innerHTML = `
    <div class="fl-player-summary-card">
      <div class="fl-player-summary-main">
        ${playerImageMarkup(player)}
        <div>
          <div class="fl-kicker">Selected Player</div>
          <h2>${escapeHtml(displayName(player))}</h2>
          <p>${rows.length} shown event${rows.length === 1 ? "" : "s"} / ${allRows.length} total event${allRows.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div class="fl-summary-stat">
        <span>Avg Depth</span>
        <strong>${numberFmt(avgFinishDepth, 0)}%</strong>
      </div>
      <div class="fl-summary-stat">
        <span>Profit</span>
        <strong class="${totalProfit >= 0 ? "positive" : "negative"}">${moneyFmt(totalProfit)}</strong>
      </div>
      <div class="fl-summary-stat">
        <span>Hits</span>
        <strong>${totalHits}</strong>
      </div>
      <div class="fl-summary-stat">
        <span>Rebuys</span>
        <strong>${totalRebuys}</strong>
      </div>
    </div>
  `;
}

function renderPresetDescription(rows) {
  const el = document.getElementById("fl-chart-readout");
  if (!el) return;

  const preset = FORM_LAB_PRESETS[FORM_LAB_STATE.preset] || FORM_LAB_PRESETS.custom;
  const xMeta = FORM_LAB_METRICS[FORM_LAB_STATE.xMetric];
  const yMeta = FORM_LAB_METRICS[FORM_LAB_STATE.yMetric];

  const best = rows.length
    ? [...rows].sort((a, b) => Number(b[FORM_LAB_STATE.yMetric] ?? 0) - Number(a[FORM_LAB_STATE.yMetric] ?? 0))[0]
    : null;

  el.innerHTML = `
    <div class="fl-readout-title">${escapeHtml(preset.label)}</div>
    <div class="fl-readout-body">
      ${escapeHtml(preset.description)}
      <br>
      <strong>X:</strong> ${escapeHtml(xMeta?.label || FORM_LAB_STATE.xMetric)}
      &nbsp;•&nbsp;
      <strong>Y:</strong> ${escapeHtml(yMeta?.label || FORM_LAB_STATE.yMetric)}
      ${best ? `<br><strong>Top plotted Y event:</strong> ${escapeHtml(formatDate(best.dateIso || best.dateRaw))} — ${escapeHtml(yMeta.format(best[FORM_LAB_STATE.yMetric]))}` : ""}
    </div>
  `;
}

function renderScatterChart(rows, player) {
  const mount = document.getElementById("fl-scatter-chart");
  if (!mount) return;

  if (!rows.length) {
    mount.innerHTML = `
      <div class="fl-empty-chart">
        No event data found for this player.
      </div>
    `;
    return;
  }

  const xKey = FORM_LAB_STATE.xMetric;
  const yKey = FORM_LAB_STATE.yMetric;
  const xMeta = FORM_LAB_METRICS[xKey];
  const yMeta = FORM_LAB_METRICS[yKey];

  const width = 960;
  const height = 560;
  const margin = { top: 44, right: 42, bottom: 76, left: 82 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xValues = rows.map(row => Number(row[xKey] ?? 0)).filter(Number.isFinite);
  const yValues = rows.map(row => Number(row[yKey] ?? 0)).filter(Number.isFinite);

  const xDomain = paddedDomain(xValues);
  const yDomain = paddedDomain(yValues);

  const xScale = value => {
    const pct = (Number(value) - xDomain[0]) / Math.max(xDomain[1] - xDomain[0], 1);
    return margin.left + clamp(pct, 0, 1) * innerW;
  };

  const yScale = value => {
    const pct = (Number(value) - yDomain[0]) / Math.max(yDomain[1] - yDomain[0], 1);
    const adjusted = yMeta?.invertAxis ? pct : 1 - pct;
    return margin.top + clamp(adjusted, 0, 1) * innerH;
  };

  const xTicks = makeTicks(xDomain[0], xDomain[1], 5);
  const yTicks = makeTicks(yDomain[0], yDomain[1], 5);

  const avgX = average(rows.map(row => row[xKey]));
  const avgY = average(rows.map(row => row[yKey]));
  const trend = linearRegression(rows.map(row => ({
    x: Number(row[xKey] ?? 0),
    y: Number(row[yKey] ?? 0)
  })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)));

  const trendLine = trend
    ? {
        x1: xDomain[0],
        y1: trend.slope * xDomain[0] + trend.intercept,
        x2: xDomain[1],
        y2: trend.slope * xDomain[1] + trend.intercept
      }
    : null;

  const selectedId = FORM_LAB_STATE.selectedEventId || rows[rows.length - 1]?.id;
  FORM_LAB_STATE.selectedEventId = selectedId;

  mount.innerHTML = `
    <svg class="fl-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Form Lab scatter chart">
      <defs>
        <filter id="fl-dot-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"></feGaussianBlur>
          <feMerge>
            <feMergeNode in="coloredBlur"></feMergeNode>
            <feMergeNode in="SourceGraphic"></feMergeNode>
          </feMerge>
        </filter>
      </defs>

      <rect class="fl-chart-bg" x="0" y="0" width="${width}" height="${height}" rx="18"></rect>

      ${xTicks.map(tick => `
        <line class="fl-grid-line" x1="${xScale(tick)}" y1="${margin.top}" x2="${xScale(tick)}" y2="${height - margin.bottom}"></line>
        <text class="fl-axis-tick" x="${xScale(tick)}" y="${height - margin.bottom + 26}" text-anchor="middle">${escapeHtml(xMeta.format(tick))}</text>
      `).join("")}

      ${yTicks.map(tick => `
        <line class="fl-grid-line" x1="${margin.left}" y1="${yScale(tick)}" x2="${width - margin.right}" y2="${yScale(tick)}"></line>
        <text class="fl-axis-tick" x="${margin.left - 14}" y="${yScale(tick) + 4}" text-anchor="end">${escapeHtml(yMeta.format(tick))}</text>
      `).join("")}

      <line class="fl-axis-line" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
      <line class="fl-axis-line" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>

      ${FORM_LAB_STATE.showAverage ? `
        <line class="fl-average-line" x1="${xScale(avgX)}" y1="${margin.top}" x2="${xScale(avgX)}" y2="${height - margin.bottom}"></line>
        <line class="fl-average-line" x1="${margin.left}" y1="${yScale(avgY)}" x2="${width - margin.right}" y2="${yScale(avgY)}"></line>
      ` : ""}

      ${FORM_LAB_STATE.showTrend && trendLine ? `
        <line class="fl-trend-line" x1="${xScale(trendLine.x1)}" y1="${yScale(trendLine.y1)}" x2="${xScale(trendLine.x2)}" y2="${yScale(trendLine.y2)}"></line>
      ` : ""}

      <text class="fl-axis-label" x="${margin.left + innerW / 2}" y="${height - 24}" text-anchor="middle">${escapeHtml(xMeta.label)}</text>
      <text class="fl-axis-label fl-axis-label-y" x="24" y="${margin.top + innerH / 2}" text-anchor="middle" transform="rotate(-90 24 ${margin.top + innerH / 2})">${escapeHtml(yMeta.label)}</text>

      ${rows.map((row, index) => {
        const cx = xScale(row[xKey]);
        const cy = yScale(row[yKey]);
        const selected = row.id === selectedId;
        const tone = row.profit >= 0 ? "positive" : row.bubbleFlag ? "bubble" : "negative";

        return `
          <g class="fl-point-group${selected ? " is-selected" : ""}" data-event-id="${escapeAttr(row.id)}" tabindex="0">
            <circle class="fl-point fl-point-${tone}" cx="${cx}" cy="${cy}" r="${selected ? 9 : 7}" filter="url(#fl-dot-glow)"></circle>
            ${FORM_LAB_STATE.showLabels ? `
              <text class="fl-point-label" x="${cx + 11}" y="${cy - 10}">${escapeHtml(shortDate(row.dateIso || row.dateRaw))}</text>
            ` : ""}
            <title>${escapeHtml(formatTooltip(row, xMeta, yMeta, xKey, yKey))}</title>
          </g>
        `;
      }).join("")}
    </svg>
  `;

  mount.querySelectorAll(".fl-point-group").forEach(group => {
    group.addEventListener("click", () => {
      FORM_LAB_STATE.selectedEventId = group.dataset.eventId || "";
      renderSelectedEventPanel(rows, player);
      renderTimeline(rows);
      renderScatterChart(rows, player);
    });

    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        FORM_LAB_STATE.selectedEventId = group.dataset.eventId || "";
        renderSelectedEventPanel(rows, player);
        renderTimeline(rows);
        renderScatterChart(rows, player);
      }
    });
  });
}

function renderSelectedEventPanel(rows, player) {
  const el = document.getElementById("fl-event-detail");
  if (!el) return;

  const selected = rows.find(row => row.id === FORM_LAB_STATE.selectedEventId) || rows[rows.length - 1];

  if (!selected) {
    el.innerHTML = `<p class="fl-muted">Select an event dot to inspect it.</p>`;
    return;
  }

  const finishLabel = selected.finishPosition
    ? `${ordinal(selected.finishPosition)} of ${selected.fieldSize}`
    : "-";

  el.innerHTML = `
    <div class="fl-event-detail-head">
      <div>
        <div class="fl-kicker">Selected Event</div>
        <h3>${escapeHtml(formatDate(selected.dateIso || selected.dateRaw))}</h3>
        <p>${escapeHtml(selected.title || "")}</p>
      </div>
      <div class="fl-event-result-pill ${selected.profit >= 0 ? "positive" : "negative"}">${moneyFmt(selected.profit)}</div>
    </div>

    <div class="fl-event-stat-grid">
      ${detailStat("Finish", finishLabel)}
      ${detailStat("Depth", `${numberFmt(selected.finishDepth, 0)}%`)}
      ${detailStat("Rebuys", selected.rebuys)}
      ${detailStat("Hits", selected.hits)}
      ${detailStat("Cost", moneyFmt(selected.cost))}
      ${detailStat("Winnings", moneyFmt(selected.winnings))}
      ${detailStat("Form", numberFmt(selected.formScore, 1))}
      ${detailStat("Pain", numberFmt(selected.painIndex, 1))}
    </div>
  `;
}

function detailStat(label, value) {
  return `
    <div class="fl-event-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function renderTimeline(rows) {
  const el = document.getElementById("fl-event-timeline");
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = rows.map(row => `
    <button
      class="fl-timeline-card${row.id === FORM_LAB_STATE.selectedEventId ? " is-selected" : ""}"
      type="button"
      data-event-id="${escapeAttr(row.id)}"
    >
      <span class="fl-timeline-date">${escapeHtml(shortDate(row.dateIso || row.dateRaw))}</span>
      <strong>${row.finishPosition ? ordinal(row.finishPosition) : "-"}</strong>
      <span class="${row.profit >= 0 ? "positive" : "negative"}">${moneyFmt(row.profit)}</span>
    </button>
  `).join("");

  el.querySelectorAll("[data-event-id]").forEach(button => {
    button.addEventListener("click", () => {
      FORM_LAB_STATE.selectedEventId = button.dataset.eventId || "";
      renderFormLab();
    });
  });
}

function formatTooltip(row, xMeta, yMeta, xKey, yKey) {
  return [
    formatDate(row.dateIso || row.dateRaw),
    `${xMeta.label}: ${xMeta.format(row[xKey])}`,
    `${yMeta.label}: ${yMeta.format(row[yKey])}`,
    `Finish: ${row.finishPosition ? `${row.finishPosition}/${row.fieldSize}` : "-"}`,
    `Profit: ${moneyFmt(row.profit)}`,
    `Hits: ${row.hits}`,
    `Rebuys: ${row.rebuys}`
  ].join("\n");
}

function paddedDomain(values) {
  const clean = values.filter(value => Number.isFinite(Number(value))).map(Number);

  if (!clean.length) return [0, 1];

  let min = Math.min(...clean);
  let max = Math.max(...clean);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

function makeTicks(min, max, count = 5) {
  const ticks = [];
  const step = (max - min) / Math.max(count - 1, 1);

  for (let i = 0; i < count; i += 1) {
    ticks.push(min + step * i);
  }

  return ticks;
}

function linearRegression(points) {
  if (!points.length || points.length < 2) return null;

  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function playerImageMarkup(player) {
  const image = player?.image || "";
  const name = displayName(player);

  if (image) {
    return `
      <span class="fl-player-avatar-wrap">
        <img
          class="fl-player-avatar"
          src="${escapeAttr(image)}"
          alt="${escapeAttr(name)}"
          loading="lazy"
          decoding="async"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <span class="fl-player-avatar-fallback" style="display:none;">${escapeHtml(initialsFromName(name))}</span>
      </span>
    `;
  }

  return `
    <span class="fl-player-avatar-wrap">
      <span class="fl-player-avatar-fallback">${escapeHtml(initialsFromName(name))}</span>
    </span>
  `;
}

function displayName(player) {
  if (!player) return "";
  const name = player.name || "";
  const fixes = {
    "Nasa Al": "NASA Al",
    "Providencemike": "ProvidenceMike",
    "Bostnmike": "BostnMike",
    "Ai-Dave": "A.I. Dave",
    "A.I. Dave": "A.I. Dave",
    "ai-dave": "A.I. Dave",
    "Phattedcalf": "PhattedCalf",
    "Pittdburghbill": "PittsburghBill"
  };

  return fixes[name] || name;
}

function initialsFromName(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function canonicalSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getNumeric(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function calculateFinishDepth(finishPosition, fieldSize) {
  const finish = Number(finishPosition || 0);
  const field = Math.max(Number(fieldSize || 1), 1);

  if (!finish || finish < 1) return 0;
  if (field <= 1) return 100;

  return clamp(((field - finish) / (field - 1)) * 100, 0, 100);
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function numberFmt(value, digits = 1) {
  const num = Number(value || 0);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function moneyFmt(value) {
  const num = Number(value || 0);
  const sign = num < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(num)).toLocaleString("en-US")}`;
}

function ordinal(value) {
  const num = Number(value || 0);
  if (!num) return "-";

  const suffixes = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return `${num}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

function formatDate(value) {
  const raw = String(value || "");
  const parsed = new Date(raw + (raw.length === 10 ? "T00:00:00" : ""));

  if (Number.isNaN(parsed.getTime())) return raw || "Unknown date";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function shortDate(value) {
  const raw = String(value || "");
  const parsed = new Date(raw + (raw.length === 10 ? "T00:00:00" : ""));

  if (Number.isNaN(parsed.getTime())) return raw || "-";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
