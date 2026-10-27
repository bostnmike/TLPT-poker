function playerCardExperienceMeta(player, tierMeta) {
  const appearances = Number(player?.buyIns ?? 0);

  if (appearances <= 0) {
    return {
      className: "unscouted",
      eyebrow: "UNSCOUTED",
      progressNow: 0,
      progressMax: 1,
      progressLabel: "Awaiting first TLPT appearance",
      milestone: "1 appearance to activate Rookie ratings",
      caveat: "Unscouted. Ratings and archetypes begin after the first TLPT appearance; no benchmark score is assigned before then."
    };
  }

  if (appearances < CREW_PROVISIONAL_MIN_BUY_INS) {
    const target = CREW_PROVISIONAL_MIN_BUY_INS;
    return {
      className: "rookie",
      eyebrow: "RKI Sample Status",
      progressNow: appearances,
      progressMax: target,
      progressLabel: `${appearances} of ${target} appearances to PRO`,
      milestone: `${target - appearances} more ${target - appearances === 1 ? "appearance" : "appearances"} to unlock Provisional status`,
      caveat: "Ratings reflect actual career results. RKI identifies a limited sample and remains unranked until five appearances."
    };
  }

  if (appearances < CREW_ESTABLISHED_MIN_BUY_INS) {
    const target = CREW_ESTABLISHED_MIN_BUY_INS;
    return {
      className: "provisional",
      eyebrow: "PRO Sample Status",
      progressNow: appearances,
      progressMax: target,
      progressLabel: `${appearances} of ${target} appearances to Established`,
      milestone: `${target - appearances} more ${target - appearances === 1 ? "appearance" : "appearances"} to unlock Power Rank and an S–D tier`,
      caveat: "Ratings reflect actual career results. PRO identifies a developing sample and does not receive an official Power Rank."
    };
  }

  return {
    className: "established",
    eyebrow: "Established Sample",
    progressNow: CREW_ESTABLISHED_MIN_BUY_INS,
    progressMax: CREW_ESTABLISHED_MIN_BUY_INS,
    progressLabel: `${appearances} career appearances`,
    milestone: tierMeta.rank
      ? `Official Power Rank #${tierMeta.rank} of ${tierMeta.totalRanked}`
      : "Eligible for official Power Rank and S–D tiers",
    caveat: "Ratings reflect actual career results and compare this player with the established TLPT benchmark pool."
  };
}

