const RULES_40K_CHIP_COUNTS = Object.freeze({
  "T-25": 16,
  "T-100": 16,
  "T-500": 16,
  "T-1000": 15,
  "T-5000": 3,
  "T-10000": 0,
  "T-25000": 0
});

const RULES_TWO_TABLE_CHIP_COUNTS = Object.freeze({
  "T-25": 16,
  "T-100": 16,
  "T-500": 16,
  "T-1000": 15,
  "T-5000": 5,
  "T-10000": 0,
  "T-25000": 0
});

const CHIP_SET_TEXT = {
  "40k": RULES_40K_CHIP_COUNTS,
  "500k": {
    "T-500": 16,
    "T-1000": 17,
    "T-5000": 15,
    "T-10000": 15,
    "T-25000": 10,
    "T-100000": 0,
    "T-250000": 0
  },
  "two-table": RULES_TWO_TABLE_CHIP_COUNTS
};

const RULES_40K_CHIPS = Object.freeze([
  { label: "T-25", image: "images/site/chip-T-25.png" },
  { label: "T-100", image: "images/site/chip-T-100.png" },
  { label: "T-500", image: "images/site/chip-T-500.png" },
  { label: "T-1000", image: "images/site/chip-T-1000.png" },
  { label: "T-5000", image: "images/site/chip-T-5000.png" },
  { label: "T-10000", image: "images/site/chip-T-10000.png" },
  { label: "T-25000", image: "images/site/chip-T-25000.png" }
]);

const RULES_TWO_TABLE_CHIPS = Object.freeze([
  { label: "T-25", image: "images/site/chip-T-25.png" },
  { label: "T-100", image: "images/site/chip-T-100.png" },
  { label: "T-500", image: "images/site/chip-T-500.png" },
  { label: "T-1000", image: "images/site/chip-T-1000.png" },
  { label: "T-5000", image: "images/site/chip-T-5000.png" },
  { label: "T-10000", image: "images/site/chip-T-10000.png" },
  { label: "T-25000", image: "images/site/chip-T-25000.png" }
]);

