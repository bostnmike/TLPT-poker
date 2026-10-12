"use strict";

(() => {
  const hideOnErrorSelector = "img[data-hide-on-error]";
  const imageErrorActionSelector = "img[data-image-error-action]";
  const openSelectOverlays = new Map();

  const placeSelectOverlay = (trigger, menu, options = {}) => {
    if (!trigger || !menu || typeof window === "undefined") return;

    const edge = 12;
    const gap = 6;
    const requestedMaxHeight = Number(options.maxHeight || 320);
    const requestedMinWidth = Number(options.minWidth || 0);
    let triggerRect = trigger.getBoundingClientRect();
    let availableHeight = window.innerHeight - triggerRect.bottom - gap - edge;

    if (availableHeight < 96) {
      const root = document.documentElement;
      const remainingScroll = Math.max(
        0,
        root.scrollHeight - window.innerHeight - window.scrollY
      );
      const scrollDistance = Math.min(96 - availableHeight, remainingScroll);
      if (scrollDistance > 0) {
        window.scrollBy(0, scrollDistance);
        triggerRect = trigger.getBoundingClientRect();
        availableHeight = window.innerHeight - triggerRect.bottom - gap - edge;
      }
    }

    const viewportWidth = Math.max(0, window.innerWidth - (edge * 2));
    const menuWidth = Math.min(
      Math.max(triggerRect.width, requestedMinWidth),
      viewportWidth
    );
    const left = Math.min(
      Math.max(edge, triggerRect.left),
      Math.max(edge, window.innerWidth - edge - menuWidth)
    );
    const maxHeight = Math.min(
      requestedMaxHeight,
      Math.max(48, availableHeight)
    );

    menu.style.position = "fixed";
    menu.style.top = `${Math.round(triggerRect.bottom + gap)}px`;
    menu.style.right = "auto";
    menu.style.left = `${Math.round(left)}px`;
    menu.style.width = `${Math.round(menuWidth)}px`;
    menu.style.maxHeight = `${Math.floor(maxHeight)}px`;
    openSelectOverlays.set(menu, { trigger, options });
  };

  const releaseSelectOverlay = menu => {
    if (menu) openSelectOverlays.delete(menu);
  };

  const repositionOpenSelectOverlays = () => {
    openSelectOverlays.forEach(({ trigger, options }, menu) => {
      if (!trigger.isConnected || !menu.isConnected || menu.hidden) {
        openSelectOverlays.delete(menu);
        return;
      }
      placeSelectOverlay(trigger, menu, options);
    });
  };

  if (typeof window !== "undefined") {
    let overlayFrame = 0;
    const queueOverlayReposition = () => {
      if (overlayFrame) return;
      overlayFrame = window.requestAnimationFrame(() => {
        overlayFrame = 0;
        repositionOpenSelectOverlays();
      });
    };
    window.TLPTSelectOverlay = {
      place:placeSelectOverlay,
      release:releaseSelectOverlay
    };
    window.addEventListener("scroll", queueOverlayReposition, true);
  }

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

  const initSiteSelects = () => {
    if (!document.body || document.body.classList.contains("marchand-page")) return;

    const selectSelector = "select:not([data-site-select-skip]):not(.fl-native-select):not([id^='fl-'])";
    const getSelectLabel = select => {
      const label = select.labels?.[0] || select.closest("label");
      const labelText = label?.querySelector(":scope > span")?.textContent
        || label?.textContent
        || select.getAttribute("aria-label")
        || select.id
        || "Option";
      return labelText.replace(/\s+/g, " ").trim();
    };

    const getSelectShell = select => {
      const shell = select.nextElementSibling;
      return shell?.classList.contains("site-select") ? shell : null;
    };

    const getSelectMenu = select => {
      const trigger = getSelectShell(select)?.querySelector(".site-select-trigger");
      const menuId = trigger?.getAttribute("aria-controls");
      return menuId ? document.getElementById(menuId) : null;
    };

    const closeSelect = (select, restoreFocus = false) => {
      const shell = getSelectShell(select);
      if (!shell) return;
      const trigger = shell.querySelector(".site-select-trigger");
      const menu = getSelectMenu(select);
      if (menu) menu.hidden = true;
      trigger?.setAttribute("aria-expanded", "false");
      shell.classList.remove("is-open");
      releaseSelectOverlay(menu);
      if (restoreFocus) trigger?.focus();
    };

    const closeAllSelects = (exceptSelect = null) => {
      document.querySelectorAll("select[data-site-select-ready='true']").forEach(select => {
        if (select !== exceptSelect) closeSelect(select);
      });
    };

    const handleOptionKeydown = (event, select) => {
      const menu = event.currentTarget.closest(".site-select-menu");
      const options = Array.from(menu?.querySelectorAll(".site-select-option:not(:disabled)") || []);
      const currentIndex = options.indexOf(event.currentTarget);

      if (event.key === "Escape") {
        event.preventDefault();
        closeSelect(select, true);
        return;
      }
      if (event.key === "Tab") {
        closeSelect(select);
        return;
      }

      let nextIndex = null;
      if (event.key === "ArrowDown") nextIndex = Math.min(options.length - 1, currentIndex + 1);
      if (event.key === "ArrowUp") nextIndex = Math.max(0, currentIndex - 1);
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = options.length - 1;
      if (nextIndex !== null) {
        event.preventDefault();
        options[nextIndex]?.focus();
      }
    };

    const syncSelect = select => {
      const shell = getSelectShell(select);
      if (!shell) return;
      const trigger = shell.querySelector(".site-select-trigger");
      const menu = getSelectMenu(select);
      if (!trigger || !menu) return;

      const signature = Array.from(select.options)
        .map(option => `${option.value}\u241f${option.textContent}\u241f${option.disabled}`)
        .join("\u241e");
      if (shell.dataset.optionSignature !== signature) {
        shell.dataset.optionSignature = signature;
        menu.innerHTML = "";
        Array.from(select.options).forEach(option => {
          const optionButton = document.createElement("button");
          optionButton.className = "site-select-option";
          optionButton.type = "button";
          optionButton.role = "option";
          optionButton.dataset.value = option.value;
          optionButton.textContent = option.textContent;
          optionButton.disabled = option.disabled;
          optionButton.addEventListener("click", () => {
            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles:true }));
            syncSelect(select);
            closeSelect(select, true);
          });
          optionButton.addEventListener("keydown", event => handleOptionKeydown(event, select));
          menu.append(optionButton);
        });
      }

      const selectedOption = select.selectedOptions?.[0] || select.options[select.selectedIndex];
      const selectedText = selectedOption?.textContent || "Select…";
      const label = trigger.dataset.fieldLabel || "Option";
      if (trigger.textContent !== selectedText) trigger.textContent = selectedText;
      trigger.disabled = select.disabled;
      trigger.setAttribute("aria-label", `${label}: ${selectedText}`);
      menu.querySelectorAll(".site-select-option").forEach(optionButton => {
        optionButton.setAttribute(
          "aria-selected",
          optionButton.dataset.value === select.value ? "true" : "false"
        );
      });
    };

    const openSelect = (select, focusOffset = null) => {
      const shell = getSelectShell(select);
      if (!shell) return;
      closeAllSelects(select);
      syncSelect(select);
      const trigger = shell.querySelector(".site-select-trigger");
      const menu = getSelectMenu(select);
      if (!trigger || !menu || trigger.disabled) return;
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      shell.classList.add("is-open");
      placeSelectOverlay(trigger, menu, { maxHeight:320 });

      if (focusOffset !== null) {
        const options = Array.from(menu.querySelectorAll(".site-select-option:not(:disabled)"));
        const selectedIndex = Math.max(0, options.findIndex(option => {
          return option.dataset.value === select.value;
        }));
        const focusIndex = focusOffset === "end"
          ? options.length - 1
          : focusOffset === "home"
            ? 0
            : Math.max(0, Math.min(options.length - 1, selectedIndex + focusOffset));
        options[focusIndex]?.focus();
      }
    };

    const enhanceSelect = select => {
      if (
        select.dataset.siteSelectReady === "true"
        || select.id.startsWith("fl-")
        || select.closest(".fl-field")
      ) return;
      const label = getSelectLabel(select);
      const shell = document.createElement("div");
      const trigger = document.createElement("button");
      const menu = document.createElement("div");
      const baseId = select.id || `site-select-${document.querySelectorAll(".site-select").length + 1}`;

      shell.className = "site-select";
      trigger.className = "site-select-trigger";
      trigger.type = "button";
      trigger.id = `${baseId}-trigger`;
      trigger.dataset.fieldLabel = label;
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-controls", `${baseId}-menu`);
      menu.className = "site-select-menu";
      menu.id = `${baseId}-menu`;
      menu.role = "listbox";
      menu.setAttribute("aria-label", label);
      menu.hidden = true;

      trigger.addEventListener("click", () => {
        if (trigger.getAttribute("aria-expanded") === "true") closeSelect(select);
        else openSelect(select);
      });
      trigger.addEventListener("keydown", event => {
        const offsets = { ArrowDown:1, ArrowUp:-1, Home:"home", End:"end" };
        if (!(event.key in offsets)) return;
        event.preventDefault();
        openSelect(select, offsets[event.key]);
      });
      select.addEventListener("change", () => syncSelect(select));

      select.classList.add("site-native-select");
      select.dataset.siteSelectReady = "true";
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
      shell.append(trigger);
      select.insertAdjacentElement("afterend", shell);
      document.body.append(menu);
      if (select.labels?.[0]) select.labels[0].htmlFor = trigger.id;
      syncSelect(select);
    };

    const enhanceAllSelects = () => {
      document.querySelectorAll(selectSelector).forEach(enhanceSelect);
      document.querySelectorAll("select[data-site-select-ready='true']").forEach(syncSelect);
    };

    enhanceAllSelects();
    document.addEventListener("click", event => {
      if (!event.target.closest(".site-select, .site-select-menu")) closeAllSelects();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeAllSelects();
    });
    window.addEventListener("resize", () => closeAllSelects(), { passive:true });

    if (typeof MutationObserver === "function") {
      let refreshQueued = false;
      const observer = new MutationObserver(() => {
        if (refreshQueued) return;
        refreshQueued = true;
        requestAnimationFrame(() => {
          refreshQueued = false;
          enhanceAllSelects();
        });
      });
      observer.observe(document.body, { childList:true, subtree:true });
    }
  };

  const initMobilePageReturn = () => {
    if (
      !document.body
      || document.body.classList.contains("marchand-page")
      || document.querySelector(".mobile-page-return")
    ) return;

    const mobileQuery = window.matchMedia("(max-width:700px)");
    const button = document.createElement("button");
    button.className = "mobile-page-return";
    button.type = "button";
    button.hidden = true;
    button.tabIndex = -1;
    button.setAttribute("aria-label", "Return to the top of this page");
    button.setAttribute("aria-hidden", "true");
    button.innerHTML = '<span aria-hidden="true">↑</span><strong>Back to top</strong>';
    const footer = document.querySelector(".site-footer");
    if (footer) footer.insertAdjacentElement("beforebegin", button);
    else document.body.append(button);

    let eligible = false;
    const syncVisibility = () => {
      const visible = eligible && window.scrollY > window.innerHeight * 2.25;
      button.classList.toggle("is-visible", visible);
      button.tabIndex = visible ? 0 : -1;
      button.setAttribute("aria-hidden", String(!visible));
    };
    const syncEligibility = () => {
      const pageHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      eligible = mobileQuery.matches && pageHeight > window.innerHeight * 5.5;
      const shouldHide = !eligible;
      if (button.hidden !== shouldHide) button.hidden = shouldHide;
      syncVisibility();
    };

    let eligibilityQueued = false;
    const queueEligibility = () => {
      if (eligibilityQueued) return;
      eligibilityQueued = true;
      requestAnimationFrame(() => {
        eligibilityQueued = false;
        syncEligibility();
      });
    };

    button.addEventListener("click", () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
      window.scrollTo({ top:0, behavior:reduceMotion ? "auto" : "smooth" });
    });
    window.addEventListener("scroll", syncVisibility, { passive:true });
    window.addEventListener("resize", queueEligibility, { passive:true });
    window.addEventListener("load", queueEligibility, { once:true });
    mobileQuery.addEventListener("change", queueEligibility);

    if (typeof MutationObserver === "function") {
      const observer = new MutationObserver(queueEligibility);
      observer.observe(document.body, { childList:true, subtree:true });
    }

    requestAnimationFrame(queueEligibility);
  };

  if (typeof document.querySelector === "function") {
    initResponsiveNavigation();
    initResponsiveProfileTools();
    initSiteSelects();
    initMobilePageReturn();
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
