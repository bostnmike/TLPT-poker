function playerCardComparisonCandidates(player, players) {
  if (isPlayerUnscouted(player)) return [];

  const currentTier = playerCardTierMeta(player, players);
  const currentRating = playerCardOverallRating(player, players);

  return (players || [])
    .filter(candidate =>
      candidate?.slug !== player?.slug && !isPlayerUnscouted(candidate)
    )
    .sort((a, b) => {
      const aTier = playerCardTierMeta(a, players);
      const bTier = playerCardTierMeta(b, players);
      const aSameStatus = aTier.status === currentTier.status ? 0 : 1;
      const bSameStatus = bTier.status === currentTier.status ? 0 : 1;
      const aDistance = Math.abs(playerCardOverallRating(a, players) - currentRating);
      const bDistance = Math.abs(playerCardOverallRating(b, players) - currentRating);

      return aSameStatus - bSameStatus ||
        aDistance - bDistance ||
        playerCardRatingComparator(players)(a, b);
    });
}

function playerCardComparisonDelta(value, opposingValue) {
  const delta = Math.round(Number(value || 0) - Number(opposingValue || 0));

  if (delta > 0) {
    return {
      value: delta,
      label: `+${delta}`,
      className: "ahead",
      description: `${delta} point${delta === 1 ? "" : "s"} higher`
    };
  }

  if (delta < 0) {
    return {
      value: delta,
      label: String(delta),
      className: "behind",
      description: `${Math.abs(delta)} point${Math.abs(delta) === 1 ? "" : "s"} lower`
    };
  }

  return {
    value: 0,
    label: "EVEN",
    className: "even",
    description: "even"
  };
}

function playerCardComparisonCardMarkup(player, view, opposingView, players, data, sideLabel) {
  const tierMeta = playerCardTierMeta(player, players);
  const archetype = getPlayerArchetypes(player).primary;
  const specialEdition = playerCardSpecialEdition(player, data);
  const specialClass = specialEdition
    ? ` tlpt-compare-card-special tlpt-compare-card-special-${specialEdition.className} tlpt-compare-card-edition-${playerCardEditionClassName(specialEdition)}`
    : "";
  const opposingAttributes = Object.fromEntries(
    opposingView.attributes.map(attribute => [attribute.code, attribute])
  );
  const overallDelta = playerCardComparisonDelta(view.overall, opposingView.overall);
  const rankText = tierMeta.rank
    ? `Power Rank #${tierMeta.rank} of ${tierMeta.totalRanked}`
    : `${tierMeta.status} • Unranked`;

  return `
    <article
      class="tlpt-compare-card tlpt-player-card-${tierMeta.className}${specialClass}"
      data-compare-card-side="${sideLabel}"
      ${specialEdition ? `data-special-edition="${escapeHtmlAttr(specialEdition.id)}"` : ""}
      aria-label="${escapeHtmlAttr(displayPlayerNamePlain(player))}, ${view.edition} rating ${view.overall}. ${overallDelta.description} than the opposing player.${specialEdition ? ` ${specialEdition.eyebrow}: ${specialEdition.label}.` : ""}"
    >
      <div class="tlpt-compare-card-inner">
        <header class="tlpt-compare-card-head">
          <div class="tlpt-compare-overall">
            <strong>${view.overall}</strong>
            <span>${tierMeta.code}</span>
            <em class="is-${overallDelta.className}" title="${escapeHtmlAttr(overallDelta.description)} versus the opposing player">${overallDelta.label}</em>
          </div>
          <div class="tlpt-compare-edition">
            <span>TLPT</span>
            <strong>${specialEdition?.cardLabel || view.edition}</strong>
            ${specialEdition ? `<small>${view.edition}</small>` : ""}
          </div>
          <img class="tlpt-compare-crest" src="images/site/chip-T-1000.png" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="auto" width="46" height="46" />
        </header>

        <div class="tlpt-compare-portrait">
          ${playerImageMarkup(player, "profile", { intrinsicSize: 142 })}
        </div>

        <div class="tlpt-compare-identity">
          <h3>${displayPlayerName(player)}</h3>
          <span>${archetype.emoji} ${archetype.name}</span>
        </div>

        ${specialEdition ? `
          <div class="tlpt-compare-special-tag" title="${escapeHtmlAttr(specialEdition.reason)}">
            <span>${specialEdition.icon}</span>
            <strong>${specialEdition.eyebrow}</strong>
            <small>${specialEdition.label}</small>
          </div>
        ` : `
          <div class="tlpt-compare-special-tag is-empty" aria-hidden="true">
            <span>♦</span>
            <strong>Standard Edition</strong>
            <small>Career Card</small>
          </div>
        `}

        <div class="tlpt-compare-attributes" aria-label="Card attribute comparison">
          ${view.attributes.map(attribute => {
            const opposingAttribute = opposingAttributes[attribute.code];
            const delta = playerCardComparisonDelta(attribute.value, opposingAttribute?.value);
            return `
              <div class="tlpt-compare-attribute">
                <div>
                  <strong>${attribute.value}</strong>
                  <span>${attribute.code}</span>
                </div>
                <small>${attribute.label}</small>
                <em
                  class="is-${delta.className}"
                  title="${escapeHtmlAttr(`${attribute.label}: ${delta.description} than the opposing player`)}"
                >${delta.label}</em>
              </div>
            `;
          }).join("")}
        </div>

        <div class="tlpt-compare-card-context">
          <span>${view.context}</span>
          <strong>${rankText}</strong>
        </div>

        <a class="tlpt-compare-profile-link" href="${playerUrl(player)}">
          View ${escapeHtmlAttr(displayPlayerNamePlain(player))}'s Profile →
        </a>
      </div>
    </article>
  `;
}

