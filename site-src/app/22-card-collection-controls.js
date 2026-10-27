function playerCardCollectionMarkup(player, players, editions, featuredId = "base") {
  const collected = editions || [];
  const featuredEdition = collected.find(edition => edition.id === featuredId) || null;
  const cards = [null, ...collected]
    .map(edition => playerCardCollectibleMarkup(
      player,
      players,
      edition,
      (edition?.id || "base") === featuredId,
      (edition?.id || "base") === featuredId
    ))
    .join("");

  return `
    <section id="player-card-collection" class="tlpt-card-collection" aria-labelledby="tlpt-card-collection-title">
      <header class="tlpt-card-collection-head">
        <div>
          <span>Collectible Career Set</span>
          <h2 id="tlpt-card-collection-title">Ultimate Card Editions</h2>
          <p>Your Rookie Card preserves your first recorded appearance and debut ratings. Earned editions keep their original dates and frozen ratings too. The highest-priority achievement becomes the Active Crew Skin; the Rookie Card never replaces it. Select any card to preview it above.</p>
        </div>
        <strong>${collected.length} Collectible${collected.length === 1 ? "" : "s"} Earned</strong>
      </header>

      <div class="tlpt-card-collection-grid">
        ${cards}
      </div>

      <p class="tlpt-card-collection-status" data-card-collection-status aria-live="polite">
        ${featuredEdition
          ? `Viewing ${featuredEdition.eyebrow}: ${featuredEdition.label}. Active Crew Skin.`
          : `Viewing the Base Edition. Active Crew Skin.${collected.length ? " Select any collectible to preview its frozen historic ratings." : " Special editions unlock automatically as achievements are earned."}`}
      </p>
    </section>
  `;
}

