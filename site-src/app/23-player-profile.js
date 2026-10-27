function playerProfileStreakMeta(player, data) {
  const streakData = data?.streaks?.players?.[player?.slug] || {};
  const cashStreak = streakData.currentCashStreak;
  const droughtStreak = streakData.currentDroughtStreak;

  if (cashStreak?.length) {
    return {
      tone: "hot",
      label: "Current Form",
      value: `🔥 ${cashStreak.length}-game cash streak`
    };
  }

  if (droughtStreak?.length) {
    return {
      tone: "cold",
      label: "Current Form",
      value: `🥶 ${droughtStreak.length}-game cash drought`
    };
  }

  return {
    tone: "steady",
    label: "Current Form",
    value: "No active streak"
  };
}

function playerProfileSnapshotMarkup(player, data, primaryArchetype, secondaryArchetype, tierMeta, quote) {
  const streak = playerProfileStreakMeta(player, data);
  const rankValue = tierMeta.rank ? `#${tierMeta.rank}` : "—";
  const rankDetail = tierMeta.rank
    ? `of ${tierMeta.totalRanked} established players`
    : `${tierMeta.status} — Power Rank begins at 5 appearances`;

  const snapshotStats = [
    { label: "Career Profit", value: fmtMoney(player?.profit), className: statValueClass(player, "profit") },
    { label: "ROI", value: fmtPct(player?.roi) },
    { label: "Cash Rate", value: fmtPct(player?.cashRate) },
    { label: "Appearances", value: String(player?.buyIns ?? 0) },
    { label: "Cashes", value: String(player?.timesPlaced ?? 0) },
    { label: "Knockouts", value: String(player?.hits ?? 0) },
    { label: "Bounties Won", value: String(player?.bountiesWon ?? 0) },
    { label: "Bounty Net", value: fmtMoney(player?.bountyNet), className: statValueClass(player, "bountyNet") }
  ];

  return `
    <section class="tlpt-player-summary" aria-labelledby="tlpt-player-summary-title">
      <div class="kicker tlpt-player-summary-kicker">TLPT Ultimate Player Card</div>

      <div class="tlpt-player-summary-title-row">
        <div>
          <h1 id="tlpt-player-summary-title">${displayPlayerName(player)}</h1>
          ${isPlayerAlumni(player) ? '<p class="tlpt-player-summary-quote"><strong>TLPT Alumni</strong> · Away from the table. Still on the record.</p>' : ""}
          <p class="tlpt-player-summary-quote">${quote}</p>
        </div>
      </div>

      <div class="tlpt-player-status-row">
        <div class="tlpt-player-status-card">
          <span>Power Rank</span>
          <strong>${rankValue}</strong>
          <small>${rankDetail}</small>
        </div>

        <div class="tlpt-player-status-card">
          <span>Power Tier</span>
          <strong>${tierMeta.emoji} ${tierMeta.name}</strong>
          <small>${tierMeta.desc}</small>
        </div>

        <div class="tlpt-player-status-card tlpt-player-status-${streak.tone}">
          <span>${streak.label}</span>
          <strong>${streak.value}</strong>
          <small>${tierMeta.status}: ${tierMeta.statusDetail}</small>
        </div>
      </div>

      <div class="tlpt-player-snapshot-grid" aria-label="Career snapshot">
        ${snapshotStats.map(stat => `
          <div class="tlpt-player-snapshot-stat">
            <span>${stat.label}</span>
            <strong class="${stat.className || ""}">${stat.value}</strong>
          </div>
        `).join("")}
      </div>

      <div class="tlpt-player-archetype-pair">
        <div class="tlpt-player-archetype-card primary">
          <span>Primary Archetype</span>
          <strong>${primaryArchetype.emoji} ${primaryArchetype.name}</strong>
          <small>${primaryArchetype.desc}</small>
        </div>

        <div class="tlpt-player-archetype-card secondary">
          <span>Secondary Archetype</span>
          <strong>${secondaryArchetype.emoji} ${secondaryArchetype.name}</strong>
          <small>${secondaryArchetype.desc}</small>
        </div>
      </div>

      <div class="tlpt-player-summary-badges">
        ${badgesMarkup(
          player,
          data,
          (data?.players || []).filter(isCrewEligible)
        )}
      </div>
    </section>
  `;
}

function syncTopPlayerNavigation(prev, next) {
  const previousLink = document.getElementById("player-top-prev");
  const nextLink = document.getElementById("player-top-next");

  if (previousLink && prev) {
    previousLink.href = playerUrl(prev);
    previousLink.textContent = `← Previous: ${displayPlayerNamePlain(prev)}`;
    previousLink.hidden = false;
  }

  if (nextLink && next) {
    nextLink.href = playerUrl(next);
    nextLink.textContent = `Next: ${displayPlayerNamePlain(next)} →`;
    nextLink.hidden = false;
  }
}

