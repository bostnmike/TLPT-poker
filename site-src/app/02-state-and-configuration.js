const DEFAULT_STANDINGS_SORT = "totalWinnings";
const DEFAULT_DASHBOARD_SORT = "hits";
let standingsStatSelection = DEFAULT_STANDINGS_SORT;
let dashboardStatSelection = DEFAULT_DASHBOARD_SORT;
const DASHBOARD_CATEGORY_DEFAULTS = Object.freeze({
  results: "hits",
  bankroll: "profit",
  rates: "roi",
  "player-dna": "trueSkillScore"
});
const DASHBOARD_METRICS_BY_CATEGORY = Object.freeze({
  results: Object.freeze([
    { key: "hits", icon: "💥", label: "Knockouts (Hits)" },
    { key: "bountiesWon", icon: "🏷️", label: "Bounties won" },
    { key: "timesPlaced", icon: "💵", label: "Cashes" },
    { key: "bubbles", icon: "🫧", label: "Bubbles" }
  ]),
  bankroll: Object.freeze([
    { key: "profit", icon: "💰", label: "Profit" },
    { key: "bountyNet", icon: "🧾", label: "Bounty profit / loss" }
  ]),
  rates: Object.freeze([
    { key: "roi", icon: "📈", label: "Return on investment (ROI)" },
    { key: "hitRate", icon: "💥", label: "Knockouts per entry" },
    { key: "cashRate", icon: "💵", label: "Cash Rate" },
    { key: "bubbleRate", icon: "🫧", label: "Bubble Rate" }
  ]),
  "player-dna": Object.freeze([
    { key: "trueSkillScore", icon: "💪🏼", label: "Power" },
    { key: "luckIndex", icon: "🍀", label: "Luck" },
    { key: "clutchIndex", icon: "🎯", label: "Clutch" },
    { key: "aggressionIndex", icon: "⚡", label: "Aggression" },
    { key: "survivorIndex", icon: "🛟", label: "Survivor" },
    { key: "tiltIndex", icon: "🧊", label: "Composure" }
  ])
});
const DASHBOARD_BOUNTY_SORTS = new Set(["bountiesWon", "bountyNet"]);
const DASHBOARD_BOUNTY_DATA_KEYS = [
  "bountiesWon",
  "bountyPaid",
  "bountyCollected",
  "bountyRetained",
  "bountyWinnings"
];
const dashboardLastSortByCategory = new Map(Object.entries(DASHBOARD_CATEGORY_DEFAULTS));
const SHOW_HOME_COMMISSIONER_REPORT = false;

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/*
 * Crew experience bands use separate tournament appearances.
 * buyIns counts initial tournament entries; rebuys do not count.
 *
 * 0 appearances: UNS / Unscouted — registered and awaiting a debut.
 * 1–2 appearances: RKI / Rookie — visible prospect, not Crew-eligible.
 * 3–4 appearances: PRO / Provisional — Crew-eligible, still unranked.
 * 5+ appearances: Established — Crew-eligible for Power Rank and power tiers.
 */
const CREW_ROOKIE_MIN_BUY_INS = 1;
const CREW_ELIGIBLE_MIN_BUY_INS = 3;
const CREW_PROVISIONAL_MIN_BUY_INS = CREW_ELIGIBLE_MIN_BUY_INS;
const CREW_ESTABLISHED_MIN_BUY_INS = 5;
const CARD_OVERALL_MIN_RATING = 40;
const CARD_OVERALL_MAX_RATING = 97;
const CARD_OVERALL_BASELINE_POWER = 160;
const CARD_OVERALL_BASELINE_RATING = 70;
const CARD_OVERALL_POWER_PER_RATING = 4.5;
const CARD_OVERALL_CONFIDENCE_APPEARANCES = 5;

function isPlayerUnscouted(player) {
  return Number(player?.buyIns ?? 0) <= 0;
}

/*
 * Hall of Fame qualification:
 * Players must have participated in 25% of TLPT history.
 * Minimum floor prevents the Hall from becoming too easy early.
 */
const HALL_PERCENTAGE = 0.25;
const HALL_MIN_EVENTS = 10;

