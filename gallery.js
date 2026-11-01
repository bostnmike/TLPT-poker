const GALLERY_FOLDER = "images/fw";
const MANIFEST_PATH = `${GALLERY_FOLDER}/gallery-manifest.json`;
const GALLERY_POSTER_FILE_PATTERN = /^fw(\d{2})-(\d{2})-(\d{2})\.(?:jpg|png)$/i;
const EVENT_HISTORY_PATH = "data/generated/event-history.json";
const PLAYER_METADATA_PATH = "data/player-metadata.json";
const GALLERY_DESKTOP_BATCH_SIZE = 12;
const GALLERY_MOBILE_BATCH_SIZE = 6;

function galleryBatchSize() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 700px)").matches
    ? GALLERY_MOBILE_BATCH_SIZE
    : GALLERY_DESKTOP_BATCH_SIZE;
}

let galleryPosters = [];
let currentPosterIndex = -1;
let galleryParsedEventsByDate = new Map();
let galleryPlayers = [];
let galleryLightboxReturnFocus = null;
let galleryVisibleArchiveCount = galleryBatchSize();
let galleryYearFilter = "all";

function formatDisplayDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  const dt = new Date(`${year}-${month}-${day}T12:00:00`);
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function buildTitleFromFilename(isoDate) {
  return `Felt Whispers — ${formatDisplayDate(isoDate)}`;
}

function escapeGalleryHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeGallerySlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getGalleryEventDate(event) {
  const raw = String(
    event?.date ||
    event?.eventDate ||
    event?.dateIso ||
    event?.id ||
    ""
  );

  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : raw.slice(0, 10);
}

function findGalleryPlayerBySlugOrName(value) {
  const target = normalizeGallerySlug(value);
  if (!target) return null;

  return galleryPlayers.find(player => {
    const slug = normalizeGallerySlug(player.slug);
    const name = normalizeGallerySlug(player.name);
    const aliases = Array.isArray(player.aliases) ? player.aliases : [];

    return (
      slug === target ||
      name === target ||
      aliases.some(alias => normalizeGallerySlug(alias) === target)
    );
  }) || null;
}

function getGalleryRankOneWinners(event) {
  if (!event || !Array.isArray(event.winners)) return [];

  return event.winners
    .filter(winner => Number(winner.rank || 0) === 1)
    .map(winner => {
      const rawIdentity =
        winner.slug ||
        winner.playerSlug ||
        winner.name ||
        winner.player ||
        "";

      return findGalleryPlayerBySlugOrName(rawIdentity) || {
        name: winner.name || rawIdentity || "Unknown Winner",
        slug: normalizeGallerySlug(rawIdentity),
        image: ""
      };
    })
    .filter(Boolean);
}

function buildGalleryWinnerBadgesMarkup(poster) {
  if (poster?.isFuture) return "";

  try {
    const event = galleryParsedEventsByDate.get(poster.date);
    const winners = getGalleryRankOneWinners(event);

    if (!winners.length) {
      return `
        <div class="gallery-winner-badges gallery-winner-badges-unknown" aria-label="Winner not identified yet">
          <span class="gallery-winner-unknown">?</span>
        </div>
      `;
    }

    const badgeClass = winners.length === 1
      ? "gallery-winner-badges-one"
      : "gallery-winner-badges-multi";

    const label = winners.length === 1
      ? `Winner: ${winners[0].name}`
      : `Chop winners: ${winners.map(player => player.name).join(", ")}`;
    const intrinsicAvatarSize = winners.length === 1 ? 46 : 34;

    return `
      <div class="gallery-winner-badges ${badgeClass}" aria-label="${escapeGalleryHtml(label)}">
        ${winners.map(player => `
          <span class="gallery-winner-avatar-wrap" title="${escapeGalleryHtml(player.name)}">
            ${player.image ? `
              <img
                class="gallery-winner-avatar"
                src="${escapeGalleryHtml(player.image)}"
                alt="${escapeGalleryHtml(player.name)}"
                loading="lazy"
                decoding="async"
                width="${intrinsicAvatarSize}"
                height="${intrinsicAvatarSize}"
                data-image-error-action="mark-parent"
                data-image-error-parent-class="is-missing-avatar"
              />
            ` : ""}
            <span class="gallery-winner-avatar-fallback">?</span>
          </span>
        `).join("")}
      </div>
    `;
  } catch (err) {
    console.warn("Gallery winner badge failed for poster:", poster, err);

    return `
      <div class="gallery-winner-badges gallery-winner-badges-unknown" aria-label="Winner not identified yet">
        <span class="gallery-winner-unknown">?</span>
      </div>
    `;
  }
}