function playerCardComparisonMarkup(player, players, data) {
  const candidates = playerCardComparisonCandidates(player, players);
  const opponent = candidates[0];
  if (!opponent) return "";

  const playerViews = playerCardViewData(player, players);
  const opponentViews = playerCardViewData(opponent, players);
  const playerView = playerViews.career;
  const opponentView = opponentViews.career;

  return `
    <section
      id="tlpt-card-comparison"
      class="tlpt-card-compare-overlay"
      data-card-compare-overlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="tlpt-card-comparison-title"
      hidden
    >
      <div class="tlpt-card-compare-dialog">
        <header class="tlpt-card-compare-dialog-head">
          <div>
            <span>TLPT Tale of the Tape</span>
            <h2 id="tlpt-card-comparison-title">Head-to-Head Card Comparison</h2>
          </div>
          <button type="button" data-card-compare-close aria-label="Close player comparison">×</button>
        </header>

        <div class="tlpt-card-compare-controls">
          <label>
            <span>Compare ${escapeHtmlAttr(displayPlayerNamePlain(player))} with</span>
            <select data-card-compare-player>
              ${window.TLPTRoster.options(candidates, candidate => {
                const tierMeta = playerCardTierMeta(candidate, players);
                const rating = playerCardOverallRating(candidate, players);
                return `<option value="${escapeHtmlAttr(candidate.slug)}">${escapeHtmlAttr(displayPlayerNamePlain(candidate))} — ${tierMeta.code} • ${rating}</option>`;
              })}
            </select>
          </label>

          <div class="tlpt-card-compare-period" role="group" aria-label="Comparison time period">
            <button type="button" class="is-active" data-compare-view-control="career" aria-pressed="true">Career</button>
            <button type="button" data-compare-view-control="lastFive" aria-pressed="false">Last Five</button>
          </div>
        </div>

        <p class="tlpt-card-compare-note">
          Both cards use the same period. Green and red markers show the rating-point advantage for that side; official rank and tier remain career-based.
        </p>

        <div class="tlpt-card-compare-arena" data-card-compare-cards aria-live="polite">
          ${playerCardComparisonCardMarkup(player, playerView, opponentView, players, data, "primary")}
          <div class="tlpt-card-compare-versus" aria-hidden="true">VS</div>
          ${playerCardComparisonCardMarkup(opponent, opponentView, playerView, players, data, "opponent")}
        </div>
      </div>
    </section>
  `;
}

function wirePlayerCardComparison(scope, player, players, data) {
  const overlay = scope.querySelector("[data-card-compare-overlay]");
  const openButton = scope.querySelector("[data-card-compare-open]");
  const closeButton = overlay?.querySelector("[data-card-compare-close]");
  const select = overlay?.querySelector("[data-card-compare-player]");
  const cards = overlay?.querySelector("[data-card-compare-cards]");

  if (!overlay || !openButton || !closeButton || !select || !cards) return null;

  const candidates = playerCardComparisonCandidates(player, players);
  const playerViews = playerCardViewData(player, players);
  let viewKey = "career";
  let lastFocused = null;

  const selectedOpponent = () =>
    candidates.find(candidate => candidate.slug === select.value) || candidates[0];

  const render = () => {
    const opponent = selectedOpponent();
    if (!opponent) return;

    const opponentViews = playerCardViewData(opponent, players);
    const playerView = playerViews[viewKey] || playerViews.career;
    const opponentView = opponentViews[viewKey] || opponentViews.career;

    overlay.querySelectorAll("[data-compare-view-control]").forEach(button => {
      const isActive = button.dataset.compareViewControl === viewKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    cards.innerHTML = `
      ${playerCardComparisonCardMarkup(player, playerView, opponentView, players, data, "primary")}
      <div class="tlpt-card-compare-versus" aria-hidden="true">VS</div>
      ${playerCardComparisonCardMarkup(opponent, opponentView, playerView, players, data, "opponent")}
    `;
  };

  const setView = nextViewKey => {
    if (!playerViews[nextViewKey]) return;
    viewKey = nextViewKey;
    render();
  };

  const open = () => {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    openButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("tlpt-compare-open");
    render();
    select.focus({ preventScroll: true });
  };

  const close = () => {
    overlay.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("tlpt-compare-open");
    if (lastFocused?.focus) lastFocused.focus({ preventScroll: true });
  };

  openButton.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  select.addEventListener("change", render);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });

  overlay.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = [...overlay.querySelectorAll("button:not(:disabled), select, a[href]")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  overlay.querySelectorAll("[data-compare-view-control]").forEach(button => {
    button.addEventListener("click", () => {
      const nextViewKey = button.dataset.compareViewControl;
      const mainViewButton = scope.querySelector(`[data-card-view-control="${nextViewKey}"]`);
      if (mainViewButton && !mainViewButton.disabled) {
        mainViewButton.click();
      } else {
        setView(nextViewKey);
      }
    });
  });

  render();
  return { setView };
}