let currentCrewView = "tier";
let currentArchetypeMode = "primary";
let currentArchetypeFilter = "all";
let currentCrewSearch = "";
let currentCrewRoster = "active";
let currentCrewVisibleCount = 0;
let currentCrewDisplay = "cards";
let currentCrewTier = "all";

const CREW_COUNT_TIERS = [
  ['all', 'All tiers', ''], ['s', 'Apex Predators', '🦈'], ['a', 'Table Crushers', '⚔️'],
  ['b', 'Shot Makers', '☄️'], ['c', 'Gamblers', '🎲'], ['d', 'League Sponsors', '🍣'],
  ['provisional', 'Provisional', '🧪'], ['rookie', 'Rookie', '🌱'], ['unscouted', 'Unscouted', '🔭']
];

function crewCountTier(player, allPlayers) {
  if (isPlayerUnscouted(player)) return 'unscouted';
  if (isCrewRookie(player)) return 'rookie';
  if (isCrewProvisional(player)) return 'provisional';
  return playerCardTierMeta(player, allPlayers).className;
}

function renderCrewCounts(roster, data) {
  const host = document.getElementById('crew-tier-counts');
  if (!host) return;
  host.innerHTML = CREW_COUNT_TIERS.map(([key, label, emoji]) => {
    const count = key === 'all' ? roster.length : roster.filter(p => crewCountTier(p, data.players) === key).length;
    return `<button type="button" class="crew-count-btn crew-count-${key}" data-crew-tier="${key}" aria-pressed="${key === currentCrewTier}" aria-controls="players-grid" ${count ? '' : 'disabled'}><span>${emoji ? `<span aria-hidden="true">${emoji}</span> ` : ''}${label}</span><strong>${count}</strong></button>`;
  }).join('');
  host.querySelectorAll('[data-crew-tier]').forEach(button => button.addEventListener('click', () => {
    currentCrewTier = button.dataset.crewTier;
    currentCrewView = 'tier';
    renderPlayers(data);
    host.querySelector(`[data-crew-tier="${currentCrewTier}"]`)?.focus({ preventScroll: true });
  }));
}

function crewMapPoints(players, allPlayers) {
  return players.filter(isCrewEstablished).flatMap(player => {
    const views = playerCardViewData(player, allPlayers);
    if (!views.lastFive || player.cardForm?.recent?.eventCount !== 5) return [];
    const tier = playerCardTierMeta(player, allPlayers);
    return [{ slug: player.slug, name: player.name, image: player.image, rosterStatus: player.rosterStatus,
      career: views.career.overall, form: views.lastFive.overall, appearances: player.buyIns,
      tier: tier.name, colorKey: tier.className, url: playerUrl(player) }];
  });
}