async function loadGalleryPlayerMetadata() {
  try {
    const res = await fetch(PLAYER_METADATA_PATH);

    if (!res.ok) {
      console.warn(`Gallery warning: player metadata fetch failed (${res.status}).`);
      galleryPlayers = [];
      return;
    }

    const data = await res.json();
    galleryPlayers = Array.isArray(data.players) ? data.players : [];
  } catch (err) {
    console.warn("Gallery warning: player metadata could not be loaded.", err);
    galleryPlayers = [];
  }
}

async function loadGalleryParsedEvents() {
  try {
    const historyRes = await fetch(EVENT_HISTORY_PATH);

    if (!historyRes.ok) {
      console.warn(`Gallery warning: event history fetch failed (${historyRes.status}).`);
      galleryParsedEventsByDate = new Map();
      return;
    }

    const historyData = await historyRes.json();
    const events = Array.isArray(historyData?.events) ? historyData.events : [];

    if (Number(historyData?.eventCount) !== events.length) {
      throw new Error("Event history bundle count does not match its event payload");
    }

    galleryParsedEventsByDate = new Map();

    events.filter(Boolean).forEach(event => {
      const date = getGalleryEventDate(event);
      if (date) {
        galleryParsedEventsByDate.set(date, event);
      }
    });
  } catch (err) {
    console.warn("Gallery warning: parsed events could not be loaded.", err);
    galleryParsedEventsByDate = new Map();
  }
}

function getGalleryLightboxFocusable(lightbox) {
  if (!lightbox) return [];

  return [...lightbox.querySelectorAll(
    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
  )].filter(element => !element.hidden);
}

function focusGalleryLightbox(lightbox) {
  const [first] = getGalleryLightboxFocusable(lightbox);
  first?.focus({ preventScroll: true });
}

function trapGalleryLightboxFocus(event, lightbox) {
  if (event.key !== "Tab") return;

  const focusable = getGalleryLightboxFocusable(lightbox);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeIndex = focusable.indexOf(document.activeElement);

  if (activeIndex === -1) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus({ preventScroll: true });
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function updateLightboxNav() {
  const prevBtn = document.getElementById("gallery-lightbox-prev");
  const nextBtn = document.getElementById("gallery-lightbox-next");

  if (!prevBtn || !nextBtn) return;

  prevBtn.disabled = currentPosterIndex <= 0;
  nextBtn.disabled = currentPosterIndex >= galleryPosters.length - 1;
}

function openLightboxByIndex(index) {
  const poster = galleryPosters[index];
  if (!poster) return;

  currentPosterIndex = index;

  const lightbox = document.getElementById("gallery-lightbox");
  const image = document.getElementById("gallery-lightbox-image");
  const title = document.getElementById("gallery-lightbox-title");
  const date = document.getElementById("gallery-lightbox-date");

  if (!lightbox || !image || !title || !date) return;

  image.src = poster.src;
  image.alt = poster.title;
  title.textContent = "The BostnMike Collection";
  date.textContent = formatDisplayDate(poster.date);

  lightbox.hidden = false;
  document.body.style.overflow = "hidden";

  updateLightboxNav();
}

function openLightbox(poster, trigger = null) {
  const index = galleryPosters.findIndex(item => item.src === poster.src);
  if (index !== -1) {
    const focusOrigin = trigger || document.activeElement;
    galleryLightboxReturnFocus = typeof focusOrigin?.focus === "function"
      ? focusOrigin
      : null;
    openLightboxByIndex(index);
    focusGalleryLightbox(document.getElementById("gallery-lightbox"));
  }
}

function showPrevPoster() {
  if (currentPosterIndex > 0) {
    openLightboxByIndex(currentPosterIndex - 1);
  }
}

function showNextPoster() {
  if (currentPosterIndex < galleryPosters.length - 1) {
    openLightboxByIndex(currentPosterIndex + 1);
  }
}

function closeLightbox() {
  const lightbox = document.getElementById("gallery-lightbox");
  const image = document.getElementById("gallery-lightbox-image");

  if (!lightbox || !image) return;

  lightbox.hidden = true;
  image.src = "";
  document.body.style.overflow = "";
  currentPosterIndex = -1;

  const returnFocus = galleryLightboxReturnFocus;
  galleryLightboxReturnFocus = null;
  if (returnFocus?.isConnected !== false && typeof returnFocus?.focus === "function") {
    returnFocus.focus({ preventScroll: true });
  }
}

function createPosterCard(poster, isLeadPoster = false) {
  const article = document.createElement("article");
  article.className = `gallery-card${poster.isFuture ? " gallery-card-coming" : ""}`;

  const button = document.createElement("button");
  button.className = "gallery-poster-button";
  button.type = "button";
  button.setAttribute("aria-label", `Open poster for ${poster.title}`);
  const loading = isLeadPoster ? "eager" : "lazy";

  button.innerHTML = `
    <div class="gallery-poster-frame">
      <img
        class="gallery-poster-image"
        src="${escapeGalleryHtml(poster.thumbnailSrc || poster.src)}"
        alt="${escapeGalleryHtml(poster.title)}"
        loading="${loading}"
        decoding="async"
        fetchpriority="${isLeadPoster ? "high" : "auto"}"
        width="1024"
        height="1536"
      />
    </div>
    <div class="gallery-card-meta${poster.isFuture ? "" : " has-winner-badges"}">
      ${buildGalleryWinnerBadgesMarkup(poster)}
      <div class="gallery-card-label">The BostnMike Collection</div>
      <h3 class="gallery-card-title">${escapeGalleryHtml(poster.collection)}</h3>
      <p class="gallery-card-subline">${escapeGalleryHtml(formatDisplayDate(poster.date))}</p>
    </div>
  `;

  const posterImage = button.querySelector(".gallery-poster-image");
  posterImage?.addEventListener("error", () => {
    if (posterImage.src.endsWith(poster.src)) return;
    posterImage.src = poster.src;
  }, { once: true });

  button.addEventListener("click", () => openLightbox(poster, button));
  article.appendChild(button);

  return article;
}

function createComingAttractionsGroup(posters, leadPosterSource) {
  const section = document.createElement("section");
  section.className = "gallery-year-group gallery-coming-group";

  section.innerHTML = `
    <div class="gallery-year-head gallery-coming-head">
      <div>
        <div class="gallery-year-kicker">Coming Attractions</div>
        <h2 class="gallery-year-title">Next on the Marquee</h2>
      </div>
    </div>
    <div class="gallery-year-rule"></div>
    <p class="gallery-coming-copy">Future event art gets the spotlight here. After the cards are dealt, the poster moves into the dated archive automatically.</p>
    <div class="gallery-year-grid"></div>
  `;

  const grid = section.querySelector(".gallery-year-grid");
  posters.forEach(poster => grid.appendChild(
    createPosterCard(poster, poster.src === leadPosterSource)
  ));

  return section;
}

function createYearGroup(year, posters, leadPosterSource) {
  const section = document.createElement("section");
  section.className = "gallery-year-group";

  section.innerHTML = `
    <div class="gallery-year-head">
      <div>
        <div class="gallery-year-kicker">TLPT Archive</div>
        <h2 class="gallery-year-title">${year}</h2>
      </div>
    </div>
    <div class="gallery-year-rule"></div>
    <div class="gallery-year-grid"></div>
  `;

  const grid = section.querySelector(".gallery-year-grid");
  posters.forEach(poster => grid.appendChild(
    createPosterCard(poster, poster.src === leadPosterSource)
  ));

  return section;
}

function groupPostersByYear(posters) {
  const grouped = new Map();

  posters.forEach(poster => {
    const year = poster.date.slice(0, 4);
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year).push(poster);
  });

  return Array.from(grouped.entries()).sort((a, b) => Number(b[0]) - Number(a[0]));
}

