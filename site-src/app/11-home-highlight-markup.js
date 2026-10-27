function buildHomeStripCard(title, icon, player, value, valueClass = "") {
  if (!player) return "";

  return `
    <a class="home-strip-card" href="${playerUrl(player)}">
      <div class="home-strip-kicker">${icon} ${title}</div>

      <div class="home-strip-player-row">
        ${playerImageMarkup(player, "table")}
        <div class="home-strip-player">${displayPlayerName(player)}</div>
      </div>

      <div class="home-strip-value ${valueClass}">${value}</div>
    </a>
  `;
}

function buildHomeInsightCard(title, icon, player, value, note, formulaKey, valueClass = "") {
  if (!player) return "";

  return `
    <a class="home-insight-card" href="${playerUrl(player)}" data-formula="${STAT_FORMULAS[formulaKey] || ""}">
      <div class="home-insight-top">
        <div class="home-insight-icon">${icon}</div>
        <div class="home-insight-kicker">${title}</div>
      </div>

      <div class="home-insight-player-row">
        ${playerImageMarkup(player, "table")}
        <div class="home-insight-player">${displayPlayerName(player)}</div>
      </div>

      <div class="home-insight-value ${valueClass}">${value}</div>
    </a>
  `;
}

function buildHomeMiniRow(rank, player, value) {
  if (!player) return "";

  return `
    <div class="home-mini-row">
      <div class="home-mini-rank">#${rank}</div>
      <div class="home-mini-player-wrap">
        ${playerImageMarkup(player, "table")}
        <div class="home-mini-name">${displayPlayerName(player)}</div>
      </div>
      <div class="home-mini-value">${value}</div>
    </div>
  `;
}

function buildHomeBadgeRow(label, player, value, valueClass = "") {
  if (!player) return "";

  return `
    <div class="home-badge-row">
      <div class="home-badge-pill">${label}</div>
      <div class="home-badge-main">
        <div class="home-badge-player-wrap">
          ${playerImageMarkup(player, "table")}
        </div>
        <div class="home-badge-value ${valueClass}">${value}</div>
      </div>
    </div>
  `;
}

function buildHomeBadgeCard(config, player) {
  if (!player) return "";

  const rule = HONOR_RULES[config.rule];
  const key = rule?.key || "profit";
  const value = formatStatValue(player, key);
  const valueClass = key === "profit"
    ? statValueClass(player, "profit")
    : "";

  return buildHomeBadgeRow(config.label, player, value, valueClass);
}

function buildTickerLeader(icon, label, player) {
  if (!player) return "";

  return `
    <a class="league-ticker-item" href="${playerUrl(player)}">
      <span class="league-ticker-label">${icon} ${label}</span>
      <span class="league-ticker-player">
        ${playerImageMarkup(player, "table")}
        <span class="league-ticker-name">${displayPlayerName(player)}</span>
      </span>
    </a>
  `;
}