const STAT_FORMULAS = {
  tournamentWinnings: "Tournament Winnings: Prize-pool payouts only, excluding all bounty returns",
  tournamentCost: "Tournament Cost: Buy-ins and rebuys, excluding bounty purchases",
  tournamentProfit: "Tournament Profit: Prize-pool payouts minus tournament entry costs",
  totalCost: "Total Cost: Tournament entries + bounty money posted",
  totalWinnings: "Total Take-home: Tournament prize money + collected and retained bounty returns + any confirmed settlement adjustments",
  settlementAdjustment: "Settlement Adjustment: Confirmed extra cash paid, separate from tournament prizes and bounty returns. Does not count as a cash, knockout, or bounty win",
  profit: "Profit: Total Take-home − tournament entry costs − bounty money posted",
  roi: "ROI: Profit ÷ Total Cost",
  cashRate: "Cash Rate: Times Placed ÷ Buy-ins",
  bubbleRate: "Bubble Rate: Bubbles ÷ Buy-ins",
  hitRate: "Hit Rate: Hits ÷ (Buy-ins + Rebuys)",
  entries: "Entries: Buy-ins + Rebuys",
  buyIns: "Buy-ins: Total number of initial tournament entries purchased",
  rebuys: "Rebuys: Re-entry purchases after busting plus permitted live-stack reloads; reloads are not knockouts",
  hits: "Hits: Total number of opponents eliminated by the player",
  timesPlaced: "Times Placed: Total number of times the player finished in the money",
  bubbles: "Bubbles: Total number of times the player finished one position outside the money",
  bountiesWon: "Bounties Won: Eligible opponent-entry bounties collected; retained personal bounties and winner-only forfeitures are not bounty wins",
  bountyPaid: "Bounty Paid: Money posted for bounty-eligible entries under each event's rules; included in overall Total Cost and ROI",
  bountyCollected: "Bounty Collected: Cash received for eligible eliminations of opponents' bounty-bearing entries",
  bountyRetained: "Bounty Retained: The player's own posted bounty returned on a surviving eligible entry",
  bountyWinnings: "Bounty Returns: Bounty Collected + Bounty Retained; included once in Total Take-home",
  bountyNet: "Bounty Net: Bounty Returns − Bounty Paid; included once in overall Profit",
  trueSkillScore: "Power Index: (1.4 × normalized ROI) + (1.2 × Clutch) + Aggression + Survival + (0.5 × normalized Luck) + (0.8 × Composure) + appearance bonus (maximum 10). Normalized inputs use fixed benchmarks, not the current player pool",
  luckIndex: "Luck Index: Profit − Expected Profit, where Expected Profit is based on Cash Rate, Hit Rate, and Bubble Avoidance",
  clutchIndex: "Clutch Index: normalized career cash frequency (Times Placed ÷ Buy-ins)",
  aggressionIndex: "Aggression Index: normalized knockouts per entry (Hits ÷ Entries)",
  survivorIndex: "Survivor Index: normalized weighted score from (0.55 × Cash Rate) + (0.25 × (1 − Bubble Rate)) + (0.20 × Hit Rate)",
  tiltIndex: "Composure Index: fixed 0–100 score rewarding fewer rebuys and fewer bubble finishes, softened toward 50 for small samples",
  expectedProfit: "Expected Profit: Total Cost × expected ROI derived from Cash Rate, Hit Rate, and Bubble Avoidance"
};

const PROFILE_STAT_CONFIG = [
  { key: "totalCost", label: "Total Cost", type: "money", icon: "💸", dashboard: false },
  { key: "tournamentWinnings", label: "Tournament Winnings", type: "money", icon: "🏆", dashboard: false },
  { key: "tournamentCost", label: "Tournament Cost", type: "money", icon: "🎟️", dashboard: false },
  { key: "tournamentProfit", label: "Tournament Profit", type: "money", icon: "🧮", dashboard: false, profitClass: true },
  { key: "totalWinnings", label: "Total Take-home", type: "money", icon: "🏦", dashboard: false, profitClassFromValue: true },
  { key: "settlementAdjustment", label: "Settlement Adjustment", type: "money", icon: "🧾", dashboard: false, nonzeroOnly: true },

  { key: "profit", label: "Profit", type: "money", icon: "💰", dashboard: true, profitClass: true },
  { key: "roi", label: "ROI", type: "pct", icon: "📈", dashboard: true },
  { key: "cashRate", label: "Cash Rate", type: "pct", icon: "💵", dashboard: true },
  { key: "bubbleRate", label: "Bubble Rate", type: "pct", icon: "🫧", dashboard: true },
  { key: "hitRate", label: "Hit Rate", type: "pct", icon: "💥", dashboard: true },

  { key: "entries", label: "Entries", type: "text", icon: "🎟️", dashboard: false },
  { key: "buyIns", label: "Buy-ins", type: "text", icon: "🎟️", dashboard: false },
  { key: "rebuys", label: "Rebuys", type: "text", icon: "♻️", dashboard: false },
  { key: "hits", label: "Hits", type: "text", icon: "💥", dashboard: true },
  { key: "timesPlaced", label: "Times Placed", dashboardLabel: "Cashes", type: "text", icon: "💵", dashboard: true },
  { key: "bubbles", label: "Bubbles", type: "text", icon: "🫧", dashboard: true },
  { key: "bountiesWon", label: "Bounties Won", type: "text", icon: "🏷️", dashboard: true },
  { key: "bountyPaid", label: "Bounty Paid", type: "money", icon: "🪙", dashboard: false },
  { key: "bountyCollected", label: "Bounty Collected", type: "money", icon: "🏷️", dashboard: false, profitClassFromValue: true },
  { key: "bountyRetained", label: "Bounty Retained", type: "money", icon: "🛡️", dashboard: false, profitClassFromValue: true },
  { key: "bountyWinnings", label: "Bounty Returns", type: "money", icon: "💰", dashboard: false, profitClassFromValue: true },
  { key: "bountyNet", label: "Bounty Net", type: "money", icon: "🧾", dashboard: true, profitClass: true },

  { key: "trueSkillScore", label: "Power Index", dashboardLabel: "Power", type: "num", icon: "💪🏼", dashboard: true },
  { key: "luckIndex", label: "Luck Index", dashboardLabel: "Luck", type: "num", icon: "🍀", dashboard: true },
  { key: "clutchIndex", label: "Clutch Index", dashboardLabel: "Clutch", type: "num", icon: "🎯", dashboard: true },
  { key: "aggressionIndex", label: "Aggression Index", dashboardLabel: "Aggression", type: "num", icon: "⚡", dashboard: true },
  { key: "survivorIndex", label: "Survivor Index", dashboardLabel: "Survivor", type: "num", icon: "🛟", dashboard: true },
  { key: "tiltIndex", label: "Composure Index", dashboardLabel: "Composure", type: "num", icon: "🧊", dashboard: true },
  
  { key: "expectedProfit", label: "Expected Profit", type: "money", icon: "💰", dashboard: false, profitClassFromValue: true }
];