function playerCardMarkup(player, players, primaryArchetype, tierMeta, cardViews, specialEdition) {
  const careerView = cardViews?.career || playerCardViewData(player, players).career;
  const hasLastFive = Boolean(cardViews?.lastFive);
  const overall = careerView.overall;
  const attributes = careerView.attributes;
  const experience = playerCardExperienceMeta(player, tierMeta);
  const overallRaw = careerView.overallRaw;
  const overallFormula = careerView.overallFormula;
  const specialClass = specialEdition
    ? ` tlpt-player-card-special tlpt-player-card-special-${specialEdition.className} tlpt-player-card-edition-${playerCardEditionClassName(specialEdition)}`
    : "";
  const progressPct = Math.max(
    0,
    Math.min(100, (experience.progressNow / Math.max(experience.progressMax, 1)) * 100)
  );

  return `
    <div class="tlpt-card-stage">
      <div class="tlpt-card-view-bar">
        <div class="tlpt-card-view-actions">
          <div class="tlpt-card-view-switch" role="group" aria-label="Player card time period">
            <button
              type="button"
              class="is-active"
              data-card-view-control="career"
              aria-pressed="true"
            >Career</button>
            <button
              type="button"
              data-card-view-control="lastFive"
              aria-pressed="false"
              ${hasLastFive ? "" : "disabled"}
            >Last Five</button>
          </div>
          <button
            type="button"
            class="tlpt-card-compare-open"
            data-card-compare-open
            aria-controls="tlpt-card-comparison"
            aria-expanded="false"
          >Compare Player</button>
        </div>
        <p data-card-view-context>${careerView.context}</p>
      </div>

      <svg class="tlpt-card-shape-defs" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="tlpt-player-card-shape" clipPathUnits="objectBoundingBox">
            <path d="M 0,.14 C .09,.12 .17,.075 .28,.035 C .34,.015 .38,.018 .41,.048 C .435,.074 .468,.055 .5,0 C .532,.055 .565,.074 .59,.048 C .62,.018 .66,.015 .72,.035 C .83,.075 .91,.12 1,.14 L 1,.84 C 1,.9 .84,.93 .7,.955 L .5,1 L .3,.955 C .16,.93 0,.9 0,.84 Z"></path>
          </clipPath>
        </defs>
      </svg>

      <article
        class="tlpt-player-card tlpt-player-card-${tierMeta.className}${specialClass}"
        data-player-card
        data-card-player-name="${escapeHtmlAttr(displayPlayerNamePlain(player))}"
        data-card-edition-aria="${specialEdition ? escapeHtmlAttr(` ${specialEdition.eyebrow}: ${specialEdition.label}. ${specialEdition.reason}`) : ""}"
        ${specialEdition ? `data-special-edition="${escapeHtmlAttr(specialEdition.id)}"` : ""}
        aria-label="${displayPlayerNamePlain(player)} career player card. Overall rating ${overall}.${specialEdition ? ` ${specialEdition.eyebrow}: ${specialEdition.label}. ${specialEdition.reason}` : ""}"
      >
        <div class="tlpt-player-card-inner">
          <div class="tlpt-player-card-pattern" aria-hidden="true"></div>

          <header class="tlpt-card-header">
            <button
              type="button"
              class="tlpt-card-rating-block is-active"
              data-card-rating-control
              data-rating-title="OVR — Overall"
              data-rating-value="${overall}"
              data-rating-raw="${escapeHtmlAttr(overallRaw)}"
              data-rating-formula="${escapeHtmlAttr(overallFormula)}"
              aria-controls="tlpt-card-rating-explainer"
              aria-pressed="true"
              title="Explain the Overall rating"
            >
              <span class="tlpt-card-overall" data-card-overall>${overall}</span>
              <span class="tlpt-card-tier-code">${tierMeta.code}</span>
            </button>

            <div class="tlpt-card-edition">
              <span>TLPT</span>
              <strong data-card-edition-label>${specialEdition?.cardLabel || "Base Card"}</strong>
              <small data-card-edition>${careerView.edition}</small>
              <em data-card-movement hidden></em>
            </div>

            <div class="tlpt-card-crest-wrap">
              <img
                class="tlpt-card-crest"
                src="images/site/chip-T-1000.png"
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                fetchpriority="auto"
                width="56"
                height="56"
              />
            </div>
          </header>

          <div class="tlpt-card-portrait">
            ${playerImageMarkup(player, "profile", {
              intrinsicSize: 210,
              loading: "eager",
              fetchPriority: "high"
            })}
          </div>

          <div class="tlpt-card-identity">
            <div class="tlpt-card-player-name">${displayPlayerName(player)}</div>
            <div class="tlpt-card-archetype">${primaryArchetype.emoji} ${primaryArchetype.name}</div>
          </div>

          <div class="tlpt-card-attributes" aria-label="Player card attributes">
            ${attributes.map(attribute => `
              <button
                type="button"
                class="tlpt-card-attribute"
                data-card-rating-control
                data-card-attribute-code="${attribute.code}"
                data-rating-title="${escapeHtmlAttr(`${attribute.code} — ${attribute.label}`)}"
                data-rating-value="${attribute.value}"
                data-rating-raw="${escapeHtmlAttr(attribute.raw)}"
                data-rating-formula="${escapeHtmlAttr(attribute.formula)}"
                aria-controls="tlpt-card-rating-explainer"
                aria-pressed="false"
                title="Explain ${escapeHtmlAttr(attribute.label)}"
              >
                <strong>${attribute.value}</strong>
                <span>${attribute.code}</span>
                <small>${attribute.label}</small>
              </button>
            `).join("")}
          </div>

          <div class="tlpt-card-footer-mark" aria-hidden="true">
            <span>♠</span><span>♥</span><span>♣</span><span>♦</span>
          </div>
        </div>
      </article>

      <div
        class="tlpt-card-special-banner${specialEdition ? ` tlpt-card-special-banner-${specialEdition.className} tlpt-card-special-banner-edition-${playerCardEditionClassName(specialEdition)}` : ""}"
        data-card-special-banner
        ${specialEdition ? "" : "hidden"}
      >
          <span data-card-special-icon aria-hidden="true">${specialEdition?.icon || "♦"}</span>
          <div>
            <strong data-card-special-eyebrow>${specialEdition?.eyebrow || "Special Edition"}</strong>
            <b data-card-special-label>${specialEdition?.label || "Career Card"}</b>
            <small data-card-special-reason>${specialEdition?.reason || ""}</small>
            <em
              data-card-special-earned
              ${playerCardEditionEarnedLabel(specialEdition) ? "" : "hidden"}
            >${playerCardEditionEarnedLabel(specialEdition) ? `Historic Collectible • ${playerCardEditionEarnedLabel(specialEdition)}` : ""}</em>
          </div>
      </div>

      <section class="tlpt-card-experience tlpt-card-experience-${experience.className}" aria-label="Card experience status">
        <div class="tlpt-card-experience-head">
          <span>${experience.eyebrow}</span>
          <strong>${experience.progressLabel}</strong>
        </div>
        <div
          class="tlpt-card-experience-track"
          role="progressbar"
          aria-label="${escapeHtmlAttr(experience.progressLabel)}"
          aria-valuemin="0"
          aria-valuemax="${experience.progressMax}"
          aria-valuenow="${experience.progressNow}"
        >
          <span style="width:${progressPct}%"></span>
        </div>
        <p>${experience.milestone}</p>
        <small
          data-card-experience-caveat
          data-experience-base="${escapeHtmlAttr(experience.caveat)}"
        >${experience.caveat} ${careerView.caveat}</small>
      </section>

      <section
        id="tlpt-card-rating-explainer"
        class="tlpt-card-rating-explainer"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="tlpt-card-rating-explainer-head">
          <span>Rating Breakdown</span>
          <strong data-card-rating-title>OVR — Overall</strong>
          <b data-card-rating-value>${overall}</b>
        </div>
        <p data-card-rating-raw>${overallRaw}</p>
        <small data-card-rating-formula>${overallFormula}</small>
        <em>Choose the overall score or any attribute on the card to see its live calculation.</em>
      </section>
    </div>
  `;
}

