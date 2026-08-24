"use strict";

(() => {
  const hideOnErrorSelector = "img[data-hide-on-error]";

  const hideBrokenImage = image => {
    image.hidden = true;
  };

  document.addEventListener(
    "error",
    event => {
      const image = event.target;
      if (image instanceof HTMLImageElement && image.matches(hideOnErrorSelector)) {
        hideBrokenImage(image);
      }
    },
    true
  );

  document.querySelectorAll(hideOnErrorSelector).forEach(image => {
    if (image.complete && image.naturalWidth === 0) {
      hideBrokenImage(image);
    }
  });
})();
