function buildEventCard(event, data, options = {}) {
  const {
    homeMode = false,
    includeCommissioner = false,
    isActive = true,
    rsvpButtonsMarkup = "",
    eventRsvpOptions = {}
  } = options;

  return `
    <div class="event-card home-event-card home-event-hero compact-event-card${homeMode ? " rotating-home-event-card" : ""}${isActive ? " is-active" : ""}" data-event-day="${escapeHtmlAttr(getEventDayLabel(event))}">
      <div class="event-card-topline">
        <div class="kicker event-title-kicker">${escapeHtmlAttr(event.title)}</div>

        <div class="home-event-top-right">
          <div class="schedule-day-pill">${escapeHtmlAttr(getEventDayLabel(event))}</div>
        </div>
      </div>

      <div class="event-layout-grid">
        <div class="event-details-col">
          <div class="event-format-title">${escapeHtmlAttr(event.format || "")}</div>
          <div class="event-structure">${escapeHtmlAttr(event.structure || "")}</div>
          <h3>${escapeHtmlAttr(event.date)}</h3>
          <p class="muted"><strong>Start:</strong> ${escapeHtmlAttr(event.time)}</p>
          <p class="muted"><strong>Estimated End:</strong> ${escapeHtmlAttr(event.endTime || "")}</p>
          <p class="muted"><strong>Location:</strong> ${escapeHtmlAttr(event.location)}</p>
          <p class="muted">${escapeHtmlAttr(event.address || "")}</p>
          ${eventRsvpForecastMarkup(event, data)}
          ${rsvpButtonsMarkup || buildEventRsvpButtonMarkup(event)}
        </div>

        <div class="event-rsvp-col">
          ${eventRsvpAvatarMarkup(event, data, 9, eventRsvpOptions)}
        </div>
      </div>

      ${includeCommissioner ? `
        <div class="event-commissioner-inline">
          <div class="event-commissioner-inline-title">
            <span class="report-icon">🌶️</span> Hot Takes: The Commissioner's Report
          </div>
          <p class="commissioner-typing-target" data-commissioner-report></p>
        </div>
      ` : ""}
    </div>
  `;
}

