/* form-lab.js
   The Form Lab — interactive one-player scatter dashboard
*/

const FL_STATE = {
  data: null,
  players: [],
  events: [],
  selectedPlayerSlug: "",
  preset: "form-volatility",
  xMetric: "volatility",
  yMetric: "formScore",
  windowSize: "6",
  showLabels: true,
  showTrend: true,
  showAverage: true,
  selectedEventId: ""
};

const FL_MIN_EVENTS_PLAYED = 4;

const FL_PRESETS = {
  "form-volatility": {
    label: "Form vs. Volatility",
    xMetric: "volatility",
    yMetric: "formScore",
    subtitle: "Recent form against event chaos. The upper-left is where the adults allegedly live."
  },
  "finish-rebuys": {
    label: "Finish Depth vs. Rebuy Load",
    xMetric: "rebuys",
    yMetric: "finishDepth",
    subtitle: "Deep runs are nice. Deep runs without lighting extra bullets on fire are nicer."
  },
  "profit-finish": {
    label: "Profit vs. Finish Depth",
    xMetric: "finishDepth",
    yMetric: "profit",
    subtitle: "Did the deep run actually pay, or did it just feel important at the time?"
  },
  "hits-finish": {
    label: "Hits vs. Finish Depth",
    xMetric: "hits",
    yMetric: "finishDepth",
    subtitle: "A look at whether the violence translated into survival."
  },
  "profit-rebuys": {
    label: "Profit vs. Rebuys",
    xMetric: "rebuys",
    yMetric: "profit",
    subtitle: "The eternal question: investment strategy or denial?"
  },
  "bubble-pain": {
    label: "Bubble Pain Map",
    xMetric: "finishDepth",
    yMetric: "painIndex",
    subtitle: "For nights that were statistically close and spiritually illegal."
  },
  "custom": {
    label: "Custom",
    xMetric: "rebuys",
    yMetric: "finishDepth",
    subtitle: "Choose your own axes and build your own deeply unnecessary evidence."
  }
};

const FL_METRICS = {
  formScore: {
    label: "Form Score",
    short: "Form",
    format: value => numberFmt(value, 1),
    description: "Weighted event score using finish depth, profit, hits, rebuys, cashing, and bubble pain."
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
    description: "Actual finishing position. Lower is better."
  },
  fieldSize: {
    label: "Field Size",
    short: "Field",
    format: value => numberFmt(value, 0),
    description: "Effective field size for the event."
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
    description: "Buy-in plus rebuys."
  },
  hits: {
    label: "Hits",
    short: "Hits",
    format: value => numberFmt(value, 0),
    description: "Knockouts credited to the player."
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
    description: "Event payout."
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
    description: "Rebuys, hits, and swingy outcomes rolled together."
  },
  painIndex: {
    label: "Pain Index",
    short: "Pain",
    format: value => numberFmt(value, 1),
    description: "Bubble pain, deep-run disappointment, and negative profit."
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
    description: "Finish depth relative to entries used."
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
    setLoadingState("Loading data…");

    const data = await loadFormLabData();

    FL_STATE.data = data;
    FL_STATE.events = data.events || [];

    const allPlayers = normalizePlayers(data.players || []);
    FL_STATE.players = allPlayers.filter(player => {
      return getPlayerEventRowsForPlayer(player).length >= FL_MIN_EVENTS_PLAYED;
    });

    populatePlayerSelect();
    populatePresetSelect();
    populateMetricSelects();
    wireControls();

    const defaultPlayer =
      FL_STATE.players.find(player => player.slug === "bostnmike") ||
      FL_STATE.players[0];

    FL_STATE.selectedPlayerSlug = defaultPlayer ? defaultPlayer.slug : "";

    const playerSelect = document.getElementById("fl-player-select");
    if (playerSelect) playerSelect.value = FL_STATE.selectedPlayerSlug;

    applyPreset("form-volatility", false);
    syncControls();
    renderFormLab();
  } catch (error) {
    console.error("Form Lab failed:", error);
    renderFatalError(error);
  }
}

/* =========================================
   DATA LOADING
========================================= */

