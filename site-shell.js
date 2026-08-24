"use strict";

(() => {
  const hideOnErrorSelector = "img[data-hide-on-error]";
  const imageErrorActionSelector = "img[data-image-error-action]";

  const hideBrokenImage = image => {
    image.hidden = true;
  };

  const revealNextFallback = (image, removeImage = false) => {
    const fallback = image.nextElementSibling;
    if (!fallback) {
      hideBrokenImage(image);
      return;
    }

    fallback.hidden = false;
    if (removeImage) {
      image.remove();
    } else {
      hideBrokenImage(image);
    }
  };

  const markParentMissing = image => {
    hideBrokenImage(image);
    const className = image.dataset.imageErrorParentClass;
    if (className && image.parentElement) {
      image.parentElement.classList.add(className);
    }
  };

  const useFallbackSource = image => {
    const fallbackSource = image.dataset.imageFallbackSrc;
    if (fallbackSource && image.dataset.imageFallbackAttempted !== "true") {
      image.dataset.imageFallbackAttempted = "true";
      image.src = fallbackSource;
      return;
    }

    hideBrokenImage(image);
  };

  const tryCandidateSource = image => {
    const candidates = String(image.dataset.candidates || "")
      .split("|")
      .map(candidate => candidate.trim())
      .filter(Boolean);
    const nextIndex = Number(image.dataset.candidateIndex || 0) + 1;

    if (nextIndex < candidates.length) {
      image.dataset.candidateIndex = String(nextIndex);
      image.src = candidates[nextIndex];
      return;
    }

    image.classList.add("is-missing");
    const fallback = image.nextElementSibling;
    if (fallback?.classList.contains("rules-chip-fallback")) {
      fallback.classList.add("is-visible");
    }
  };

  const handleImageError = image => {
    switch (image.dataset.imageErrorAction) {
      case "show-next":
        revealNextFallback(image);
        return;
      case "replace-with-next":
        revealNextFallback(image, true);
        return;
      case "mark-parent":
        markParentMissing(image);
        return;
      case "fallback-source":
        useFallbackSource(image);
        return;
      case "candidate-list":
        tryCandidateSource(image);
        return;
      default:
        if (image.matches(hideOnErrorSelector)) {
          hideBrokenImage(image);
        }
    }
  };

  document.addEventListener(
    "error",
    event => {
      const image = event.target;
      if (
        image instanceof HTMLImageElement &&
        image.matches(`${hideOnErrorSelector}, ${imageErrorActionSelector}`)
      ) {
        handleImageError(image);
      }
    },
    true
  );

  document
    .querySelectorAll(`${hideOnErrorSelector}, ${imageErrorActionSelector}`)
    .forEach(image => {
      if (image.complete && image.naturalWidth === 0) {
        handleImageError(image);
      }
    });
})();
