function playerCardHistoricalEventCount(data) {
  const streakCounts = Object.values(data?.streaks?.players || {})
    .map(item => Number(item?.playedEvents || 0));
  const appearanceCounts = (data?.players || [])
    .map(item => Number(item?.buyIns || 0));

  return Math.max(0, ...streakCounts, ...appearanceCounts);
}

function playerCardEditionClassName(edition) {
  return String(edition?.id || "base")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "base";
}

function playerCardEditionCatalogRecord(record) {
  const id = String(record?.id || "");
  const fixed = {
    "rookie": {
      className: "rookie",
      icon: "RC",
      eyebrow: "Rookie Edition",
      label: "Rookie Card",
      cardLabel: "Rookie Card",
      shortLabel: "ROOKIE",
      priority: 0
    },
    "hall-tax-collector": {
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Tax Collector",
      cardLabel: "Tax Collector",
      shortLabel: "HALL",
      priority: 4
    },
    "hall-direct-deposit": {
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "Direct Deposit",
      cardLabel: "Direct Deposit",
      shortLabel: "HALL",
      priority: 4
    },
    "hall-billing-department": {
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Billing Department",
      cardLabel: "Billing Dept.",
      shortLabel: "HALL",
      priority: 4
    },
    "infamy-boy-in-the-bubble": {
      className: "infamy",
      icon: "🔥",
      eyebrow: "Infamy Edition",
      label: "Boy in the Bubble",
      cardLabel: "Infamy",
      shortLabel: "INFAMY",
      priority: 4
    },
    "leader-profit": {
      className: "leader",
      icon: "💰",
      eyebrow: "League Leader Edition",
      label: "Profit Leader",
      cardLabel: "Profit Leader",
      shortLabel: "LEADER",
      priority: 3
    },
    "leader-knockouts": {
      className: "leader",
      icon: "💥",
      eyebrow: "League Leader Edition",
      label: "Knockout Leader",
      cardLabel: "KO Leader",
      shortLabel: "LEADER",
      priority: 3
    },
    "leader-bounties": {
      className: "leader",
      icon: "🏷️",
      eyebrow: "League Leader Edition",
      label: "Bounty Hunter",
      cardLabel: "Bounty Hunter",
      shortLabel: "LEADER",
      priority: 3
    },
    "leader-roi": {
      className: "leader",
      icon: "📈",
      eyebrow: "League Leader Edition",
      label: "ROI Leader",
      cardLabel: "ROI Leader",
      shortLabel: "LEADER",
      priority: 3
    },
    "leader-cash-rate": {
      className: "leader",
      icon: "🏧",
      eyebrow: "League Leader Edition",
      label: "Cash-Rate Leader",
      cardLabel: "Cash Leader",
      shortLabel: "LEADER",
      priority: 3
    }
  };

  let metadata = fixed[id] || null;

  if (!metadata && /^heater-\d+$/.test(id)) {
    const length = Number(record?.streakLength || id.split("-").pop() || 0);
    metadata = {
      className: "heater",
      icon: "🔥",
      eyebrow: "Heater Edition",
      label: `${length}-Game Cash Streak`,
      cardLabel: `${length}-Game Heater`,
      shortLabel: "HEATER",
      priority: 2
    };
  }

  if (!metadata && /^milestone-(10|25|50|75|100)$/.test(id)) {
    const milestone = Number(id.split("-").pop());
    const milestoneIcons = {
      10: "♦",
      25: "◈",
      50: "◆",
      75: "✦",
      100: "100"
    };
    metadata = {
      className: "milestone",
      icon: milestoneIcons[milestone],
      eyebrow: "Milestone Edition",
      label: `${milestone}-Appearance Club`,
      cardLabel: `${milestone} Club`,
      shortLabel: `${milestone} CLUB`,
      priority: 1
    };
  }

  return metadata ? { ...metadata, ...record, id } : null;
}

function playerCardEditionEarnedLabel(edition) {
  const earned = playerCardWindowDate(edition?.earnedDate);
  const upgraded = playerCardWindowDate(edition?.upgradedDate);

  if (earned && upgraded) return `Earned ${earned} • Upgraded ${upgraded}`;
  if (earned) return edition?.id === "rookie" ? `Debut ${earned}` : `Earned ${earned}`;
  return "";
}