function renderPlayerProfile(data) {
  const container = document.getElementById("player-profile");
  if (!container || !data?.players?.length) return;

  const params = new URLSearchParams(window.location.search);
  let requestedName = params.get("name");

  const players = sortPlayers(data.players, "trueSkillScore");

  const normalizeName = (value) => String(value || "").trim().toLowerCase();

  const defaultPlayer =
    players.find(p => normalizeName(p.name) === "bostnmike") || players[0];

  if (!requestedName) {
    requestedName = defaultPlayer.name;
    params.set("name", requestedName);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }

  const player =
    players.find(p => [p.name, p.slug, ...(p.aliases || [])]
      .some(name => normalizeName(name) === normalizeName(requestedName))) ||
    defaultPlayer;

  updatePlayerProfileMetadata(player);

  const index = players.findIndex(p => p.name === player.name);
  const prev = players[(index - 1 + players.length) % players.length];
  const next = players[(index + 1) % players.length];
  syncTopPlayerNavigation(prev, next);
  const quote = ensureQuoted(player?.notes || "");
  const archetypes = getPlayerArchetypes(player);
  const primaryArchetype = archetypes.primary;
  const secondaryArchetype = archetypes.secondary;
  const tierMeta = playerCardTierMeta(player, players);
  const cardViews = playerCardViewData(player, players);
  const specialEditions = playerCardSpecialEditions(player, data);
  const featuredEditionId = playerCardFeaturedEditionId(player, data);
  const specialEdition = playerCardSpecialEdition(player, data);

  const resultPlayer = window.TLPTStats?.players(data.players).find(p => p.slug === player.slug) || player;
  const profileStats = PROFILE_STAT_CONFIG.filter(config => !config.nonzeroOnly || (Number(resultPlayer?.[config.key]) || 0) !== 0).map(config => {
    let valueClass = "";

    if (config.profitClass) {
      valueClass = statValueClass(resultPlayer, config.key);
    } else if (config.profitClassFromValue) {
      valueClass = statValueClass({ profit: resultPlayer?.[config.key] }, "profit");
    }

    return {
      key: config.key,
      label: config.label + (window.TLPTStats && !window.TLPTStats.isFactual(config.key) ? ' (Career)' : ''),
      value: formatProfileStatValue(resultPlayer, config),
      valueClass
    };
  });

  const statsMarkup = profileStats.map(stat => {
    const formula = STAT_FORMULAS[stat.key] || "";
    const accessibleLabel = `${stat.label}: ${stat.value}. ${formula ? `Calculation: ${formula}` : "Calculation not available."}`;

    return `
      <div
        class="profile-stat player-stat-card"
        data-stat-formula="${escapeHtmlAttr(formula)}"
        tabindex="0"
        role="group"
        aria-label="${escapeHtmlAttr(accessibleLabel)}"
      >
        <span class="kicker player-stat-kicker">${statIcon(stat.key)} ${stat.label}</span>
        <div
          class="metric player-stat-metric ${stat.valueClass || ""}"
          data-animate-count="true"
          data-target-value="${stat.value}"
        >${stat.value}</div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="mobile-jump-nav-shell" data-mobile-jump-nav-shell>
      <nav class="player-section-jump-nav" aria-label="Jump to a profile section">
        <a href="#player-overview">Overview</a>
        <a href="#player-card-collection">Editions</a>
        <a href="#player-dna">DNA</a>
        <a href="#player-archetypes">Archetypes</a>
        <a href="#player-stats">Stats</a>
      </nav>
      <span class="mobile-jump-nav-cue" aria-hidden="true">Swipe →</span>
    </div>
    <div class="profile-shell player-profile-shell">
      <div id="player-overview" class="profile-hero profile-hero-wide player-profile-hero">
        ${playerCardMarkup(player, players, primaryArchetype, tierMeta, cardViews, specialEdition)}
        ${playerProfileSnapshotMarkup(
          player,
          data,
          primaryArchetype,
          secondaryArchetype,
          tierMeta,
          quote
        )}
      </div>

      ${playerCardComparisonMarkup(player, players, data)}

      ${playerCardCollectionMarkup(player, players, specialEditions, featuredEditionId)}

      ${playerDnaMarkup(player)}

      ${archetypeMixMarkup(player)}

      <div id="player-formula-display" class="player-formula-display">&nbsp;</div>

            <p class="player-formula-help muted">Mouse over or focus any stat to reveal the calculation.</p>

      <h2 class="stat-results-heading">${window.TLPTStats?.active() ? 'Selected Event Results' : 'All Event Results'}</h2>
      <p class="stat-career-note">${resultPlayer.buyIns} appearance${resultPlayer.buyIns === 1 ? '' : 's'} in this view.${window.TLPTStats?.active() && !resultPlayer.buyIns ? ' This player has no results in the selected events.' : ''} Profile cards, career snapshot, DNA and awards remain career-wide.</p>
      <div id="player-stats" class="profile-grid player-stat-grid-enhanced">
        ${statsMarkup}
      </div>
    </div>
  `;

  wireMobileJumpNavCues(container);

  const comparisonController = wirePlayerCardComparison(container, player, players, data);
  const ratingController = wirePlayerCardRatingControls(
    container,
    cardViews,
    viewKey => comparisonController?.setView(viewKey)
  );
  wirePlayerCardEditionCollection(
    container,
    player,
    specialEditions,
    ratingController,
    featuredEditionId
  );

  const formulaDisplay = document.getElementById("player-formula-display");
  const statCards = container.querySelectorAll("[data-stat-formula]");

    statCards.forEach(card => {
    const formula = card.dataset.statFormula || "";
    const showFormula = () => {
      if (formulaDisplay) formulaDisplay.textContent = formula || "\u00A0";
    };
    const clearFormula = () => {
      if (formulaDisplay) formulaDisplay.innerHTML = "&nbsp;";
    };

    card.addEventListener("mouseenter", showFormula);
    card.addEventListener("focusin", showFormula);
    card.addEventListener("mouseleave", clearFormula);
    card.addEventListener("focusout", clearFormula);
  });

initAnimatedCounters(container);

if (typeof wirePlayerFormulaCards === "function") {
  wirePlayerFormulaCards(container);
}

wireArchetypeMixHover(container);
}
  
