async function loadSiteData() {
  const res = await fetch("site-data.json");
  return await res.json();
}

const PLAYER_QUOTES = {
  "Nitro": "\"I don't believe you, Tony.\"",
  "Jeff T": "\"On my big blind?\"",
  "Vish": "\"Vamos!\"",
  "Vic": "\"I don't like it when you call.\"",
  "Brad R": "\"I raise.\"",
  "Red": "\"Variance-free Poker!\"",
  "Hayden D": "\"There's $400 sitting on my table at home.\"",
  "Wild Bill": "\"It's a skill game.\"",
  "Hiro": "\"That's a prime number.\"",
  "A.I. Dave": "\"Oh man! I caught some of that!\"",
  "ProvidenceMike": "\"I should'd be in this hand.\"",
  "The Architect": "\"Un-&^%$%-ing Believeable! How do you get there… Every Time!?\"",
  "Ahmed": "\"Get in there, Man!\"",
  "Chris O": "\"Can I still rebuy?\"",
  "Cougar": "\"Nice hand, you suck!\"",
  "NASA Al": "\"I'm running 5 mins late.\"",
  "BostnMike": "\"Play as tight as you want, Mike\"",
  "LiFo": "\"What's the worst that can happen?\"",
  "Li-Fo": "\"What's the worst that can happen?\"",
  "Nat": "\"Ya Fold\""
};

function getPlayerQuote(name) {
  return PLAYER_QUOTES[name] || "They just haven't said anything funny... yet!";
}

function applyRsvpOverrides(data) {
  if (!data?.events) return data;
  data.events = data.events.map(event => {
    const title = (event.title || "").toLowerCase();
    if (title.includes("friday")) {
      return {
        ...event,
        rsvp_counts: { confirmed: 6, maybe: 0, tbd: 2, out: 3 }
      };
    }
    if (title.includes("saturday")) {
      return {
        ...event,
        rsvp_counts: { confirmed: 4, maybe: 2, tbd: 2, out: 3 }
      };
    }
    return event;
  });
  return data;
}

function fmtMoney(n) {
  const sign = Number(n) < 0 ? "-" : "";
  return `${sign}$${Math.abs(Number(n)).toFixed(0)}`;
}

function fmtPct(n) {
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function fmtNum(n) {
  return Number(n).toFixed(1);
}

function sortPlayers(players, key) {
  return [...players].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));
}

function initialsFromName(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function displayPlayerName(player) {
  return player.entries < 5 ? `${player.name}*` : player.name;
}

function playerImageMarkup(player, size = "medium") {
  if (player.image && player.image.trim() !== "") {
    return `
      <div class="player-avatar-wrap">
        <img
          class="player-avatar ${size}"
          src="${player.image}"
          alt="${player.name}"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="player-avatar-fallback ${size}" style="display:none;">
          ${initialsFromName(player.name)}
        </div>
      </div>
    `;
  }

  return `
    <div class="player-avatar-wrap">
      <div class="player-avatar-fallback ${size}">
        ${initialsFromName(player.name)}
      </div>
    </div>
  `;
}

function playerInlineMarkup(player, size = "small") {
  return `
    <div class="player-inline">
      ${playerImageMarkup(player, size)}
      <a href="player.html?name=${encodeURIComponent(player.name)}">${displayPlayerName(player)}</a>
    </div>
  `;
}

function leaderInlineMarkup(player, value, size = "small") {
  return `
    <div class="leader-inline">
      ${playerImageMarkup(player, size)}
      <span>${displayPlayerName(player)} (${value})</span>
    </div>
  `;
}

function formatStatLabel(key) {
  const labels = {
    trueSkillScore: "Power",
    buyIns: "Buy-ins",
    rebuys: "Rebuys",
    entries: "Entries",
    hits: "Hits",
    timesPlaced: "Cashes",
    bubbles: "Bubbles",
    profit: "Profit",
    roi: "ROI",
    cashRate: "Cash Rate",
    bubbleRate: "Bubble Rate",
    hitRate: "Hit Rate",
    luckIndex: "Luck",
    clutchIndex: "Clutch",
    aggressionIndex: "Aggression",
    survivorIndex: "Survivor",
    tiltIndex: "Tilt"
  };
  return labels[key] || key;
}

function formatStatValue(player, key) {
  if (key === "profit") return fmtMoney(player[key]);
  if (["roi", "cashRate", "bubbleRate", "hitRate"].includes(key)) return fmtPct(player[key]);
  if