const DASHBOARD_META = Object.fromEntries(
  PROFILE_STAT_CONFIG
    .filter(stat => stat.dashboard)
    .map(stat => [
      stat.key,
      {
        label: stat.dashboardLabel || stat.label,
        icon: stat.icon || "♠",
        formula: STAT_FORMULAS[stat.key] || ""
      }
    ])
);

const DASHBOARD_EDITORIAL = {
  profit: "Who’s actually turning bullets into bankroll.",
  roi: "Efficiency over volume. The cleanest results rise fastest.",
  hits: "Who’s ending hands — and nights — with force.",
  timesPlaced: "The most reliable cashing resumes in the room.",
  bubbles: "Who keeps drifting painfully close without sealing the deal.",
  hitRate: "Who converts entries into knockouts most often.",
  cashRate: "Who finds the money most consistently.",
  bubbleRate: "Who lives closest to the danger line.",
  trueSkillScore: "The strongest all-around résumés in the room.",
  luckIndex: "Who’s running purer than the rest of the table.",
  clutchIndex: "Who closes when the pressure spikes.",
  aggressionIndex: "Who pushes the pace and forces the action.",
  survivorIndex: "Who outlasts the field when stacks get shallow.",
  tiltIndex: "Who stays the steadiest when the session starts getting expensive.",
  bountiesWon: "Who has collected the most bounty-bearing first entries.",
  bountyNet: "Bounty returns minus bounty costs; this component is already included in overall profit."
};

const STAT_LEADER_CONFIG = [
  { key: "roi", title: "ROI Leader" },
  { key: "luckIndex", title: "Luck Leader" },
  { key: "aggressionIndex", title: "Aggression Leader" },
  { key: "survivorIndex", title: "Survivor Leader" },
  { key: "tiltIndex", title: "Composure Leader" }
];

const HOME_BADGE_CONFIG = [
  { rule: "Profit Leader", icon: "💰", label: "Show Me Da $" },
  { rule: "Power Leader", icon: "💪🏼", label: "Power Flex" },
  { rule: "Clutch Leader", icon: "🎯", label: "Cap'n Clutch" },
  { rule: "Hit King", icon: "💥", label: "Knockout King" }
];

const NAME_FIXES = {
  "Nasa Al": "NASA Al",
  "Providencemike": "ProvidenceMike",
  "Bostnmike": "BostnMike",
  "Ai-Dave": "A.I. Dave",
  "A.I. Dave": "A.I. Dave",
  "ai-dave": "A.I. Dave",
  "Phattedcalf": "PhattedCalf",
  "Pittdburghbill": "PittsburghBill"
};