function wirePlayerCardEditionCollection(
  scope,
  player,
  editions,
  ratingController = null,
  initialEditionId = "base"
) {
  const card = scope.querySelector("[data-player-card]");
  const banner = scope.querySelector("[data-card-special-banner]");
  const buttons = [...scope.querySelectorAll("[data-card-edition-select]")];
  if (!card || !banner || !buttons.length) return;

  const collection = editions || [];
  const specialClasses = ["hall", "infamy", "leader", "heater", "milestone", "rookie"]
    .map(className => `tlpt-player-card-special-${className}`);
  const status = scope.querySelector("[data-card-collection-status]");
  const activeCrewSkinId = initialEditionId;
  const activeCrewEdition = collection.find(edition => edition.id === activeCrewSkinId) || null;
  const activeCrewSkinLabel = activeCrewEdition
    ? `${activeCrewEdition.eyebrow}: ${activeCrewEdition.label}`
    : "Base Edition";
  const cardEditionLabel = card.querySelector("[data-card-edition-label]");
  const icon = banner.querySelector("[data-card-special-icon]");
  const eyebrow = banner.querySelector("[data-card-special-eyebrow]");
  const label = banner.querySelector("[data-card-special-label]");
  const reason = banner.querySelector("[data-card-special-reason]");
  const earned = banner.querySelector("[data-card-special-earned]");
  const overallControl = scope.querySelector(".tlpt-card-rating-block[data-card-rating-control]");
  const overall = scope.querySelector("[data-card-overall]");
  const tierCode = scope.querySelector(".tlpt-card-tier-code");
  const liveTierCode = tierCode?.textContent || "—";
  const editionPeriod = scope.querySelector("[data-card-edition]");
  const movement = scope.querySelector("[data-card-movement]");
  const context = scope.querySelector("[data-card-view-context]");
  const caveat = scope.querySelector("[data-card-experience-caveat]");
  card.dataset.liveCardView = card.dataset.cardView || "career";

  const applyHistoricSnapshot = edition => {
    const snapshot = edition?.snapshot;
    if (!snapshot) return false;

    const earnedLabel = playerCardEditionEarnedLabel(edition);
    const snapshotDate = playerCardWindowDate(
      edition?.upgradedDate || edition?.earnedDate
    );
    const snapshotEvent = edition?.upgradeEvent || edition?.earnedEvent || "historical event";
    const historicRaw = `Frozen collectible snapshot from ${snapshotEvent}${snapshotDate ? ` on ${snapshotDate}` : ""}.`;
    const historicFormula = "Historic edition stats, tier and attributes are frozen at issuance or upgrade. OVR uses the current fixed, sample-adjusted scale with those frozen stats; later results do not affect it.";

    card.dataset.historicEdition = edition.id;
    card.dataset.cardView = "historic";
    if (overall) overall.textContent = snapshot.overall;
    if (tierCode) tierCode.textContent = snapshot.tierCode || "—";
    if (editionPeriod) editionPeriod.textContent = "HISTORIC";
    if (context) {
      context.textContent = `${edition.eyebrow}${earnedLabel ? ` • ${earnedLabel}` : ""}`;
    }
    if (caveat) {
      caveat.textContent = `${historicFormula} The Base Edition remains the live career card.`;
    }
    if (movement) {
      movement.hidden = true;
      movement.textContent = "";
      movement.removeAttribute("title");
    }

    scope.querySelectorAll("[data-card-view-control]").forEach(button => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });

    if (overallControl) {
      overallControl.dataset.ratingValue = snapshot.overall;
      overallControl.dataset.ratingRaw = historicRaw;
      overallControl.dataset.ratingFormula = historicFormula;
    }

    (snapshot.attributes || []).forEach(attribute => {
      const control = scope.querySelector(`[data-card-attribute-code="${attribute.code}"]`);
      if (!control) return;
      control.dataset.ratingValue = attribute.value;
      control.dataset.ratingRaw = `${attribute.code} was rated ${attribute.value}. ${historicRaw}`;
      control.dataset.ratingFormula = historicFormula;
      const displayedValue = control.querySelector("strong");
      if (displayedValue) displayedValue.textContent = attribute.value;
    });

    if (overallControl) overallControl.click();
    return true;
  };

  const applyEdition = (editionId, options = {}) => {
    const edition = collection.find(item => item.id === editionId) || null;

    card.classList.remove("tlpt-player-card-special", ...specialClasses);
    [...card.classList]
      .filter(className => className.startsWith("tlpt-player-card-edition-"))
      .forEach(className => card.classList.remove(className));
    delete card.dataset.specialEdition;
    delete card.dataset.historicEdition;
    card.dataset.cardEditionAria = "";

    [...banner.classList]
      .filter(className => (
        className.startsWith("tlpt-card-special-banner-")
        && className !== "tlpt-card-special-banner"
      ))
      .forEach(className => banner.classList.remove(className));

    if (edition) {
      card.classList.add(
        "tlpt-player-card-special",
        `tlpt-player-card-special-${edition.className}`,
        `tlpt-player-card-edition-${playerCardEditionClassName(edition)}`
      );
      card.dataset.specialEdition = edition.id;
      card.dataset.cardEditionAria = ` ${edition.eyebrow}: ${edition.label}. ${edition.reason}`;
      banner.classList.add(`tlpt-card-special-banner-${edition.className}`);
      banner.classList.add(`tlpt-card-special-banner-edition-${playerCardEditionClassName(edition)}`);
      banner.hidden = false;
      if (cardEditionLabel) cardEditionLabel.textContent = edition.cardLabel || edition.label;
      if (icon) icon.textContent = edition.icon;
      if (eyebrow) eyebrow.textContent = edition.eyebrow;
      if (label) label.textContent = edition.label;
      if (reason) reason.textContent = edition.reason;
      const earnedLabel = playerCardEditionEarnedLabel(edition);
      if (earned) {
        earned.hidden = !earnedLabel;
        earned.textContent = earnedLabel ? `Historic Collectible • ${earnedLabel}` : "";
      }
      if (status) {
        const activeCrewSuffix = edition.id === activeCrewSkinId
          ? " Active Crew Skin."
          : ` Active Crew Skin: ${activeCrewSkinLabel}.`;
        status.textContent = `Viewing ${edition.eyebrow}: ${edition.label}.${earnedLabel ? ` ${earnedLabel}.` : ""}${activeCrewSuffix}`;
      }
    } else {
      banner.hidden = true;
      if (cardEditionLabel) cardEditionLabel.textContent = "Base Card";
      if (status) {
        status.textContent = activeCrewSkinId === "base"
          ? "Viewing the Base Edition. Active Crew Skin."
          : `Viewing the Base Edition. Active Crew Skin: ${activeCrewSkinLabel}.`;
      }
      if (earned) {
        earned.hidden = true;
        earned.textContent = "";
      }
    }

    buttons.forEach(button => {
      const isSelected = button.dataset.cardEditionSelect === (edition?.id || "base");
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });

    const isHistoric = applyHistoricSnapshot(edition);
    if (!isHistoric && tierCode) tierCode.textContent = liveTierCode;
    if (!isHistoric && options.restoreView !== false) {
      ratingController?.applyView(card.dataset.liveCardView || "career");
    }

    const viewLabel = isHistoric
      ? "historic collectible"
      : (card.dataset.cardView === "lastFive" ? "last five" : "career");
    const overallValue = scope.querySelector("[data-card-overall]")?.textContent || "";
    card.setAttribute(
      "aria-label",
      `${displayPlayerNamePlain(player)} ${viewLabel} player card. Overall rating ${overallValue}.${card.dataset.cardEditionAria}`
    );
    card.classList.remove("is-edition-changing");
    void card.offsetWidth;
    card.classList.add("is-edition-changing");
  };

  buttons.forEach(button => {
    button.addEventListener("click", () => applyEdition(button.dataset.cardEditionSelect));
  });

  scope.querySelectorAll("[data-card-view-control]").forEach(button => {
    button.addEventListener("click", () => {
      card.dataset.liveCardView = button.dataset.cardViewControl || "career";
      applyEdition("base", { restoreView: false });
    });
  });

  const validInitialEdition = initialEditionId === "base"
    || collection.some(edition => edition.id === initialEditionId);
  applyEdition(validInitialEdition ? initialEditionId : (collection.find(edition => edition.id !== "rookie")?.id || "base"));
}

