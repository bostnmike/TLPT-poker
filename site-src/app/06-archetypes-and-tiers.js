function getPlayerArchetypeScores(player) {
  if (!player || isPlayerUnscouted(player)) return [];

  const aggression = Number(player?.aggressionIndex ?? 0);
  const clutch = Number(player?.clutchIndex ?? 0);
  const survivor = Number(player?.survivorIndex ?? 0);
  const luck = Number(player?.luckIndex ?? 0);
  const composure = Number(player?.tiltIndex ?? 0);
  const bubbles = Number(player?.bubbles ?? 0);
  const rebuys = Number(player?.rebuys ?? 0);
  const hits = Number(player?.hits ?? 0);

  const archetypes = [
    {
      key: "hitman",
      emoji: "💥",
      name: "The Hitman",
      desc: "knocking players out like it’s a contact sport",
      score: aggression + hits * 0.8
    },
    {
      key: "closer",
      emoji: "🔒",
      name: "The Closer",
      desc: "somehow always shows up when the chips matter",
      score: clutch * 1.25
    },
    {
      key: "grinder",
      emoji: "⚙️",
      name: "The Grinder",
      desc: "Joey Knish would be proud, you’re steady and dangerous, if not a little boring.",
      score: survivor * 1.05 + composure * 0.45 - aggression * 0.35
    },
    {
      key: "lucky",
      emoji: "😈",
      name: "The Lucky Devil",
      desc: "running hotter than probability should allow... and yeah the table knows it",
      score: luck * 1.15
    },
    {
      key: "wildcard",
      emoji: "🌀",
      name: "The Wildcard",
      desc: "agent of chaos capable of brilliance or disaster on any orbit",
      score: (100 - composure) * 1.1 + rebuys * 0.8
    },
    {
      key: "bubblemagnet",
      emoji: "🫧",
      name: "The Bubble Magnet",
      desc: "the bridesmaid who's always close enough to smell the money",
      score: bubbles * 4 + clutch * 0.15
    },
    {
      key: "technician",
      emoji: "🧠",
      name: "The Technician",
      desc: "playing strong poker without needing the drama... or the money",
      score: (clutch + survivor + aggression) / 3
    }
  ];

  return archetypes.sort((a, b) => b.score - a.score);
}

function getPlayerArchetypes(player) {
  const ranked = getPlayerArchetypeScores(player);

  const primary = ranked[0] || {
    key: "unscouted",
    emoji: "🔭",
    name: "Unscouted",
    desc: "waiting for a first TLPT appearance before assigning a play style.",
    score: 0
  };

  const secondary = ranked[1] || primary;

  return {
    primary,
    secondary,
    ranked
  };
}

function getPlayerArchetype(player) {
  return getPlayerArchetypes(player).primary;
}

function normalizeHallMetric(players, player, key, higherIsBetter = true) {
  const values = players
    .map(item => Number(item?.[key] ?? 0))
    .filter(value => !Number.isNaN(value));

  if (!values.length) return 0;

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) return 100;

  const value = Number(player?.[key] ?? 0);

  const normalized = higherIsBetter
    ? ((value - min) / (max - min)) * 100
    : ((max - value) / (max - min)) * 100;

  return Math.max(0, Math.min(100, normalized));
}


function getHallScore(player, players = []) {
  if (!player) return 0;

  const profit = normalizeHallMetric(players, player, "profit");
  const roi = normalizeHallMetric(players, player, "roi");
  const cashRate = normalizeHallMetric(players, player, "cashRate");
  const skill = normalizeHallMetric(players, player, "trueSkillScore");
  const longevity = Math.min((Number(player.buyIns ?? 0) / 25) * 100, 100);

  return (
    (profit * 0.30) +
    (roi * 0.25) +
    (cashRate * 0.20) +
    (skill * 0.15) +
    (longevity * 0.10)
  );
}

