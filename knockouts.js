/* knockouts.js */
(() => {
  const SITE_DATA_URLS = [
    "data/generated/site-data.json",
    "./data/generated/site-data.json",
    "site-data.json"
  ];

const KNOCKOUTS_URLS = [
  "data/generated/knockouts.json?v=" + Date.now(),
  "data/generated/knockouts-generated.json?v=" + Date.now(),
  "knockouts.json?v=" + Date.now(),
  "./knockouts.json?v=" + Date.now()
];

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

  function renderTallyMarks(count) {
    const total = Number(count || 0);
    if (total <= 0) return "";

    const groupsOfFive = Math.floor(total / 5);
    const remainder = total % 5;

    const fiveGroup = `
      <span class="knockouts-tally-group">
        <span class="knockouts-tally-stroke"></span>
        <span class="knockouts-tally-stroke"></span>
        <span class="knockouts-tally-stroke"></span>
        <span class="knockouts-tally-stroke"></span>
        <span class="knockouts-tally-slash"></span>
      </span>
    `;

    const remainderGroup = remainder
      ? `<span class="knockouts-tally-group">
          ${Array.from({ length: remainder }).map(() => `<span class="knockouts-tally-stroke"></span>`).join("")}
        </span>`
      : "";

    return `
      <div class="knockouts-tally-row" aria-hidden="true">
        ${Array.from({ length: groupsOfFive }).map(() => fiveGroup).join("")}
        ${remainderGroup}
      </div>
    `;
  }

  function renderTopStats(playerMap, byKiller, byVictim) {
    const killers = getTotalByKiller(byKiller).sort((a, b) => b.total - a.total);
    const victims = getTotalByVictim(byVictim).sort((a, b) => b.total - a.total);
    const rivalries = getStrongestRivalries(byVictim);

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
    const rivalryMap = new Map();

    Object.entries(byVictim || {}).forEach(([victimSlug, killers]) => {
      Object.entries(killers || {}).forEach(([killerSlug, count]) => {
        const a = String(killerSlug);
        const b = String(victimSlug);
        const key = [a, b].sort().join("__");

        if (!rivalryMap.has(key)) {
          rivalryMap.set(key, {
            slugA: [a, b].sort()[0],
            slugB: [a, b].sort()[1],
            aOverB: 0,
            bOverA: 0,
            total: 0
          });
        }

        const entry = rivalryMap.get(key);

        if (a === entry.slugA && b === entry.slugB) {
          entry.aOverB += Number(count || 0);
        } else if (a === entry.slugB && b === entry.slugA) {
          entry.bOverA += Number(count || 0);
        }

        entry.total = entry.aOverB + entry.bOverA;
      });
    });

    let rivalries = [...rivalryMap.values()]
      .filter(entry => entry.total > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        const aMax = Math.max(a.aOverB, a.bOverA);
        const bMax = Math.max(b.aOverB, b.bOverA);
        if (bMax !== aMax) return bMax - aMax;
        const aNames = `${a.slugA}-${a.slugB}`;
        const bNames = `${b.slugA}-${b.slugB}`;
        return aNames.localeCompare(bNames);
      });

    if (!rivalries.length) {
      return `<div class="knockouts-empty">No rivalry data yet.</div>`;
    }

    const cutoffIndex = Math.min(5, rivalries.length - 1);
    const cutoffTotal = rivalries[cutoffIndex]?.total ?? rivalries[rivalries.length - 1].total;
    rivalries = rivalries.filter((entry, index) => index < 6 || entry.total === cutoffTotal);

    return `
      <div class="knockouts-vendetta-list">
        ${rivalries.map(entry => {
          const playerA = safePlayer(playerMap, entry.slugA);
          const playerB = safePlayer(playerMap, entry.slugB);

          const nameA = playerA?.name || entry.slugA;
          const nameB = playerB?.name || entry.slugB;

          return `
            <div class="knockouts-vendetta-card">
              <div class="knockouts-vendetta-side knockouts-vendetta-side-left">
                <div class="knockouts-vendetta-avatar-wrap">
                  ${avatarMarkup(playerA, "knockouts-avatar-md")}
                  <div class="knockouts-vendetta-hover-name">${nameA}</div>
                </div>
              </div>

              <div class="knockouts-vendetta-scoreline">
                <span class="knockouts-vendetta-score">${entry.aOverB}</span>
                <span class="knockouts-vendetta-vs">vs.</span>
                <span class="knockouts-vendetta-score">${entry.bOverA}</span>
              </div>

              <div class="knockouts-vendetta-side knockouts-vendetta-side-right">
                <div class="knockouts-vendetta-avatar-wrap">
                  ${avatarMarkup(playerB, "knockouts-avatar-md")}
                  <div class="knockouts-vendetta-hover-name">${nameB}</div>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderNemesisBoard(playerMap, byVictim) {
    const board = Object.entries(byVictim || {})
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
        const victimA = safePlayer(playerMap, a.victimSlug)?.name || a.victimSlug;
        const victimB = safePlayer(playerMap, b.victimSlug)?.name || b.victimSlug;
        return victimA.localeCompare(victimB);
      });

    if (!board.length) {
      return `<div class="knockouts-empty">No nemesis board yet.</div>`;
    }

    return `
      <div class="knockouts-nemesis-grid">
        ${board.map(item => {
          const victim = safePlayer(playerMap, item.victimSlug);
          const killer = safePlayer(playerMap, item.killerSlug);

          const victimName = victim?.name || item.victimSlug;
          const killerName = killer?.name || item.killerSlug;

          return `
            <div class="knockouts-nemesis-card">
              <div class="knockouts-nemesis-side">
                <div class="knockouts-nemesis-avatar-wrap">
                  ${avatarMarkup(victim, "knockouts-avatar-md")}
                  <div class="knockouts-nemesis-hover-name">${victimName}</div>
                </div>
              </div>

              <div class="knockouts-nemesis-count-pill">
                ${item.count} x by
              </div>

              <div class="knockouts-nemesis-side knockouts-nemesis-side-right">
                <div class="knockouts-nemesis-avatar-wrap">
                  ${avatarMarkup(killer, "knockouts-avatar-md")}
                  <div class="knockouts-nemesis-hover-name">${killerName}</div>
                </div>
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
        const nameA = safePlayer(playerMap, a.slug)?.name || a.slug;
        const nameB = safePlayer(playerMap, b.slug)?.name || b.slug;
        return nameA.localeCompare(nameB);
      });

    if (!killers.length) {
      return `<div class="knockouts-empty">No knockout ledger yet.</div>`;
    }

    return `
      <div class="knockouts-belt-grid">
        ${killers.map(killerEntry => {
          const killer = safePlayer(playerMap, killerEntry.slug);
          const displayName = killer?.name || killerEntry.slug;

          return `
            <div class="knockouts-belt-tally-card">
              <div class="knockouts-belt-tally-avatar-wrap">
                ${avatarMarkup(killer, "knockouts-avatar-md")}
                <div class="knockouts-belt-hover-name">${displayName}</div>
              </div>

              <div class="knockouts-belt-tally-total">${killerEntry.total}</div>
              ${renderTallyMarks(killerEntry.total)}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  async function loadJsonWithFallback(urls, label) {
    let lastError = null;

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`${label} fetch failed: ${url} (${res.status})`);
        const data = await res.json();
        console.log(`[Knockouts] Loaded ${label} from: ${url}`);
        return data;
      } catch (err) {
        lastError = err;
        console.warn(`[Knockouts] Failed loading ${label} from: ${url}`, err);
      }
    }

    throw lastError || new Error(`Unable to load ${label}`);
  }

  function showKnockoutsError(message) {
    const root = document.getElementById("knockouts-page");
    if (!root) return;

    root.innerHTML = `
      <section class="section knockouts-shell">
        <div class="knockouts-shell-head">
          <h3>⚠️ Knockout data failed to load</h3>
          <p class="muted">The page shell loaded, but the data request failed.</p>
        </div>
        <div class="knockouts-empty">${message}</div>
      </section>
    `;
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
      const siteData = await loadJsonWithFallback(SITE_DATA_URLS, "site data");
      const knockouts = await loadJsonWithFallback(KNOCKOUTS_URLS, "knockouts data");

      if (!Array.isArray(siteData?.players)) {
        throw new Error("site-data.json loaded but players array is missing");
      }

      if (!knockouts?.byVictim || !knockouts?.byKiller) {
        throw new Error("knockouts.json loaded but byVictim/byKiller is missing");
      }

      renderKnockoutCentral(siteData, knockouts);
    } catch (err) {
      console.error("Failed to initialize Knockout Central:", err);
      showKnockoutsError(String(err.message || err));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initKnockoutCentral);
  } else {
    initKnockoutCentral();
  }
})();
