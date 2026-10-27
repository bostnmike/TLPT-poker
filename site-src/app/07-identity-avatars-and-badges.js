function playerUrl(player) {
  return `player.html?name=${encodeURIComponent(player.name)}`;
}

const TLPT_SITE_ORIGIN = "https://tlpt.org";
const PLAYER_PROFILE_FALLBACK_IMAGE = "images/site/chip-T-1000.png";

function upsertPageMetadata(attribute, key, content) {
  if (!document.head) return;

  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.append(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonicalLink(href) {
  if (!document.head) return;

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.append(canonical);
  }
  canonical.setAttribute("href", href);
}

function updatePlayerProfileMetadata(player) {
  if (!player?.name) return;

  const playerName = displayPlayerNamePlain(player);
  const title = `${playerName} | TLPT.org`;
  const description = `View ${playerName}'s TLPT Poker League Ultimate Player Card, statistics, honors, knockouts, and card collection.`;
  const canonicalUrl = new URL("/player.html", TLPT_SITE_ORIGIN);
  canonicalUrl.searchParams.set("name", player.name);
  const imageUrl = new URL(
    player.image || PLAYER_PROFILE_FALLBACK_IMAGE,
    `${TLPT_SITE_ORIGIN}/`
  ).href;
  const imageAlt = `${playerName} TLPT player portrait`;

  document.title = title;
  upsertCanonicalLink(canonicalUrl.href);
  upsertPageMetadata("name", "description", description);
  upsertPageMetadata("property", "og:type", "profile");
  upsertPageMetadata("property", "og:site_name", "TLPT Poker League");
  upsertPageMetadata("property", "og:title", title);
  upsertPageMetadata("property", "og:description", description);
  upsertPageMetadata("property", "og:url", canonicalUrl.href);
  upsertPageMetadata("property", "og:image", imageUrl);
  upsertPageMetadata("property", "og:image:alt", imageAlt);
  upsertPageMetadata("name", "twitter:card", "summary");
  upsertPageMetadata("name", "twitter:title", title);
  upsertPageMetadata("name", "twitter:description", description);
  upsertPageMetadata("name", "twitter:image", imageUrl);
  upsertPageMetadata("name", "twitter:image:alt", imageAlt);
}

const PLAYER_AVATAR_INTRINSIC_SIZES = Object.freeze({
  small: 44,
  medium: 44,
  table: 44,
  standings: 44,
  crew: 128,
  dashboard: 82,
  honors: 76,
  hall: 114,
  profile: 340
});

function playerAvatarIntrinsicSize(size, requestedSize) {
  const numericSize = Number(requestedSize);
  if (Number.isFinite(numericSize) && numericSize > 0) {
    return Math.round(numericSize);
  }

  return PLAYER_AVATAR_INTRINSIC_SIZES[size] || 44;
}

function playerImageMarkup(player, size = "medium", options = {}) {
  const intrinsicSize = playerAvatarIntrinsicSize(size, options.intrinsicSize);
  const loading = options.loading === "eager" ? "eager" : "lazy";
  const fetchPriority = options.fetchPriority === "high" ? "high" : "auto";

  if (player?.image) {
    return `
      <span class="player-avatar-wrap">
        <img
          class="player-avatar ${size}"
          src="${player.image}"
          alt="${player.name}"
          loading="${loading}"
          decoding="async"
          fetchpriority="${fetchPriority}"
          width="${intrinsicSize}"
          height="${intrinsicSize}"
          data-image-error-action="show-next"
        />
        <span class="player-avatar-fallback ${size}" hidden>${initialsFromName(player.name)}</span>
      </span>
    `;
  }

  return `
    <span class="player-avatar-wrap">
      <span class="player-avatar-fallback ${size}">${initialsFromName(player?.name)}</span>
    </span>
  `;
}

function playerInlineMarkup(player, size = "small") {
  return `
    <a class="player-inline" href="${playerUrl(player)}">
      ${playerImageMarkup(player, size)}
      <span class="player-inline-name">${displayPlayerName(player)}</span>
    </a>
  `;
}

function badgeMetaFromLabel(label) {
  const text = String(label || "");

  if (text.includes("Profit Leader")) return { rarity: "legendary", tone: "gold" };
  if (text.includes("Power Flex")) return { rarity: "epic", tone: "violet" };
  if (text.includes("Cap'n Clutch")) return { rarity: "rare", tone: "amber" };
  if (text.includes("Luck Leader")) return { rarity: "rare", tone: "green" };
  if (text.includes("Hit King")) return { rarity: "epic", tone: "red" };
  if (text.includes("Bubble King")) return { rarity: "uncommon", tone: "blue" };
  if (text.includes("Small Sample")) return { rarity: "common", tone: "slate" };

  return { rarity: "common", tone: "slate" };
}

function badgeList(player, data, comparisonPlayers = null) {
  if (isPlayerUnscouted(player)) return [];
  const hasCustomPool = Array.isArray(comparisonPlayers);
  const players = hasCustomPool
    ? comparisonPlayers
    : (data?.players || []);

  if (!players.length) return [];

  const eligiblePlayers = hasCustomPool
    ? players
    : getEligiblePlayers(players);

  const badgePool = eligiblePlayers.length
    ? eligiblePlayers
    : players;
  
  const topProfit = sortPlayers(badgePool, "profit")[0]?.name;
  const topPower = sortPlayers(badgePool, "trueSkillScore")[0]?.name;
  const topClutch = sortPlayers(badgePool, "clutchIndex")[0]?.name;
  const topHits = sortPlayers(badgePool, "hits")[0]?.name;

  const topROI = sortPlayers(badgePool, "roi")[0]?.name;
  const topCashRate = sortPlayers(badgePool, "cashRate")[0]?.name;
  const topLuck = sortPlayers(badgePool, "luckIndex")[0]?.name;
  const topAggro = sortPlayers(badgePool, "aggressionIndex")[0]?.name;
  const topSurvivor = sortPlayers(badgePool, "survivorIndex")[0]?.name;
  const topTilt = sortPlayers(badgePool, "tiltIndex")[0]?.name;
  const topBubbleRate = sortPlayers(badgePool, "bubbleRate")[0]?.name;
  const topRebuys = sortPlayers(badgePool, "rebuys")[0]?.name;

  const badges = [];

  if (player.name === topProfit) badges.push({ icon: "💰", label: "Profit Leader", rarity: "legendary", tone: "gold" });
  if (player.name === topPower) badges.push({ icon: "💪🏼", label: "Power Leader", rarity: "epic", tone: "violet" });
  if (player.name === topClutch) badges.push({ icon: "🎯", label: "Clutch Leader", rarity: "rare", tone: "amber" });
  if (player.name === topHits) badges.push({ icon: "💥", label: "Hit King", rarity: "epic", tone: "red" });

  if (player.name === topROI) badges.push({ icon: "📈", label: "ROI Boss", rarity: "rare", tone: "amber" });
  if (player.name === topCashRate) badges.push({ icon: "🏧", label: "Cash Machine", rarity: "rare", tone: "green" });
  if (player.name === topLuck) badges.push({ icon: "😈", label: "Lucky Devil", rarity: "epic", tone: "violet" });
  if (player.name === topAggro) badges.push({ icon: "🦁", label: "Aggro Animal", rarity: "epic", tone: "red" });
  if (player.name === topSurvivor) badges.push({ icon: "🛟", label: "Survivor", rarity: "uncommon", tone: "blue" });
  if (player.name === topTilt) badges.push({ icon: "🧊", label: "Cool Customer", rarity: "common", tone: "slate" });
  if (player.name === topBubbleRate) badges.push({ icon: "🫧", label: "Bubble Trouble", rarity: "uncommon", tone: "blue" });
  if (player.name === topRebuys) badges.push({ icon: "♻️", label: "Rebuy King", rarity: "rare", tone: "amber" });

  if (Number(player.entries ?? 0) < 5) badges.push({ icon: "✳️", label: "Small Sample", rarity: "common", tone: "slate" });

  return badges;
}

function badgesMarkup(player, data, comparisonPlayers = null) {
  const badges = badgeList(player, data, comparisonPlayers);
  if (!badges.length) return "";
  
  return `
    <div class="button-row stat-leader-badges">
      ${badges.map(badge => `
        <span class="stat-badge-text badge-rarity-${badge.rarity} badge-tone-${badge.tone}">
          <span class="stat-badge-icon">${badge.icon}</span>
          <span class="stat-badge-label">${badge.label}</span>
        </span>
      `).join("")}
    </div>
  `;
}