function renderHomePage(data) {
  const eventsEl = document.getElementById("home-events-list");

if (eventsEl) {
  const homeEvents = getHomeEvents(data);

  if (SHOW_HOME_COMMISSIONER_REPORT) {
    ensureHomeCommissionerSection();
  }

  if (!homeEvents.length) {
      eventsEl.innerHTML = "";
    } else if (homeEvents.length === 1) {
      eventsEl.innerHTML = `
        <div class="home-event-rotator-shell single-event-week">
          <div class="home-event-rotator-stage">
            <div class="home-event-rotator-panel is-active" aria-hidden="false">
              ${buildHomeEventCard(homeEvents[0], data, homeEvents, 0, 0)}
            </div>
          </div>
        </div>
      `;
    } else {
      const activeIndex = Math.min(Number(eventsEl.querySelector("[data-home-event-panel].is-active")?.dataset.homeEventPanel || 0), homeEvents.length - 1);

      eventsEl.innerHTML = `
        <div class="home-event-rotator-shell multi-event-week">
          <div class="home-event-rotator-stage">
            ${homeEvents.map((event, index) => `
              <div
                class="home-event-rotator-panel${index === activeIndex ? " is-active" : ""}"
                data-home-event-panel="${index}"
                aria-hidden="${index === activeIndex ? "false" : "true"}"
                ${index === activeIndex ? "" : "inert"}
              >
                ${buildHomeEventCard(event, data, homeEvents, activeIndex, index)}
              </div>
            `).join("")}
          </div>
        </div>
      `;

      const rotatorPanels = eventsEl.querySelectorAll("[data-home-event-panel]");
      const rotatorDots = eventsEl.querySelectorAll("[data-home-event-index]");

      let currentIndex = activeIndex;

      function setHomeEventSlide(index, { moveFocus = false } = {}) {
        currentIndex = index;

        rotatorPanels.forEach((panel, panelIndex) => {
          const isActive = panelIndex === index;
          panel.classList.toggle("is-active", isActive);
          panel.setAttribute("aria-hidden", isActive ? "false" : "true");
          panel.inert = !isActive;
        });

        rotatorDots.forEach(dot => {
          const dotIndex = Number(dot.dataset.homeEventIndex || 0);
          const isActive = dotIndex === index;
          dot.classList.toggle("is-active", isActive);
          dot.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        if (moveFocus) {
          window.requestAnimationFrame(() => {
            const activeDot = rotatorPanels[index]?.querySelector(
              `[data-home-event-index="${index}"]`
            );
            activeDot?.focus({ preventScroll: true });
          });
        }
      }

      rotatorDots.forEach(dot => {
        dot.addEventListener("click", () => {
          const nextIndex = Number(dot.dataset.homeEventIndex || 0);
          setHomeEventSlide(nextIndex, { moveFocus: true });
        });
      });

      setHomeEventSlide(activeIndex);
    }
  }

  const allPlayers = data?.players || [];
const leaderStrip = document.getElementById("home-leader-strip");

if (leaderStrip) {
  /*
   * Home page leader cards follow Crew qualification:
   * 3 separate tournament appearances.
   * Rebuys do not count.
   */
  const crewLeaderPool = allPlayers.filter(isCrewEligible);

  const profitLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Profit Leader"],
    crewLeaderPool
  );

  const powerLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Power Leader"],
    crewLeaderPool
  );

  const clutchLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Clutch Leader"],
    crewLeaderPool
  );

  const hitLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Hit King"],
    crewLeaderPool
  );

  leaderStrip.innerHTML = window.TLPTRoster.sections([
    buildHomeStripCard(
      "Profit Leader",
      "💰",
      profitLeader,
      profitLeader ? fmtMoney(profitLeader.profit) : "",
      profitLeader ? statValueClass(profitLeader, "profit") : ""
    ),

    buildHomeStripCard(
      "Power Leader",
      "💪🏼",
      powerLeader,
      powerLeader ? fmtNum(powerLeader.trueSkillScore) : ""
    ),

    buildHomeStripCard(
      "Clutch Leader",
      "🎯",
      clutchLeader,
      clutchLeader ? fmtNum(clutchLeader.clutchIndex) : ""
    ),

    buildHomeStripCard(
      "Knockout King",
      "💥",
      hitLeader,
      hitLeader ? String(hitLeader.hits) : ""
    )
  ], html => html, { playerOf: (_html, index) => [profitLeader, powerLeader, clutchLeader, hitLeader][index] });
}

const badgeCluster = document.getElementById("home-badge-cluster");

if (badgeCluster) {
  const crewBadgePool = allPlayers.filter(isCrewEligible);

  const badges = window.TLPTRoster.sections(HOME_BADGE_CONFIG, config => {
    const leader = getLeaderByRule(
      allPlayers,
      HONOR_RULES[config.rule],
      crewBadgePool
    );

    return leader ? buildHomeBadgeCard(config, leader) : "";
  }, { playerOf: config => getLeaderByRule(allPlayers, HONOR_RULES[config.rule], crewBadgePool) });

  badgeCluster.innerHTML = badges;
}

  /*
  * Keep the home ticker aligned with Crew-page eligibility:
  * 3 separate tournament appearances; rebuys do not count.
  */
  const tickerPlayers = allPlayers.filter(isCrewEligible);
  const ticker = document.getElementById("league-ticker-text");

  if (ticker && tickerPlayers.length) {
    const tickerItems = STAT_LEADER_CONFIG.map(stat => {
      const leader = sortPlayers(tickerPlayers, stat.key)[0];
      if (!leader) return "";
      const statConfig = getStatConfig(stat.key);
      const icon = statConfig?.icon || "🏅";
      return buildTickerLeader(icon, stat.title, leader);
    }).join("");

    ticker.innerHTML = `
      <div class="league-ticker-run">
        ${tickerItems}
      </div>
      <div class="league-ticker-run">
        ${tickerItems}
      </div>
    `;
    }

    const archetypeGuide = document.getElementById("home-archetype-guide");
    if (archetypeGuide) {
      archetypeGuide.innerHTML = buildArchetypeGuideCard();
    }

    const tierGuide = document.getElementById("home-tier-guide");
    if (tierGuide) {
      tierGuide.innerHTML = buildTierGuideCard();
    }

