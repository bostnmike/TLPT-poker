function crewCardMarkup(player, data) {
  const players = data?.players || [];
  const overall = playerCardOverallRating(player, players);
  const tierMeta = playerCardTierMeta(player, players);
  const attributes = playerCardAttributes(player, players);
  const primaryArchetype = getPlayerArchetypes(player).primary;
  const specialEditions = playerCardSpecialEditions(player, data);
  const featuredEditionId = playerCardFeaturedEditionId(player, data);
  const specialEdition = playerCardSpecialEdition(player, data);
  const specialCollectionLabel = specialEditions
    .map(edition => `${edition.eyebrow}: ${edition.label}`)
    .join("; ");
  const specialClass = specialEdition
    ? ` crew-ultimate-card-special crew-ultimate-card-special-${specialEdition.className} crew-ultimate-card-edition-${playerCardEditionClassName(specialEdition)}`
    : "";

  return `
    <a
      class="crew-ultimate-card crew-ultimate-card-${tierMeta.className}${specialClass}"
      href="${playerUrl(player)}"
      data-featured-edition="${escapeHtmlAttr(featuredEditionId)}"
      ${specialEdition ? `data-special-edition="${escapeHtmlAttr(specialEdition.id)}"` : ""}
      aria-label="Open ${displayPlayerNamePlain(player)} profile. Overall rating ${overall}. ${tierMeta.status} ${tierMeta.name}. Active Crew Skin: ${specialEdition ? `${specialEdition.eyebrow}, ${specialEdition.label}` : "Base Edition"}.${specialEditions.length ? ` ${specialEditions.length} special edition${specialEditions.length === 1 ? "" : "s"} collected: ${specialCollectionLabel}.` : ""}"
    >
      <div class="crew-ultimate-card-inner">
        <div class="crew-ultimate-metal" aria-hidden="true"></div>

        <header class="crew-ultimate-header">
          <div class="crew-ultimate-rating-block">
            <span class="crew-ultimate-overall">${overall}</span>
            <span class="crew-ultimate-tier-code">${tierMeta.code}</span>
          </div>

          <div class="crew-ultimate-edition">
            <span>TLPT</span>
            <strong>CAREER</strong>
            ${specialEdition ? `
              <em title="${escapeHtmlAttr(`Active Crew Skin: ${specialEdition.eyebrow}: ${specialEdition.label} • ${specialEditions.length} collected`)}">
                ${specialEdition.icon} ${specialEdition.shortLabel}${specialEditions.length > 1 ? ` +${specialEditions.length - 1}` : ""}
              </em>
            ` : `
              <em class="is-base-featured" title="Active Crew Skin: Base Edition">♠ BASE</em>
            `}
          </div>

          <img
            class="crew-ultimate-chip"
            src="images/site/chip-T-1000.png"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            fetchpriority="auto"
            width="38"
            height="38"
          />
        </header>

        <div class="crew-ultimate-portrait">
          ${playerImageMarkup(player, "crew")}
        </div>

        <div class="crew-ultimate-identity">
          <h3>${displayPlayerName(player)}</h3>
          <span>${primaryArchetype.emoji} ${primaryArchetype.name}</span>
        </div>

        <div class="crew-ultimate-attributes" aria-label="Player card attributes">
          ${attributes.map(attribute => `
            <div class="crew-ultimate-attribute" title="${attribute.detail}">
              <strong>${attribute.value}</strong>
              <span>${attribute.code}</span>
            </div>
          `).join("")}
        </div>

        <div class="crew-ultimate-footer">
          <span>${isPlayerAlumni(player) ? "Alumni" : "TLPT"}</span>
          <span>${tierMeta.status}</span>
        </div>
      </div>
    </a>
  `;
}