async function loadFormLabData() {
  const siteRes = await fetch("data/generated/site-data.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!siteRes.ok) {
    throw new Error(`Could not load data/generated/site-data.json (${siteRes.status})`);
  }

  const siteData = await siteRes.json();

  const indexRes = await fetch("data/parsed/events/index.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!indexRes.ok) {
    throw new Error(`Could not load data/parsed/events/index.json (${indexRes.status})`);
  }

  const indexData = await indexRes.json();
  const files = normalizeEventIndexFiles(indexData);

  const eventFiles = await Promise.all(
    files.map(async file => {
      const clean = String(file || "").replace(/^\/+/, "");
      const url = clean.includes("/")
        ? clean
        : `data/parsed/events/${clean}`;

      try {
        const res = await fetch(`${url}?v=${Date.now()}`, {
          cache: "no-store"
        });

        if (!res.ok) {
          console.warn(`Skipping event file ${url}: ${res.status}`);
          return null;
        }

        return await res.json();
      } catch (error) {
        console.warn(`Skipping event file ${url}:`, error);
        return null;
      }
    })
  );

  return {
    ...siteData,
    events: eventFiles.filter(Boolean)
  };
}

function normalizeEventIndexFiles(indexData) {
  if (Array.isArray(indexData)) return indexData;

  if (Array.isArray(indexData && indexData.events)) {
    return indexData.events
      .map(item => {
        if (typeof item === "string") return item;
        return item.file || item.path || item.filename || "";
      })
      .filter(Boolean);
  }

  if (Array.isArray(indexData && indexData.files)) return indexData.files;

  return [];
}

/* =========================================
   SETUP
========================================= */

function normalizePlayers(players) {
  return players
    .filter(player => player && player.name)
    .map(player => ({
      ...player,
      slug: canonicalSlug(player.slug || player.name)
    }))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));
}

function populatePlayerSelect() {
  const select = document.getElementById("fl-player-select");
  if (!select) return;

  select.innerHTML = FL_STATE.players.map(player => `
    <option value="${escapeAttr(player.slug)}">${escapeHtml(displayName(player))}</option>
  `).join("");
}

function populatePresetSelect() {
  const select = document.getElementById("fl-preset-select");
  if (!select) return;

  select.innerHTML = Object.entries(FL_PRESETS).map(([key, preset]) => `
    <option value="${escapeAttr(key)}">${escapeHtml(preset.label)}</option>
  `).join("");
}

function populateMetricSelects() {
  const xSelect = document.getElementById("fl-x-select");
  const ySelect = document.getElementById("fl-y-select");

  const options = Object.entries(FL_METRICS).map(([key, metric]) => `
    <option value="${escapeAttr(key)}">${escapeHtml(metric.label)}</option>
  `).join("");

  if (xSelect) xSelect.innerHTML = options;
  if (ySelect) ySelect.innerHTML = options;
}

function wireControls() {
  const playerSelect = document.getElementById("fl-player-select");
  const presetSelect = document.getElementById("fl-preset-select");
  const xSelect = document.getElementById("fl-x-select");
  const ySelect = document.getElementById("fl-y-select");
  const windowSelect = document.getElementById("fl-window-select");

  if (playerSelect) {
    playerSelect.addEventListener("change", () => {
      FL_STATE.selectedPlayerSlug = playerSelect.value;
      FL_STATE.selectedEventId = "";
      renderFormLab();
    });
  }

  if (presetSelect) {
    presetSelect.addEventListener("change", () => {
      applyPreset(presetSelect.value, true);
      FL_STATE.selectedEventId = "";
      renderFormLab();
    });
  }

  if (xSelect) {
    xSelect.addEventListener("change", () => {
      FL_STATE.xMetric = xSelect.value;
      FL_STATE.preset = "custom";
      FL_STATE.selectedEventId = "";
      syncControls();
      renderFormLab();
    });
  }

  if (ySelect) {
    ySelect.addEventListener("change", () => {
      FL_STATE.yMetric = ySelect.value;
      FL_STATE.preset = "custom";
      FL_STATE.selectedEventId = "";
      syncControls();
      renderFormLab();
    });
  }

  if (windowSelect) {
    windowSelect.addEventListener("change", () => {
      FL_STATE.windowSize = windowSelect.value;
      FL_STATE.selectedEventId = "";
      renderFormLab();
    });
  }

  wireCheckbox("fl-show-labels", "showLabels");
  wireCheckbox("fl-show-trend", "showTrend");
  wireCheckbox("fl-show-average", "showAverage");
}

