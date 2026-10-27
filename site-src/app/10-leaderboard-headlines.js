function ensureStandingsHeadline(sortKey) {
  const table = document.getElementById("standings-table");
  if (!table) return;

  const topShell = document.querySelector(".standings-top-shell");
  const raceStrip = document.getElementById("standings-race-strip");
  let metaShell = document.getElementById("standings-meta-shell");
  let headline = document.getElementById("standings-current-stat");
  let formula = document.getElementById("standings-formula-display");

  if (!metaShell) {
    metaShell = document.createElement("div");
    metaShell.id = "standings-meta-shell";
    metaShell.className = "standings-meta-shell";
  }

  if (!headline) {
    headline = document.createElement("div");
    headline.id = "standings-current-stat";
    headline.className = "standings-current-stat";
  }

  headline.setAttribute("role", "status");
  headline.setAttribute("aria-live", "polite");
  headline.setAttribute("aria-atomic", "true");

  if (!formula) {
    formula = document.createElement("div");
    formula.id = "standings-formula-display";
    formula.className = "standings-formula-display";
  }

  if (headline.parentNode !== metaShell) {
    metaShell.appendChild(headline);
  }

  if (formula.parentNode !== metaShell) {
    metaShell.appendChild(formula);
  }

  if (topShell) {
    if (raceStrip && raceStrip.parentNode === topShell) {
      if (metaShell.parentNode !== topShell || metaShell.previousElementSibling !== raceStrip) {
        topShell.insertBefore(metaShell, raceStrip.nextSibling);
      }
    } else if (metaShell.parentNode !== topShell) {
      topShell.appendChild(metaShell);
    }
  }

  headline.innerHTML = `
    <span class="dashboard-current-icon">${statIcon(sortKey)}</span>
    <span class="standings-current-label">${formatStatLabel(sortKey)}</span>
  `;

  formula.textContent =
    STAT_FORMULAS[sortKey] || "Click a standings stat button to reveal the calculation formula.";
}

function renderStandingsRaceStrip(sortKey, sortedPlayers) {
  const strip = document.getElementById("standings-race-strip");
  if (!strip) return;

  strip.innerHTML = `
    <div class="standings-race-context">
      <strong>Qualified Field:</strong> ${sortedPlayers.length} players ${window.TLPTStats?.active() ? 'with results in this view' : 'with 2+ entries'}
    </div>
  `;
}

function dashboardMetricLabel(sortKey) {
  return Object.values(DASHBOARD_METRICS_BY_CATEGORY).flat().find(metric => metric.key === sortKey)?.label || formatStatLabel(sortKey);
}

function renderDashboardStudioStrip(sortKey, sortedPlayers) {
  const strip = document.getElementById("dashboard-studio-strip");
  if (!strip) return;

  const count = sortedPlayers.length;
  const career = !window.TLPTStats?.isFactual(sortKey);
  const eventCount = window.TLPTStats?.selectedEvents().length || 0;
  const metric = dashboardMetricLabel(sortKey).toLowerCase();
  const context = career ? "using career-wide ratings" : `across ${eventCount} event${eventCount === 1 ? "" : "s"}`;
  strip.textContent = count
    ? `Ranking ${count} player${count === 1 ? "" : "s"} by ${metric} ${context}.`
    : `No players to rank by ${metric} ${context}.`;
  if (!career && eventCount > 0 && eventCount < 5) strip.textContent += " Small sample—brag responsibly.";
  strip.setAttribute("role", "status");
  strip.setAttribute("aria-live", "polite");
}

function ensureDashboardHeadline(sortKey) {
  const topShell = document.querySelector(".dashboard-top-shell");
  const studioStrip = document.getElementById("dashboard-studio-strip");
  const metaShell = document.getElementById("dashboard-meta-shell");
  const headline = document.getElementById("dashboard-current-stat");
  const formulaBox = document.getElementById("dashboard-formula-display");

  if (!topShell || !metaShell || !headline) return;

  if (studioStrip && studioStrip.parentNode === topShell) {
    if (metaShell.parentNode !== topShell || metaShell.previousElementSibling !== studioStrip) {
      topShell.insertBefore(metaShell, studioStrip.nextSibling);
    }
  } else if (metaShell.parentNode !== topShell) {
    topShell.appendChild(metaShell);
  }

  const meta = DASHBOARD_META[sortKey] || {
    label: formatStatLabel(sortKey),
    icon: statIcon(sortKey),
    formula: ""
  };

  headline.innerHTML = `
    <span class="dashboard-current-icon">${meta.icon}</span>
    <span class="standings-current-label">${dashboardMetricLabel(sortKey)}</span>
  `;

  if (formulaBox) {
    formulaBox.textContent = meta.formula || "Click a stat button to reveal the calculation formula.";
  }
}

