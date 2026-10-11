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

  const initResponsiveNavigation = () => {
    const header = document.querySelector(".site-header");
    const headerInner = header?.querySelector(".header-inner");
    const nav = header?.querySelector(".nav");
    if (!header || !headerInner || !nav || header.dataset.mobileNavReady === "true") {
      return;
    }

    header.dataset.mobileNavReady = "true";
    const navId = nav.id || "site-navigation";
    nav.id = navId;

    const toggle = document.createElement("button");
    toggle.className = "site-nav-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-controls", navId);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open site navigation");
    toggle.innerHTML = '<span class="site-nav-toggle-icon" aria-hidden="true"></span><span>Menu</span>';
    headerInner.insertBefore(toggle, nav);

    const closeSubmenus = exceptDropdown => {
      nav.querySelectorAll(".nav-dropdown.is-open").forEach(dropdown => {
        if (dropdown === exceptDropdown) return;
        dropdown.classList.remove("is-open");
        const submenuToggle = dropdown.querySelector(":scope > .nav-submenu-toggle");
        submenuToggle?.setAttribute("aria-expanded", "false");
      });
    };

    const closeNavigation = restoreFocus => {
      header.classList.remove("is-nav-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open site navigation");
      closeSubmenus();
      if (restoreFocus) toggle.focus();
    };

    nav.querySelectorAll(".nav-dropdown").forEach((dropdown, index) => {
      const parent = dropdown.querySelector(":scope > .nav-dropdown-parent");
      const menu = dropdown.querySelector(":scope > .nav-dropdown-menu");
      if (!parent || !menu) return;

      const menuId = menu.id || `site-submenu-${index + 1}`;
      menu.id = menuId;

      const submenuToggle = document.createElement("button");
      submenuToggle.className = "nav-submenu-toggle";
      submenuToggle.type = "button";
      submenuToggle.setAttribute("aria-controls", menuId);
      submenuToggle.setAttribute("aria-expanded", "false");
      submenuToggle.setAttribute("aria-label", `Open ${parent.textContent.trim()} menu`);
      dropdown.insertBefore(submenuToggle, menu);

      submenuToggle.addEventListener("click", () => {
        const willOpen = !dropdown.classList.contains("is-open");
        closeSubmenus(willOpen ? dropdown : null);
        dropdown.classList.toggle("is-open", willOpen);
        submenuToggle.setAttribute("aria-expanded", String(willOpen));
        submenuToggle.setAttribute(
          "aria-label",
          `${willOpen ? "Close" : "Open"} ${parent.textContent.trim()} menu`
        );
      });
    });

    toggle.addEventListener("click", () => {
      const willOpen = !header.classList.contains("is-nav-open");
      header.classList.toggle("is-nav-open", willOpen);
      toggle.setAttribute("aria-expanded", String(willOpen));
      toggle.setAttribute("aria-label", `${willOpen ? "Close" : "Open"} site navigation`);
      if (!willOpen) closeSubmenus();
    });

    nav.addEventListener("click", event => {
      if (event.target.closest("a") && window.matchMedia("(max-width:700px)").matches) {
        closeNavigation(false);
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && header.classList.contains("is-nav-open")) {
        closeNavigation(true);
      }
    });

    document.addEventListener("click", event => {
      if (!header.contains(event.target) && header.classList.contains("is-nav-open")) {
        closeNavigation(false);
      }
    });

    window.matchMedia("(min-width:701px)").addEventListener("change", event => {
      if (event.matches) closeNavigation(false);
    });
  };

  const initScrollAffordances = () => {
    const selectors = [
      ".table-wrap",
      ".blind-table-scroll",
      ".marchand-stat-wing"
    ];

    document.querySelectorAll(selectors.join(",")).forEach(region => {
      if (region.dataset?.scrollAffordanceReady === "true") return;

      const host = region.parentElement;
      if (!host) return;

      const shell = document.createElement("div");
      const cue = document.createElement("span");
      shell.className = "scroll-affordance-shell";
      cue.className = "scroll-affordance";
      cue.setAttribute("aria-hidden", "true");
      cue.textContent = "Scroll for more";

      region.dataset.scrollAffordanceReady = "true";
      host.classList.add("scroll-affordance-host");
      shell.append(cue);
      host.append(shell);

      const update = () => {
        const scrollable = region.scrollWidth - region.clientWidth > 4;
        const atStart = region.scrollLeft <= 4;
        const atEnd = region.scrollLeft + region.clientWidth >= region.scrollWidth - 4;
        host.classList.toggle("has-horizontal-overflow", scrollable);
        shell.classList.toggle("is-scrollable", scrollable);
        shell.classList.toggle("is-scroll-start", scrollable && atStart);
        shell.classList.toggle("is-scroll-end", !scrollable || atEnd);
      };

      region.addEventListener("scroll", update, { passive:true });
      window.addEventListener("resize", update, { passive:true });
      requestAnimationFrame(update);
    });
  };

  const initLoadingSkeletons = () => {
    const targetIds = [
      "dashboard-grid",
      "players-grid",
      "pm-top-movers",
      "pm-player-grid",
      "knockouts-summary-grid",
      "active-cash-board",
      "top-cash-board",
      "active-drought-board",
      "top-drought-board",
      "trophy-card-grid"
    ];

    targetIds.forEach(targetId => {
      const target = document.getElementById(targetId);
      if (!target || target.children.length || target.dataset.skeletonReady === "true") return;

      target.dataset.skeletonReady = "true";
      target.setAttribute("aria-busy", "true");
      const skeleton = document.createElement("div");
      skeleton.className = "tlpt-loading-grid";
      skeleton.setAttribute("aria-hidden", "true");
      skeleton.innerHTML = Array.from(
        { length: targetId.includes("top") ? 5 : 3 },
        () => '<span class="tlpt-loading-card"></span>'
      ).join("");
      target.append(skeleton);

      const observer = new MutationObserver(() => {
        const hasRenderedContent = Array.from(target.children).some(child => {
          return !child.classList.contains("tlpt-loading-grid");
        });
        const skeletonStillPresent = target.querySelector(":scope > .tlpt-loading-grid");
        if (!hasRenderedContent && skeletonStillPresent) return;

        skeletonStillPresent?.remove();
        target.removeAttribute("aria-busy");
        observer.disconnect();
      });
      observer.observe(target, { childList:true });
    });
  };

  const initVideoFacades = () => {
    document.querySelectorAll('.media-embed-wrap iframe[src*="youtube.com/embed/"]').forEach(iframe => {
      if (typeof iframe.getAttribute !== "function") return;
      const source = iframe.getAttribute("src") || "";
      const match = source.match(/youtube\.com\/embed\/([^?&/]+)/i);
      if (!match) return;

      const facade = document.createElement("button");
      const title = iframe.getAttribute("title") || "TLPT video";
      facade.className = "media-video-facade";
      facade.type = "button";
      facade.setAttribute("aria-label", `Play ${title}`);
      facade.innerHTML = `
        <img src="https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg" alt="" loading="lazy" decoding="async" data-hide-on-error>
        <span class="media-video-play" aria-hidden="true"></span>
      `;

      const frame = iframe.cloneNode(true);
      frame.setAttribute("loading", "eager");
      facade.addEventListener("click", () => {
        const autoplaySeparator = source.includes("?") ? "&" : "?";
        frame.src = `${source}${autoplaySeparator}autoplay=1`;
        facade.replaceWith(frame);
      });
      iframe.replaceWith(facade);
    });
  };

  const initResponsiveProfileTools = () => {
    const details = document.querySelector(".player-page-more");
    if (!details) return;

    const mobileQuery = window.matchMedia("(max-width:700px)");
    const sync = event => {
      details.open = !event.matches;
    };
    sync(mobileQuery);
    mobileQuery.addEventListener("change", sync);
  };

  if (typeof document.querySelector === "function") {
    initResponsiveNavigation();
    initResponsiveProfileTools();
  }
  if (typeof document.querySelectorAll === "function") {
    initScrollAffordances();
    initVideoFacades();

    if (document.body && typeof MutationObserver === "function") {
      let scrollRefreshQueued = false;
      const scrollRegionObserver = new MutationObserver(() => {
        if (scrollRefreshQueued) return;
        scrollRefreshQueued = true;
        requestAnimationFrame(() => {
          scrollRefreshQueued = false;
          initScrollAffordances();
        });
      });
      scrollRegionObserver.observe(document.body, { childList:true, subtree:true });
    }
  }
  if (typeof document.getElementById === "function") {
    initLoadingSkeletons();
  }
})();