function wireCheckbox(id, stateKey) {
  const input = document.getElementById(id);
  if (!input) return;

  input.addEventListener("change", () => {
    FL_STATE[stateKey] = input.checked;
    renderFormLab();
  });
}

function applyPreset(presetKey, updateControls) {
  const preset = FL_PRESETS[presetKey] || FL_PRESETS["form-volatility"];

  FL_STATE.preset = presetKey;
  FL_STATE.xMetric = preset.xMetric;
  FL_STATE.yMetric = preset.yMetric;

  if (updateControls) syncControls();
}

function syncControls() {
  const presetSelect = document.getElementById("fl-preset-select");
  const xSelect = document.getElementById("fl-x-select");
  const ySelect = document.getElementById("fl-y-select");
  const windowSelect = document.getElementById("fl-window-select");

  if (presetSelect) presetSelect.value = FL_STATE.preset;
  if (xSelect) xSelect.value = FL_STATE.xMetric;
  if (ySelect) ySelect.value = FL_STATE.yMetric;
  if (windowSelect) windowSelect.value = FL_STATE.windowSize;

  syncCheckbox("fl-show-labels", FL_STATE.showLabels);
  syncCheckbox("fl-show-trend", FL_STATE.showTrend);
  syncCheckbox("fl-show-average", FL_STATE.showAverage);
}

function syncCheckbox(id, value) {
  const input = document.getElementById(id);
  if (input) input.checked = Boolean(value);
}

/* =========================================
   RENDER
========================================= */

function renderFormLab() {
  syncControls();

  const player = getSelectedPlayer();
  const allRows = getPlayerEventRows(player);
  const rows = applyWindow(allRows);

  if (!player) {
    renderFatalError(new Error("No players found in site-data.json."));
    return;
  }

  if (!rows.length) {
    renderNoRows(player, allRows);
    return;
  }

  if (!FL_STATE.selectedEventId || !rows.some(row => row.id === FL_STATE.selectedEventId)) {
    FL_STATE.selectedEventId = rows[rows.length - 1].id;
  }

  renderChartHeader(rows);
  renderPlayerCard(player, allRows, rows);
  renderScatter(rows);
  renderQuadrants();
  renderEventDetail(rows);
  renderReadout(rows);
  renderEventList(rows);
}

function setLoadingState(message) {
  const title = document.getElementById("fl-chart-title");
  const subtitle = document.getElementById("fl-chart-subtitle");

  if (title) title.textContent = message || "Loading chart…";
  if (subtitle) subtitle.textContent = "The lab is pulling parsed event data.";
}

function renderFatalError(error) {
  const title = document.getElementById("fl-chart-title");
  const subtitle = document.getElementById("fl-chart-subtitle");
  const chart = document.getElementById("fl-chart");
  const detail = document.getElementById("fl-event-detail");
  const readout = document.getElementById("fl-chart-readout");
  const list = document.getElementById("fl-event-list");

  if (title) title.textContent = "Form Lab could not load.";
  if (subtitle) subtitle.textContent = error && error.message ? error.message : "Check the console for details.";
  if (chart) chart.innerHTML = "";
  if (detail) detail.innerHTML = `<p class="fl-empty-state">No event selected.</p>`;
  if (readout) readout.innerHTML = `<p class="fl-empty-state">The chart did not initialize.</p>`;
  if (list) list.innerHTML = "";
}

function renderNoRows(player, allRows) {
  const title = document.getElementById("fl-chart-title");
  const subtitle = document.getElementById("fl-chart-subtitle");
  const chart = document.getElementById("fl-chart");
  const playerCard = document.getElementById("fl-player-card");
  const detail = document.getElementById("fl-event-detail");
  const readout = document.getElementById("fl-chart-readout");
  const list = document.getElementById("fl-event-list");

  if (title) title.textContent = "No event dots found.";
  if (subtitle) subtitle.textContent = `${displayName(player)} was found, but no parsed event rows matched this player.`;
  if (chart) chart.innerHTML = "";
  if (playerCard) {
    playerCard.innerHTML = `
      <div class="fl-player-card-row">
        ${playerAvatarMarkup(player)}
        <div>
          <div class="fl-kicker">Selected Player</div>
          <h3>${escapeHtml(displayName(player))}</h3>
          <p>Matched events: ${allRows.length}</p>
        </div>
      </div>
    `;
  }
  if (detail) detail.innerHTML = `<p class="fl-empty-state">No event selected.</p>`;
  if (readout) readout.innerHTML = `<p class="fl-empty-state">Try another player or check parsed event player slugs.</p>`;
  if (list) list.innerHTML = "";
}

