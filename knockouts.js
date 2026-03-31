/* knockouts.js */
(() => {
  const SITE_DATA_URL = "site-data.json";
  const KNOCKOUTS_URL = "knockouts.json";

  function getInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function avatarMarkup(player, sizeClass = "knockouts-avatar-md") {
    if (!player) {
      return `<div class="knockouts-avatar-fallback ${sizeClass}" aria-hidden="true">?</div>`;
    }

    const image = player.image || "";
    const name = player.name || "Unknown";
    const initials = getInitials(name);

    if (!image) {
      return `<div class="knockouts-avatar-fallback ${sizeClass}" aria-hidden="true">${initials}</div>`;
    }

    return `
      <img
        class="knockouts-avatar ${sizeClass}"
        src="${image}"
        alt="${name}"
        onerror="this.outerHTML='<div class=&quot;knockouts-avatar-fallback ${sizeClass}&quot; aria-hidden=&quot;true&quot;>${initials}</div>';"
      />
    `;
  }

  function buildPlayerMap(players) {
    const bySlug = new Map();
    players.forEach(player => {
      if (player?.slug) bySlug.set(String(player.slug), player);
    });
    return bySlug;
  }

  function getTotalByKiller(byKiller) {
    return Object.entries(byKiller || {}).map(([killerSlug, victims]) => {
      const total = Object.values(victims || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      const uniqueVictims = Object.keys(victims || {}).length;
      return { slug: killerSlug, total, uniqueVictims, victims };
    });
  }

  function getTotalByVictim(byVictim) {
    return Object.entries(byVictim || {}).map(([victimSlug, killers]) => {
      const total = Object.values(killers || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      return { slug: victimSlug, total, killers };
    });
  }

  function getStrongestRivalries(byVictim) {
    const rivalries = [];

    Object.entries(byVictim || {}).forEach(([victimSlug, killers]) => {
      Object.entries(killers || {}).forEach(([killerSlug, count]) => {
        rivalries.push({
          killerSlug,
          victimSlug,
          count: Number(count || 0)
        });
      });
    });

    return rivalries.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.killerSlug !== b.killerSlug) return a.killerSlug.localeCompare(b.killerSlug);
      return a.victimSlug.localeCompare(b.victimSlug);
    });
  }

  function getNemesisBoard(byVictim) {
    return Object.entries(byVictim || {})
      .map(([victimSlug, killers]) => {
        const entries = Object.entries(killers || {}).map(([killerSlug, count]) => ({
          killerSlug,
          count: Number(count || 0)
        }));

        if (!entries.length) return null;

        entries.sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.killerSlug.localeCompare(b.killerSlug);
        });

        return {
          victimSlug,
          killerSlug: entries[0].killerSlug,
          count: entries[0].count
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.victimSlug.localeCompare(b.victimSlug);
      });
  }

  function safePlayer(playerMap, slug) {
    return playerMap.get(String(slug || "")) || null;
  }

  function renderStatCard({ label, player, value, subtext, avatarSize = "knockouts-avatar-md" }) {
    return `
      <div class="knockouts-stat-card">
        <div class="knockouts-stat-label">${label}</div>
        <div class="knockouts-stat-main">
          <div class="knockouts-stat-avatar-wrap">
            ${avatarMarkup(player, avatarSize)}
          </div>
          <div class="knockouts-stat-copy">
            <div class="knockouts-stat-name">${player?.name || "—"}</div>
            <div class="knockouts-stat-value">${value}</div>
            ${subtext ? `<div class="knockouts-stat-sub">${subtext}</div>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function renderTopStats(playerMap, byKiller, byVictim) {
    const killers = getTotalByKiller(byKiller).sort((a, b) => b.total - a.total);
    const victims = getTotalByVictim(byVictim).sort((a, b) => b.total - a.total);
    const rivalries = getStrongestRivalries(byVictim);
    const nemesisBoard = getNemesisBoard(byVictim);

    const mostKnockouts = killers[0] || null;
    const mostBusted = victims[0] || null;
    const biggestBully = rivalries[0] || null;
    const mostUniqueVictims = [...killers].sort((a, b) => {
      if (b.uniqueVictims !== a.uniqueVictims) return b.uniqueVictims - a.uniqueVictims;
      if (b.total !== a.total) return b.total - a.total;
      return a.slug.localeCompare(b.slug);
    })[0] || null;

    const html = [];

html.push(renderStatCard({
  label: "Most Total Knock-Outs",
  player: mostKnockouts ? safePlayer(playerMap, mostKnockouts.slug) : null,
  value: mostKnockouts ? `${mostKnockouts.total}` : "—",
  subtext: ""
}));

html.push(renderStatCard({
  label: "Most Times Busted",
  player: mostBusted ? safePlayer(playerMap, mostBusted.slug) : null,
  value: mostBusted ? `${mostBusted.total}` : "—",
  subtext: ""
}));

if (biggestBully) {
  const killer = safePlayer(playerMap, biggestBully.killerSlug);
  const victim = safePlayer(playerMap, biggestBully.victimSlug);

  html.push(renderStatCard({
    label: "Biggest Bully",
    player: killer,
    value: `${biggestBully.count} vs ${victim?.name || biggestBully.victimSlug}`,
    subtext: ""
  }));
} else {
  html.push(renderStatCard({
    label: "Biggest Bully",
    player: null,
    value: "—",
    subtext: ""
  }));
}

if (mostUniqueVictims) {
  const killer = safePlayer(playerMap, mostUniqueVictims.slug);

  html.push(renderStatCard({
    label: "Most Unique Victims",
    player: killer,
    value: `${mostUniqueVictims.uniqueVictims}`,
    subtext: ""
  }));
} else {
  html.push(renderStatCard({
    label: "Most Unique Victims",
    player: null,
    value: "—",
    subtext: ""
  }));
}

    return html.join("");
  }

  function renderRivalries(playerMap, byVictim) {
    const rivalries = getStrongestRivalries(byVictim).slice(0, 12);

    if (!rivalries.length) {
      return `<div class="knockouts-empty">No rivalry data yet.</div>`;
    }

    return `
      <div class="knockouts-rivalry-list">
        ${rivalries.map(item => {
          const killer = safePlayer(playerMap, item.killerSlug);
          const victim = safePlayer(playerMap, item.victimSlug);

          return `
            <div class="knockouts-rivalry-card">
              ${avatarMarkup(killer, "knockouts-avatar-sm")}
              <div class="knockouts-rivalry-arrow">→</div>
              <div class="knockouts-rivalry-copy">
                <div class="knockouts-rivalry-title">${killer?.name || item.killerSlug} vs ${victim?.name || item.victimSlug}</div>
                <div class="knockouts-rivalry-sub">Sent them home ${item.count} ${item.count === 1 ? "time" : "times"}</div>
              </div>
              <div class="knockouts-list-value">${item.count}</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderNemesisBoard(playerMap, byVictim) {
    const board = getNemesisBoard(byVictim);

    if (!board.length) {
      return `<div class="knockouts-empty">No nemesis board yet.</div>`;
    }

    return `
      <div class="knockouts-nemesis-grid">
        ${board.map(item => {
          const victim = safePlayer(playerMap, item.victimSlug);
          const killer = safePlayer(playerMap, item.killerSlug);

          return `
            <div class="knockouts-nemesis-card">
              <div class="knockouts-nemesis-top">
                ${avatarMarkup(victim, "knockouts-avatar-sm")}
                <div>
                  <div class="knockouts-nemesis-player">${victim?.name || item.victimSlug}</div>
                  <div class="knockouts-nemesis-meta">keeps seeing this face</div>
                </div>
              </div>

              <div class="knockouts-list-card">
                ${avatarMarkup(killer, "knockouts-avatar-sm")}
                <div class="knockouts-list-copy">
                  <div class="knockouts-list-title">${killer?.name || item.killerSlug}</div>
                  <div class="knockouts-list-sub">Table Nemesis</div>
                </div>
                <div class="knockouts-list-value">${item.count}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderBodyCountLedger(playerMap, byKiller) {
    const killers = getTotalByKiller(byKiller)
      .filter(item => item.total > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.slug.localeCompare(b.slug);
      });

    if (!killers.length) {
      return `<div class="knockouts-empty">No knockout ledger yet.</div>`;
    }

    return `
      <div class="knockouts-belt">
        ${killers.map(killerEntry => {
          const killer = safePlayer(playerMap, killerEntry.slug);
          const victims = Object.entries(killerEntry.victims || {})
            .map(([slug, count]) => ({
              slug,
              count: Number(count || 0)
            }))
            .sort((a, b) => {
              if (b.count !== a.count) return b.count - a.count;
              return a.slug.localeCompare(b.slug);
            });

          return `
            <div class="knockouts-belt-card">
              <div class="knockouts-belt-head">
                ${avatarMarkup(killer, "knockouts-avatar-md")}
                <div class="knockouts-belt-copy">
                  <div class="knockouts-belt-name">${killer?.name || killerEntry.slug}</div>
                  <div class="knockouts-belt-sub">${killerEntry.uniqueVictims} unique ${killerEntry.uniqueVictims === 1 ? "victim" : "victims"}</div>
                </div>
                <div class="knockouts-belt-total">${killerEntry.total} total</div>
              </div>

              <div class="knockouts-belt-victims">
                ${victims.map(victimEntry => {
                  const victim = safePlayer(playerMap, victimEntry.slug);
                  return `
                    <div class="knockouts-belt-tile">
                      ${avatarMarkup(victim, "knockouts-avatar-sm")}
                      <div class="knockouts-belt-tile-name">${victim?.name || victimEntry.slug}</div>
                      <div class="knockouts-belt-tile-count">${victimEntry.count}</div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    return await res.json();
  }

  function renderKnockoutCentral(siteData, knockouts) {
    const root = document.getElementById("knockouts-page");
    if (!root) return;

    const players = Array.isArray(siteData?.players) ? siteData.players : [];
    const playerMap = buildPlayerMap(players);

    const byVictim = knockouts?.byVictim || {};
    const byKiller = knockouts?.byKiller || {};

    const topStatsHost = document.getElementById("knockouts-summary-grid");
    const rivalriesHost = document.getElementById("knockouts-rivalries");
    const nemesisBoardHost = document.getElementById("knockouts-nemesis-board");
    const bodyCountLedgerHost = document.getElementById("knockouts-body-count-ledger");

    if (topStatsHost) {
      topStatsHost.innerHTML = renderTopStats(playerMap, byKiller, byVictim);
    }

    if (rivalriesHost) {
      rivalriesHost.innerHTML = renderRivalries(playerMap, byVictim);
    }

    if (nemesisBoardHost) {
      nemesisBoardHost.innerHTML = renderNemesisBoard(playerMap, byVictim);
    }

    if (bodyCountLedgerHost) {
      bodyCountLedgerHost.innerHTML = renderBodyCountLedger(playerMap, byKiller);
    }
  }

  async function initKnockoutCentral() {
    try {
      const [siteData, knockouts] = await Promise.all([
        loadJson(SITE_DATA_URL),
        loadJson(KNOCKOUTS_URL)
      ]);

      renderKnockoutCentral(siteData, knockouts);
    } catch (err) {
      console.error("Failed to initialize Knockout Central:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initKnockoutCentral);
  } else {
    initKnockoutCentral();
  }
})();