function renderGalleryCollection() {
  const grid = document.getElementById("gallery-grid");
  const status = document.getElementById("gallery-filter-status");
  if (!grid) return;

  const comingPosters = galleryPosters.filter(poster => poster.isFuture);
  const allArchivePosters = galleryPosters.filter(poster => !poster.isFuture);
  const matchingArchivePosters = galleryYearFilter === "all"
    ? allArchivePosters
    : allArchivePosters.filter(poster => poster.date.startsWith(`${galleryYearFilter}-`));
  const visibleArchivePosters = matchingArchivePosters.slice(0, galleryVisibleArchiveCount);
  const grouped = groupPostersByYear(visibleArchivePosters);
  const leadPosterSource = galleryPosters[0]?.src || "";
  const fragment = document.createDocumentFragment();

  if (comingPosters.length) {
    fragment.appendChild(createComingAttractionsGroup(comingPosters, leadPosterSource));
  }

  grouped.forEach(([year, posters]) => {
    fragment.appendChild(createYearGroup(year, posters, leadPosterSource));
  });

  const remaining = Math.max(matchingArchivePosters.length - visibleArchivePosters.length, 0);
  if (remaining) {
    const batchSize = galleryBatchSize();
    const controls = document.createElement("div");
    controls.className = "gallery-progressive-controls";
    controls.innerHTML = `
      <button class="btn" type="button" data-gallery-load-more>
        ${remaining > batchSize ? `Show ${batchSize} More Posters` : `Show ${remaining} More Poster${remaining === 1 ? "" : "s"}`}
      </button>
    `;
    controls.querySelector("[data-gallery-load-more]")?.addEventListener("click", () => {
      galleryVisibleArchiveCount += batchSize;
      renderGalleryCollection();
    });
    fragment.appendChild(controls);
  }

  grid.replaceChildren(fragment);
  if (status) {
    status.textContent = matchingArchivePosters.length === visibleArchivePosters.length
      ? `${matchingArchivePosters.length} archived poster${matchingArchivePosters.length === 1 ? "" : "s"} on display`
      : `Showing ${visibleArchivePosters.length} of ${matchingArchivePosters.length} archived posters`;
  }
}

