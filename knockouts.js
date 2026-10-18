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

  function avatarIntrinsicSize(sizeClass) {
    if (sizeClass === "knockouts-avatar-lg") return 68;
    if (sizeClass === "knockouts-avatar-sm") return 40;
    return 72;
  }

  function avatarMarkup(player, sizeClass = "knockouts-avatar-md") {
    if (!player) {
      return `<div class="knockouts-avatar-fallback ${sizeClass}" aria-hidden="true">?</div>`;
    }

    const image = player.image || "";
    const name = player.name || "Unknown";
    const initials = getInitials(name);
    const intrinsicSize = avatarIntrinsicSize(sizeClass);

    if (!image) {
      return `<div class="knockouts-avatar-fallback ${sizeClass}" aria-hidden="true">${initials}</div>`;
    }

    return `
      <img
        class="knockouts-avatar ${sizeClass}"
        src="${image}"
        alt="${name}"
        loading="lazy"
        decoding="async"
        width="${intrinsicSize}"
        height="${intrinsicSize}"
        data-image-error-action="replace-with-next"
      />
      <div class="knockouts-avatar-fallback ${sizeClass}" aria-hidden="true" hidden>${initials}</div>
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

    const leaders = [mostKnockouts?.slug, mostBusted?.slug, biggestBully?.killerSlug, mostUniqueVictims?.slug];
    return window.TLPTRoster.sections(html, card => card, { playerOf: (_card, index) => playerMap.get(leaders[index]) });
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
        ${window.TLPTRoster.sections(rivalries, entry => {
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
        }, { playerOf: entry => [playerMap.get(entry.slugA), playerMap.get(entry.slugB)].find(window.TLPTRoster.isAlumni), alumniLabel: "Rivalries involving alumni" })}
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
        ${window.TLPTRoster.sections(board, item => {
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
        }, { playerOf: item => playerMap.get(item.victimSlug) })}
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
        ${window.TLPTRoster.sections(killers, killerEntry => {
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
        }, { playerOf: item => playerMap.get(item.slug) })}
      </div>
    `;
  }

  function formatMoney(value) {
    const amount = Number(value || 0);
    const sign = amount < 0 ? "-" : "";
    return `${sign}$${Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  }

  function bountyValueClass(value) {
    const amount = Number(value || 0);
    if (amount > 0) return " is-positive";
    if (amount < 0) return " is-negative";
    return "";
  }

  function hasBountyData(players) {
    return players.some(player => [
      "bountiesWon", "bountyPaid", "bountyCollected", "bountyRetained",
      "bountyWinnings", "bountyNet"
    ].some(key => Math.abs(Number(player?.[key] || 0)) > 0));
  }

  function bountyLeader(players, key) {
    return [...players]
      .filter(player => Math.abs(Number(player?.[key] || 0)) > 0)
      .sort((a, b) =>
        Number(b?.[key] || 0) - Number(a?.[key] || 0)
        || String(a?.name || "").localeCompare(String(b?.name || ""))
      )[0] || null;
  }

  function renderBountySummary(players) {
    const mostWon = bountyLeader(players, "bountiesWon");
    const bestNet = bountyLeader(players, "bountyNet");
    const mostCollected = bountyLeader(players, "bountyCollected");
    const mostRetained = bountyLeader(players, "bountyRetained");

    return window.TLPTRoster.sections([
      renderStatCard({
        label: "Most Bounties Won",
        player: mostWon,
        value: mostWon ? String(mostWon.bountiesWon) : "—",
        subtext: "Eligible bounties collected"
      }),
      renderStatCard({
        label: "Best Bounty Net",
        player: bestNet,
        value: bestNet ? formatMoney(bestNet.bountyNet) : "—",
        subtext: "Returns minus bounty money posted"
      }),
      renderStatCard({
        label: "Most Money Collected",
        player: mostCollected,
        value: mostCollected ? formatMoney(mostCollected.bountyCollected) : "—",
        subtext: "Opponent bounties only"
      }),
      renderStatCard({
        label: "Most Money Retained",
        player: mostRetained,
        value: mostRetained ? formatMoney(mostRetained.bountyRetained) : "—",
        subtext: "Own unclaimed bounty returned"
      })
    ], card => card, { playerOf: (_card, index) => [mostWon, bestNet, mostCollected, mostRetained][index] });
  }

  function renderBountyLedger(players) {
    const rows = [...players]
      .filter(player => [
        "bountiesWon", "bountyPaid", "bountyCollected", "bountyRetained",
        "bountyWinnings", "bountyNet"
      ].some(key => Math.abs(Number(player?.[key] || 0)) > 0))
      .sort((a, b) =>
        Number(b.bountiesWon || 0) - Number(a.bountiesWon || 0)
        || Number(b.bountyNet || 0) - Number(a.bountyNet || 0)
        || String(a.name || "").localeCompare(String(b.name || ""))
      );

    return `
      <div class="knockouts-bounty-ledger-grid">
        ${window.TLPTRoster.sections(rows, player => `
          <a class="knockouts-bounty-ledger-card" href="player.html?name=${encodeURIComponent(player.name || "")}">
            <div class="knockouts-bounty-ledger-player">
              ${avatarMarkup(player, "knockouts-avatar-md")}
              <div>
                <strong>${player.name || player.slug}</strong>
                <span>${Number(player.bountiesWon || 0)} ${Number(player.bountiesWon || 0) === 1 ? "bounty" : "bounties"}</span>
              </div>
            </div>
            <dl class="knockouts-bounty-ledger-stats">
              <div><dt>Collected</dt><dd>${formatMoney(player.bountyCollected)}</dd></div>
              <div><dt>Retained</dt><dd>${formatMoney(player.bountyRetained)}</dd></div>
              <div><dt>Posted</dt><dd>${formatMoney(player.bountyPaid)}</dd></div>
              <div><dt>Net</dt><dd class="${bountyValueClass(player.bountyNet).trim()}">${formatMoney(player.bountyNet)}</dd></div>
            </dl>
          </a>
        `)}
      </div>
    `;
  }

  function shortEventDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${Number(match[2])}/${Number(match[3])}/${match[1].slice(2)}` : String(value || "");
  }

  function renderBountyClaims(playerMap, claims) {
    if (!claims.length) {
      return `<div class="knockouts-empty">No verified killer-to-victim bounty claims are available yet.</div>`;
    }

    return `
      <div class="knockouts-bounty-claims">
        ${[...claims].reverse().map(claim => {
          const killer = safePlayer(playerMap, claim.killer);
          const victim = safePlayer(playerMap, claim.victim);
          return `
            <div class="knockouts-bounty-claim-card">
              <div class="knockouts-bounty-claim-player">
                ${avatarMarkup(killer, "knockouts-avatar-sm")}
                <span><strong>${killer?.name || claim.killer}</strong><small>claimed</small></span>
              </div>
              <div class="knockouts-bounty-claim-value">
                <strong>${formatMoney(claim.amount)}</strong>
                <span>${shortEventDate(claim.eventId)}</span>
              </div>
              <div class="knockouts-bounty-claim-player is-victim">
                ${avatarMarkup(victim, "knockouts-avatar-sm")}
                <span><strong>${victim?.name || claim.victim}</strong><small>${claim.victimEntry ? `entry #${Number(claim.victimEntry)} bounty` : "first-entry bounty"}</small></span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderBountyView(players, playerMap, knockouts) {
    if (!hasBountyData(players)) {
      return `
        <section class="section knockouts-shell knockouts-bounty-empty-state">
          <div class="knockouts-bounty-empty-icon" aria-hidden="true">🏷️</div>
          <h2>Bounty board awaiting its first claims</h2>
          <p>The first MTT bounty results will open this view automatically. Bounty money has its own ledger and counts toward overall profit.</p>
        </section>
      `;
    }

    const claims = knockouts?.bounties?.claims || [];
    return `
      <section class="section knockouts-shell">
        <div class="knockouts-shell-head knockouts-shell-head-leaders">
          <h2>🏷️ Bounty Leaders</h2>
          <p class="muted">Eligible bounty claims only. Every claim also remains one ordinary knockout.</p>
        </div>
        <div class="knockouts-summary-grid">${renderBountySummary(players)}</div>
      </section>

      <section class="section knockouts-shell">
        <div class="knockouts-shell-head">
          <h2>💰 Career Bounty Ledger</h2>
          <p class="muted">Prize-pool payouts and bounty returns stay separate. Overall take-home and profit include both; retained bounties offset the original bounty cost.</p>
        </div>
        ${renderBountyLedger(players)}
      </section>

      <section class="section knockouts-shell">
        <div class="knockouts-shell-head">
          <h2>✅ Verified Bounty Claims</h2>
          <p class="muted">Who captured whose bounty, checked against the event’s entry rules and Tournament Director totals. Forfeited bounties become winner-only prize money, not bounty claims.</p>
        </div>
        ${renderBountyClaims(playerMap, claims)}
      </section>
    `;
  }

  function initProgressiveCollection(hostSelector, itemSelector, initialCount, label) {
    const host = document.querySelector(hostSelector);
    const items = host ? [...host.querySelectorAll(itemSelector)] : [];
    if (!host || items.length <= initialCount) return;
    // Keep both membership sections visible rather than orphaning an Alumni heading.
    if (host.querySelector("[data-roster-section='alumni']")) return;

    items.slice(initialCount).forEach(item => {
      item.hidden = true;
    });

    const controls = document.createElement("div");
    controls.className = "knockouts-progressive-controls";
    controls.innerHTML = `
      <button class="btn" type="button">Show All ${items.length} ${label}</button>
    `;
    controls.querySelector("button")?.addEventListener("click", () => {
      items.forEach(item => {
        item.hidden = false;
      });
      controls.remove();
    });
    host.appendChild(controls);
  }

  function initProgressiveKnockoutLists() {
    initProgressiveCollection("#knockouts-nemesis-board", ".knockouts-nemesis-card", 8, "Nemeses");
    initProgressiveCollection("#knockouts-body-count-ledger", ".knockouts-belt-tally-card", 12, "Players");
    initProgressiveCollection("#knockouts-bounty-view", ".knockouts-bounty-ledger-card", 12, "Bounty Hunters");
    initProgressiveCollection("#knockouts-bounty-view", ".knockouts-bounty-claim-card", 10, "Claims");
  }

  function initKnockoutViewSwitch(root) {
    const buttons = [...root.querySelectorAll("[data-knockouts-view]")];
    const panels = [...root.querySelectorAll("[data-knockouts-panel]")];
    if (!buttons.length || !panels.length || root.dataset.viewSwitchReady === "true") return;

    root.dataset.viewSwitchReady = "true";
    buttons.forEach(button => {
      button.addEventListener("click", () => {
        const view = button.dataset.knockoutsView;
        buttons.forEach(item => {
          const active = item.dataset.knockoutsView === view;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        panels.forEach(panel => {
          const active = panel.dataset.knockoutsPanel === view;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });
      });
    });
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

  function showKnockoutsError() {
    const root = document.getElementById("knockouts-page");
    if (!root) return;

    root.innerHTML = `
      <section class="section knockouts-shell" role="alert">
        <div class="knockouts-shell-head">
          <h2>⚠️ Knockout data failed to load</h2>
          <p class="muted">The latest knockout results couldn’t be loaded. Check your connection and try again.</p>
        </div>
        <div class="hero-actions">
          <button class="btn active" type="button" data-knockouts-retry>Try Again</button>
        </div>
      </section>
    `;

    root.querySelector("[data-knockouts-retry]")?.addEventListener("click", () => {
      window.location.reload();
    });
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
    const bountyViewHost = document.getElementById("knockouts-bounty-view");

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

    if (bountyViewHost) {
      bountyViewHost.innerHTML = renderBountyView(players, playerMap, knockouts);
    }

    initProgressiveKnockoutLists();
    initKnockoutViewSwitch(root);
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
      showKnockoutsError();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initKnockoutCentral);
  } else {
    initKnockoutCentral();
  }
})();