function renderChartHeader(rows) {
  const preset = FL_PRESETS[FL_STATE.preset] || FL_PRESETS.custom;
  const xMetric = FL_METRICS[FL_STATE.xMetric];
  const yMetric = FL_METRICS[FL_STATE.yMetric];

  const title = document.getElementById("fl-chart-title");
  const subtitle = document.getElementById("fl-chart-subtitle");

  if (title) title.textContent = preset.label;
  if (subtitle) {
    subtitle.textContent = `${preset.subtitle} X: ${xMetric.label}. Y: ${yMetric.label}. Showing ${rows.length} event${rows.length === 1 ? "" : "s"}.`;
  }
}

function renderPlayerCard(player, allRows, rows) {
  const el = document.getElementById("fl-player-card");
  if (!el) return;

  const totalProfit = rows.reduce((sum, row) => sum + row.profit, 0);
  const totalHits = rows.reduce((sum, row) => sum + row.hits, 0);
  const totalRebuys = rows.reduce((sum, row) => sum + row.rebuys, 0);
  const avgDepth = average(rows.map(row => row.finishDepth));

  el.innerHTML = `
    <div>
      <h3>${escapeHtml(formatDate(row.dateIso || row.dateRaw))}</h3>
      <p>${escapeHtml(row.title || "")}</p>
    </div>

    <div class="fl-event-detail-grid">

    <div class="fl-detail-grid">
      <div class="fl-detail-stat">
        <span>Avg Depth</span>
        <strong>${numberFmt(avgDepth, 0)}%</strong>
      </div>
      <div class="fl-detail-stat">
        <span>Profit</span>
        <strong class="${totalProfit >= 0 ? "positive" : "negative"}">${moneyFmt(totalProfit)}</strong>
      </div>
      <div class="fl-detail-stat">
        <span>Hits</span>
        <strong>${totalHits}</strong>
      </div>
      <div class="fl-detail-stat">
        <span>Rebuys</span>
        <strong>${totalRebuys}</strong>
      </div>
    </div>
  `;
}