wireHomeFormulaReveal();

  const insightsGrid = document.getElementById("home-insights-grid");
  if (insightsGrid) {
  const crewInsightPool = allPlayers.filter(isCrewEligible);

  const profitLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Profit Leader"],
    crewInsightPool
  );

  const powerLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Power Leader"],
    crewInsightPool
  );

  const clutchLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Clutch Leader"],
    crewInsightPool
  );

  const hitLeader = getLeaderByRule(
    allPlayers,
    HONOR_RULES["Hit King"],
    crewInsightPool
  );
    insightsGrid.innerHTML = window.TLPTRoster.sections([
      profitLeader ? buildHomeInsightCard(
        "Profit Leader",
        "💰",
        profitLeader,
        fmtMoney(profitLeader.profit),
        "",
        "profit",
        statValueClass(profitLeader, "profit")
      ) : "",
      powerLeader ? buildHomeInsightCard(
        "Power Leader",
        "💪🏼",
        powerLeader,
        fmtNum(powerLeader.trueSkillScore),
        "",
        "trueSkillScore",
        ""
      ) : "",
      clutchLeader ? buildHomeInsightCard(
        "Clutch Leader",
        "🎯",
        clutchLeader,
        fmtNum(clutchLeader.clutchIndex),
        "",
        "clutchIndex",
        ""
      ) : "",
      hitLeader ? buildHomeInsightCard(
        "Knockout King",
        "💥",
        hitLeader,
        String(hitLeader.hits ?? 0),
        "",
        "hits",
        ""
      ) : ""
    ], html => html, { playerOf: (_html, index) => [profitLeader, powerLeader, clutchLeader, hitLeader][index] });
  }

  const insightFormula = document.getElementById("home-insight-formula");
if (insightFormula && insightsGrid) {
  const insightCards = [...insightsGrid.querySelectorAll(".home-insight-card")];

  function setInsightState(card) {
    insightCards.forEach(item => item.classList.remove("is-active"));
    if (!card) {
      insightFormula.textContent = "";
      return;
    }
    card.classList.add("is-active");
    insightFormula.textContent = card.dataset.formula || "";
  }

  insightCards.forEach(card => {
    card.addEventListener("mouseenter", () => setInsightState(card));
    card.addEventListener("focus", () => setInsightState(card));
    card.addEventListener("click", () => setInsightState(card));
    card.addEventListener("mouseleave", () => setInsightState(null));
    card.addEventListener("blur", () => setInsightState(null));
  });
}
}
  
function getFeaturedPlayer(data) {
  const players = (data?.players || []).filter(Boolean);
  if (!players.length) return null;

  /*
   * Featured Player should use the same qualification standard
   * as Crew: 3 separate tournament appearances.
   */
  const eligible = players.filter(isCrewEligible);

  const pool = eligible.length ? eligible : players;

  const rotationWindowMs = 12 * 60 * 60 * 1000;
  const rotationIndex = Math.floor(Date.now() / rotationWindowMs) % pool.length;

  return pool[rotationIndex];
}

