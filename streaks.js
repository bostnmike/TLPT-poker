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

function renderAvatar(streak) {
  const alt = escapeHtml(streak?.player || "");
  const src = escapeHtml(streak?.image || "");
  const fallback = escapeHtml(
    String(streak?.player || "")
      .split(/\s+/)
      .map(part => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase()
  );

  return `
    <span class="player-avatar-wrap">
      <img
        class="player-avatar table"
        src="${src}"
        alt="${alt}"
        loading="lazy"
        decoding="async"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      />
      <span class="player-avatar-fallback table" style="display:none;">${fallback}</span>
    </span>
  `;
}

function renderStreakCard(streak, index) {
  return `
    <article class="streak-card">
      <div class="streak-card-head">
        <span class="streak-rank">${index + 1}</span>
        ${renderAvatar(streak)}
        <div class="streak-card-title">
          <div class="streak-player">${escapeHtml(streak.player)}</div>
        </div>
      </div>

      <div class="streak-badge-row">
        <span class="streak-length">${escapeHtml(streak.length)} straight</span>
        ${streak.active ? `<span class="streak-active">Active</span>` : ""}
      </div>

      <div class="streak-meta">
        <div class="streak-meta-line">
          <strong>Start:</strong> ${escapeHtml(formatDate(streak.startDate))}
        </div>
        <div class="streak-meta-line">
          <strong>End:</strong> ${escapeHtml(formatDate(streak.endDate))}
        </div>
        <div class="streak-meta-line">
          <strong>Opened:</strong> ${escapeHtml(streak.startTitle || "")}
        </div>
        <div class="streak-meta-line">
          <strong>Latest:</strong> ${escapeHtml(streak.endTitle || "")}
        </div>
      </div>
    </article>
  `;
}

function renderSection(items, containerId, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = `<div class="streak-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  container.innerHTML = items.map(renderStreakCard).join("");
}

async function initStreakTracker() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);

    const data = await res.json();
    const streaks = data.streaks || {};

    renderSection(
      streaks.cashLeaders || [],
      "cash-leaders",
      "No cash streaks found yet."
    );

    renderSection(
      streaks.droughtLeaders || [],
      "drought-leaders",
      "No drought streaks found yet."
    );

    renderSection(
      streaks.activeCashLeaders || [],
      "active-cash-leaders",
      "No active cash streaks right now."
    );

    renderSection(
      streaks.activeDroughtLeaders || [],
      "active-drought-leaders",
      "No active drought streaks right now."
    );
  } catch (error) {
    console.error("Streak Tracker failed to load:", error);

    ["cash-leaders", "drought-leaders", "active-cash-leaders", "active-drought-leaders"]
      .forEach((id) => {
        const container = document.getElementById(id);
        if (container) {
          container.innerHTML = `<div class="streak-empty">Could not load streak data.</div>`;
        }
      });
  }
}

document.addEventListener("DOMContentLoaded", initStreakTracker);