function renderScatter(rows) {
  const svg = document.getElementById("fl-chart");
  const tooltip = document.getElementById("fl-tooltip");
  if (!svg) return;

  const xKey = FL_STATE.xMetric;
  const yKey = FL_STATE.yMetric;
  const xMeta = FL_METRICS[xKey];
  const yMeta = FL_METRICS[yKey];

  const width = 960;
  const height = 560;
  const margin = { top: 42, right: 38, bottom: 78, left: 84 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const xValues = rows.map(row => Number(row[xKey])).filter(Number.isFinite);
  const yValues = rows.map(row => Number(row[yKey])).filter(Number.isFinite);

  const xDomain = paddedDomain(xValues);
  const yDomain = paddedDomain(yValues);

  const xScale = value => {
    const pct = (Number(value) - xDomain[0]) / Math.max(xDomain[1] - xDomain[0], 1);
    return margin.left + clamp(pct, 0, 1) * innerW;
  };

  const yScale = value => {
    const pct = (Number(value) - yDomain[0]) / Math.max(yDomain[1] - yDomain[0], 1);
    const adjusted = yMeta.invertAxis ? pct : 1 - pct;
    return margin.top + clamp(adjusted, 0, 1) * innerH;
  };

  const xTicks = makeTicks(xDomain[0], xDomain[1], 5);
  const yTicks = makeTicks(yDomain[0], yDomain[1], 5);

  const avgX = average(rows.map(row => row[xKey]));
  const avgY = average(rows.map(row => row[yKey]));

  const regression = linearRegression(rows.map(row => ({
    x: Number(row[xKey]),
    y: Number(row[yKey])
  })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)));

  const trendLine = regression
    ? {
        x1: xDomain[0],
        y1: regression.slope * xDomain[0] + regression.intercept,
        x2: xDomain[1],
        y2: regression.slope * xDomain[1] + regression.intercept
      }
    : null;

  svg.innerHTML = `
    <rect class="fl-chart-bg" x="0" y="0" width="${width}" height="${height}" rx="18"></rect>

    ${xTicks.map(tick => `
      <line class="fl-grid-line" x1="${xScale(tick)}" y1="${margin.top}" x2="${xScale(tick)}" y2="${height - margin.bottom}"></line>
      <text class="fl-tick-label" x="${xScale(tick)}" y="${height - margin.bottom + 26}" text-anchor="middle">${escapeHtml(xMeta.format(tick))}</text>
    `).join("")}

    ${yTicks.map(tick => `
      <line class="fl-grid-line" x1="${margin.left}" y1="${yScale(tick)}" x2="${width - margin.right}" y2="${yScale(tick)}"></line>
      <text class="fl-tick-label" x="${margin.left - 14}" y="${yScale(tick) + 4}" text-anchor="end">${escapeHtml(yMeta.format(tick))}</text>
    `).join("")}

    <line class="fl-axis-line" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
    <line class="fl-axis-line" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>

    ${FL_STATE.showAverage ? `
      <line class="fl-average-line" x1="${xScale(avgX)}" y1="${margin.top}" x2="${xScale(avgX)}" y2="${height - margin.bottom}"></line>
      <line class="fl-average-line" x1="${margin.left}" y1="${yScale(avgY)}" x2="${width - margin.right}" y2="${yScale(avgY)}"></line>
      <text class="fl-average-label" x="${xScale(avgX) + 8}" y="${margin.top + 18}">avg ${xMeta.short}</text>
      <text class="fl-average-label" x="${margin.left + 8}" y="${yScale(avgY) - 8}">avg ${yMeta.short}</text>
    ` : ""}

    ${FL_STATE.showTrend && trendLine ? `
      <line class="fl-trend-line" x1="${xScale(trendLine.x1)}" y1="${yScale(trendLine.y1)}" x2="${xScale(trendLine.x2)}" y2="${yScale(trendLine.y2)}"></line>
    ` : ""}

    <text class="fl-axis-label" x="${margin.left + innerW / 2}" y="${height - 26}" text-anchor="middle">${escapeHtml(xMeta.label)}</text>
    <text class="fl-axis-label" x="26" y="${margin.top + innerH / 2}" text-anchor="middle" transform="rotate(-90 26 ${margin.top + innerH / 2})">${escapeHtml(yMeta.label)}</text>

    ${rows.map(row => {
      const cx = xScale(row[xKey]);
      const cy = yScale(row[yKey]);
      const selected = row.id === FL_STATE.selectedEventId;
      const tone = row.profit >= 0 ? "positive" : row.bubbleFlag ? "bubble" : "negative";

      return `
        <g class="fl-point" data-event-id="${escapeAttr(row.id)}" tabindex="0">
          <circle class="fl-point-dot fl-point-${tone}${selected ? " is-selected" : ""}" cx="${cx}" cy="${cy}" r="${selected ? 9 : 7}"></circle>
          ${FL_STATE.showLabels ? `<text class="fl-point-label" x="${cx + 11}" y="${cy - 10}">${escapeHtml(shortDate(row.dateIso || row.dateRaw))}</text>` : ""}
        </g>
      `;
    }).join("")}
  `;

  svg.querySelectorAll(".fl-point").forEach(point => {
    const eventId = point.getAttribute("data-event-id");
    const row = rows.find(item => item.id === eventId);

    point.addEventListener("click", () => {
      FL_STATE.selectedEventId = eventId;
      renderFormLab();
    });

    point.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        FL_STATE.selectedEventId = eventId;
        renderFormLab();
      }
    });

    point.addEventListener("mousemove", event => {
      if (!tooltip || !row) return;

      tooltip.hidden = false;
      tooltip.innerHTML = `
        <strong>${escapeHtml(formatDate(row.dateIso || row.dateRaw))}</strong>
        <span>${escapeHtml(xMeta.label)}: ${escapeHtml(xMeta.format(row[xKey]))}</span>
        <span>${escapeHtml(yMeta.label)}: ${escapeHtml(yMeta.format(row[yKey]))}</span>
        <span>Finish: ${row.finishPosition ? `${ordinal(row.finishPosition)} / ${row.fieldSize}` : "-"}</span>
        <span>Profit: ${moneyFmt(row.profit)}</span>
      `;

      tooltip.style.left = `${event.clientX + 14}px`;
      tooltip.style.top = `${event.clientY + 14}px`;
    });

    point.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.hidden = true;
    });
  });
}