function tierSectionMarkup(title, emoji, players, data, maxTierPower = 1, options = {}) {
  if (!players.length) return "";

  const {
    className = "",
    rangeLabel: customRangeLabel = "",
    headerLabel = "",
    unranked = false
  } = options;

  const avgPower =
    players.reduce((sum, p) => sum + (Number(p.trueSkillScore) || 0), 0) /
    players.length;

  const strengthPct = Math.max(
    12,
    Math.min(100, (avgPower / Math.max(maxTierPower, 0.1)) * 100)
  );

  let rangeLabel = customRangeLabel;
  if (!rangeLabel && title === "The Apex Predators") rangeLabel = " (Top 15%)";
  else if (!rangeLabel && title === "The Table Crushers") rangeLabel = " (15–35%)";
  else if (!rangeLabel && title === "The Shot Makers") rangeLabel = " (35–60%)";
  else if (!rangeLabel && title === "The Gamblers") rangeLabel = " (60–80%)";
  else if (!rangeLabel && title === "The League Sponsors") rangeLabel = " (Bottom 20%)";

  const sectionHeaderLabel = headerLabel || `Avg Power ${fmtNum(avgPower)}`;
  const sectionId = `crew-tier-${String(className || title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
  
  return `
    <div id="${sectionId}" class="tier-section ${className}">
      <div class="tier-section-head">
        <h2>${emoji} ${title}<span class="tier-section-range">${rangeLabel}</span></h2>
        <div class="tier-header-stats">
          ${sectionHeaderLabel}
        </div>
      </div>

      ${unranked ? "" : `<div class="tier-strength">
        <div class="tier-strength-label">Tier Strength</div>
        <div class="tier-strength-bar">
          <div class="tier-strength-fill" style="width:${strengthPct}%"></div>
        </div>
        <div class="tier-strength-pct">${Math.round(strengthPct)}%</div>
      </div>`}

      <div class="tier-grid">
        ${players.map(player => crewCardMarkup(player, data)).join("")}
      </div>
    </div>
  `;
}

function wireMobileJumpNavCues(root = document) {
  root.querySelectorAll("[data-mobile-jump-nav-shell]").forEach(shell => {
    if (shell.dataset.jumpNavCueReady === "true") return;
    const rail = shell.querySelector(".player-section-jump-nav, .crew-tier-jump-nav");
    if (!rail) return;

    const syncCue = () => {
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      shell.classList.toggle("is-scrollable", maxScroll > 2);
      shell.classList.toggle("is-scroll-end", rail.scrollLeft >= maxScroll - 2);
    };

    shell.dataset.jumpNavCueReady = "true";
    rail.addEventListener("scroll", syncCue, { passive: true });
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(syncCue);
      observer.observe(rail);
      rail._tlptJumpNavObserver = observer;
    }
    requestAnimationFrame(syncCue);
  });
}

function crewTierJumpNavMarkup(groups) {
  const availableGroups = groups.filter(group => group.players.length);
  if (availableGroups.length < 2) return "";

  return `
    <div class="mobile-jump-nav-shell" data-mobile-jump-nav-shell>
      <nav class="crew-tier-jump-nav" aria-label="Jump to a crew tier">
        ${availableGroups.map(group => {
          const sectionId = `crew-tier-${String(group.sectionClassName || group.title)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")}`;
          const shortLabel = group.title
            .replace(/^The\s+/i, "")
            .replace(/^(PRO|RKI|UNS)\s+—\s+/i, "");
          return `<a href="#${sectionId}">${group.emoji} ${shortLabel}</a>`;
        }).join("")}
      </nav>
      <span class="mobile-jump-nav-cue" aria-hidden="true">Swipe →</span>
    </div>
  `;
}

function archetypeMeta(name) {
  const map = {
    "Unscouted": { emoji: "🔭", className: "archetype-unscouted" },
    "The Hitman": { emoji: "💥", className: "archetype-hitman" },
    "The Closer": { emoji: "🔒", className: "archetype-closer" },
    "The Grinder": { emoji: "⚙️", className: "archetype-grinder" },
    "The Lucky Devil": { emoji: "😈", className: "archetype-lucky-devil" },
    "The Wildcard": { emoji: "🌀", className: "archetype-wildcard" },
    "The Bubble Magnet": { emoji: "🫧", className: "archetype-bubble-magnet" },
    "The Technician": { emoji: "🧠", className: "archetype-technician" }
  };

  return map[name] || { emoji: "🧍", className: "archetype-unknown" };
}

function groupPlayersByArchetype(players, mode = "primary", ratingPool = players) {
  const groups = new Map();
  const cardRatingSort = playerCardRatingComparator(ratingPool);

  players.forEach(player => {
    const archetypes = getPlayerArchetypes(player);
    const selected = mode === "secondary" ? archetypes.secondary : archetypes.primary;
    const meta = archetypeMeta(selected.name);

    if (!groups.has(selected.name)) {
      groups.set(selected.name, {
        title: selected.name,
        emoji: meta.emoji || selected.emoji,
        className: meta.className,
        desc: selected.desc,
        players: []
      });
    } 

    groups.get(selected.name).players.push(player);
  });

  return [...groups.values()]
    .map(group => ({
      ...group,
      players: group.players.sort(cardRatingSort)
    }))
    .sort((a, b) => b.players.length - a.players.length || a.title.localeCompare(b.title));
}

function archetypeFilterMarkup(groups, activeFilter = "all", mode = "primary", explainer = "") {
  const totalPlayers = groups.reduce((sum, group) => sum + group.players.length, 0);

  return `
    <div class="archetype-visual-card">
      <div class="archetype-visual-head">
        <div class="archetype-visual-head-inline">
          <h2>🫟 Archetype Radar:</h2>
          <p class="archetype-helper-bottom">${explainer}</p>
        </div>
      </div>

      <div class="archetype-mode-toggle" role="group" aria-label="Archetype mode">
        <button
          type="button"
          class="archetype-mode-btn ${mode === "primary" ? "active" : ""}"
          data-archetype-mode="primary"
          aria-pressed="${mode === "primary" ? "true" : "false"}"
          aria-controls="players-visual players-grid"
        >
          Primary
        </button>

        <label
          class="archetype-mode-switch"
          for="archetype-mode-switch-input"
        >
          <input
            id="archetype-mode-switch-input"
            type="checkbox"
            aria-label="Secondary archetypes"
            aria-controls="players-visual players-grid"
            ${mode === "secondary" ? "checked" : ""}
          />
          <span class="archetype-mode-switch-track">
            <span class="archetype-mode-switch-thumb"></span>
          </span>
        </label>

        <button
          type="button"
          class="archetype-mode-btn ${mode === "secondary" ? "active" : ""}"
          data-archetype-mode="secondary"
          aria-pressed="${mode === "secondary" ? "true" : "false"}"
          aria-controls="players-visual players-grid"
        >
          Secondary
        </button>
      </div>

      <div class="archetype-filters-stack">
        <div class="archetype-filter-row" role="group" aria-label="Archetype filter">
          <button
            type="button"
            class="archetype-filter-pill ${activeFilter === "all" ? "active" : ""}"
            data-archetype-filter="all"
            aria-pressed="${activeFilter === "all" ? "true" : "false"}"
            aria-controls="players-visual players-grid"
          >
            View All
            <span>${totalPlayers}</span>
          </button>

          ${groups.map(group => `
            <button
              type="button"
              class="archetype-filter-pill ${activeFilter === group.title ? "active" : ""} ${group.className}"
              data-archetype-filter="${group.title}"
              aria-pressed="${activeFilter === group.title ? "true" : "false"}"
              aria-controls="players-visual players-grid"
            >
              ${group.emoji} ${group.title}
              <span>${group.players.length}</span>
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function archetypeSectionMarkup(group, data) {
  if (!group.players.length) return "";

  return `
    <div class="tier-section archetype-section ${group.className}">
      <div class="tier-section-head">
        <h2>${group.emoji} ${group.title}</h2>
        <div class="tier-header-stats">${group.players.length} player${group.players.length === 1 ? "" : "s"}</div>
      </div>

      <p class="muted archetype-section-copy">${group.desc}</p>

      <div class="tier-grid">
        ${group.players.map(player => crewCardMarkup(player, data)).join("")}
        </div>
    </div>
  `;
}

function tierDistributionMarkup(groups) {
  const maxCount = Math.max(...groups.map(group => group.players.length), 1);

  return `
    <div class="tier-distribution">
      <div class="tier-distribution-head">
        <h2>🎖️  Tier Distribution</h2>
      </div>

      <div class="tier-distribution-list">
        ${groups.map(group => {
          const count = group.players.length;
          const pct = Math.max(8, (count / maxCount) * 100);

          return `
            <div class="tier-distribution-row">
              <div class="tier-distribution-label">${group.emoji} ${group.title}</div>
              <div class="tier-distribution-bar">
                <div class="tier-distribution-fill ${group.className}" style="width:${pct}%"></div>
              </div>
              <div class="tier-distribution-count">${count}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

