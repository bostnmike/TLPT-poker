const DATA_URL = "data/generated/site-data.json";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function initials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .map(part => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function renderAvatar(person) {
  const alt = escapeHtml(person?.player || person?.name || "");
  const src = escapeHtml(person?.image || "");
  const fallback = escapeHtml(initials(person?.player || person?.name || ""));

  return `
    <span class="player-avatar-wrap">
      <img
        class="player-avatar table"
        src="${src}"
        alt="${alt}"
        loading="lazy"
        decoding="async"
        data-image-error-action="show-next"
      />
      <span class="player-avatar-fallback table" hidden>${fallback}</span>
    </span>
  `;
}

function renderLeaderboard(items, containerId, emptyText, limit = null, collapseTwos = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let rows = Array.isArray(items) ? [...items] : [];

  if (collapseTwos) {
    const threePlus = rows.filter((item) => Number(item.length) >= 3);
    const twoCount = rows.filter((item) => Number(item.length) === 2).length;

    rows = [...threePlus];

    if (twoCount > 0) {
      rows.push({
        isTieSummary: true,
        tieCount: twoCount,
        length: 2
      });
    }
  }

  const finalRows = Number.isInteger(limit) ? rows.slice(0, limit) : rows;

  if (!finalRows.length) {
    container.innerHTML = `<div class="streak-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  container.innerHTML = finalRows
    .map((item, index) => {
      if (item.isTieSummary) {
        return `
          <article class="streak-row">
            <span class="streak-rank">${index + 1}</span>
            <div class="streak-row-main" style="grid-column: 2 / 4;">
              <div class="streak-row-player">${escapeHtml(item.tieCount)} Players tied with 2</div>
              <div class="streak-row-meta">Additional active droughts grouped at the minimum tracked threshold.</div>
            </div>
            <div class="streak-row-length">2 straight</div>
          </article>
        `;
      }

      return `
        <article class="streak-row">
          <span class="streak-rank">${index + 1}</span>
          ${renderAvatar(item)}
          <div class="streak-row-main">
            <div class="streak-row-player">${escapeHtml(item.player)}</div>
            <div class="streak-row-meta">
              ${escapeHtml(formatDate(item.startDate))} → ${escapeHtml(formatDate(item.endDate))}
            </div>
          </div>
          <div class="streak-row-length">${escapeHtml(item.length)} straight</div>
        </article>
      `;
    })
    .join("");
}

function detailCard(title, streak, theme = "hot") {
  const themeClass = theme === "cold" ? "streak-detail-card-cold" : "streak-detail-card-hot";

  if (!streak) {
    return `
      <article class="streak-detail-card ${themeClass}">
        <h4>${escapeHtml(title)}</h4>
        <div class="streak-empty">No qualifying run.</div>
      </article>
    `;
  }

  return `
    <article class="streak-detail-card ${themeClass}">
      <h4>${escapeHtml(title)}</h4>

      <div class="streak-detail-pill-row">
        <span class="streak-detail-length">${escapeHtml(streak.length)} straight</span>
        ${streak.active ? `<span class="streak-detail-active">Active</span>` : ""}
      </div>

      <div class="streak-detail-line">
        <strong>Start:</strong> ${escapeHtml(formatDate(streak.startDate))} — ${escapeHtml(streak.startTitle || "")}
      </div>
      <div class="streak-detail-line">
        <strong>End:</strong> ${escapeHtml(formatDate(streak.endDate))} — ${escapeHtml(streak.endTitle || "")}
      </div>
    </article>
  `;
}

function renderPlayerDetail(streaks, slug) {
  const container = document.getElementById("streak-player-detail");
  if (!container) return;

  const player = streaks?.players?.[slug];
  const eligibleList = Array.isArray(streaks?.eligiblePlayers) ? streaks.eligiblePlayers : [];
  const meta = eligibleList.find(p => p.slug === slug);

  if (!player || !meta) {
    container.innerHTML = `<div class="streak-empty">No eligible player selected.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="streak-player-summary">
      ${renderAvatar(meta)}
      <div>
        <div class="streak-player-name">${escapeHtml(meta.name)}</div>
        <div class="streak-player-sub">Full streak profile for the eligible sample.</div>
      </div>
      <div class="streak-played-pill">${escapeHtml(meta.playedEvents)} played events</div>
    </div>

    <div class="streak-detail-grid">
      ${detailCard("Current Cash Streak", player.currentCashStreak, "hot")}
      ${detailCard("Current Drought", player.currentDroughtStreak, "cold")}
      ${detailCard("Longest Cash Run", player.bestCashStreak, "hot")}
      ${detailCard("Coldest Drought Run", player.bestDroughtStreak, "cold")}
    </div>
  `;
}

function initPlayerSelect(streaks) {
  const select = document.getElementById("streak-player-select");
  if (!select) return;

  const eligiblePlayers = Array.isArray(streaks?.eligiblePlayers) ? streaks.eligiblePlayers : [];

  if (!eligiblePlayers.length) {
    select.innerHTML = `<option value="">No eligible players</option>`;
    renderPlayerDetail(streaks, "");
    return;
  }

  select.innerHTML = eligiblePlayers
    .map(player => `
      <option value="${escapeHtml(player.slug)}">
        ${escapeHtml(player.name)} (${escapeHtml(player.playedEvents)} events)
      </option>
    `)
    .join("");

  select.addEventListener("change", (event) => {
    renderPlayerDetail(streaks, event.target.value);
  });

  renderPlayerDetail(streaks, eligiblePlayers[0].slug);
}

async function initStreakTracker() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);

    const data = await res.json();
    const streaks = data.streaks || {};

    renderLeaderboard(
      streaks.activeCashLeaders || [],
      "active-cash-board",
      "No active cash streaks of 2+ among eligible players."
    );

    renderLeaderboard(
      streaks.activeDroughtLeaders || [],
      "active-drought-board",
      "No active droughts of 2+ among eligible players.",
      null,
      true
    );

    renderLeaderboard(
      streaks.cashLeaders || [],
      "top-cash-board",
      "No qualifying cash streaks yet.",
      5
    );

    renderLeaderboard(
      streaks.droughtLeaders || [],
      "top-drought-board",
      "No qualifying droughts yet.",
      5
    );

    initPlayerSelect(streaks);
  } catch (error) {
    console.error("Streak Tracker failed to load:", error);

    [
      "active-cash-board",
      "active-drought-board",
      "top-cash-board",
      "top-drought-board",
      "streak-player-detail"
    ].forEach((id) => {
      const container = document.getElementById(id);
      if (container) {
        container.innerHTML = `<div class="streak-empty">Could not load streak data.</div>`;
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", initStreakTracker);
