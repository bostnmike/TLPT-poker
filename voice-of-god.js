"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const PAGE_SIZE = 24;
  const DATA_URL = "data/voice-of-god.json?v=20260909-11";
  const PLAYER_DATA_URL = "data/player-metadata.json?v=20260907-1";
  const CORRECTIONS_URL = "data/voice-of-god-corrections.json?v=20260909-11";

  const audio = document.querySelector("#vog-audio");
  const currentTitle = document.querySelector("#vog-now-playing-title");
  const currentId = document.querySelector("#vog-current-id");
  const currentVictims = document.querySelector("#vog-current-victims");
  const currentTranscript = document.querySelector("#vog-current-transcript");
  const currentTags = document.querySelector("#vog-current-tags");
  const searchInput = document.querySelector("#vog-search");
  const playerFilter = document.querySelector("#vog-player-filter");
  const categoryFilter = document.querySelector("#vog-category-filter");
  const sortSelect = document.querySelector("#vog-sort");
  const filterForm = document.querySelector("#vog-filters");
  const resultCount = document.querySelector("#vog-result-count");
  const clipGrid = document.querySelector("#vog-clip-grid");
  const emptyState = document.querySelector("#vog-empty");
  const loadMore = document.querySelector("#vog-load-more");
  const status = document.querySelector("#vog-status");
  const previousButton = document.querySelector("#vog-previous");
  const nextButton = document.querySelector("#vog-next");
  const randomButton = document.querySelector("#vog-random");

  if (
    !audio || !currentTitle || !currentId || !currentVictims || !currentTranscript || !currentTags ||
    !searchInput || !playerFilter || !categoryFilter || !sortSelect || !filterForm ||
    !resultCount || !clipGrid || !emptyState || !loadMore || !status ||
    !previousButton || !nextButton || !randomButton
  ) {
    return;
  }

  let allClips = [];
  let filteredClips = [];
  let visibleCount = PAGE_SIZE;
  let currentClipId = "";
  let playerProfiles = new Map();

  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const categoryLabel = category => category === "league-wide" ? "League-wide" : "Roast";

  const specialPlayerLabels = new Map([
    ["deckmate", "DeckMate"],
    ["nasa-al", "NASA Al"],
  ]);

  const playerLabel = slug => specialPlayerLabels.get(slug) || playerProfiles.get(slug)?.name || slug
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const formatDuration = seconds => {
    const rounded = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(rounded / 60);
    return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
  };

  const searchableText = clip => [
    clip.id,
    clip.transcript,
    ...(clip.keywords || []),
    ...(clip.aliasesDetected || []),
    ...(clip.canonicalPlayersMentioned || []).map(playerLabel),
  ].join(" ").toLowerCase();

  const matchesQuery = (clip, query) => {
    if (!query) return true;
    const haystack = searchableText(clip);
    if (/^[a-z0-9]+$/.test(query) && query.length <= 4) {
      return (haystack.match(/[a-z0-9]+/g) || []).includes(query);
    }
    return haystack.includes(query);
  };

  const renderCurrentTags = clip => {
    const players = (clip.canonicalPlayersMentioned || []).map(slug => (
      `<span class="vog-tag">${escapeHtml(playerLabel(slug))}</span>`
    ));
    players.push(`<span class="vog-tag vog-tag-category">${escapeHtml(categoryLabel(clip.category))}</span>`);
    currentTags.innerHTML = players.join("");
  };

  const initialsFor = name => name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");

  const renderCurrentVictims = clip => {
    const slugs = clip.canonicalPlayersMentioned || [];
    if (!slugs.length) {
      currentVictims.innerHTML = '<span class="vog-victim vog-victim-league">♠ Entire League</span>';
      return;
    }

    currentVictims.innerHTML = slugs.map(slug => {
      if (slug === "deckmate") {
        return '<span class="vog-victim vog-victim-league vog-victim-deckmate"><span aria-hidden="true">♣</span> DeckMate</span>';
      }
      const profile = playerProfiles.get(slug) || {};
      const name = profile.name || playerLabel(slug);
      const image = profile.image || `images/players/${slug}.jpg`;
      return `
        <span class="vog-victim">
          <span class="vog-victim-portrait">
            <img class="vog-victim-image" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="eager" decoding="async" data-image-error-action="replace-with-next">
            <span class="vog-victim-fallback" hidden aria-hidden="true">${escapeHtml(initialsFor(name))}</span>
          </span>
          <span class="vog-victim-name">${escapeHtml(name)}</span>
        </span>
      `;
    }).join("");
  };

  const selectClip = (clip, play = false) => {
    if (!clip) return;
    currentClipId = clip.id;
    currentTitle.textContent = (clip.canonicalPlayersMentioned || []).length
      ? (clip.canonicalPlayersMentioned || []).map(playerLabel).join(" + ")
      : "League-wide bulletin";
    currentId.textContent = `#${clip.id}`;
    currentTranscript.textContent = clip.transcript;
    renderCurrentVictims(clip);
    renderCurrentTags(clip);

    const requestedSource = new URL(clip.file, document.baseURI).href;
    if (audio.src !== requestedSource) {
      audio.src = clip.file;
      audio.load();
    }

    document.querySelectorAll(".vog-clip-card.is-current").forEach(card => {
      card.classList.remove("is-current");
      card.removeAttribute("aria-current");
    });
    const currentCard = clipGrid.querySelector(`[data-clip-id="${CSS.escape(clip.id)}"]`);
    if (currentCard) {
      currentCard.classList.add("is-current");
      currentCard.setAttribute("aria-current", "true");
    }

    if (play) {
      audio.play().catch(() => {
        status.textContent = `Clip #${clip.id} is ready. Press play to hear it.`;
      });
    }
  };

  const renderCards = () => {
    const visibleClips = filteredClips.slice(0, visibleCount);
    clipGrid.innerHTML = visibleClips.map(clip => {
      const names = (clip.canonicalPlayersMentioned || []).map(playerLabel);
      const audience = names.length ? names.join(", ") : "Entire league";
      const currentClass = clip.id === currentClipId ? " is-current" : "";
      const currentAttribute = clip.id === currentClipId ? ' aria-current="true"' : "";
      return `
        <button type="button" class="vog-clip-card${currentClass}" data-clip-id="${escapeHtml(clip.id)}"${currentAttribute} aria-label="Play clip ${escapeHtml(clip.id)}: ${escapeHtml(audience)}">
          <span class="vog-card-header">
            <span class="vog-card-id">#${escapeHtml(clip.id)}</span>
            <span class="vog-card-play" aria-hidden="true">▶</span>
          </span>
          <span class="vog-card-transcript">${escapeHtml(clip.transcript)}</span>
          <span class="vog-card-footer">
            <span class="vog-card-players">${escapeHtml(audience)}</span>
            <span class="vog-card-duration">${formatDuration(clip.duration)}</span>
          </span>
        </button>
      `;
    }).join("");

    const total = filteredClips.length;
    const showing = Math.min(visibleCount, total);
    resultCount.textContent = total === allClips.length
      ? `${total.toLocaleString()} transmissions`
      : `${total.toLocaleString()} of ${allClips.length.toLocaleString()} transmissions`;
    emptyState.hidden = total !== 0;
    loadMore.hidden = showing >= total;
    loadMore.textContent = `Deal me more (${Math.min(PAGE_SIZE, total - showing)} next)`;
    status.textContent = total
      ? `Showing ${showing.toLocaleString()} of ${total.toLocaleString()} matching clips.`
      : "No clips match the current filters.";
  };

  const applyFilters = () => {
    const query = searchInput.value.trim().toLowerCase().replace(/^#/, "");
    const player = playerFilter.value;
    const category = categoryFilter.value;

    filteredClips = allClips.filter(clip => {
      if (player && !(clip.canonicalPlayersMentioned || []).includes(player)) return false;
      if (category && clip.category !== category) return false;
      return matchesQuery(clip, query);
    });

    switch (sortSelect.value) {
      case "id-desc":
        filteredClips.sort((a, b) => Number(b.id) - Number(a.id));
        break;
      case "shortest":
        filteredClips.sort((a, b) => a.duration - b.duration || Number(a.id) - Number(b.id));
        break;
      case "longest":
        filteredClips.sort((a, b) => b.duration - a.duration || Number(a.id) - Number(b.id));
        break;
      default:
        filteredClips.sort((a, b) => Number(a.id) - Number(b.id));
    }

    visibleCount = PAGE_SIZE;
    renderCards();
  };

  const adjacentClip = direction => {
    const pool = filteredClips.length ? filteredClips : allClips;
    if (!pool.length) return null;
    const currentIndex = pool.findIndex(clip => clip.id === currentClipId);
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;
    return pool[(safeIndex + direction + pool.length) % pool.length];
  };

  const playAdjacent = direction => {
    const clip = adjacentClip(direction);
    if (clip) selectClip(clip, true);
  };

  try {
    const [archiveResponse, playerResponse, correctionsResponse] = await Promise.all([
      fetch(DATA_URL, { cache: "no-store" }),
      fetch(PLAYER_DATA_URL, { cache: "no-store" }),
      fetch(CORRECTIONS_URL, { cache: "no-store" }),
    ]);
    if (!archiveResponse.ok || !playerResponse.ok) {
      throw new Error("Archive data could not be loaded.");
    }

    const [archive, playerData, corrections] = await Promise.all([
      archiveResponse.json(),
      playerResponse.json(),
      correctionsResponse.ok ? correctionsResponse.json() : Promise.resolve({}),
    ]);
    playerProfiles = new Map(
      (playerData.players || []).map(player => [player.slug, player])
    );
    allClips = (archive.clips || [])
      .filter(clip => clip && clip.id && clip.file && clip.transcript)
      .map(clip => {
        const correction = corrections?.[clip.id];
        return correction?.transcript ? { ...clip, transcript: correction.transcript } : clip;
      });
    filteredClips = [...allClips];

    const playerCounts = new Map();
    allClips.forEach(clip => {
      (clip.canonicalPlayersMentioned || []).forEach(slug => {
        playerCounts.set(slug, (playerCounts.get(slug) || 0) + 1);
      });
    });
    [...playerCounts]
      .sort((a, b) => playerLabel(a[0]).localeCompare(playerLabel(b[0])))
      .forEach(([slug, count]) => {
        const option = document.createElement("option");
        option.value = slug;
        option.textContent = `${playerLabel(slug)} (${count})`;
        playerFilter.appendChild(option);
      });

    applyFilters();
    selectClip(allClips[Math.floor(Math.random() * allClips.length)] || allClips[0]);
    renderCards();
  } catch (error) {
    console.error(error);
    currentTitle.textContent = "The booth has gone quiet";
    currentTranscript.textContent = "The archive could not be loaded. Please refresh and try again.";
    resultCount.textContent = "Archive unavailable";
    status.textContent = "The Voice of God archive is temporarily unavailable.";
    filterForm.querySelectorAll("input, select, button").forEach(control => {
      control.disabled = true;
    });
  }

  searchInput.addEventListener("input", applyFilters);
  playerFilter.addEventListener("change", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
  sortSelect.addEventListener("change", applyFilters);
  filterForm.addEventListener("reset", () => {
    window.setTimeout(applyFilters, 0);
  });

  clipGrid.addEventListener("click", event => {
    const card = event.target.closest("[data-clip-id]");
    if (!card) return;
    const clip = allClips.find(item => item.id === card.dataset.clipId);
    if (clip) selectClip(clip, true);
  });

  loadMore.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    renderCards();
  });

  previousButton.addEventListener("click", () => playAdjacent(-1));
  nextButton.addEventListener("click", () => playAdjacent(1));
  audio.addEventListener("ended", () => playAdjacent(1));
  randomButton.addEventListener("click", () => {
    const pool = filteredClips.length ? filteredClips : allClips;
    if (!pool.length) return;
    const alternatives = pool.filter(clip => clip.id !== currentClipId);
    const choices = alternatives.length ? alternatives : pool;
    selectClip(choices[Math.floor(Math.random() * choices.length)], true);
  });
});