function getPlayerTierScore(player) {
  if (!player) return -999;
  if (isPlayerUnscouted(player)) return 0;

  /*
   * Use buyIns for sample size because buyIns represent separate tournament
   * appearances. Rebuys are handled independently by the rebuy penalty.
   */
  const buyIns = Number(player?.buyIns ?? 0);
  const rebuys = Number(player?.rebuys ?? 0);
  const trueSkill = Number(player?.trueSkillScore ?? 0);
  const clutch = Number(player?.clutchIndex ?? 0);
  const aggression = Number(player?.aggressionIndex ?? 0);
  const survivor = Number(player?.survivorIndex ?? 0);
  const composure = Number(player?.tiltIndex ?? 0);

  let sampleBonus = 0;

  if (buyIns >= 20) {
    sampleBonus = 3.0;
  } else if (buyIns >= 15) {
    sampleBonus = 2.0;
  } else if (buyIns >= 10) {
    sampleBonus = 1.0;
  } else if (buyIns >= CREW_ESTABLISHED_MIN_BUY_INS) {
    sampleBonus = 0.25;
  } else if (buyIns >= CREW_PROVISIONAL_MIN_BUY_INS) {
    /*
     * Provisional players remain visible, but do not receive an established
     * sample bonus or participate in official rankings.
     */
    sampleBonus = 0;
  } else {
    sampleBonus = -2.0;
  }

  const rebuyPenalty = rebuys * 0.6;

  return (
    (trueSkill * 1.5) +
    (clutch * 1.1) +
    (aggression * 0.65) +
    (survivor * 1.0) +
    (composure * 1.25) +
    sampleBonus -
    rebuyPenalty
  );
}

function getArchetypeMix(player) {
  const ranked = getPlayerArchetypeScores(player);

  if (!ranked.length) return [];

  const minScore = Math.min(...ranked.map(item => Number(item.score ?? 0)));
  const shifted = ranked.map(item => {
    const raw = Number(item.score ?? 0);
    const adjusted = minScore < 0 ? raw - minScore + 0.01 : raw + 0.01;
    return {
      ...item,
      adjusted
    };
  });

  const total = shifted.reduce((sum, item) => sum + item.adjusted, 0) || 1;

  return shifted.map(item => ({
    ...item,
    pct: (item.adjusted / total) * 100
  }));
}

