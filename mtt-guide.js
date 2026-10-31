(() => {
  "use strict";

  const toggle = document.querySelector("[data-mtt-guide-toggle]");
  const panel = document.getElementById("mtt-guide-panel");
  if (!toggle || !panel) return;

  const frame = panel.querySelector("iframe");
  const printButton = panel.querySelector("[data-mtt-guide-print]");
  const status = panel.querySelector("[data-mtt-guide-status]");
  const formatContent = document.querySelector(".format-content-shell");
  const formatButtons = [...document.querySelectorAll("[data-rules-format]")];
  let previousFormat = null;

  function setOpen(open, restoreFormat = true) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (formatContent) formatContent.hidden = open;
    if (open) {
      previousFormat = formatButtons.find(button => button.getAttribute("aria-pressed") === "true") || previousFormat;
      formatButtons.forEach(button => {
        button.classList.remove("active");
        button.setAttribute("aria-pressed", "false");
      });
      if (!frame.getAttribute("src")) frame.setAttribute("src", frame.dataset.src);
    } else if (restoreFormat && previousFormat) {
      if (previousFormat.hidden) previousFormat = document.getElementById("format-btn-40k");
      previousFormat.classList.add("active");
      previousFormat.setAttribute("aria-pressed", "true");
    }
  }

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  formatButtons.forEach(button => button.addEventListener("click", () => setOpen(false, false)));

  window.addEventListener("message", event => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === "mtt-guide-ready") {
      printButton.disabled = false;
      status.textContent = "Two pages. Scroll within the guide to read both.";
    } else if (event.data?.type === "mtt-guide-error") {
      printButton.disabled = true;
      status.textContent = "The preview could not load. Download the PDF to read or print the guide.";
    }
  });
  printButton.addEventListener("click", () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      status.textContent = "This browser cannot print the embedded PDF. Download it, then print from your PDF viewer.";
    }
  });
})();