function wirePlayerCardRatingControls(scope, cardViews, onViewChange) {
  const controls = [...scope.querySelectorAll("[data-card-rating-control]")];
  const explainer = scope.querySelector("#tlpt-card-rating-explainer");
  if (!controls.length || !explainer) return;

  const title = explainer.querySelector("[data-card-rating-title]");
  const value = explainer.querySelector("[data-card-rating-value]");
  const raw = explainer.querySelector("[data-card-rating-raw]");
  const formula = explainer.querySelector("[data-card-rating-formula]");

  const activate = control => {
    controls.forEach(item => {
      const isActive = item === control;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (title) title.textContent = control.dataset.ratingTitle || "Rating";
    if (value) value.textContent = control.dataset.ratingValue || "—";
    if (raw) raw.textContent = control.dataset.ratingRaw || "";
    if (formula) formula.textContent = control.dataset.ratingFormula || "";
  };

  const applyView = viewKey => {
    const view = cardViews?.[viewKey];
    if (!view) return;

    const activeControl = controls.find(control => control.classList.contains("is-active"));
    const activeAttributeCode = activeControl?.dataset.cardAttributeCode || null;
    const overallControl = scope.querySelector(".tlpt-card-rating-block[data-card-rating-control]");
    const card = scope.querySelector("[data-player-card]");
    const overall = scope.querySelector("[data-card-overall]");
    const edition = scope.querySelector("[data-card-edition]");
    const movement = scope.querySelector("[data-card-movement]");
    const context = scope.querySelector("[data-card-view-context]");
    const caveat = scope.querySelector("[data-card-experience-caveat]");

    scope.querySelectorAll("[data-card-view-control]").forEach(button => {
      const isActive = button.dataset.cardViewControl === viewKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (card) {
      card.dataset.cardView = viewKey;
      card.classList.remove("is-view-changing");
      void card.offsetWidth;
      card.classList.add("is-view-changing");
      card.setAttribute(
        "aria-label",
        `${card.dataset.cardPlayerName || "Player"} ${viewKey === "career" ? "career" : "last five"} player card. Overall rating ${view.overall}.${card.dataset.cardEditionAria || ""}`
      );
    }

    if (overall) overall.textContent = view.overall;
    if (edition) edition.textContent = view.edition;
    if (context) context.textContent = view.context;
    if (caveat) {
      const base = caveat.dataset.experienceBase || "";
      caveat.textContent = `${base} ${view.caveat}`.trim();
    }

    if (movement) {
      movement.className = "tlpt-card-movement";
      if (view.movement) {
        movement.hidden = false;
        movement.textContent = view.movement.label;
        movement.title = view.movement.title;
        movement.classList.add(`is-${view.movement.className}`);
      } else {
        movement.hidden = true;
        movement.textContent = "";
        movement.removeAttribute("title");
      }
    }

    if (overallControl) {
      overallControl.dataset.ratingValue = view.overall;
      overallControl.dataset.ratingRaw = view.overallRaw;
      overallControl.dataset.ratingFormula = view.overallFormula;
    }

    view.attributes.forEach(attribute => {
      const control = scope.querySelector(`[data-card-attribute-code="${attribute.code}"]`);
      if (!control) return;
      control.dataset.ratingValue = attribute.value;
      control.dataset.ratingRaw = attribute.raw;
      control.dataset.ratingFormula = attribute.formula;
      const displayedValue = control.querySelector("strong");
      if (displayedValue) displayedValue.textContent = attribute.value;
    });

    const nextActive = activeAttributeCode
      ? scope.querySelector(`[data-card-attribute-code="${activeAttributeCode}"]`)
      : overallControl;
    if (nextActive) activate(nextActive);
    if (typeof onViewChange === "function") onViewChange(viewKey);
  };

  controls.forEach(control => {
    control.addEventListener("click", () => activate(control));
    control.addEventListener("focus", () => activate(control));
    control.addEventListener("mouseenter", () => activate(control));
  });

  scope.querySelectorAll("[data-card-view-control]").forEach(button => {
    button.addEventListener("click", () => applyView(button.dataset.cardViewControl));
  });

  const overallControl = scope.querySelector(".tlpt-card-rating-block[data-card-rating-control]");
  if (overallControl) activate(overallControl);
  if (typeof onViewChange === "function") onViewChange("career");
  return { applyView };
}