function renderQuadrants() {
  const el = document.getElementById("fl-quadrant-legend");
  if (!el) return;

  const preset = FL_PRESETS[FL_STATE.preset] || FL_PRESETS.custom;

  const labels = {
    "form-volatility": [
      ["Steady Heater", "High form, lower chaos."],
      ["Dangerous Chaos", "High form, high volatility."],
      ["Cold but Stable", "Low form, low chaos."],
      ["Swingy Trouble", "Low form, high volatility."]
    ],
    "finish-rebuys": [
      ["Clean Deep Run", "Deep finish with fewer rebuys."],
      ["Rebuy Survivor", "Deep finish after extra bullets."],
      ["Short Night", "Early exit without much damage."],
      ["Bullet Fire", "Rebuys without much survival."]
    ],
    "bubble-pain": [
      ["Maximum Agony", "Deep enough to hurt."],
      ["Clean Escape", "Low pain, better night."],
      ["Quiet Exit", "Not close enough to haunt anyone."],
      ["Why Are We Like This?", "The spreadsheet has concerns."]
    ]
  };

  const items = labels[FL_STATE.preset] || [
    ["Upper Left", "Usually good, depending on the axes."],
    ["Upper Right", "Strong but expensive or chaotic."],
    ["Lower Left", "Quiet night."],
    ["Lower Right", "The danger zone."]
  ];

  el.innerHTML = items.map(item => `
    <div class="fl-quadrant-card">
      <strong>${escapeHtml(item[0])}</strong>
      <span>${escapeHtml(item[1])}</span>
    </div>
  `).join("");
}

function renderEventDetail(rows) {
  const el = document.getElementById("fl-event-detail");
  if (!el) return;

  const row = rows.find(item => item.id === FL_STATE.selectedEventId) || rows[rows.length - 1];

  if (!row) {
    el.innerHTML = `<p class="fl-empty-state">Select a dot to inspect an event.</p>`;
    return;
  }

  el.innerHTML = `
    <div>
      <div class="fl-kicker">Selected Event</div>
      <h3>${escapeHtml(formatDate(row.dateIso || row.dateRaw))}</h3>
      <p>${escapeHtml(row.title || "")}</p>
    </div>

    <div class="fl-event-detail-grid">
      ${detailStat("Finish", row.finishPosition ? `${ordinal(row.finishPosition)} / ${row.fieldSize}` : "-")}
      ${detailStat("Depth", `${numberFmt(row.finishDepth, 0)}%`)}
      ${detailStat("Profit", moneyFmt(row.profit), row.profit >= 0 ? "positive" : "negative")}
      ${detailStat("Rebuys", row.rebuys)}
      ${detailStat("Hits", row.hits)}
      ${detailStat("Cost", moneyFmt(row.cost))}
      ${detailStat("Winnings", moneyFmt(row.winnings))}
      ${detailStat("Form", numberFmt(row.formScore, 1))}
      ${detailStat("Pain", numberFmt(row.painIndex, 1))}
    </div>
  `;
}

