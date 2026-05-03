const MANIFEST_PATH = "images/twtw/gallery-manifest.json";
const PARSED_EVENT_INDEX_PATH = "data/parsed/events/index.json";
const PARSED_EVENT_BASE_PATH = "data/parsed/events/";
const PLAYER_METADATA_PATH = "data/player-metadata.json";

let galleryPosters = [];
let currentPosterIndex = -1;
let galleryParsedEventsByDate = new Map();
let galleryPlayers = [];

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
  return `The Week That Was — ${formatDisplayDate(isoDate)}`;
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

function normalizeGalleryEventIndexFiles(indexData) {
  if (Array.isArray(indexData)) return indexData;

  if (Array.isArray(indexData?.events)) {
    return indexData.events
      .map(item => {
        if (typeof item === "string") return item;
        return item.file || item.path || item.filename || "";
      })
      .filter(Boolean);
  }

  if (Array.isArray(indexData?.files)) return indexData.files;

  return [];
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
                onerror="this.style.display='none'; this.parentElement.classList.add('is-missing-avatar');"
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
    const res = await fetch(`${PLAYER_METADATA_PATH}?v=${Date.now()}`, {
      cache: "no-store"
    });

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
    const indexRes = await fetch(`${PARSED_EVENT_INDEX_PATH}?v=${Date.now()}`, {
      cache: "no-store"
    });

    if (!indexRes.ok) {
      console.warn(`Gallery warning: parsed event index fetch failed (${indexRes.status}).`);
      galleryParsedEventsByDate = new Map();
      return;
    }

    const indexData = await indexRes.json();
    const files = normalizeGalleryEventIndexFiles(indexData);

    const events = await Promise.all(
      files.map(async file => {
        const clean = String(file || "").replace(/^\/+/, "");
        const url = clean.includes("/")
          ? clean
          : `${PARSED_EVENT_BASE_PATH}${clean}`;

        try {
          const res = await fetch(`${url}?v=${Date.now()}`, {
            cache: "no-store"
          });

          if (!res.ok) {
            console.warn(`Gallery warning: parsed event fetch failed for ${url} (${res.status}).`);
            return null;
          }

          return await res.json();
        } catch (err) {
          console.warn(`Gallery warning: parsed event could not be loaded for ${url}.`, err);
          return null;
        }
      })
    );

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

function openLightbox(poster) {
  const index = galleryPosters.findIndex(item => item.src === poster.src);
  if (index !== -1) {
    openLightboxByIndex(index);
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
}

function createPosterCard(poster) {
  const article = document.createElement("article");
  article.className = "gallery-card";

  const button = document.createElement("button");
  button.className = "gallery-poster-button";
  button.type = "button";
  button.setAttribute("aria-label", `Open poster for ${poster.title}`);

  button.innerHTML = `
    <div class="gallery-poster-frame">
      <img
        class="gallery-poster-image"
        src="${escapeGalleryHtml(poster.src)}"
        alt="${escapeGalleryHtml(poster.title)}"
        loading="lazy"
      />
    </div>
    <div class="gallery-card-meta has-winner-badges">
      ${buildGalleryWinnerBadgesMarkup(poster)}
      <div class="gallery-card-label">The BostnMike Collection</div>
      <h3 class="gallery-card-title">${escapeGalleryHtml(poster.collection)}</h3>
      <p class="gallery-card-subline">${escapeGalleryHtml(formatDisplayDate(poster.date))}</p>
    </div>
  `;

  button.addEventListener("click", () => openLightbox(poster));
  article.appendChild(button);

  return article;
}

function createYearGroup(year, posters) {
  const section = document.createElement("section");
  section.className = "gallery-year-group";

  section.innerHTML = `
    <div class="gallery-year-head">
      <div>
        <div class="gallery-year-kicker">TLPT Archive</div>
        <h3 class="gallery-year-title">${year}</h3>
      </div>
    </div>
    <div class="gallery-year-rule"></div>
    <div class="gallery-year-grid"></div>
  `;

  const grid = section.querySelector(".gallery-year-grid");
  posters.forEach(poster => grid.appendChild(createPosterCard(poster)));

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
    
    galleryPosters = (manifest.files || [])
      .filter(file => /^twtw\d{2}-\d{2}-\d{2}\.jpg$/i.test(file))
      .map(file => {
        const match = file.match(/^twtw(\d{2})-(\d{2})-(\d{2})\.jpg$/i);
        const yy = Number(match[1]);
        const mm = match[2];
        const dd = match[3];
        const yyyy = yy >= 70 ? `19${yy}` : `20${yy}`;
        const isoDate = `${yyyy}-${mm}-${dd}`;

        return {
          file,
          date: isoDate,
          src: `images/twtw/${file}`,
          title: buildTitleFromFilename(isoDate),
          collection: "The Week That Was"
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    grid.innerHTML = "";

    if (!galleryPosters.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    const grouped = groupPostersByYear(galleryPosters);
    const fragment = document.createDocumentFragment();

    grouped.forEach(([year, posters]) => {
      fragment.appendChild(createYearGroup(year, posters));
    });

    grid.appendChild(fragment);
  } catch (err) {
    console.error("Gallery load error:", err);
    if (empty) {
      empty.hidden = false;
      empty.textContent = "Unable to load gallery posters.";
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
      closeLightbox();
    } else if (e.key === "ArrowLeft") {
      showPrevPoster();
    } else if (e.key === "ArrowRight") {
      showNextPoster();
    }
  });
});