function populateGalleryYearFilter() {
  const select = document.getElementById("gallery-year-filter");
  if (!select) return;

  const years = [...new Set(
    galleryPosters
      .filter(poster => !poster.isFuture)
      .map(poster => poster.date.slice(0, 4))
  )].sort((a, b) => Number(b) - Number(a));

  select.replaceChildren(
    new Option("All Years", "all"),
    ...years.map(year => new Option(year, year))
  );
  select.value = galleryYearFilter;
  if (select.dataset.ready === "true") return;
  select.dataset.ready = "true";
  select.addEventListener("change", () => {
    galleryYearFilter = select.value;
    galleryVisibleArchiveCount = galleryBatchSize();
    renderGalleryCollection();
  });
}

async function loadGallery() {
  const grid = document.getElementById("gallery-grid");
  const empty = document.getElementById("gallery-empty");

  if (!grid) {
    console.error("Gallery error: #gallery-grid not found");
    return;
  }

  try {
    await Promise.all([
      loadGalleryPlayerMetadata(),
      loadGalleryParsedEvents()
    ]);

    const res = await fetch(MANIFEST_PATH, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Manifest fetch failed: ${res.status}`);
    }

    const manifest = await res.json();
    const manifestFolder = String(manifest.folder || "").replace(/\/+$/, "");
    const thumbnailFolder = String(manifest.thumbnailFolder || `${manifestFolder}/thumbs`).replace(/\/+$/, "");

    if (manifestFolder !== GALLERY_FOLDER) {
      throw new Error(`Unexpected gallery folder: ${manifestFolder || "missing"}`);
    }
    
    const today = new Date();
    const todayIso = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");

    galleryPosters = (manifest.files || [])
      .filter(file => GALLERY_POSTER_FILE_PATTERN.test(file))
      .map(file => {
        const match = file.match(GALLERY_POSTER_FILE_PATTERN);
        const yy = Number(match[1]);
        const mm = match[2];
        const dd = match[3];
        const yyyy = yy >= 70 ? `19${yy}` : `20${yy}`;
        const isoDate = `${yyyy}-${mm}-${dd}`;

        return {
          file,
          date: isoDate,
          src: `${manifestFolder}/${file}`,
          thumbnailSrc: `${thumbnailFolder}/${file}`,
          isFuture: isoDate > todayIso,
          title: buildTitleFromFilename(isoDate),
          collection: isoDate > todayIso ? "Coming Soon" : "In the Vault"
        };
      })
      .sort((a, b) => {
        if (a.isFuture !== b.isFuture) return a.isFuture ? -1 : 1;
        return a.isFuture
          ? new Date(a.date) - new Date(b.date)
          : new Date(b.date) - new Date(a.date);
      });

    grid.innerHTML = "";

    if (!galleryPosters.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    galleryVisibleArchiveCount = galleryBatchSize();
    populateGalleryYearFilter();
    renderGalleryCollection();
  } catch (err) {
    console.error("Gallery load error:", err);
    if (empty) {
      empty.hidden = false;
      empty.setAttribute("role", "alert");
      empty.innerHTML = `
        <strong>The Gallery couldn’t load the poster collection.</strong>
        <span>Check your connection and try again.</span>
        <div class="hero-actions">
          <button class="btn active" type="button" data-gallery-retry>Try Again</button>
        </div>
      `;
      empty.querySelector("[data-gallery-retry]")?.addEventListener("click", () => {
        window.location.reload();
      });
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadGallery();

  const closeBtn = document.getElementById("gallery-lightbox-close");
  const backdrop = document.getElementById("gallery-lightbox-backdrop");
  const prevBtn = document.getElementById("gallery-lightbox-prev");
  const nextBtn = document.getElementById("gallery-lightbox-next");

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (backdrop) backdrop.addEventListener("click", closeLightbox);
  if (prevBtn) prevBtn.addEventListener("click", showPrevPoster);
  if (nextBtn) nextBtn.addEventListener("click", showNextPoster);

  document.addEventListener("keydown", (e) => {
    const lightbox = document.getElementById("gallery-lightbox");
    if (!lightbox || lightbox.hidden) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeLightbox();
    } else if (e.key === "Tab") {
      trapGalleryLightboxFocus(e, lightbox);
    } else if (e.key === "ArrowLeft") {
      showPrevPoster();
    } else if (e.key === "ArrowRight") {
      showNextPoster();
    }
  });
});
