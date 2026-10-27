function getEligiblePlayers(players) {
  return (players || []).filter(player => Number(player?.entries ?? 0) >= 5);
}

function isCrewVisible(player) {
  return Number(player?.buyIns ?? 0) >= CREW_ROOKIE_MIN_BUY_INS;
}

// Membership changes visibility only, never identity, eligibility, ratings, or RSVPs.
function isPlayerAlumni(player) {
  return player?.rosterStatus === "alumni";
}

function crewRosterPlayers(players, roster = "active") {
  return (players || []).filter(player => roster === "all" ||
    (roster === "alumni" ? isPlayerAlumni(player) : !isPlayerAlumni(player)));
}

function isCrewRookie(player) {
  const appearances = Number(player?.buyIns ?? 0);
  return appearances >= CREW_ROOKIE_MIN_BUY_INS &&
    appearances < CREW_PROVISIONAL_MIN_BUY_INS;
}

function isCrewProvisional(player) {
  const appearances = Number(player?.buyIns ?? 0);
  return appearances >= CREW_PROVISIONAL_MIN_BUY_INS &&
    appearances < CREW_ESTABLISHED_MIN_BUY_INS;
}

/* Existing site leader pools continue to use the 3-appearance qualification. */
function isCrewEligible(player) {
  return Number(player?.buyIns ?? 0) >= CREW_ELIGIBLE_MIN_BUY_INS;
}

/* Only established players participate in Power Rank and percentile tiers. */
function isCrewEstablished(player) {
  return Number(player?.buyIns ?? 0) >= CREW_ESTABLISHED_MIN_BUY_INS;
}

/*
 * Hall qualification:
 * Uses separate tournament appearances, not entries.
 */
function getHallMinimumAppearances(totalEvents = 0) {
  return Math.max(
    Math.ceil(totalEvents * HALL_PERCENTAGE),
    HALL_MIN_EVENTS
  );
}

function isHallEligible(player, totalEvents = 0) {
  return Number(player?.buyIns ?? 0) >= getHallMinimumAppearances(totalEvents);
}

async function loadHallHistoryData(data) {
  const version = data?.generatedAt
    ? `?v=${encodeURIComponent(data.generatedAt)}`
    : "";

  const historyRes = await fetch(`/data/generated/event-history.json${version}`);

  if (!historyRes.ok) {
    throw new Error(`Failed to load Hall event history (${historyRes.status})`);
  }

  const history = await historyRes.json();
  const events = Array.isArray(history?.events) ? history.events : [];

  if (Number(history?.eventCount) !== events.length) {
    throw new Error("Hall event history bundle is incomplete");
  }

  return {
    eventCount: events.length,
    events
  };
}

function buildHallHistoryMetrics(historyEvents = []) {
  const timesBusted = new Map();
  const lazarusCount = new Map();

  historyEvents.forEach(event => {
    const actions = Array.isArray(event?.actions) ? event.actions : [];

    actions.forEach(action => {
      if (!["bustout", "bustout_uncredited"].includes(action?.type) || !action?.slug) return;

      const slug = String(action.slug).toLowerCase();
      timesBusted.set(slug, (timesBusted.get(slug) || 0) + 1);
    });

    const firstBustout = actions.find(
      action => ["bustout", "bustout_uncredited"].includes(action?.type) && action?.slug
    );

    const firstOutSlug = String(firstBustout?.slug || "").toLowerCase();
    if (!firstOutSlug) return;

    const recoveredToCash = (event?.winners || []).some(
      winner => String(winner?.slug || "").toLowerCase() === firstOutSlug
    );

    if (recoveredToCash) {
      lazarusCount.set(
        firstOutSlug,
        (lazarusCount.get(firstOutSlug) || 0) + 1
      );
    }
  });

  return {
    timesBusted,
    lazarusCount
  };
}

function getHallPlayers(data, hallHistory = null) {
  const players = data?.players || [];

  /*
   * Hall qualification must use the full parsed TLPT event history.
   * data.events contains the upcoming schedule and is not historical data.
   */
  const totalEvents = Number(hallHistory?.eventCount ?? 0);
  const historyEvents = hallHistory?.events || [];
  const historyMetrics = buildHallHistoryMetrics(historyEvents);

  const eligiblePlayers = players.filter(
    player => isHallEligible(player, totalEvents)
  );

  return eligiblePlayers.map(player => {
    const slug = String(player?.slug || "").toLowerCase();
    const entries = Number(player?.entries ?? 0);
    const hits = Number(player?.hits ?? 0);

    return {
      ...player,
      hallScore: getHallScore(player, eligiblePlayers),
      variancePain: Math.abs(Number(player?.luckIndex ?? 0)),
      knockoutRate: entries > 0 ? hits / entries : 0,
      timesBusted: historyMetrics.timesBusted.get(slug) || 0,
      lazarusCount: historyMetrics.lazarusCount.get(slug) || 0
    };
  });
}

function getLeaderByRule(players, rule, customPool = null) {
  if (!rule || !rule.key) return null;

  const eligiblePlayers = Array.isArray(customPool)
    ? customPool
    : getEligiblePlayers(players);
  if (!eligiblePlayers.length) return null;

  const sorted = [...eligiblePlayers].sort((a, b) => {
    const aVal = Number(a?.[rule.key] ?? 0);
    const bVal = Number(b?.[rule.key] ?? 0);

    if (rule.direction === "asc") {
      if (aVal !== bVal) return aVal - bVal;
    } else {
      if (bVal !== aVal) return bVal - aVal;
    }

    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });

  return sorted[0] || null;
}

function statValueClass(player, key) {
  if (!new Set(["profit", "tournamentProfit", "bountyNet"]).has(key)) return "";
  const value = Number(player?.[key] ?? 0);
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function valueClassFromMoneyString(value) {
  const raw = String(value || "").replace(/[^0-9.-]/g, "");
  const num = Number(raw);
  if (Number.isNaN(num)) return "";
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "neutral";
}

function isNumericValueText(value) {
  const v = String(value || "").trim();
  return /^-?\$?\d[\d,]*(\.\d+)?%?$/.test(v);
}

function initialsFromName(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function displayPlayerName(player) {
  if (!player) return "";

  let name = player.name || "";

  if (NAME_FIXES[name]) {
    name = NAME_FIXES[name];
  }

  const entries = Number(player?.entries ?? 0);

  if (entries < 5 && !isPlayerUnscouted(player)) {
    return `${name}<span class="player-entry-asterisk" title="* fewer than 5 league entries">*</span>`;
  }

  return name;
}

function displayPlayerNamePlain(player) {
  if (!player) return "";

  let name = player.name || "";

  if (NAME_FIXES[name]) {
    name = NAME_FIXES[name];
  }

  return name;
}

