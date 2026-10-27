function setActiveSortButton(scope, sortKey) {
  if (scope === "dashboard") {
    const metricSelect = document.getElementById("dashboard-metric-select");
    if (metricSelect && [...metricSelect.options].some(option => option.value === sortKey)) {
      metricSelect.value = sortKey;
    }
  }

  document.querySelectorAll(`[data-sort-scope="${scope}"] [data-sort], [data-${scope}-sort]`).forEach(btn => {
    const key = btn.dataset.sort || btn.dataset[`${scope}Sort`];
    const isActive = key === sortKey;
    btn.classList.toggle("active", isActive);

    if (scope === "dashboard") {
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.tabIndex = isActive ? 0 : -1;
    } else {
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  });
}

function dashboardCategoryForSort(sortKey) {
  return Object.entries(DASHBOARD_METRICS_BY_CATEGORY)
    .find(([, metrics]) => metrics.some(metric => metric.key === sortKey))?.[0] || null;
}

function syncDashboardSelector(sortKey) {
  const category = dashboardCategoryForSort(sortKey);
  if (!category) return;

  dashboardLastSortByCategory.set(category, sortKey);

  document.querySelectorAll("[data-dashboard-category]").forEach(tab => {
    const isActive = tab.dataset.dashboardCategory === category;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.tabIndex = isActive ? 0 : -1;
  });

  const metricPanel = document.getElementById("dashboard-metric-panel");
  const metricSelect = document.getElementById("dashboard-metric-select");
  const metricIcon = document.getElementById("dashboard-metric-icon");
  const metrics = DASHBOARD_METRICS_BY_CATEGORY[category] || [];
  const activeMetric = metrics.find(metric => metric.key === sortKey) || metrics[0];
  const activeTab = document.getElementById(`dashboard-category-${category}`);

  if (metricPanel) {
    metricPanel.dataset.dashboardMetricGroup = category;
    metricPanel.setAttribute("aria-labelledby", activeTab?.id || "dashboard-category-results");
  }

  if (metricSelect) {
    const categoryLabel = activeTab?.textContent?.trim() || "Dashboard";
    metricSelect.replaceChildren(...metrics.map(metric => {
      const option = document.createElement("option");
      option.value = metric.key;
      option.textContent = metric.label;
      return option;
    }));
    metricSelect.setAttribute("aria-label", `${categoryLabel} metric`);
    metricSelect.value = sortKey;
  }

  if (metricIcon) {
    metricIcon.textContent = activeMetric?.icon || "";
  }
}

function dashboardHasBountyData(players) {
  return (players || []).some(player =>
    DASHBOARD_BOUNTY_DATA_KEYS.some(key => Math.abs(Number(player?.[key] ?? 0)) > 0)
  );
}

function dashboardBountyEmptyMarkup() {
  return `
    <div class="dashboard-empty-state" role="status">
      <div class="dashboard-empty-state-icon" aria-hidden="true">🏷️</div>
      <h3>No bounty results yet</h3>
      <p>This board will open automatically after the first recorded bounty event.</p>
    </div>
  `;
}

function dashboardMetricEmptyMarkup(sortKey) {
  const meta = DASHBOARD_META[sortKey] || {
    label: formatStatLabel(sortKey),
    icon: statIcon(sortKey)
  };

  return `
    <div class="dashboard-empty-state" role="status">
      <div class="dashboard-empty-state-icon" aria-hidden="true">${meta.icon}</div>
      <h3>No non-zero ${meta.label.toLowerCase()} results yet</h3>
      <p>Players with a value of 0 are omitted from this ranking.</p>
    </div>
  `;
}

function initCrewViewToggle() {
  const tierBtn = document.getElementById("crew-view-tier");
  const archetypeBtn = document.getElementById("crew-view-archetype");
  const crewViewSwitch = document.getElementById("crew-view-switch-input");

  if (!tierBtn || !archetypeBtn) return;
  const summary = document.getElementById('crew-tier-summary');
  if (summary && typeof window.matchMedia === 'function') {
    const desktop = window.matchMedia('(min-width: 760px)');
    summary.open = desktop.matches;
    desktop.addEventListener('change', event => { summary.open = event.matches; });
  }
  document.querySelectorAll('[data-crew-display]').forEach(button => button.addEventListener('click', () => {
    currentCrewDisplay = button.dataset.crewDisplay;
    renderPlayers(window.siteData);
  }));

  tierBtn.addEventListener("click", () => {
    currentCrewTier = 'all';
    currentCrewView = "tier";
    currentArchetypeMode = "primary";
    currentArchetypeFilter = "all";
    currentCrewVisibleCount = 0;
    if (crewViewSwitch) crewViewSwitch.checked = false;
    renderPlayers(window.siteData);
  });

  archetypeBtn.addEventListener("click", () => {
    currentCrewTier = 'all';
    currentCrewView = "archetype";
    currentArchetypeMode = "primary";
    currentArchetypeFilter = "all";
    currentCrewVisibleCount = 0;
    if (crewViewSwitch) crewViewSwitch.checked = true;
    renderPlayers(window.siteData);
  });

  if (crewViewSwitch) {
    crewViewSwitch.addEventListener("change", () => {
      currentCrewView = crewViewSwitch.checked ? "archetype" : "tier";
      currentArchetypeMode = "primary";
      currentArchetypeFilter = "all";
      currentCrewVisibleCount = 0;
      renderPlayers(window.siteData);
    });
  }
}

function initCrewSearch() {
  document.querySelectorAll("[data-crew-roster]").forEach(button => {
    button.addEventListener("click", () => {
      currentCrewRoster = button.dataset.crewRoster;
      currentCrewTier = 'all';
      currentArchetypeFilter = "all";
      currentCrewVisibleCount = 0;
      renderPlayers(window.siteData);
    });
  });
  const search = document.getElementById("crew-player-search");
  if (!search) return;

  search.addEventListener("input", () => {
    currentCrewSearch = String(search.value || "").trim().toLowerCase();
    currentCrewTier = 'all';
    currentArchetypeFilter = "all";
    currentCrewVisibleCount = 0;
    renderPlayers(window.siteData);
  });
}

function initSorting() {
  document.querySelectorAll(`[data-sort-scope="standings"] [data-sort], [data-standings-sort]`).forEach(btn => {
    btn.addEventListener("click", () => renderStandings(btn.dataset.sort || btn.dataset.standingsSort || DEFAULT_STANDINGS_SORT));
  });

  const dashboardMetricSelect = document.getElementById("dashboard-metric-select");
  dashboardMetricSelect?.addEventListener("change", () => {
    renderDashboard(dashboardMetricSelect.value || DEFAULT_DASHBOARD_SORT);
  });

  const dashboardCategoryTabs = [...document.querySelectorAll("[data-dashboard-category]")];
  dashboardCategoryTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const category = tab.dataset.dashboardCategory;
      renderDashboard(dashboardLastSortByCategory.get(category) || DASHBOARD_CATEGORY_DEFAULTS[category] || DEFAULT_DASHBOARD_SORT);
    });

    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

      event.preventDefault();
      const currentIndex = dashboardCategoryTabs.indexOf(tab);
      let nextIndex = currentIndex;

      if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = dashboardCategoryTabs.length - 1;
      else if (event.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + dashboardCategoryTabs.length) % dashboardCategoryTabs.length;
      } else {
        nextIndex = (currentIndex + 1) % dashboardCategoryTabs.length;
      }

      dashboardCategoryTabs[nextIndex].focus();
      dashboardCategoryTabs[nextIndex].click();
    });
  });
}

window.renderStandings = renderStandings;
window.renderDashboard = renderDashboard;
window.renderPlayers = renderPlayers;
window.renderPlayerProfile = renderPlayerProfile;
window.showFormat = showFormat;

