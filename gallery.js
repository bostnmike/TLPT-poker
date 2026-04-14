const MANIFEST_PATH = "images/twtw/gallery-manifest.json";

let galleryPosters = [];
let currentPosterIndex = -1;

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
  title.textContent = poster.collection;
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
        src="${poster.src}"
        alt="${poster.title}"
        loading="lazy"
      />
    </div>
    <div class="gallery-card-meta">
      <div class="gallery-card-label">TLPT Archive</div>
      <h3 class="gallery-card-title">${poster.collection}</h3>
      <p class="gallery-card-subline">${formatDisplayDate(poster.date)}</p>
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
        <div class="gallery-year-kicker">Collection Year</div>
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
    const res = await fetch(MANIFEST_PATH, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Manifest fetch failed: ${res.status}`);
    }

    const manifest = await res.json();

    galleryPosters = (manifest.files || [])
      .filter(file => /^twtw\\d{2}-\\d{2}-\\d{2}\\.jpg$/i.test(file))
      .map(file => {
        const match = file.match(/^twtw(\\d{2})-(\\d{2})-(\\d{2})\\.jpg$/i);
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