function buildFeaturedPlayerCard(player, data) {
  if (!player) return "";

  const players = data?.players || [];
  const overall = playerCardOverallRating(player, players);
  const tierMeta = playerCardTierMeta(player, players);
  const primaryArchetype = getPlayerArchetypes(player).primary;
  const attributes = playerCardAttributes(player, players);
  const featuredEditionId = playerCardFeaturedEditionId(player, data);
  const specialEdition = playerCardSpecialEdition(player, data);
  const specialClass = specialEdition
    ? ` crew-ultimate-card-special crew-ultimate-card-special-${specialEdition.className} crew-ultimate-card-edition-${playerCardEditionClassName(specialEdition)}`
    : "";
  const activeCrewSkinLabel = specialEdition
    ? `${specialEdition.eyebrow}: ${specialEdition.label}`
    : "Base Edition";

  return `
    <div class="home-featured-ultimate-shell crew-page">
      <div class="home-featured-ultimate-kicker">🌟 Featured Player</div>

      <div class="home-featured-card-stage">
        <a
          class="crew-ultimate-card crew-ultimate-card-${tierMeta.className} home-featured-ultimate-card${specialClass}"
          href="${playerUrl(player)}"
          data-featured-edition="${escapeHtmlAttr(featuredEditionId)}"
          ${specialEdition ? `data-special-edition="${escapeHtmlAttr(specialEdition.id)}"` : ""}
          aria-label="Open ${displayPlayerNamePlain(player)} profile. Overall rating ${overall}. ${tierMeta.status} ${tierMeta.name}. Active Crew Skin: ${escapeHtmlAttr(activeCrewSkinLabel)}."
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
                <strong>${specialEdition?.shortLabel || "BASE"}</strong>
                ${specialEdition ? `
                  <em title="${escapeHtmlAttr(`Active Crew Skin: ${activeCrewSkinLabel}`)}">
                    ${specialEdition.icon} ${specialEdition.cardLabel || specialEdition.label}
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
          </div>
        </a>

        <div class="home-featured-attributes" aria-label="Featured player card attributes">
          ${attributes.map(attribute => `
            <div
              class="home-featured-attribute"
              title="${escapeHtmlAttr(`${attribute.label}: ${attribute.raw}. ${attribute.formula}`)}"
            >
              <div class="home-featured-attribute-score">
                <strong>${attribute.value}</strong>
                <span>${attribute.code}</span>
              </div>
              <small>${attribute.label}</small>
            </div>
          `).join("")}
        </div>
      </div>

      <a class="home-featured-profile-link" href="${playerUrl(player)}">
        View Full Player Profile →
      </a>
    </div>
  `;
}

function renderLeagueSnapshot(data) {
  const container = document.getElementById("home-snapshot-grid");
  const featuredContainer = document.getElementById("home-featured-player");
  if (!container) return;

  const players = data?.players || [];

  const totalEntries = players.reduce((sum, p) => sum + (Number(p.entries) || 0), 0);
  const totalRebuys = players.reduce((sum, p) => sum + (Number(p.rebuys) || 0), 0);
  const totalEntryFees = players.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);

  const cards = [
    {
      icon:"👥",
      label:"Players Recorded",
      value:players.length,
      className:"snapshot-purple",
      href:"players.html"
    },
    {
      icon:"💰",
      label:"Total Prize & Bounty Pools",
      value:fmtMoney(totalEntryFees),
      valueClass:"money",
      className:"snapshot-green",
      href:"dashboard.html"
    },
    {
      icon:"🎟️",
      label:"Entries",
      value:totalEntries,
      className:"snapshot-silver",
      href:"dashboard.html"
    },
    {
      icon:"♻️",
      label:"Rebuys",
      value:totalRebuys,
      className:"snapshot-blue",
      href:"dashboard.html"
    }
  ];

container.innerHTML = cards.map(card => `
  <a class="snapshot-card ${card.className}" href="${card.href}">
    <div class="snapshot-icon">${card.icon}</div>
    <div
      class="snapshot-value${card.valueClass ? ` ${card.valueClass}` : ""}"
      data-animate-count="true"
      data-target-value="${card.value}"
    >
      ${card.value}
    </div>
    <div class="snapshot-label">${card.label}</div>
    <div class="snapshot-cta">Go deeper →</div>
  </a>
`).join("");
  
    if (featuredContainer) {
    const featuredPlayer = getFeaturedPlayer(data);
    featuredContainer.innerHTML = buildFeaturedPlayerCard(featuredPlayer, data);
  }

  initAnimatedCounters(container.parentElement || document);
}

