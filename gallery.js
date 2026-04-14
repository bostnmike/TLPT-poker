const MANIFEST_PATH = "images/twtw/gallery-manifest.json";

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

function openLightbox(poster) {
  const lightbox = document.getElementById("gallery-lightbox");
  const image = document.getElementById("gallery-lightbox-image");
  const title = document.getElementById("gallery-lightbox-title");
  const date = document.getElementById("gallery-lightbox-date");

  if (!lightbox || !image || !title || !date) return;

  image.src = poster.src;
  image.alt = poster.title;
  title.textContent = poster.title;
  date.textContent = formatDisplayDate(poster.date);

  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const lightbox = document.getElementById("gallery-lightbox");
  const image = document.getElementById("gallery-lightbox-image");

  if (!lightbox || !image) return;

  lightbox.hidden = true;
  image.src = "";
  document.body.style.overflow = "";
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
      <h3 class="gallery-card-title">${poster.title}</h3>
      <p class="gallery-card-date">${formatDisplayDate(poster.date)}</p>
    </div>
  `;

  button.addEventListener("click", () => openLightbox(poster));
  article.appendChild(button);

  return article;
}

async function loadGallery() {
  const grid = document.getElementById("gallery-grid");
  const empty = document.getElementById("gallery-empty");
  const count = document.getElementById("gallery-count");

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

    const posters = (manifest.files || [])
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
          title: buildTitleFromFilename(isoDate)
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    grid.innerHTML = "";

    if (count) {
      count.textContent = String(posters.length);
    }

    if (!posters.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    const fragment = document.createDocumentFragment();
    posters.forEach(poster => {
      fragment.appendChild(createPosterCard(poster));
    });

    grid.appendChild(fragment);
  } catch (err) {
    console.error("Gallery load error:", err);
    if (empty) {
      empty.hidden = false;
      empty.textContent = "Unable to load gallery posters.";
    }
    if (count) {
      count.textContent = "0";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadGallery();

  const closeBtn = document.getElementById("gallery-lightbox-close");
  const backdrop = document.getElementById("gallery-lightbox-backdrop");

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (backdrop) backdrop.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
    }
  });
});
