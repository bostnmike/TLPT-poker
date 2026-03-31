/* player-knockouts.js */
(() => {
  const KNOCKOUTS_URL = "knockouts.json";
  const SITE_DATA_URL = "site-data.json";

  function getRequestedPlayerName() {
    const params = new URLSearchParams(window.location.search);
    return params.get("name") || "";
  }

  function slugifyName(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function findPlayerByRequest(players, requestedName) {
    if (!requestedName) return players[0] || null;
    return players.find(p => String(p.name || "") === String(requestedName)) || players[0] || null;
  }

  function buildPlayerMap(players) {
    const bySlug = new Map();
    players.forEach(player => {
      if (player?.slug) bySlug.set(String(player.slug), player);
    });
    return bySlug;
  }

  function getInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function avatarMarkup(player, sizeClass = "") {
    if (!player) {
      return `
        <div class="knockout-avatar-fallback ${sizeClass}" aria-hidden="true">?</div>
      `;
    }

    const image = player.image || "";
    const name = player.name || "Unknown";
    const initials = getInitials(name);

    if (!image) {
      return `
        <div class="knockout-avatar-fallback ${sizeClass}" aria-hidden="true">${initials}</div>
      `;
    }

    return `
      <img
        class="knockout-avatar ${sizeClass}"
        src="${image}"
        alt="${name}"
        onerror="this.outerHTML='<div class=&quot;knockout-avatar-fallback ${sizeClass}&quot; aria-hidden=&quot;true&quot;>${initials}</div>';"
      />
    `;
  }

  function getTopEntry(countMap) {
    const entries = Object.entries(countMap || {});
    if (!entries.length) return null;

    entries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return String(a[0]).localeCompare(String(b[0]));
    });

    const [slug, count] = entries[0];
    return { slug, count };
  }

  function sortBodyCountEntries(countMap) {
    return Object.entries(countMap || {})
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.slug).localeCompare(String(b.slug));
      });
  }

function nemesisMarkup(currentPlayer, byVictim, playerMap) {
  const victimMap = byVictim?.[currentPlayer.slug] || {};
  const top = getTopEntry(victimMap);
  const subtitle = "The player who’s bounced you most often, and living rent free in your head with every check, raise.";

  if (!top) {
    return `
      <div class="player-nemesis-card">
        <div class="player-nemesis-head">
          <h3>🥊 Meet Your Table Nemesis</h3>
          <p class="muted">${subtitle}</p>
        </div>

        <div class="player-nemesis-empty muted">
          No recurring executioner… yet.
        </div>
      </div>
    `;
  }

  const nemesis = playerMap.get(top.slug);
  const displayName = nemesis?.name || top.slug;

  return `
    <div class="player-nemesis-card">
      <div class="player-nemesis-head">
        <h3>🥊 Meet Your Table Nemesis</h3>
        <p class="muted">${subtitle}</p>
      </div>

      <div class="player-nemesis-body">
        <div class="player-nemesis-avatar-wrap">
          ${avatarMarkup(nemesis, "knockout-avatar-lg")}
        </div>

        <div class="player-nemesis-copy">
          <div class="player-nemesis-name">${displayName}</div>
          <div class="player-nemesis-count">${top.count} ${top.count === 1 ? "Knock-Out" : "Knock-Outs"}</div>
        </div>
      </div>
    </div>
  `;
}
  
 function bodyCountMarkup(currentPlayer, byKiller, playerMap) {
  const killerMap = byKiller?.[currentPlayer.slug] || {};
  const victims = sortBodyCountEntries(killerMap);
  const totalHits = victims.reduce((sum, entry) => sum + Number(entry.count || 0), 0);

  if (!victims.length) {
    return `
      <div class="player-body-count-card">
        <div class="player-body-count-head">
          <h3>💀 Your Body Count 0</h3>
          <p class="muted">Everybody you’ve sent to the rail, and just how often you are making it a habit.</p>
        </div>

        <div class="player-body-count-empty muted">
          No confirmed victims on the board yet.
        </div>
      </div>
    `;
  }

  return `
    <div class="player-body-count-card">
      <div class="player-body-count-head">
        <h3>💀 Your Body Count ${totalHits}</h3>
        <p class="muted">Everybody you’ve sent to the rail.</p>
      </div>

      <div class="player-body-count-list">
        ${victims.map(({ slug, count }) => {
          const victim = playerMap.get(slug);
          const displayName = victim?.name || slug;

          return `
            <div class="player-body-count-tile">
              ${avatarMarkup(victim, "knockout-avatar-sm")}
              <div class="player-body-count-tile-name">${displayName}</div>
              <div class="player-body-count-tile-number">${count}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

  function injectKnockoutCards(currentPlayer, knockouts, players) {
    const profileRoot = document.getElementById("player-profile");
    if (!profileRoot) return;

    const profileShell = profileRoot.querySelector(".player-profile-shell");
    const dnaCard = profileRoot.querySelector(".player-dna-card");
    const statGrid = profileRoot.querySelector(".profile-grid.player-stat-grid-enhanced");
    if (!profileShell || !dnaCard || !statGrid) return;

    const existingTopWrap = profileRoot.querySelector(".player-dna-nemesis-wrap");
    if (existingTopWrap) existingTopWrap.remove();

    const existingBodyCount = profileRoot.querySelector(".player-body-count-card");
    if (existingBodyCount) existingBodyCount.remove();

    const playerMap = buildPlayerMap(players);

    const topWrap = document.createElement("div");
    topWrap.className = "player-dna-nemesis-wrap";

    dnaCard.parentNode.insertBefore(topWrap, dnaCard);
    topWrap.appendChild(dnaCard);

    const nemesisHost = document.createElement("div");
    nemesisHost.className = "player-nemesis-host";
    nemesisHost.innerHTML = nemesisMarkup(currentPlayer, knockouts.byVictim || {}, playerMap);
    topWrap.appendChild(nemesisHost);

    const bodyCountHost = document.createElement("div");
    bodyCountHost.innerHTML = bodyCountMarkup(currentPlayer, knockouts.byKiller || {}, playerMap);
    statGrid.insertAdjacentElement("afterend", bodyCountHost.firstElementChild);
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    return await res.json();
  }

  function waitForProfileShell(maxAttempts = 120, delay = 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const timer = setInterval(() => {
        attempts += 1;

        const profileShell = document.querySelector("#player-profile .player-profile-shell");
        const dnaCard = document.querySelector("#player-profile .player-dna-card");
        const statGrid = document.querySelector("#player-profile .profile-grid.player-stat-grid-enhanced");

        if (profileShell && dnaCard && statGrid) {
          clearInterval(timer);
          resolve(true);
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(timer);
          reject(new Error("Player profile shell did not render in time."));
        }
      }, delay);
    });
  }

  async function initPlayerKnockouts() {
    try {
      await waitForProfileShell();

      const [siteData, knockouts] = await Promise.all([
        loadJson(SITE_DATA_URL),
        loadJson(KNOCKOUTS_URL)
      ]);

      const players = Array.isArray(siteData?.players) ? siteData.players : [];
      if (!players.length) return;

      const requestedName = getRequestedPlayerName();
      const currentPlayer = findPlayerByRequest(players, requestedName);
      if (!currentPlayer?.slug) return;

      injectKnockoutCards(currentPlayer, knockouts || {}, players);
    } catch (err) {
      console.warn("Knockout profile enhancement skipped:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayerKnockouts);
  } else {
    initPlayerKnockouts();
  }
})();