const HONOR_RULES = {
  "Profit Leader": { key: "profit", direction: "desc" },
  "Power Leader": { key: "trueSkillScore", direction: "desc" },
  "Clutch Leader": { key: "clutchIndex", direction: "desc" },
  "Hit King": { key: "hits", direction: "desc" },
  "Bubble King": { key: "bubbles", direction: "desc" }
};

const HALL_RULES = {
  bests: [
    {
      title: "The Tax Collector",
      visualClass: "the-money-machine",
      description: "Highest career profit among Hall-qualified players.",
      displayLabel: "Career Profit",
      note: "Everybody pays eventually.",

      propLeft: "images/site/hall/props/hall-prop-coins.png",
      propRight: "images/site/hall/props/hall-prop-coins.png",

      key: "profit",
      direction: "desc"
    },

    {
      title: "Direct Deposit",
      visualClass: "the-complete-player",
      description: "Highest career cash rate among Hall-qualified players.",
      displayLabel: "Career Cash Rate",
      note: "Payout has his routing number.",

      propLeft: "images/site/hall/props/hall-prop-trophy.png",
      propRight: "images/site/hall/props/hall-prop-trophy.png",

      key: "cashRate",
      direction: "desc"
    },

    {
      title: "The Billing Department",
      visualClass: "the-killer",
      description: "Most knockouts per total entry among Hall-qualified players.",
      displayLabel: "Knockouts Per Entry",
      note: "No wasted motion. Invoice attached.",

      propLeft: "images/site/hall/props/hall-prop-boxing-glove-single.png",
      propRight: "images/site/hall/props/hall-prop-boxing-glove-single.png",

      key: "knockoutRate",
      direction: "desc"
    }
  ],

  worsts: [
    {
      title: "Standing 8 Count",
      visualClass: "the-killer",
      description: "Most career bust-outs suffered among Hall-qualified players.",
      displayLabel: "Times Knocked Out",
      note: "Always gets back up swinging.",

      propLeft: "images/site/hall/props/hall-prop-boxing-glove-single.png",
      propRight: "images/site/hall/props/hall-prop-boxing-glove-single.png",

      key: "timesBusted",
      direction: "desc"
    },

    {
      title: "The Lazarus",
      visualClass: "the-variance-victim",
      description: "Most times first out of the tournament and still recovered to cash.",
      displayLabel: "1st Out → Still Cashed",
      note: "Busting him is only a suggestion.",

      propLeft: "images/site/hall/props/hall-prop-card-ah-clean.png",
      propRight: "images/site/hall/props/hall-prop-card-2c-clean.png",

      key: "lazarusCount",
      direction: "desc"
    },

    {
      title: "Boy in the Bubble",
      visualClass: "the-bubble-prisoner",
      description: "Most painful career near misses among Hall-qualified players.",
      displayLabel: "Career Bubbles",
      note: "So close it hurts.",

      propLeft: "images/site/hall/props/hall-prop-bubbles.png",
      propRight: "images/site/hall/props/hall-prop-bubbles.png",

      key: "bubbles",
      direction: "desc"
    }
  ]
};

const RECORD_RULES = {
  "Most Cashes": { key: "timesPlaced", direction: "desc" },
  "Worst Luck Index": { key: "luckIndex", direction: "asc" },
  "Lowest Profit": { key: "profit", direction: "asc" },
  "Most Rebuys": { key: "rebuys", direction: "desc" },
  "Most Entries": { key: "entries", direction: "desc" }
};

const ARCHETYPE_GUIDE = [
  { emoji: "💥", name: "The Hitman" },
  { emoji: "🔒", name: "The Closer" },
  { emoji: "⚙️", name: "The Grinder" },
  { emoji: "😈", name: "The Lucky Devil" },
  { emoji: "🌀", name: "The Wildcard" },
  { emoji: "🫧", name: "The Bubble Magnet" },
  { emoji: "🧠", name: "The Technician" }
];

const TIER_GUIDE = [
  { emoji: "🦈", name: "The Apex Predator" },
  { emoji: "⚔️", name: "The Table Crusher" },
  { emoji: "☄️", name: "The Shot Maker" },
  { emoji: "🎲", name: "The Gambler" },
  { emoji: "🍣", name: "The League Sponsor" }
];