function archetypeMixMarkup(player) {
  const mix = getArchetypeMix(player);
  if (!mix.length) return "";

  const toneMap = {
    hitman: "var(--red)",
    closer: "#7ecbff",
    grinder: "#86efac",
    lucky: "#d8b4fe",
    wildcard: "#f9a8d4",
    bubblemagnet: "#93c5fd",
    technician: "var(--gold)"
  };

  return `
    <div id="player-archetypes" class="player-archetype-spectrum-shell">
      <div class="player-archetype-spectrum-head">
        <div class="kicker player-archetype-spectrum-kicker">Archetype Mix</div>
        <div class="player-archetype-spectrum-sub">How much of each table personality is in the tank.</div>
      </div>

      <div class="player-archetype-spectrum-bar" aria-label="Archetype percentage mix">
        ${mix.map(item => `
          <div
            class="player-archetype-spectrum-segment"
            data-archetype-key="${item.key}"
            style="width:${item.pct}%; background:${toneMap[item.key] || 'var(--gold)'};"
            title="${item.emoji} ${item.name}: ${item.pct.toFixed(1)}%"
          ></div>
        `).join("")}
      </div>

      <div class="player-archetype-spectrum-legend">
        ${mix.map(item => `
          <div class="player-archetype-spectrum-chip" data-archetype-key="${item.key}">
            <span
              class="player-archetype-spectrum-dot"
              style="background:${toneMap[item.key] || 'var(--gold)'};"
            ></span>
            <span class="player-archetype-spectrum-label">${item.emoji} ${item.name}</span>
            <span class="player-archetype-spectrum-value">${item.pct.toFixed(1)}%</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function wireArchetypeMixHover(scope = document) {
  const shell = scope.querySelector(".player-archetype-spectrum-shell");
  if (!shell) return;

  const segments = [...shell.querySelectorAll(".player-archetype-spectrum-segment")];
  const chips = [...shell.querySelectorAll(".player-archetype-spectrum-chip")];
  const allTargets = [...segments, ...chips];

  chips.forEach(chip => {
    chip.dataset.defaultBackground = chip.style.background || "";
    chip.dataset.defaultBorderColor = chip.style.borderColor || "";
    chip.dataset.defaultBoxShadow = chip.style.boxShadow || "";
    chip.dataset.defaultTransform = chip.style.transform || "";
  });

  segments.forEach(segment => {
    segment.dataset.defaultFilter = segment.style.filter || "";
    segment.dataset.defaultBoxShadow = segment.style.boxShadow || "";
    segment.dataset.defaultOpacity = segment.style.opacity || "";
  });

  const clearActive = () => {
    segments.forEach(segment => {
      segment.classList.remove("is-hover-match");
      segment.style.filter = segment.dataset.defaultFilter || "";
      segment.style.boxShadow = segment.dataset.defaultBoxShadow || "";
      segment.style.opacity = segment.dataset.defaultOpacity || "";
      // IMPORTANT: do NOT clear segment background
    });

    chips.forEach(chip => {
      chip.classList.remove("is-hover-match");
      chip.style.transform = chip.dataset.defaultTransform || "";
      chip.style.borderColor = chip.dataset.defaultBorderColor || "";
      chip.style.background = chip.dataset.defaultBackground || "";
      chip.style.boxShadow = chip.dataset.defaultBoxShadow || "";
    });
  };

  const activateKey = (key) => {
    if (!key) return;

    segments.forEach(segment => {
      if (segment.dataset.archetypeKey !== key) return;
      segment.classList.add("is-hover-match");
      segment.style.filter = "brightness(1.18)";
      segment.style.boxShadow = "inset 0 0 0 2px rgba(255,255,255,.28)";
      segment.style.opacity = "1";
    });

    chips.forEach(chip => {
      if (chip.dataset.archetypeKey !== key) return;
      chip.classList.add("is-hover-match");
      chip.style.transform = "translateY(-1px)";
      chip.style.borderColor = "rgba(255,184,28,.34)";
      chip.style.background =
        "linear-gradient(180deg, rgba(255,184,28,.10), rgba(255,184,28,.03)), rgba(255,255,255,.02)";
      chip.style.boxShadow =
        "inset 0 1px 0 rgba(255,255,255,.05), 0 8px 18px rgba(0,0,0,.18), 0 0 14px rgba(255,184,28,.10)";
    });
  };

  allTargets.forEach(el => {
    el.addEventListener("mouseenter", () => {
      clearActive();
      activateKey(el.dataset.archetypeKey);
    });

    el.addEventListener("mouseleave", () => {
      clearActive();
    });

    el.addEventListener("focus", () => {
      clearActive();
      activateKey(el.dataset.archetypeKey);
    });

    el.addEventListener("blur", () => {
      clearActive();
    });
  });
}

function getPlayerTier(player, allPlayers = []) {
  if (!player) {
    return {
      emoji: "🧍",
      name: "Unknown",
      desc: "still waiting for enough hands to say anything useful"
    };
  }

  if (!isCrewVisible(player)) {
    return {
      emoji: "⏳",
      name: "Not Yet in the Field",
      desc: "waiting for a first TLPT tournament appearance"
    };
  }

  if (isCrewRookie(player)) {
    return {
      emoji: "🌱",
      name: "Rookie",
      desc: "in the field and building the sample needed for Provisional status"
    };
  }

  if (isCrewProvisional(player)) {
    return {
      emoji: "🧪",
      name: "Provisional",
      desc: "showing early results, but not yet eligible for an official Power Rank"
    };
  }

  const eligiblePlayers = (allPlayers || []).filter(isCrewEstablished);
  const ranked = [...eligiblePlayers].sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a));
  const index = ranked.findIndex(p => p.name === player.name);
  const rank = index >= 0 ? index + 1 : ranked.length + 1;
  const total = Math.max(ranked.length, 1);
  const pct = rank / total;

  if (pct <= 0.15) {
    return {
      emoji: "🦈",
      name: "The Apex Predator",
      desc: "the kind of player who makes a full table suddenly behave... or fold"
    };
  }

  if (pct <= 0.35) {
    return {
      emoji: "⚔️",
      name: "The Table Crusher",
      desc: "consistently dangerous and almost never a comfortable draw"
    };
  }

  if (pct <= 0.60) {
    return {
      emoji: "☄️",
      name: "The Shot Maker",
      desc: "capable of real damage when the cards and courage line up"
    };
  }

  if (pct <= 0.80) {
    return {
      emoji: "🎲",
      name: "The Gambler",
      desc: "volatile, entertaining, and always one orbit from chaos"
    };
  }

  return {
    emoji: "🍣",
    name: "The League Sponsor",
    desc: "keeping the prize pool healthy, one decision at a time"
  };
}