function detailStat(label, value, extraClass) {
  return `
    <div class="fl-detail-stat">
      <span>${escapeHtml(label)}</span>
      <strong class="${extraClass || ""}">${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function renderReadout(rows) {
  const el = document.getElementById("fl-chart-readout");
  if (!el) return;

  const xMetric = FL_METRICS[FL_STATE.xMetric];
  const yMetric = FL_METRICS[FL_STATE.yMetric];

  const bestY = [...rows].sort((a, b) => Number(b[FL_STATE.yMetric]) - Number(a[FL_STATE.yMetric]))[0];
  const worstY = [...rows].sort((a, b) => Number(a[FL_STATE.yMetric]) - Number(b[FL_STATE.yMetric]))[0];

  el.innerHTML = `
    <h3>What this chart is saying</h3>
    <p>
      This view plots <strong>${escapeHtml(yMetric.label)}</strong> against
      <strong>${escapeHtml(xMetric.label)}</strong> for each selected event.
    </p>
    <p>
      Highest plotted Y event:
      <strong>${escapeHtml(formatDate(bestY.dateIso || bestY.dateRaw))}</strong>
      at <strong>${escapeHtml(yMetric.format(bestY[FL_STATE.yMetric]))}</strong>.
      Lowest:
      <strong>${escapeHtml(formatDate(worstY.dateIso || worstY.dateRaw))}</strong>
      at <strong>${escapeHtml(yMetric.format(worstY[FL_STATE.yMetric]))}</strong>.
    </p>
  `;
}

function renderEventList(rows) {
  const el = document.getElementById("fl-event-list");
  if (!el) return;

  el.innerHTML = rows.map(row => `
    <button class="fl-event-card${row.id === FL_STATE.selectedEventId ? " is-selected" : ""}" type="button" data-event-id="${escapeAttr(row.id)}">
      <span class="fl-event-card-date">${escapeHtml(shortDate(row.dateIso || row.dateRaw))}</span>
      <span class="fl-event-card-title">${escapeHtml(row.title || "Event")}</span>
      <span class="fl-event-card-metrics">
        <strong>${row.finishPosition ? ordinal(row.finishPosition) : "-"}</strong>
        <span class="${row.profit >= 0 ? "positive" : "negative"}">${moneyFmt(row.profit)}</span>
      </span>
    </button>
  `).join("");

  el.querySelectorAll("[data-event-id]").forEach(button => {
    button.addEventListener("click", () => {
      FL_STATE.selectedEventId = button.getAttribute("data-event-id") || "";
      renderFormLab();
    });
  });
}

/* =========================================
   EVENT ROW BUILDING
========================================= */

function getSelectedPlayer() {
  return FL_STATE.players.find(player => player.slug === FL_STATE.selectedPlayerSlug) || FL_STATE.players[0] || null;
}

function getPlayerEventRows(player) {
  if (!player) return [];

  const playerSlug = canonicalSlug(player.slug || player.name);
  const rows = [];

  FL_STATE.events.forEach(event => {
    const row = buildPlayerEventRow(event, player, playerSlug);
    if (row) rows.push(row);
  });

  return rows.sort((a, b) => {
    const aDate = new Date(a.dateIso || a.dateRaw).getTime() || 0;
    const bDate = new Date(b.dateIso || b.dateRaw).getTime() || 0;
    return aDate - bDate;
  });
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
  const rebuys = getNumeric(found.rebuys !== undefined ? found.rebuys : found.rebuyCount);
  const entriesUsed = 1 + rebuys;
  const hits = getPlayerHits(event, playerSlug, found);
  const winnings = getNumeric(firstDefined(found.winnings, found.prize, found.payout, found.totalWinnings, 0));
  const cost = entriesUsed * 30;

  const explicitProfit = firstDefined(found.profit, found.net, found.netProfit, null);
  const profit = explicitProfit !== null && explicitProfit !== undefined
    ? getNumeric(explicitProfit)
    : winnings - cost;

  const paidSpots = getPaidSpots(event);
  const cashFlag = winnings > 0 || (paidSpots > 0 && finishPosition > 0 && finishPosition <= paidSpots);
  const bubbleFlag = paidSpots > 0 && finishPosition === paidSpots + 1 ? 1 : 0;

  const finishDepth = calculateFinishDepth(finishPosition, fieldSize);

  const formScore = clamp(
    finishDepth +
      hits * 10 +
      (cashFlag ? 12 : 0) +
      clamp(profit / 3, -35, 35) -
      rebuys * 7 -
      bubbleFlag * 12,
    -50,
    175
  );

  const efficiencyScore = finishDepth - rebuys * 12 + (cashFlag ? 8 : 0);
  const chaosScore = rebuys * 16 + hits * 10 + Math.abs(profit / 10);
  const painIndex = Math.max(
    0,
    (bubbleFlag ? 45 : 0) +
      finishDepth * 0.25 +
      (profit < 0 ? Math.abs(profit) / 4 : -profit / 10)
  );
  const killerValue = hits / Math.max(entriesUsed, 1);
  const survivalValue = finishDepth / Math.max(entriesUsed, 1);
  const volatility = Math.abs(profit / 10) + rebuys * 14 + hits * 6 + bubbleFlag * 16;

  return {
    id: `${dateIso || event.id || event.date || "event"}-${playerSlug}`,
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
    bubbleFlag,
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
  const direct = getNumeric(firstDefined(
    playerResult.finishPosition,
    playerResult.finish,
    playerResult.place,
    playerResult.rank,
    playerResult.position,
    0
  ));

  if (direct > 0) return direct;

  const players = getEventPlayers(event);
  const index = players.findIndex(item => item === playerResult);

  return index >= 0 ? index + 1 : 0;
}

function getFieldSize(event) {
  const direct = getNumeric(firstDefined(
    event.fieldSize,
    event.entries,
    event.totalEntries,
    event.buyIns,
    event.playersCount,
    0
  ));

  if (direct > 0) return direct;

  const players = getEventPlayers(event);
  return players.length || 1;
}

function getPaidSpots(event) {
  return getNumeric(firstDefined(
    event.paidSpots,
    event.payouts && event.payouts.paidSpots,
    event.summary && event.summary.paidSpots,
    0
  ));
}

function getPlayerHits(event, playerSlug, found) {
  const direct = getNumeric(firstDefined(found.hits, found.knockouts, found.kos, 0));
  if (direct > 0) return direct;

  const eliminations = event.eliminations || event.knockouts || event.hits || [];
  if (!Array.isArray(eliminations)) return 0;

  return eliminations.filter(item => {
    const hitter = canonicalSlug(item.hitman || item.killer || item.eliminator || item.by || item.player || "");
    return hitter === playerSlug;
  }).length;
}

function getEventDateIso(event) {
  const raw = String(firstDefined(event.dateIso, event.dateISO, event.eventDateIso, event.eventDate, event.date, event.id, "")).trim();

  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return raw;
}

function applyWindow(rows) {
  const sorted = [...rows];

  if (FL_STATE.windowSize === "all") return sorted;

  const count = Number(FL_STATE.windowSize || 6);
  return sorted.slice(Math.max(0, sorted.length - count));
}

/* =========================================
   HELPERS
========================================= */

function playerAvatarMarkup(player) {
  const name = displayName(player);
  const image = player && player.image ? player.image : "";

  return `
    <span class="fl-player-avatar-wrap">
      ${image ? `
        <img
          class="fl-player-avatar"
          src="${escapeAttr(image)}"
          alt="${escapeAttr(name)}"
          loading="lazy"
          decoding="async"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <span class="fl-player-avatar-fallback" style="display:none;">${escapeHtml(initialsFromName(name))}</span>
      ` : `
        <span class="fl-player-avatar-fallback">${escapeHtml(initialsFromName(name))}</span>
      `}
    </span>
  `;
}

function displayName(player) {
  if (!player) return "";

  const name = String(player.name || "");
  const fixes = {
    "Nasa Al": "NASA Al",
    "Providencemike": "ProvidenceMike",
    "Bostnmike": "BostnMike",
    "Ai Dave": "A.I. Dave",
    "Ai-Dave": "A.I. Dave",
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

function firstDefined() {
  for (let i = 0; i < arguments.length; i += 1) {
    if (arguments[i] !== undefined && arguments[i] !== null) return arguments[i];
  }
  return undefined;
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

function paddedDomain(values) {
  const clean = values.map(Number).filter(Number.isFinite);
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

function makeTicks(min, max, count) {
  const ticks = [];
  const step = (max - min) / Math.max(count - 1, 1);

  for (let i = 0; i < count; i += 1) {
    ticks.push(min + step * i);
  }

  return ticks;
}

function linearRegression(points) {
  if (!points || points.length < 2) return null;

  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (!denominator) return null;

  return {
    slope: (n * sumXY - sumX * sumY) / denominator,
    intercept: (sumY - ((n * sumXY - sumX * sumY) / denominator) * sumX) / n
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function numberFmt(value, digits) {
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
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