function playerCardCollectibleMarkup(
  player,
  players,
  edition,
  isSelected = false,
  isFeatured = false
) {
  const liveTierMeta = playerCardTierMeta(player, players);
  const snapshot = edition?.snapshot || null;
  const tierMeta = snapshot
    ? {
        ...liveTierMeta,
        code: snapshot.tierCode || liveTierMeta.code,
        className: snapshot.tierClassName || liveTierMeta.className,
        status: snapshot.tierStatus || liveTierMeta.status
      }
    : liveTierMeta;
  const overall = snapshot?.overall ?? playerCardOverallRating(player, players);
  const attributes = snapshot?.attributes || playerCardAttributes(player, players);
  const collectible = edition || {
    id: "base",
    className: "base",
    icon: "♠",
    eyebrow: "Base Edition",
    label: "Live Career Card",
    cardLabel: "Base Card",
    shortLabel: "BASE",
    reason: "The live career card using the player's current official tier finish."
  };
  const specialClass = edition
    ? ` tlpt-player-card-special tlpt-player-card-special-${edition.className} tlpt-player-card-edition-${playerCardEditionClassName(edition)}`
    : "";
  const earnedLabel = playerCardEditionEarnedLabel(edition);

  return `
    <button
      type="button"
      class="tlpt-card-collectible-button tlpt-player-card-${tierMeta.className}${specialClass}${isSelected ? " is-selected" : ""}${isFeatured ? " is-featured" : ""}"
      data-card-edition-select="${escapeHtmlAttr(collectible.id)}"
      data-card-featured-on-crew="${isFeatured ? "true" : "false"}"
      aria-pressed="${isSelected ? "true" : "false"}"
      aria-label="View ${escapeHtmlAttr(collectible.eyebrow)}, ${escapeHtmlAttr(collectible.label)}. ${earnedLabel ? `${escapeHtmlAttr(earnedLabel)}. ` : ""}${escapeHtmlAttr(collectible.reason)}"
      title="${escapeHtmlAttr(collectible.reason)}"
    >
      <span class="tlpt-card-collectible-frame" aria-hidden="true">
        <span class="tlpt-card-collectible-inner">
          <span class="tlpt-card-collectible-pattern"></span>

          <span class="tlpt-card-collectible-head">
            <span class="tlpt-card-collectible-rating">
              <strong>${overall}</strong>
              <small>${tierMeta.code}</small>
            </span>
            <span class="tlpt-card-collectible-edition">
              <small>TLPT</small>
              <strong>${collectible.shortLabel}</strong>
            </span>
            <img src="images/site/chip-T-1000.png" alt="" loading="lazy" decoding="async" fetchpriority="auto" width="28" height="28" />
          </span>

          <span class="tlpt-card-collectible-portrait">
            ${playerImageMarkup(player, "profile", { intrinsicSize: 88 })}
          </span>

          <span class="tlpt-card-collectible-name">${displayPlayerName(player)}</span>

          <span class="tlpt-card-collectible-stats">
            ${attributes.map(attribute => `
              <span><strong>${attribute.value}</strong><small>${attribute.code}</small></span>
            `).join("")}
          </span>

          <span class="tlpt-card-collectible-stamp">
            <b>${collectible.icon}</b>
            <strong>${collectible.label}</strong>
          </span>
        </span>
      </span>

      <span class="tlpt-card-collectible-caption">
        <strong>${collectible.eyebrow}</strong>
        <small>${collectible.label}</small>
        ${earnedLabel ? `<em>${earnedLabel}</em>` : ""}
      </span>
      <span class="tlpt-card-collectible-selected">Viewing</span>
      ${isFeatured ? `<span class="tlpt-card-collectible-featured" title="Automatically selected as this player's highest-priority earned Crew skin">Active Crew Skin</span>` : ""}
    </button>
  `;
}

