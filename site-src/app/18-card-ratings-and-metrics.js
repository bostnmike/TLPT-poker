function clampPct(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function playerDnaMetrics(player) {
  return [
    {
      label: "Aggression",
      value: clampPct(player?.aggressionIndex),
      tone: "red"
    },
    {
      label: "Clutch",
      value: clampPct(player?.clutchIndex),
      tone: "gold"
    },
    {
      label: "Survival",
      value: clampPct(player?.survivorIndex),
      tone: "green"
    },
    {
      label: "Composure",
      value: clampPct(player?.tiltIndex),
      tone: "violet"
    },
    {
      label: "Finish Rate",
      value: clampPct(Number(player?.hitRate ?? 0) * 100),
      tone: "blue"
    },
    {
      label: "Bubble Risk",
      value: clampPct(Number(player?.bubbleRate ?? 0) * 100),
      tone: "slate"
    }
  ];
}

function playerDnaMarkup(player) {
  const metrics = playerDnaMetrics(player);

  return `
    <div id="player-dna" class="player-dna-card">
      <div class="player-dna-head">
        <h3>🧬 Player DNA</h3>
        <p class="muted">A visual snapshot of how this player tends to win, wobble, and survive.</p>
      </div>

      <div class="player-dna-grid">
        ${metrics.map(metric => `
          <div class="player-dna-row dna-row-${metric.tone}">
            <div class="player-dna-label-wrap">
              <span class="player-dna-label">${metric.label}</span>
              <span class="player-dna-value">${Math.round(metric.value)}%</span>
            </div>
            <div class="player-dna-bar">
              <div class="player-dna-fill dna-${metric.tone}" style="width:${metric.value}%"></div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function playerCardBenchmarkPool(players) {
  const established = (players || []).filter(isCrewEstablished);

  if (established.length >= 2) return established;

  const crew = (players || []).filter(isCrewEligible);
  const played = (players || []).filter(player => !isPlayerUnscouted(player));
  return crew.length >= 2 ? crew : played;
}

function playerCardDisplayRating(rating) {
  const safeRating = Math.max(1, Math.min(99, Number(rating) || 0));
  return Math.round(safeRating);
}

function playerCardMetricRating(player, players, key, minRating = 40, maxRating = 96) {
  const pool = playerCardBenchmarkPool(players);
  const values = pool
    .map(item => Number(item?.[key]))
    .filter(Number.isFinite);

  if (!values.length) return playerCardDisplayRating(68);

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const value = Number(player?.[key] ?? 0);

  const normalized = maxValue === minValue
    ? 0.5
    : (value - minValue) / (maxValue - minValue);

  const bounded = Math.max(0, Math.min(1, normalized));
  const rating = minRating + (bounded * (maxRating - minRating));

  return playerCardDisplayRating(rating);
}

function playerCardTierMeta(player, players) {
  const appearances = Number(player?.buyIns ?? 0);
  const tier = getPlayerTier(player, players);
  const eligiblePlayers = (players || [])
    .filter(isCrewEstablished)
    .sort((a, b) => getPlayerTierScore(b) - getPlayerTierScore(a));
  const rankIndex = eligiblePlayers.findIndex(item => item.name === player?.name);

  const tierMap = {
    "The Apex Predator": { code: "S", className: "s" },
    "The Table Crusher": { code: "A", className: "a" },
    "The Shot Maker": { code: "B", className: "b" },
    "The Gambler": { code: "C", className: "c" },
    "The League Sponsor": { code: "D", className: "d" }
  };

  const mappedTier = tierMap[tier.name] || { code: "—", className: "prospect" };

  if (isPlayerUnscouted(player)) {
    return {
      ...tier,
      code: "UNS",
      className: "unscouted",
      status: "Unscouted",
      statusDetail: "First TLPT appearance activates Rookie ratings; Power Rank begins at 5",
      rank: null,
      totalRanked: eligiblePlayers.length
    };
  }

  if (appearances < CREW_PROVISIONAL_MIN_BUY_INS) {
    const appearancesToProvisional = Math.max(
      CREW_PROVISIONAL_MIN_BUY_INS - appearances,
      0
    );

    return {
      ...tier,
      code: "RKI",
      className: "rookie",
      status: "Rookie",
      statusDetail: `${appearancesToProvisional} more ${appearancesToProvisional === 1 ? "appearance" : "appearances"} for Provisional status; Power Rank begins at 5`,
      rank: null,
      totalRanked: eligiblePlayers.length
    };
  }

  if (appearances < CREW_ESTABLISHED_MIN_BUY_INS) {
    const appearancesToEstablished = CREW_ESTABLISHED_MIN_BUY_INS - appearances;

    return {
      ...tier,
      code: "PRO",
      className: "provisional",
      status: "Provisional",
      statusDetail: `${appearancesToEstablished} more ${appearancesToEstablished === 1 ? "appearance" : "appearances"} for an established rating and Power Rank`,
      rank: null,
      totalRanked: eligiblePlayers.length
    };
  }

  return {
    ...tier,
    ...mappedTier,
    status: "Established",
    statusDetail: `${appearances} career appearances`,
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    totalRanked: eligiblePlayers.length
  };
}

function playerCardOverallRating(player, players) {
  if (isPlayerUnscouted(player)) return "NR";

  const appearances = Math.max(0, Number(player?.buyIns ?? 0));
  const powerIndex = Number(player?.trueSkillScore ?? 0);
  const confidence = appearances /
    (appearances + CARD_OVERALL_CONFIDENCE_APPEARANCES);
  const adjustedPower = CARD_OVERALL_BASELINE_POWER +
    (confidence * (powerIndex - CARD_OVERALL_BASELINE_POWER));
  const rating = CARD_OVERALL_BASELINE_RATING +
    ((adjustedPower - CARD_OVERALL_BASELINE_POWER) /
      CARD_OVERALL_POWER_PER_RATING);

  return Math.max(
    CARD_OVERALL_MIN_RATING,
    Math.min(CARD_OVERALL_MAX_RATING, playerCardDisplayRating(rating))
  );
}

const PLAYER_CARD_TIER_PRIORITY = Object.freeze({
  S: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  PRO: 5,
  RKI: 6,
  UNS: 7
});

function playerCardTierPriority(player, players) {
  const tierCode = playerCardTierMeta(player, players).code;
  return PLAYER_CARD_TIER_PRIORITY[tierCode] ?? 7;
}

function playerCardRatingComparator(players) {
  return (a, b) => {
    const tierDifference =
      playerCardTierPriority(a, players) - playerCardTierPriority(b, players);

    return tierDifference ||
      (Number(playerCardOverallRating(b, players)) || 0) -
        (Number(playerCardOverallRating(a, players)) || 0) ||
      getPlayerTierScore(b) - getPlayerTierScore(a) ||
      String(a?.name || "").localeCompare(String(b?.name || ""));
  };
}

function playerCardAttributes(player, players, options = {}) {
  if (isPlayerUnscouted(player)) {
    const raw = "Unrated • 0 career appearances";
    const formula = "Ratings begin after the player's first TLPT appearance.";
    return [
      { code: "RET", label: "Return", value: "—", raw, formula },
      { code: "CLT", label: "Clutch", value: "—", raw, formula },
      { code: "ITM", label: "In the Money", value: "—", raw, formula },
      { code: "AGR", label: "Aggression", value: "—", raw, formula },
      { code: "HIT", label: "Hit Rate", value: "—", raw, formula },
      { code: "SUR", label: "Survival", value: "—", raw, formula }
    ];
  }

  const periodLabel = options.periodLabel || "Career";
  const periodDescription = options.periodDescription || "career";
  const returnRating = Math.round(
    (playerCardMetricRating(player, players, "roi") * 0.65) +
    (playerCardMetricRating(player, players, "profit") * 0.35)
  );
  const appearances = Number(player?.buyIns ?? 0);
  const entries = Number(player?.entries ?? 0);
  const cashes = Number(player?.timesPlaced ?? 0);
  const hits = Number(player?.hits ?? 0);

  return [
    {
      code: "RET",
      label: "Return",
      value: returnRating,
      raw: `ROI ${fmtPct(player?.roi)} • ${periodLabel} Profit ${fmtMoney(player?.profit)}`,
      formula: `65% of the ROI rating plus 35% of the ${periodLabel} Profit rating. Both components are scaled against the comparable TLPT ${periodDescription} benchmark pool.`
    },
    {
      code: "CLT",
      label: "Clutch",
      value: playerCardMetricRating(player, players, "clutchIndex"),
      raw: `Clutch Index ${fmtNum(player?.clutchIndex)} • ${cashes} cash${cashes === 1 ? "" : "es"} in ${appearances} appearance${appearances === 1 ? "" : "s"}`,
      formula: `Clutch Index is normalized ${periodDescription} cash frequency: Times Placed ÷ Buy-ins. The result is then scaled to the card-rating range.`
    },
    {
      code: "ITM",
      label: "In the Money",
      value: playerCardMetricRating(player, players, "cashRate"),
      raw: `Cash Rate ${fmtPct(player?.cashRate)} • ${cashes} of ${appearances} appearances`,
      formula: `Cash Rate equals Times Placed ÷ Buy-ins, then scales against the comparable TLPT ${periodDescription} benchmark pool. Rebuys do not count as separate appearances.`
    },
    {
      code: "AGR",
      label: "Aggression",
      value: playerCardMetricRating(player, players, "aggressionIndex"),
      raw: `Aggression Index ${fmtNum(player?.aggressionIndex)} • ${hits} knockout${hits === 1 ? "" : "s"} in ${entries} entr${entries === 1 ? "y" : "ies"}`,
      formula: `Aggression Index normalizes ${periodDescription} knockouts per entry: Hits ÷ Entries. Entries include the initial buy-in and any rebuys.`
    },
    {
      code: "HIT",
      label: "Hit Rate",
      value: playerCardMetricRating(player, players, "hitRate"),
      raw: `Hit Rate ${fmtPct(player?.hitRate)} • ${hits} knockout${hits === 1 ? "" : "s"} in ${entries} entr${entries === 1 ? "y" : "ies"}`,
      formula: `Hit Rate equals Hits ÷ Entries, then scales against the comparable TLPT ${periodDescription} benchmark pool. Every rebuy adds another entry to the denominator.`
    },
    {
      code: "SUR",
      label: "Survival",
      value: playerCardMetricRating(player, players, "survivorIndex"),
      raw: `Survival Index ${fmtNum(player?.survivorIndex)} • Cash ${fmtPct(player?.cashRate)} • Bubble ${fmtPct(player?.bubbleRate)} • Hit ${fmtPct(player?.hitRate)}`,
      formula: `Survival starts with 55% Cash Rate, 25% Bubble Avoidance and 20% Hit Rate. That result is normalized across the TLPT ${periodDescription} benchmark pool and scaled to the card-rating range.`
    }
  ];
}

function playerCardWindowMetrics(players, windowKey) {
  return (players || [])
    .map(player => player?.cardForm?.[windowKey])
    .filter(window => Number(window?.eventCount || 0) > 0 && window?.metrics)
    .map(window => window.metrics);
}

function playerCardWindowDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${Number(match[2])}/${Number(match[3])}/${match[1].slice(2)}`;
}

function playerCardWindowRange(window) {
  const start = playerCardWindowDate(window?.startDate);
  const end = playerCardWindowDate(window?.endDate);
  if (!start && !end) return "No appearances yet";
  return start === end || !start ? (end || start) : `${start}–${end}`;
}

function playerCardMovementMeta(recentOverall, previousOverall, hasComparison) {
  if (!hasComparison) {
    return {
      label: "NEW FORM",
      className: "new",
      title: "A complete preceding five-appearance window is required for movement."
    };
  }

  const delta = recentOverall - previousOverall;
  if (delta > 0) {
    return {
      label: `▲ +${delta}`,
      className: "up",
      title: `${delta} rating point${delta === 1 ? "" : "s"} above the preceding five appearances.`
    };
  }

  if (delta < 0) {
    return {
      label: `▼ ${delta}`,
      className: "down",
      title: `${Math.abs(delta)} rating point${Math.abs(delta) === 1 ? "" : "s"} below the preceding five appearances.`
    };
  }

  return {
    label: "• 0",
    className: "flat",
    title: "Even with the preceding five appearances."
  };
}

function playerCardViewData(player, players) {
  const careerAppearances = Number(player?.buyIns ?? 0);
  const careerOverall = playerCardOverallRating(player, players);
  const unscouted = isPlayerUnscouted(player);
  const career = {
    key: "career",
    edition: "CAREER",
    overall: careerOverall,
    attributes: playerCardAttributes(player, players),
    overallRaw: unscouted
      ? "Unrated • 0 career appearances"
      : `Power Index ${fmtNum(player?.trueSkillScore)} • ${careerAppearances} career appearance${careerAppearances === 1 ? "" : "s"}`,
    overallFormula: unscouted
      ? "Ultimate Player Card ratings begin after the player's first TLPT appearance. No benchmark rating is assigned before then."
      : `${STAT_FORMULAS.trueSkillScore}. The fixed overall scale anchors a 160 Power Index at 70 OVR, adjusts confidence by appearances ÷ (appearances + 5), and moves one OVR point per 4.5 adjusted Power Index points. Ratings are limited to 40–97, reserving 98–99 for future exceptional standards.`,
    context: `Career • ${careerAppearances} appearance${careerAppearances === 1 ? "" : "s"}`,
    caveat: unscouted
      ? "Unscouted. Career card ratings and archetypes activate after the first TLPT appearance."
      : "Career view. The card tier, overall Power Rank and experience status use the full career sample.",
    movement: null
  };

  const recentWindow = player?.cardForm?.recent;
  const recentMetrics = recentWindow?.metrics;
  const recentCount = Number(recentWindow?.eventCount || 0);
  if (!recentMetrics || recentCount < 1) {
    return { career, lastFive: null };
  }

  const previousWindow = player?.cardForm?.previous;
  const previousMetrics = previousWindow?.metrics;
  const previousCount = Number(previousWindow?.eventCount || 0);
  const recentPool = playerCardWindowMetrics(players, "recent");
  const previousPool = playerCardWindowMetrics(players, "previous");
  const recentOverall = playerCardOverallRating(recentMetrics, recentPool);
  const hasComparison = recentCount === 5 && previousCount === 5 && previousMetrics;
  const previousOverall = hasComparison
    ? playerCardOverallRating(previousMetrics, previousPool)
    : null;
  const movement = playerCardMovementMeta(recentOverall, previousOverall, hasComparison);
  const recentLabel = recentCount === 5 ? "Last Five" : `Last ${recentCount}`;
  const range = playerCardWindowRange(recentWindow);

  return {
    career,
    lastFive: {
      key: "lastFive",
      edition: recentCount === 5 ? "LAST FIVE" : `LAST ${recentCount}`,
      overall: recentOverall,
      attributes: playerCardAttributes(recentMetrics, recentPool, {
        periodLabel: recentLabel,
        periodDescription: "recent-form"
      }),
      overallRaw: `Form Power Index ${fmtNum(recentMetrics?.trueSkillScore)} • ${recentCount} recent appearance${recentCount === 1 ? "" : "s"} • ${range}`,
      overallFormula: `${STAT_FORMULAS.trueSkillScore}. The form Power Index uses the same fixed, sample-adjusted 40–97 overall scale as the career card. Movement compares this rating with the preceding five appearances.`,
      context: `${recentLabel} • ${range}`,
      caveat: `${recentLabel} view. Scores use only this player's most recent appearances; the card tier, official Power Rank and experience status remain career-based.`,
      movement
    }
  };
}

