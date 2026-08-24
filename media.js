document.addEventListener("DOMContentLoaded", () => {
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