const RULES_FORMATS = {
  "40k": {
    title: "40K Small Blind Ante",
    assumption: "Assumptions: 8 starting players and 4 rebuys.",
    payoutPlaces: 3,
    payoutLabel: "$360 • 1st $180 (50%) • 2nd $110 (30%) • 3rd $70 (20%)",
    runtimeMinutes: 300,
    levelMinutes: 20,
    breakMinutes: 10,
    showTypicalRemainingPlayers: true,
    blindNote: "Gold rows mark 10-minute breaks and chip-up points. Green rows mark projected payout territory. Black and gray rows are 20-minute live levels. Typical remaining players is a planning estimate; actual attrition varies.",
    chips: RULES_40K_CHIPS,
    levels: [
      { type: "level", level: "1", sb: "50", bb: "100", ante: "", eff: "400 BB", remaining: "8" },
      { type: "level", level: "2", sb: "75", bb: "150", ante: "", eff: "266 BB", remaining: "8" },
      { type: "level", level: "3", sb: "125", bb: "250", ante: "", eff: "160 BB", remaining: "8" },
      { type: "level", level: "4", sb: "200", bb: "400", ante: "", eff: "100 BB", remaining: "8" },
      { type: "break", note: "BREAK — Chip up T-25" },
      { type: "level", level: "5", sb: "300", bb: "600", ante: "300", eff: "66 BB", remaining: "8" },
      { type: "level", level: "6", sb: "500", bb: "1,000", ante: "500", eff: "40 BB", remaining: "8" },
      { type: "level", level: "7", sb: "800", bb: "1,600", ante: "800", eff: "25 BB", remaining: "8" },
      { type: "break", note: "BREAK — Chip up T-100" },
      { type: "level", level: "8", sb: "1,000", bb: "2,000", ante: "1000", eff: "Rebuys Closed", remaining: "8" },
      { type: "level", level: "9", sb: "1,500", bb: "3,000", ante: "1,500", eff: "Rebuys Closed", remaining: "7" },
      { type: "level", level: "10", sb: "2,500", bb: "5,000", ante: "2,500", eff: "Rebuys Closed", remaining: "6" },
      { type: "break", note: "BREAK — Chip up T-500" },
      { type: "level", level: "11", sb: "4,000", bb: "8,000", ante: "4,000", eff: "Rebuys Closed", remaining: "5" },
      { type: "level", level: "12", sb: "6,000", bb: "12,000", ante: "6,000", eff: "Rebuys Closed", remaining: "4" },
      { type: "level", level: "13", sb: "10,000", bb: "20,000", ante: "10,000", eff: "Rebuys Closed", remaining: "3" },
      { type: "level", level: "14", sb: "15,000", bb: "30,000", ante: "15,000", eff: "Rebuys Closed", remaining: "2" },
      { type: "break", note: "BREAK — Chip up T-1000 & T-5000" },
      { type: "level", level: "15", sb: "25,000", bb: "50,000", ante: "25,000", eff: "Rebuys Closed", remaining: "2" },
      { type: "level", level: "16", sb: "40,000", bb: "80,000", ante: "40,000", eff: "Rebuys Closed", remaining: "2" },
      { type: "level", level: "17", sb: "50,000", bb: "100,000", ante: "60,000", eff: "Rebuys Closed", remaining: "2" }
    ]
  },
  "500k": {
    title: "500K Small Blind Ante",
    assumption: "Assumptions: 8 starting players and 4 rebuys.",
    payoutPlaces: 3,
    payoutLabel: "$360 • 1st $180 (50%) • 2nd $110 (30%) • 3rd $70 (20%)",
    runtimeMinutes: 300,
    levelMinutes: 20,
    breakMinutes: 10,
    showTypicalRemainingPlayers: true,
    blindNote: "Gold rows mark 10-minute breaks and chip-up points. Green rows mark projected payout territory. Black and gray rows are 20-minute live levels. Typical remaining players is a planning estimate; actual attrition varies.",
    chips: [
      { label: "T-500", image: "images/site/chip-T-500.png" },
      { label: "T-1000", image: "images/site/chip-T-1000.png" },
      { label: "T-5000", image: "images/site/chip-T-5000.png" },
      { label: "T-10000", image: "images/site/chip-T-10000.png" },
      { label: "T-25000", image: "images/site/chip-T-25000.png" },
      { label: "T-100000", image: "images/site/chip-T-100000.png" },
      { label: "T-250000", image: "images/site/chip-T-250000.png" }
    ],
    levels: [
      { type: "level", level: "1", sb: "500", bb: "1,000", ante: "", eff: "500 BB", remaining: "8" },
      { type: "level", level: "2", sb: "1,000", bb: "2,000", ante: "", eff: "250 BB", remaining: "8" },
      { type: "level", level: "3", sb: "1,500", bb: "3,000", ante: "", eff: "166 BB", remaining: "8" },
      { type: "level", level: "4", sb: "2,500", bb: "5,000", ante: "", eff: "100 BB", remaining: "8" },
      { type: "break", note: "BREAK — Chip up T-500" },
      { type: "level", level: "5", sb: "4,000", bb: "8,000", ante: "4,000", eff: "62 BB", remaining: "8" },
      { type: "level", level: "6", sb: "6,000", bb: "12,000", ante: "6,000", eff: "41 BB", remaining: "8" },
      { type: "level", level: "7", sb: "10,000", bb: "20,000", ante: "10,000", eff: "25 BB", remaining: "8" },
      { type: "break", note: "BREAK — Chip up T-1000" },
      { type: "level", level: "8", sb: "15,000", bb: "30,000", ante: "15,000", eff: "Rebuys Closed", remaining: "8" },
      { type: "level", level: "9", sb: "25,000", bb: "50,000", ante: "25,000", eff: "Rebuys Closed", remaining: "7" },
      { type: "level", level: "10", sb: "40,000", bb: "80,000", ante: "40,000", eff: "Rebuys Closed", remaining: "6" },
      { type: "break", note: "BREAK — Chip up T-5000" },
      { type: "level", level: "11", sb: "60,000", bb: "120,000", ante: "60,000", eff: "Rebuys Closed", remaining: "5" },
      { type: "level", level: "12", sb: "100,000", bb: "200,000", ante: "100,000", eff: "Rebuys Closed", remaining: "4" },
      { type: "level", level: "13", sb: "150,000", bb: "300,000", ante: "150,000", eff: "Rebuys Closed", remaining: "3" },
      { type: "break", note: "BREAK — Chip up T-10000" },
      { type: "level", level: "14", sb: "200,000", bb: "400,000", ante: "200,000", eff: "Rebuys Closed", remaining: "2" },
      { type: "level", level: "15", sb: "300,000", bb: "600,000", ante: "300,000", eff: "Rebuys Closed", remaining: "2" },
      { type: "level", level: "16", sb: "500,000", bb: "1,000,000", ante: "500,000", eff: "Rebuys Closed", remaining: "2" }
    ]
  },
  "two-table": {
    // Locked after 54 events through 2026-10-09: 182 rebuys across 407
    // initial entries = 44.7%; 18 players project to 8.05, rounded to 8.
    title: "Two-Table 50K Deep Stack",
    assumption: "Assumptions: 18 starting players, 8 rebuys, and a $1,040 prize pool.",
    payoutPlaces: 6,
    projectedPool: "$1,040",
    payoutLabel: "1st $380 • 2nd $240 • 3rd $160 • 4th $120 • 5th $100 • 6th $40",
    payoutNote: "Top 6 paid. Reserve $40 for 6th; split the remaining regular prize pool 38% / 24% / 16% / 12% / 10% for 1st–5th. Bounty money is separate.",
    combinePayoutAndBounty: true,
    bounty: {
      title: "$10 Bounty — Optional on Rebuys",
      text: "First entry: $50 ($40 prize pool + $10 bounty). Rebuys: $50 with a bounty or $40 without. Only opted-in entries can collect bounties.",
      rulesLink: true
    },
    runtimeLabel: "9 hrs 20 min",
    levelMinutes: 25,
    levelLengthLabel: "25 min",
    breakMinutes: 20,
    showTypicalRemainingPlayers: true,
    blindNote: "Gold rows mark scheduled breaks and chip-up points. Green rows mark projected payout territory. Effective BB uses the 50K starting stack. Late entry, rebuys and reloads close after Level 11 (25 BB); closed beginning Level 12. Around 6:40 PM with a 1 PM start and the posted breaks, but the level cutoff governs. Reloads require 10,000 chips or fewer (20% of 50,000) while the window is open. No stack is seated or blinded until the player arrives and payment is confirmed; prepayment does not put an absent stack into play. Typical remaining players is a planning estimate; merge to one table as soon as nine players remain.",
    chips: RULES_TWO_TABLE_CHIPS,
    levels: [
      { type: "level", level: "1", sb: "50", bb: "100", ante: "0", eff: "500 BB", remaining: "18 (2 × 9)" },
      { type: "level", level: "2", sb: "75", bb: "150", ante: "0", eff: "333 BB", remaining: "18 (2 × 9)" },
      { type: "level", level: "3", sb: "100", bb: "200", ante: "0", eff: "250 BB", remaining: "18 (2 × 9)" },
      { type: "level", level: "4", sb: "125", bb: "250", ante: "0", eff: "200 BB", remaining: "18 (2 × 9)" },
      { type: "level", level: "5", sb: "150", bb: "300", ante: "0", eff: "166 BB", remaining: "18 (2 × 9)" },
      { type: "break", note: "20-MINUTE BREAK — Chip up" },
      { type: "level", level: "6", sb: "200", bb: "400", ante: "200", eff: "125 BB", remaining: "17" },
      { type: "level", level: "7", sb: "300", bb: "600", ante: "300", eff: "83 BB", remaining: "17" },
      { type: "level", level: "8", sb: "400", bb: "800", ante: "400", eff: "62 BB", remaining: "16" },
      { type: "level", level: "9", sb: "500", bb: "1,000", ante: "500", eff: "50 BB", remaining: "15" },
      { type: "level", level: "10", sb: "600", bb: "1,200", ante: "600", eff: "41 BB", remaining: "14" },
      { type: "break", durationMinutes: 45, note: "45-MINUTE DINNER BREAK — Chip up" },
      { type: "level", level: "11", sb: "1,000", bb: "2,000", ante: "1,000", eff: "25 BB", remaining: "12" },
      { type: "level", level: "12", sb: "1,500", bb: "3,000", ante: "1,500", eff: "Rebuys Closed", remaining: "11" },
      { type: "level", level: "13", sb: "2,500", bb: "5,000", ante: "2,500", eff: "Rebuys Closed", remaining: "10" },
      { type: "level", level: "14", sb: "4,000", bb: "8,000", ante: "4,000", eff: "Rebuys Closed", remaining: "9 — MERGE" },
      { type: "level", level: "15", sb: "6,000", bb: "12,000", ante: "6,000", eff: "Rebuys Closed", remaining: "7" },
      { type: "break", note: "20-MINUTE BREAK — Chip up" },
      { type: "level", level: "16", sb: "8,000", bb: "16,000", ante: "8,000", eff: "Rebuys Closed", remaining: "6" },
      { type: "level", level: "17", sb: "10,000", bb: "20,000", ante: "10,000", eff: "Rebuys Closed", remaining: "5" },
      { type: "level", level: "18", sb: "15,000", bb: "30,000", ante: "15,000", eff: "Rebuys Closed", remaining: "3" },
      { type: "level", level: "19", sb: "20,000", bb: "40,000", ante: "20,000", eff: "Rebuys Closed", remaining: "2" },
      { type: "level", level: "20", sb: "40,000", bb: "80,000", ante: "40,000", eff: "Rebuys Closed", remaining: "2" },
      { type: "level", level: "21", sb: "50,000", bb: "100,000", ante: "50,000", eff: "Rebuys Closed", remaining: "2", duration: "60 min" }
    ]
  }
};

