(() => {
  const roastPlayerByRule = Object.freeze({
    1: "chris-o",
    2: "nasa-al",
    3: "alex-c",
    4: "kishan",
    5: "brad-r",
    6: "red",
    7: "hiro",
    8: "cougar",
    9: "hayden-d",
    10: "vish",
    11: "phattedcalf",
    12: "jeff-t",
    13: "li-fo",
    14: "pat",
    15: "nitro",
    16: "ai-dave",
    17: "buffalomike",
    18: "vic",
    19: "bostnmike",
    20: "wild-bill",
    21: "providencemike",
    22: "griffin",
    23: "the-architect",
    24: "bostnmike",
    25: "tim-s",
    26: "ahmed",
    27: "chris-f",
    28: "li-fo",
    29: "bostnmike",
    30: "hiro",
    31: "ahmed"
  });

  function addRoastAvatars(players) {
    const playersBySlug = new Map(
      players.map((player) => [String(player?.slug || "").toLowerCase(), player])
    );

    document.querySelectorAll(".rule-card").forEach((card) => {
      const head = card.querySelector(".rule-card-head");
      const ruleNumber = Number(card.querySelector(".dealer-button-number")?.textContent);
      const player = playersBySlug.get(roastPlayerByRule[ruleNumber]);

      if (!head || !player?.image || head.querySelector(".rule-roast-avatar")) return;

      const avatar = document.createElement("img");
      avatar.className = "rule-roast-avatar";
      avatar.src = player.image;
      avatar.alt = player.name;
      avatar.title = `Roasted player: ${player.name}`;
      avatar.loading = "lazy";
      avatar.decoding = "async";
      avatar.width = 46;
      avatar.height = 46;
      avatar.addEventListener("error", () => avatar.remove(), { once: true });
      head.append(avatar);
    });
  }

  function initRuleChapters() {
    const chapters = [...document.querySelectorAll(".rules-chapter")];
    const mobileQuery = window.matchMedia("(max-width: 640px)");

    function setChapterState(chapter, isOpen) {
      const toggle = chapter.querySelector(".rules-chapter-toggle");
      const grid = chapter.querySelector(".rules-grid");
      if (!toggle || !grid) return;

      toggle.setAttribute("aria-expanded", String(isOpen));
      const chapterName = chapter.querySelector(".section-head h2")?.textContent.trim() || "chapter";
      toggle.setAttribute("aria-label", `${isOpen ? "Collapse" : "Expand"} ${chapterName} rules`);
      chapter.classList.toggle("is-open", isOpen);
      grid.hidden = mobileQuery.matches ? !isOpen : false;
    }

    function openChapter(chapter) {
      chapters.forEach((item) => setChapterState(item, item === chapter));
    }

    function openLinkedChapter() {
      if (!mobileQuery.matches) return;
      const target = document.getElementById(window.location.hash.slice(1));
      if (!target?.classList.contains("rules-chapter")) return;
      openChapter(target);
      target.scrollIntoView({ block: "start" });
    }

    function syncChapterLayout(event) {
      chapters.forEach((chapter, index) => {
        const toggle = chapter.querySelector(".rules-chapter-toggle");
        const isOpen = mobileQuery.matches
          ? (event?.matches ? index === 0 : toggle?.getAttribute("aria-expanded") === "true" || index === 0)
          : true;
        setChapterState(chapter, isOpen);
      });
      openLinkedChapter();
    }

    chapters.forEach((chapter) => {
      chapter.querySelector(".rules-chapter-toggle")?.addEventListener("click", () => {
        if (!mobileQuery.matches) return;
        const isOpen = chapter.classList.contains("is-open");
        if (isOpen) setChapterState(chapter, false);
        else openChapter(chapter);
      });
    });

    document.querySelectorAll('.rules-mobile-jump a, .rule-card a[href="#rules-mtt-bounties"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        if (!mobileQuery.matches) return;
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        event.preventDefault();
        openChapter(target);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    mobileQuery.addEventListener?.("change", syncChapterLayout);
    window.addEventListener("hashchange", openLinkedChapter);
    syncChapterLayout();
  }

  initRuleChapters();

  fetch("data/player-metadata.json?v=20260907-1", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`Player metadata request failed (${response.status})`);
      return response.json();
    })
    .then((data) => addRoastAvatars(Array.isArray(data?.players) ? data.players : []))
    .catch((error) => console.warn("Rule roast avatars unavailable.", error));
})();
