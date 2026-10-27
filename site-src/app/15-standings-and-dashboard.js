function renderStandings(sortKey = DEFAULT_STANDINGS_SORT) {
  const table = document.getElementById("standings-table");
  const tbody = table?.querySelector("tbody");
  if (!table || !tbody || !window.siteData?.players) return;
  standingsStatSelection = sortKey;

  ensureStandingsHeadline(sortKey);

  const scopedPlayers = window.TLPTStats?.players(window.siteData.players) || window.siteData.players;
  const eligiblePlayers = scopedPlayers.filter(
    player => window.TLPTStats?.active() ? Number(player.buyIns) > 0 : Number(player?.entries ?? 0) >= 2
  );

  const sorted = sortPlayers(eligiblePlayers, sortKey);
  table.dataset.activeStat = sortKey;

  table.querySelectorAll("thead th[data-standings-column]").forEach(header => {
    if (header.dataset.standingsColumn === sortKey) {
      header.setAttribute("aria-sort", "descending");
    } else {
      header.removeAttribute("aria-sort");
    }
  });

  renderStandingsRaceStrip(sortKey, sorted);

  tbody.innerHTML = window.TLPTRoster.sections(sorted, (player, index) => `
    <tr
      class="standings-row-link"
      data-league-rank="${index + 1}"
      data-href="${playerUrl(player)}"
    >
      <td>${index + 1}</td>
      <td role="rowheader">${playerInlineMarkup(player, "standings")}</td>
      <td>${fmtMoney(player.totalWinnings)}</td>
      <td class="${statValueClass(player, "profit")}">${fmtMoney(player.profit)}</td>
      <td>${player.timesPlaced ?? "-"}</td>
      <td>${player.bubbles ?? "-"}</td>
      <td>${player.hits ?? "-"}</td>
      <td>${player.buyIns ?? "-"}</td>
      <td>${player.rebuys ?? "-"}</td>
      <td>${player.entries ?? "-"}</td>
    </tr>
  `, { columns: 10, ranked: true });
  if (!sorted.length) tbody.innerHTML = '<tr><td colspan="10">No results match these event filters. Try another selection or Reset to All.</td></tr>';

  setActiveSortButton("standings", sortKey);

  tbody.querySelectorAll(".standings-row-link").forEach(row => {
    const href = row.dataset.href;
    if (!href) return;

    row.addEventListener("click", event => {
      const link = event.target.closest("a");
      if (link) return;
      window.location.href = href;
    });

  });
}

function dashboardCardMarkup(player, sortKey, rank = null) {
  let medal = "";
  let rankClass = "dashboard-rank-default";

  if (rank === 1) {
    medal = "🥇";
    rankClass = "dashboard-rank-gold";
  } else if (rank === 2) {
    medal = "🥈";
    rankClass = "dashboard-rank-silver";
  } else if (rank === 3) {
    medal = "🥉";
    rankClass = "dashboard-rank-bronze";
  }

  return `
    <a class="player-card player-card-rich dashboard-card ${rankClass}${rank > 3 ? " dashboard-card-mobile-compact" : ""}" href="${playerUrl(player)}">
      ${medal ? `<div class="dashboard-rank-medal">${medal}</div>` : ""}
      <span class="dashboard-list-rank" aria-hidden="true">${rank}</span>
      <div class="dashboard-card-top">
        ${playerImageMarkup(player, "dashboard")}
      </div>
      <div class="dashboard-player-name dashboard-player-name-below">${displayPlayerName(player)}</div>
      <div
        class="dashboard-card-value dashboard-stat-gold ${statValueClass(player, sortKey)}"
        data-animate-count="true"
        data-target-value="${formatStatValue(player, sortKey)}"
      >${formatStatValue(player, sortKey)}</div>
    </a>
  `;
}

function renderDashboard(sortKey = DEFAULT_DASHBOARD_SORT) {
  const grid = document.getElementById("dashboard-grid");
  if (!grid || !window.siteData?.players) return;
  dashboardStatSelection = sortKey;

  syncDashboardSelector(sortKey);
  ensureDashboardHeadline(sortKey);

  const careerMetric = window.TLPTStats && !window.TLPTStats.isFactual(sortKey);
  const scopedPlayers = careerMetric ? window.siteData.players : (window.TLPTStats?.players(window.siteData.players) || window.siteData.players);
  const eligiblePlayers = !careerMetric && window.TLPTStats?.active()
    ? scopedPlayers.filter(player => player.buyIns > 0 && Number.isFinite(Number(player[sortKey])) && Number(player[sortKey]) !== 0)
    : dashboardPlayersForMetric(scopedPlayers, sortKey);
  const careerNote = document.getElementById('dashboard-career-note');
  if (careerNote) careerNote.hidden = !careerMetric;

  if (DASHBOARD_BOUNTY_SORTS.has(sortKey) && !dashboardHasBountyData(scopedPlayers)) {
    renderDashboardStudioStrip(sortKey, []);

    grid.innerHTML = '<p class="muted">No bounty results match these filters. Try With Bounties or Reset to All.</p>';
    setActiveSortButton("dashboard", sortKey);
    return;
  }

  const sorted = sortPlayers(eligiblePlayers, sortKey);

  renderDashboardStudioStrip(sortKey, sorted);

  if (!sorted.length) {
    grid.innerHTML = dashboardMetricEmptyMarkup(sortKey);
    setActiveSortButton("dashboard", sortKey);
    return;
  }

  grid.innerHTML = window.TLPTRoster.sections(sorted, (player, index) => dashboardCardMarkup(player, sortKey, index + 1), { ranked: true });
  initAnimatedCounters(grid);
  setActiveSortButton("dashboard", sortKey);
}

