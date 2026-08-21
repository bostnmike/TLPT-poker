/* trophy-room.js
   Isolated renderer for the permanent collectible-card ledger. */

(function () {
  "use strict";

  const state = {
    cards: [],
    type: "all",
    player: "all",
    year: "all",
    sort: "prestige"
  };

  const fixedEditions = {
    "hall-tax-collector": {
      type: "hall",
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Tax Collector",
      cardLabel: "Tax Collector",
      priority: 4,
      order: 0
    },
    "hall-direct-deposit": {
      type: "hall",
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "Direct Deposit",
      cardLabel: "Direct Deposit",
      priority: 4,
      order: 1
    },
    "hall-billing-department": {
      type: "hall",
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Billing Department",
      cardLabel: "Billing Dept.",
      priority: 4,
      order: 2
    },
    "infamy-boy-in-the-bubble": {
      type: "infamy",
      className: "infamy",
      icon: "🔥",
      eyebrow: "Infamy Edition",
      label: "Boy in the Bubble",
      cardLabel: "Infamy",
      priority: 4,
      order: 3
    },
    "leader-profit": {
      type: "leader",
      className: "leader",
      icon: "💰",
      eyebrow: "League Leader Edition",
      label: "Profit Leader",
      cardLabel: "Profit Leader",
      priority: 3,
      order: 10
    },
    "leader-knockouts": {
      type: "leader",
      className: "leader",
      icon: "💥",
      eyebrow: "League Leader Edition",
      label: "Knockout Leader",
      cardLabel: "KO Leader",
      priority: 3,
      order: 11
    },
    "leader-roi": {
      type: "leader",
      className: "leader",
      icon: "📈",
      eyebrow: "League Leader Edition",
      label: "ROI Leader",
      cardLabel: "ROI Leader",
      priority: 3,
      order: 12
    },
    "leader-cash-rate": {
      type: "leader",
      className: "leader",
      icon: "🏧",
      eyebrow: "League Leader Edition",
      label: "Cash-Rate Leader",
      cardLabel: "Cash Leader",
      priority: 3,
      order: 13
    }
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function editionClassName(value) {
    return String(value || "base")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "base";
  }

  function editionMetadata(record) {
    const id = String(record?.id || "");
    if (fixedEditions[id]) return { ...fixedEditions[id], ...record, id };

    if (/^heater-\d+$/.test(id)) {
      const length = Number(record?.streakLength || id.split("-").pop() || 0);
      return {
        type: "heater",
        className: "heater",
        icon: "🔥",
        eyebrow: "Heater Edition",
        label: `${length}-Game Cash Streak`,
        cardLabel: `${length}-Game Heater`,
        priority: 2,
        order: 20,
        ...record,
        id
      };
    }

    if (/^milestone-(10|25|50|75|100)$/.test(id)) {
      const milestone = Number(id.split("-").pop());
      const icons = { 10: "♦", 25: "◈", 50: "◆", 75: "✦", 100: "100" };
      return {
        type: "milestone",
        className: "milestone",
        icon: icons[milestone],
        eyebrow: "Milestone Edition",
        label: `${milestone}-Appearance Club`,
        cardLabel: `${milestone} Club`,
        priority: 1,
        order: 100 - milestone,
        milestone,
        ...record,
        id
      };
    }

    return null;
  }

  function dateParts(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return { year: match[1], month: Number(match[2]), day: Number(match[3]) };
  }

  function shortDate(value) {
    const parts = dateParts(value);
    return parts ? `${parts.month}/${parts.day}/${parts.year.slice(2)}` : "—";
  }

  function initials(name) {
    return String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function flattenCollections(data) {
    const cards = [];

    (data?.players || []).forEach(player => {
      (player?.cardCollection || []).forEach(record => {
        const edition = editionMetadata(record);
        if (!edition?.snapshot) return;

        cards.push({
          ...edition,
          player: {
            name: player.name,
            slug: player.slug,
            image: player.image
          },
          activityDate: edition.upgradedDate || edition.earnedDate,
          year: String(edition.upgradedDate || edition.earnedDate || "").slice(0, 4)
        });
      });
    });

    const rarity = cards.reduce((counts, card) => {
      counts[card.id] = (counts[card.id] || 0) + 1;
      return counts;
    }, {});

    return cards.map(card => ({ ...card, rarityCount: rarity[card.id] || 1 }));
  }

  function earnedLabel(card) {
    const earned = shortDate(card.earnedDate);
    const upgraded = card.upgradedDate ? shortDate(card.upgradedDate) : "";
    return upgraded === "" ? `Earned ${earned}` : `Earned ${earned} • Upgraded ${upgraded}`;
  }

  function rarityLabel(card) {
    const count = Number(card.rarityCount || 1);
    return count === 1 ? "1 in the League" : `${count} in the League`;
  }

  function avatarMarkup(card) {
    const name = escapeHtml(card.player.name);
    const image = escapeHtml(card.player.image);
    const fallback = escapeHtml(initials(card.player.name));

    return `
      <span class="trophy-card-avatar-wrap">
        <img
          src="${image}"
          alt="${name}"
          loading="lazy"
          decoding="async"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
        />
        <span class="trophy-card-avatar-fallback" style="display:none;">${fallback}</span>
      </span>
    `;
  }

  function cardMarkup(card) {
    const snapshot = card.snapshot || {};
    const attributes = snapshot.attributes || [];
    const editionClass = editionClassName(card.id);
    const playerUrl = `player.html?name=${encodeURIComponent(card.player.name)}`;

    return `
      <article
        class="trophy-collection-item trophy-collection-${escapeHtml(card.className)} trophy-collection-edition-${editionClass}"
        data-card-id="${escapeHtml(card.id)}"
      >
        <a
          class="trophy-card trophy-card-${escapeHtml(card.className)} trophy-card-edition-${editionClass}"
          href="${playerUrl}"
          aria-label="${escapeHtml(card.player.name)}, ${escapeHtml(card.label)}, historic rating ${snapshot.overall}. ${escapeHtml(earnedLabel(card))}."
          title="Open ${escapeHtml(card.player.name)}'s Player Profile"
        >
          <span class="trophy-card-inner">
            <span class="trophy-card-metal" aria-hidden="true"></span>

            <span class="trophy-card-header">
              <span class="trophy-card-rating">
                <strong>${Number(snapshot.overall || 0)}</strong>
                <small>${escapeHtml(snapshot.tierCode || "—")}</small>
              </span>

              <span class="trophy-card-edition">
                <small>TLPT</small>
                <strong>${escapeHtml(card.cardLabel)}</strong>
                <em>Historic</em>
              </span>

              <img src="images/site/chip-T-1000.png" alt="" aria-hidden="true" />
            </span>

            <span class="trophy-card-portrait">${avatarMarkup(card)}</span>

            <span class="trophy-card-identity">
              <strong>${escapeHtml(card.player.name)}</strong>
              <small>${escapeHtml(card.icon)} ${escapeHtml(card.label)}</small>
            </span>

            <span class="trophy-card-attributes" aria-label="Frozen historic attributes">
              ${attributes.map(attribute => `
                <span>
                  <strong>${Number(attribute.value || 0)}</strong>
                  <small>${escapeHtml(attribute.code)}</small>
                </span>
              `).join("")}
            </span>

            <span class="trophy-card-earned">${escapeHtml(earnedLabel(card))}</span>
            <span class="trophy-card-suits" aria-hidden="true">♠ <b>♥</b> ♣ <i>♦</i></span>
          </span>
        </a>

        <div class="trophy-card-plaque">
          <div>
            <span>${escapeHtml(card.eyebrow)}</span>
            <strong>${escapeHtml(card.label)}</strong>
          </div>
          <em>${escapeHtml(rarityLabel(card))}</em>
          <p>${escapeHtml(card.reason || "Permanent TLPT collectible.")}</p>
          <small>${escapeHtml(card.earnedEvent || "TLPT Event")}</small>
        </div>
      </article>
    `;
  }

  function sortCards(cards) {
    const sorted = [...cards];

    if (state.sort === "newest") {
      return sorted.sort((a, b) =>
        String(b.activityDate).localeCompare(String(a.activityDate)) ||
        a.player.name.localeCompare(b.player.name)
      );
    }

    if (state.sort === "oldest") {
      return sorted.sort((a, b) =>
        String(a.earnedDate).localeCompare(String(b.earnedDate)) ||
        a.player.name.localeCompare(b.player.name)
      );
    }

    if (state.sort === "rating") {
      return sorted.sort((a, b) =>
        Number(b.snapshot?.overall || 0) - Number(a.snapshot?.overall || 0) ||
        String(b.activityDate).localeCompare(String(a.activityDate))
      );
    }

    if (state.sort === "player") {
      return sorted.sort((a, b) =>
        a.player.name.localeCompare(b.player.name) ||
        Number(b.priority || 0) - Number(a.priority || 0) ||
        Number(a.order || 0) - Number(b.order || 0)
      );
    }

    return sorted.sort((a, b) =>
      Number(b.priority || 0) - Number(a.priority || 0) ||
      Number(a.order || 0) - Number(b.order || 0) ||
      Number(b.snapshot?.overall || 0) - Number(a.snapshot?.overall || 0) ||
      a.player.name.localeCompare(b.player.name)
    );
  }

  function filteredCards() {
    return sortCards(state.cards.filter(card => {
      const matchesType = state.type === "all" || card.type === state.type;
      const matchesPlayer = state.player === "all" || card.player.slug === state.player;
      const matchesYear = state.year === "all" || card.year === state.year;
      return matchesType && matchesPlayer && matchesYear;
    }));
  }

  function render() {
    const grid = document.getElementById("trophy-card-grid");
    const resultCount = document.getElementById("trophy-result-count");
    const empty = document.getElementById("trophy-empty-state");
    if (!grid) return;

    const cards = filteredCards();
    grid.innerHTML = cards.map(cardMarkup).join("");
    if (resultCount) {
      resultCount.textContent = `${cards.length} Card${cards.length === 1 ? "" : "s"} on Display`;
    }
    if (empty) empty.hidden = cards.length > 0;
  }

  function populateSummary() {
    const cards = state.cards;
    const collectors = new Set(cards.map(card => card.player.slug));
    const editions = new Set(cards.map(card => card.id));
    const latest = [...cards].sort((a, b) =>
      String(b.activityDate).localeCompare(String(a.activityDate))
    )[0];

    document.getElementById("trophy-total-cards").textContent = cards.length;
    document.getElementById("trophy-total-collectors").textContent = collectors.size;
    document.getElementById("trophy-total-editions").textContent = editions.size;
    document.getElementById("trophy-latest-card").textContent = latest
      ? shortDate(latest.activityDate)
      : "—";
  }

  function populateFilters() {
    const playerSelect = document.getElementById("trophy-player-filter");
    const yearSelect = document.getElementById("trophy-year-filter");

    const players = [...new Map(
      state.cards.map(card => [card.player.slug, card.player])
    ).values()].sort((a, b) => a.name.localeCompare(b.name));

    if (playerSelect) {
      playerSelect.insertAdjacentHTML(
        "beforeend",
        players.map(player => `
          <option value="${escapeHtml(player.slug)}">${escapeHtml(player.name)}</option>
        `).join("")
      );
    }

    const years = [...new Set(state.cards.map(card => card.year).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a));
    if (yearSelect) {
      yearSelect.insertAdjacentHTML(
        "beforeend",
        years.map(year => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join("")
      );
    }

    const typeCounts = state.cards.reduce((counts, card) => {
      counts.all += 1;
      counts[card.type] = (counts[card.type] || 0) + 1;
      return counts;
    }, { all: 0 });

    document.querySelectorAll("[data-trophy-type]").forEach(button => {
      const count = typeCounts[button.dataset.trophyType] || 0;
      const badge = document.createElement("span");
      badge.textContent = count;
      button.appendChild(badge);

      button.addEventListener("click", () => {
        state.type = button.dataset.trophyType || "all";
        document.querySelectorAll("[data-trophy-type]").forEach(item => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", active ? "true" : "false");
        });
        render();
      });
    });

    playerSelect?.addEventListener("change", () => {
      state.player = playerSelect.value;
      render();
    });
    yearSelect?.addEventListener("change", () => {
      state.year = yearSelect.value;
      render();
    });
    document.getElementById("trophy-sort")?.addEventListener("change", event => {
      state.sort = event.target.value;
      render();
    });
  }

  async function initTrophyRoom() {
    const grid = document.getElementById("trophy-card-grid");

    try {
      const response = await fetch(`/data/generated/site-data.json?v=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`site-data.json returned ${response.status}`);

      const data = await response.json();
      state.cards = flattenCollections(data);
      populateSummary();
      populateFilters();
      render();
    } catch (error) {
      console.error("Trophy Room failed to load:", error);
      if (grid) {
        grid.innerHTML = `
          <div class="trophy-load-error">
            <strong>The Trophy Room vault would not open.</strong>
            <span>Please refresh after the latest site-data update finishes.</span>
          </div>
        `;
      }
      const resultCount = document.getElementById("trophy-result-count");
      if (resultCount) resultCount.textContent = "Collection Unavailable";
    }
  }

  document.addEventListener("DOMContentLoaded", initTrophyRoom);
})();