function playerCardSpecialEditions(player, data) {
  const players = data?.players || [];
  if (!player || !players.length) return [];

  if (Array.isArray(player?.cardCollection)) {
    return player.cardCollection
      .map(playerCardEditionCatalogRecord)
      .filter(Boolean);
  }

  const samePlayer = candidate => candidate?.slug === player?.slug;
  const editions = [];
  const historicalEvents = playerCardHistoricalEventCount(data);
  const hallPool = players
    .filter(candidate => isHallEligible(candidate, historicalEvents))
    .map(candidate => ({
      ...candidate,
      knockoutRate: Number(candidate?.entries || 0) > 0
        ? Number(candidate?.hits || 0) / Number(candidate.entries)
        : 0
    }));

  const hallEditions = [
    {
      id: "hall-tax-collector",
      key: "profit",
      direction: "desc",
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Tax Collector",
      cardLabel: "Tax Collector",
      shortLabel: "HALL",
      reason: leader => `Highest Hall-qualified career profit at ${fmtMoney(leader?.profit)}.`
    },
    {
      id: "hall-direct-deposit",
      key: "cashRate",
      direction: "desc",
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "Direct Deposit",
      cardLabel: "Direct Deposit",
      shortLabel: "HALL",
      reason: leader => `Highest Hall-qualified career cash rate at ${fmtPct(leader?.cashRate)}.`
    },
    {
      id: "hall-billing-department",
      key: "knockoutRate",
      direction: "desc",
      className: "hall",
      icon: "🏛️",
      eyebrow: "Hall Edition",
      label: "The Billing Department",
      cardLabel: "Billing Dept.",
      shortLabel: "HALL",
      reason: leader => `Highest Hall-qualified knockout efficiency at ${Number(leader?.knockoutRate || 0).toFixed(2)} per entry.`
    },
    {
      id: "infamy-boy-in-the-bubble",
      key: "bubbles",
      direction: "desc",
      className: "infamy",
      icon: "🔥",
      eyebrow: "Infamy Edition",
      label: "Boy in the Bubble",
      cardLabel: "Infamy",
      shortLabel: "INFAMY",
      reason: leader => `Most Hall-qualified career bubbles with ${Number(leader?.bubbles || 0)} near misses.`
    }
  ];

  for (const edition of hallEditions) {
    const leader = getLeaderByRule(hallPool, edition, hallPool);
    if (!samePlayer(leader)) continue;
    editions.push({
      ...edition,
      reason: edition.reason(leader),
      priority: 4
    });
  }

  const establishedPool = players.filter(isCrewEstablished);
  const leaderEditions = [
    {
      id: "leader-profit",
      key: "profit",
      direction: "desc",
      icon: "💰",
      label: "Profit Leader",
      cardLabel: "Profit Leader",
      shortLabel: "LEADER",
      reason: leader => `Current established-player profit leader at ${fmtMoney(leader?.profit)}.`
    },
    {
      id: "leader-knockouts",
      key: "hits",
      direction: "desc",
      icon: "💥",
      label: "Knockout Leader",
      cardLabel: "KO Leader",
      shortLabel: "LEADER",
      reason: leader => `Current established-player knockout leader with ${Number(leader?.hits || 0)} hits.`
    },
    {
      id: "leader-bounties",
      key: "bountiesWon",
      direction: "desc",
      minimumValue: 1,
      icon: "🏷️",
      label: "Bounty Hunter",
      cardLabel: "Bounty Hunter",
      shortLabel: "LEADER",
      reason: leader => {
        const count = Number(leader?.bountiesWon || 0);
        return `Current established-player bounty leader with ${count} ${count === 1 ? "bounty" : "bounties"} collected.`;
      }
    },
    {
      id: "leader-roi",
      key: "roi",
      direction: "desc",
      icon: "📈",
      label: "ROI Leader",
      cardLabel: "ROI Leader",
      shortLabel: "LEADER",
      reason: leader => `Current established-player ROI leader at ${fmtPct(leader?.roi)}.`
    },
    {
      id: "leader-cash-rate",
      key: "cashRate",
      direction: "desc",
      icon: "🏧",
      label: "Cash-Rate Leader",
      cardLabel: "Cash Leader",
      shortLabel: "LEADER",
      reason: leader => `Current established-player cash-rate leader at ${fmtPct(leader?.cashRate)}.`
    }
  ];

  for (const edition of leaderEditions) {
    const leader = getLeaderByRule(establishedPool, edition, establishedPool);
    if (Number(leader?.[edition.key] || 0) < Number(edition.minimumValue || 0)) continue;
    if (!samePlayer(leader)) continue;
    editions.push({
      ...edition,
      className: "leader",
      eyebrow: "League Leader Edition",
      reason: edition.reason(leader),
      priority: 3
    });
  }

  const cashStreak = data?.streaks?.players?.[player.slug]?.currentCashStreak;
  const streakLength = Number(cashStreak?.length || 0);
  if (streakLength >= 2) {
    editions.push({
      id: `heater-${streakLength}`,
      className: "heater",
      icon: "🔥",
      eyebrow: "Heater Edition",
      label: `${streakLength}-Game Cash Streak`,
      cardLabel: `${streakLength}-Game Heater`,
      shortLabel: "HEATER",
      reason: `Active ${streakLength}-appearance cash streak from ${playerCardWindowDate(cashStreak?.startDate)} through ${playerCardWindowDate(cashStreak?.endDate)}.`,
      priority: 2
    });
  }

  const appearances = Number(player?.buyIns || 0);
  const milestoneIcons = {
    10: "♦",
    25: "◈",
    50: "◆",
    75: "✦",
    100: "100"
  };
  [100, 75, 50, 25, 10].forEach(milestone => {
    if (appearances < milestone) return;
    editions.push({
      id: `milestone-${milestone}`,
      className: "milestone",
      icon: milestoneIcons[milestone],
      eyebrow: "Milestone Edition",
      label: `${milestone}-Appearance Club`,
      cardLabel: `${milestone} Club`,
      shortLabel: `${milestone} CLUB`,
      reason: `${appearances} career tournament appearances and counting.`,
      priority: 1
    });
  });

  return editions;
}

function playerCardSpecialEdition(player, data) {
  const editions = playerCardSpecialEditions(player, data);
  const featuredId = playerCardFeaturedEditionId(player, data);
  return editions.find(edition => edition.id === featuredId) || null;
}

function playerCardFeaturedEditionId(player, data) {
  const editions = playerCardSpecialEditions(player, data);
  return editions.find(edition => edition.id !== "rookie")?.id || "base";
}

