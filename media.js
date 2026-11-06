function initFamilyPortraits() {
  const section = document.querySelector("#family-portraits");
  if (!section) return;

  const stage = section.querySelector(".family-portraits-stage");
  const slides = [...stage.querySelectorAll(".family-portrait")];
  if (slides.length < 2) return;

  const controls = section.querySelector(".family-portraits-controls");
  const position = controls.querySelector(".family-portraits-position");
  const previous = controls.querySelector('[data-portrait-action="previous"]');
  const next = controls.querySelector('[data-portrait-action="next"]');
  const toggle = controls.querySelector('[data-portrait-action="toggle"]');
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const delay = 10000;
  let current = 0;
  let playing = !reducedMotion.matches;
  let visible = !("IntersectionObserver" in window);
  let hovered = false;
  let timer;

  function showPortrait(offset) {
    slides[current].hidden = true;
    current = (current + offset + slides.length) % slides.length;
    slides[current].hidden = false;
    const title = slides[current].querySelector("figcaption").textContent;
    position.textContent = `${current + 1} of ${slides.length}`;
    position.setAttribute("aria-label", `${title}, ${position.textContent}`);
  }

  function scheduleRotation() {
    window.clearTimeout(timer);
    if (!playing || !visible || hovered || document.hidden) return;

    slides[(current + 1) % slides.length].querySelector("img").loading = "eager";
    timer = window.setTimeout(() => {
      showPortrait(1);
      scheduleRotation();
    }, delay);
  }

  function setPlaying(value) {
    playing = value;
    toggle.textContent = playing ? "Pause rotation" : "Play rotation";
    position.setAttribute("aria-live", playing ? "off" : "polite");
    scheduleRotation();
  }

  previous.addEventListener("click", () => {
    setPlaying(false);
    showPortrait(-1);
  });
  next.addEventListener("click", () => {
    setPlaying(false);
    showPortrait(1);
  });
  toggle.addEventListener("click", () => setPlaying(!playing));
  section.addEventListener("focusin", (event) => {
    if (event.target.matches(":focus-visible")) setPlaying(false);
  });
  stage.addEventListener("mouseenter", () => {
    hovered = true;
    scheduleRotation();
  });
  stage.addEventListener("mouseleave", () => {
    hovered = false;
    scheduleRotation();
  });
  document.addEventListener("visibilitychange", scheduleRotation);
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) setPlaying(false);
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      scheduleRotation();
    }).observe(stage);
  }

  controls.hidden = false;
  setPlaying(playing);
}

document.addEventListener("DOMContentLoaded", () => {
  initFamilyPortraits();

  document.querySelectorAll(".media-video-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const videoId = trigger.dataset.videoId;
      const frame = trigger.closest(".media-frame");

      if (!frame || !/^[A-Za-z0-9_-]{6,}$/.test(videoId || "")) return;

      const wrap = document.createElement("div");
      const iframe = document.createElement("iframe");

      wrap.className = "media-embed-wrap";
      iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
      iframe.title = trigger.getAttribute("aria-label") || "YouTube video";
      iframe.loading = "lazy";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;

      wrap.appendChild(iframe);
      frame.replaceChildren(wrap);
    });
  });
});
