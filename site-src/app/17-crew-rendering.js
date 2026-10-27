function renderPlayers(data) {
  const grid = document.getElementById("players-grid");
  const visual = document.getElementById("players-visual");
  const helpCopy = document.getElementById("players-help-copy");
  const explainer = document.getElementById("players-explainer");
  const tierBtn = document.getElementById("crew-view-tier");
  const archetypeBtn = document.getElementById("crew-view-archetype");
  const crewViewSwitch = document.getElementById("crew-view-switch-input");

  if (tierBtn) {
    const isActive = currentCrewView === "tier";
    tierBtn.classList.toggle("active", isActive);
    tierBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
  if (archetypeBtn) {
    const isActive = currentCrewView === "archetype";
    archetypeBtn.classList.toggle("active", isActive);
    archetypeBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
  if (crewViewSwitch) crewViewSwitch.checked = currentCrewView === "archetype";

  if (!grid || !data?.players) return;
  window.TLPTCrewMap?.destroy();
  document.querySelectorAll('[data-crew-display]').forEach(button => {
    const active = button.dataset.crewDisplay === currentCrewDisplay;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const grouping = document.querySelector('.crew-view-toolbar');
  if (grouping) grouping.hidden = currentCrewDisplay === 'map';

  document.querySelectorAll("[data-crew-roster]").forEach(button => {
    const selected = button.dataset.crewRoster === currentCrewRoster;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
    const count = button.querySelector("[data-roster-count]");
    if (count) count.textContent = String(crewRosterPlayers(data.players, button.dataset.crewRoster).length);
  });
  const rosterNote = document.getElementById("crew-roster-note");
  if (rosterNote) rosterNote.textContent = currentCrewRoster === "alumni"
    ? "Away from the table. Still on the record. Always welcome back."
    : currentCrewRoster === "all"
      ? "The whole league, past and present. Career ratings and history stay together."
      : "The regular lineup. Alumni remain part of TLPT and are always welcome back.";

  const searchedRosterPlayers = crewRosterPlayers(data.players, currentCrewRoster)
    .filter(player => {
      if (!currentCrewSearch) return true;
      const haystack = `${player?.name || ""} ${player?.slug || ""}`.toLowerCase();
      return haystack.includes(currentCrewSearch);
    })
    .sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a));
  renderCrewCounts(searchedRosterPlayers, data);
  const matchingRosterPlayers = searchedRosterPlayers.filter(player => currentCrewTier === 'all' || crewCountTier(player, data.players) === currentCrewTier);
  const rankedRosterPlayers = matchingRosterPlayers.filter(isCrewEstablished);
  const developingRosterPlayers = matchingRosterPlayers.filter(player => !isCrewEstablished(player));
  const rosterPlayers = currentCrewDisplay === 'cards' && currentCrewTier === 'all' && currentCrewRoster === "active" && currentCrewView === "tier" && !currentCrewSearch
    ? [
        ...rankedRosterPlayers,
        ...developingRosterPlayers.slice(0, currentCrewVisibleCount)
      ].sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a))
    : matchingRosterPlayers;

  const searchStatus = document.getElementById("crew-search-status");
  if (searchStatus) {
    searchStatus.textContent = currentCrewSearch
      ? `${rosterPlayers.length} player${rosterPlayers.length === 1 ? "" : "s"} found`
      : currentCrewView === "tier" && rosterPlayers.length < matchingRosterPlayers.length
        ? `Showing all ${rankedRosterPlayers.length} ranked players; ${Math.max(rosterPlayers.length - rankedRosterPlayers.length, 0)} of ${developingRosterPlayers.length} developing players`
        : `Showing all ${matchingRosterPlayers.length} players`;
  }

  if (currentCrewDisplay === 'map' && window.TLPTCrewMap) {
    if (helpCopy) helpCopy.hidden = true;
    if (visual) { visual.innerHTML = ''; visual.hidden = true; }
    const points = crewMapPoints(matchingRosterPlayers, data.players);
    if (searchStatus) searchStatus.textContent = `${points.length} established players on the map; ${matchingRosterPlayers.length - points.length} developing players available in Cards`;
    window.TLPTCrewMap.render(grid, points, crewMapPoints(data.players, data.players), matchingRosterPlayers.length - points.length, () => {
      currentCrewDisplay = 'cards';
      currentCrewVisibleCount = developingRosterPlayers.length;
      renderPlayers(data);
    });
    return;
  }

  if (!rosterPlayers.length) {
    if (visual) visual.innerHTML = "";
    grid.innerHTML = `
      <div class="crew-search-empty" role="status">
        <strong>No player matches that search.</strong>
        <span>${currentCrewRoster === "active" ? "Try All Players to include alumni, or check the spelling." : "Try another name or choose All Players."}</span>
      </div>
    `;
    return;
  }

  if (currentCrewView === "archetype") {
    if (visual) visual.hidden = false;
    const archetypeGroups = groupPlayersByArchetype(rosterPlayers, currentArchetypeMode, data.players);
    const filteredGroups = currentArchetypeFilter === "all"
      ? archetypeGroups
      : archetypeGroups.filter(group => group.title === currentArchetypeFilter);

    if (helpCopy) {
      helpCopy.hidden = false;
      helpCopy.textContent = "Your primary & secondary brands of trouble.";
    }

    if (explainer) {
      explainer.hidden = true;
      explainer.textContent = "";
    }

    if (visual) {
      const archetypeExplainer = currentArchetypeMode === "primary"
        ? "Primary Archetype = Your loudest (perhaps most annoying) table style."
        : "Secondary Archetype = Your backup chaos, hiding underneath, - mostly when you're bluffing.";

      visual.innerHTML = archetypeFilterMarkup(
        archetypeGroups,
        currentArchetypeFilter,
        currentArchetypeMode,
        archetypeExplainer
      );
    }

    grid.innerHTML = window.TLPTRoster.sections(filteredGroups.flatMap(group => group.players), null, {
      renderGroup: members => filteredGroups.map(group => archetypeSectionMarkup({
        ...group, players: group.players.filter(player => members.includes(player))
      }, data)).join("")
    });

    document.querySelectorAll("[data-archetype-filter]").forEach(button => {
      button.addEventListener("click", () => {
        currentArchetypeFilter = button.dataset.archetypeFilter || "all";
        renderPlayers(data);
      });
    });

    document.querySelectorAll("[data-archetype-mode]").forEach(button => {
      button.addEventListener("click", () => {
        currentArchetypeMode = button.dataset.archetypeMode || "primary";
        currentArchetypeFilter = "all";
        renderPlayers(data);
      });
    });

    const archetypeModeSwitch = document.getElementById("archetype-mode-switch-input");
    if (archetypeModeSwitch) {
      archetypeModeSwitch.checked = currentArchetypeMode === "secondary";

      archetypeModeSwitch.addEventListener("change", () => {
        currentArchetypeMode = archetypeModeSwitch.checked ? "secondary" : "primary";
        currentArchetypeFilter = "all";
        renderPlayers(data);
      });
    }

    return;
  }

  const apexPredators = [];
  const tableCrushers = [];
  const shotMakers = [];
  const gamblers = [];
  const leagueSponsors = [];
  const cardRatingSort = playerCardRatingComparator(data.players);
  const allViewAlumni = currentCrewRoster === "all" ? rosterPlayers.filter(isPlayerAlumni).sort(cardRatingSort) : [];
  const tierRoster = currentCrewRoster === "all" ? rosterPlayers.filter(player => !isPlayerAlumni(player)) : rosterPlayers;
  const unscoutedPlayers = tierRoster
    .filter(isPlayerUnscouted)
    .sort(cardRatingSort);
  const fieldPlayers = tierRoster.filter(isCrewVisible);
  const provisionalPlayers = fieldPlayers
    .filter(isCrewProvisional)
    .sort(cardRatingSort);
  const rookiePlayers = fieldPlayers
    .filter(isCrewRookie)
    .sort(cardRatingSort);
  const establishedPlayers = fieldPlayers.filter(isCrewEstablished);

  establishedPlayers.forEach(player => {
    const tier = getPlayerTier(player, data.players);

    if (tier.name === "The Apex Predator") {
      apexPredators.push(player);
    } else if (tier.name === "The Table Crusher") {
      tableCrushers.push(player);
    } else if (tier.name === "The Shot Maker") {
      shotMakers.push(player);
    } else if (tier.name === "The Gambler") {
      gamblers.push(player);
    } else {
      leagueSponsors.push(player);
    }
  });

  apexPredators.sort(cardRatingSort);
  tableCrushers.sort(cardRatingSort);
  shotMakers.sort(cardRatingSort);
  gamblers.sort(cardRatingSort);
  leagueSponsors.sort(cardRatingSort);

  const tierAveragePower = group =>
    group.length
      ? group.reduce((sum, p) => sum + (Number(p.trueSkillScore) || 0), 0) / group.length
      : 0;

  const maxTierPower = Math.max(
    tierAveragePower(apexPredators),
    tierAveragePower(tableCrushers),
    tierAveragePower(shotMakers),
    tierAveragePower(gamblers),
    tierAveragePower(leagueSponsors),
    1
  );

  const tierGroups = [
    { title: "The Apex Predators", emoji: "🦈", players: apexPredators, className: "apex-predators" },
    { title: "The Table Crushers", emoji: "⚔️", players: tableCrushers, className: "table-crushers" },
    { title: "The Shot Makers", emoji: "☄️", players: shotMakers, className: "shot-makers" },
    { title: "The Gamblers", emoji: "🎲", players: gamblers, className: "gamblers" },
    { title: "The League Sponsors", emoji: "🍣", players: leagueSponsors, className: "league-sponsors" },
    { title: "PRO — Provisional", emoji: "🧪", players: provisionalPlayers, className: "provisionals", sectionClassName: "tier-section-provisional" },
    { title: "RKI — Rookie", emoji: "🌱", players: rookiePlayers, className: "rookies", sectionClassName: "tier-section-rookie" },
    { title: "UNS — Unscouted", emoji: "🔭", players: unscoutedPlayers, className: "unscouted", sectionClassName: "tier-section-unscouted" },
    { title: "Alumni", emoji: "♠", players: allViewAlumni, className: "alumni", sectionClassName: "alumni" }
  ];

  if (helpCopy) {
    helpCopy.textContent = "";
    helpCopy.hidden = true;
  }

  if (explainer) {
    explainer.textContent = "";
    explainer.hidden = true;
  }

  if (visual) { visual.innerHTML = ''; visual.hidden = true; }

  grid.innerHTML = `
    ${tierSectionMarkup("The Apex Predators", "🦈", apexPredators, data, maxTierPower)}
    ${tierSectionMarkup("The Table Crushers", "⚔️", tableCrushers, data, maxTierPower)}
    ${tierSectionMarkup("The Shot Makers", "☄️", shotMakers, data, maxTierPower)}
    ${tierSectionMarkup("The Gamblers", "🎲", gamblers, data, maxTierPower)}
    ${tierSectionMarkup("The League Sponsors", "🍣", leagueSponsors, data, maxTierPower)}
    ${tierSectionMarkup(
      "PRO — Provisional",
      "🧪",
      provisionalPlayers,
      data,
      maxTierPower,
      {
        className: "tier-section-provisional",
        rangeLabel: " (3–4 Appearances)",
        headerLabel: `${provisionalPlayers.length} Unranked`,
        unranked: true
      }
    )}
    ${tierSectionMarkup(
      "RKI — Rookie",
      "🌱",
      rookiePlayers,
      data,
      maxTierPower,
      {
        className: "tier-section-rookie",
        rangeLabel: " (1–2 Appearances)",
        headerLabel: `${rookiePlayers.length} In the Field`,
        unranked: true
      }
    )}
    ${tierSectionMarkup(
      "UNS — Unscouted",
      "🔭",
      unscoutedPlayers,
      data,
      maxTierPower,
      {
        className: "tier-section-unscouted",
        rangeLabel: " (0 Appearances)",
        headerLabel: `${unscoutedPlayers.length} Awaiting Debut`,
        unranked: true
      }
    )}
  `;

  wireMobileJumpNavCues(grid);

  if (allViewAlumni.length) {
    grid.insertAdjacentHTML("beforeend", tierSectionMarkup("Alumni", "♠", allViewAlumni, data, maxTierPower, {
      className: "alumni", rangeLabel: " · Always welcome back", headerLabel: `${allViewAlumni.length} players`, unranked: true
    }));
  }

  if (rosterPlayers.length < matchingRosterPlayers.length) {
    grid.insertAdjacentHTML("beforeend", `
      <div class="crew-progressive-controls">
        <button class="btn" type="button" data-crew-load-more>
          Show Provisional, Rookie &amp; Unscouted
        </button>
      </div>
    `);
    grid.querySelector("[data-crew-load-more]")?.addEventListener("click", () => {
      currentCrewVisibleCount = developingRosterPlayers.length;
      renderPlayers(data);
    });
  }
}

