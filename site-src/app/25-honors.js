function honorIcon(type) {
  const key = String(type || "").toLowerCase();
  if (key.includes("profit")) return "💰";
  if (key.includes("power")) return "💪🏼";
  if (key.includes("clutch")) return "🎯";
  if (key.includes("hit")) return "💥";
  if (key.includes("bubble")) return "🫧";
  if (key.includes("luck")) return "🍀";
  if (key.includes("cash")) return "💵";
  if (key.includes("roi")) return "📈";
  return "🏅";
}

function honorsPageLabel(type) {
  if (type === "Profit Leader") return "Show Me Da $";
  if (type === "Power Leader") return "Power Flex";
  if (type === "Clutch Leader") return "Cap'n Clutch";
  return type;
}

function recordIcon(label) {
  const key = String(label || "").toLowerCase();
  if (key.includes("profit")) return "💰";
  if (key.includes("roi")) return "📈";
  if (key.includes("hit")) return "💥";
  if (key.includes("cash")) return "💵";
  if (key.includes("bubble")) return "🫧";
  if (key.includes("power")) return "💪🏼";
  if (key.includes("clutch")) return "🎯";
  if (key.includes("luck")) return "🍀";
  return "📊";
}

function honorsCardMarkup(player, category, icon, valueText, isTop = false, valueClass = "") {

  const href = player ? playerUrl(player) : "#";
  const nameMarkup = player ? displayPlayerName(player) : "Unknown";

  const numericClass = isNumericValueText(valueText)
    ? " hall-card-score-numeric"
    : "";

  const cardSlug = String(category || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `
    <a class="hall-card hall-card-${cardSlug}" href="${href}">

      <div class="hall-card-title">
        <span class="hall-card-icon">${icon}</span>
        <span>${category}</span>
      </div>

      <div class="hall-card-portrait">
        ${player ? playerImageMarkup(player, "honors") : ""}
      </div>

      <div class="hall-card-player">
        ${nameMarkup}
      </div>

      <div class="hall-card-score ${valueClass}${numericClass}">
        ${valueText}
      </div>

    </a>
  `;
}

function hallLaurelMarkup(tone = "best") {

  const leafSrc =
    tone === "worst"
      ? "images/site/hall/hall-leaf-withered.png"
      : "images/site/hall/hall-leaf-gold.png";

  return `
    <div class="hall-plaque-laurels" aria-hidden="true">

      <img
        class="hall-laurel-image hall-laurel-image-left"
        src="${leafSrc}"
        alt=""
        loading="lazy"
        decoding="async"
        fetchpriority="auto"
        width="632"
        height="1024"
      />

      <img
        class="hall-laurel-image hall-laurel-image-right"
        src="${leafSrc}"
        alt=""
        loading="lazy"
        decoding="async"
        fetchpriority="auto"
        width="632"
        height="1024"
      />

    </div>
  `;
}

function hallCardMarkup(player, rule, tone = "best") {

  const href = player ? playerUrl(player) : "#";

  const nameMarkup = player
    ? displayPlayerName(player)
    : "Unknown";

  const valueText = player
    ? `${formatStatValue(player, rule.key)}${rule.suffix || ""}`
    : "—";

  const cardSlug = String(rule?.visualClass || rule?.title || "hall-card")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let valueTone = "";

  if (rule?.key === "profit") {

    const profit = Number(player?.profit ?? 0);

    if (profit > 0) {
      valueTone = " hall-plaque-stat-value--positive";
    }

    if (profit < 0) {
      valueTone = " hall-plaque-stat-value--negative";
    }

  }

  return `
    <a
      class="
        hall-plaque
        hall-plaque--${tone}
        hall-plaque-${cardSlug}
      "
      href="${href}"
    >

      <div class="hall-plaque-title-row">

        <span class="hall-plaque-title">
          ${rule.title}
        </span>

      </div>


      <div class="hall-plaque-portrait-stage">

        ${hallLaurelMarkup(tone)}

        <div class="hall-plaque-avatar">
          ${player ? playerImageMarkup(player, "hall") : ""}
        </div>

      </div>


      <div class="hall-plaque-nameplate">
        ${nameMarkup}
      </div>


      <div class="hall-plaque-stat-stage">

  ${rule.propLeft ? `
    <img
      class="hall-plaque-prop hall-plaque-prop-left"
      src="${rule.propLeft}"
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      fetchpriority="auto"
      width="512"
      height="512"
    />
  ` : ""}


  <div class="hall-plaque-stat-panel">

    <div class="hall-plaque-stat-label">
      ${rule.displayLabel}
    </div>

    <div
      class="
        hall-plaque-stat-value
        ${valueTone}
      "
    >
      ${valueText}
    </div>

    <div class="hall-plaque-stat-note">
      ${rule.note || rule.description || ""}
    </div>

  </div>


  ${rule.propRight ? `
    <img
      class="hall-plaque-prop hall-plaque-prop-right"
      src="${rule.propRight}"
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      fetchpriority="auto"
      width="512"
      height="512"
    />
  ` : ""}

  </div>


    </a>
  `;
}

function getBalancedHonorsSections(data) {
  return {
    statLeaders: [
      { key: "roi", title: "Mr. ROI", icon: "🤑" },
      { key: "luckIndex", title: "Lucky Duck", icon: "🐥" },
      { key: "aggressionIndex", title: "Mr. Aggro", icon: "😤" },
      { key: "survivorIndex", title: "The Survivor", icon: "🛟" },
      { key: "tiltIndex", title: "Cool Customer", icon: "🧊" }
    ],
    recordItems: [
      { label: "Most Cashes", title: "Cash Cow", icon: "🐮" },
      { label: "Worst Luck Index", title: "Cursed Duck", icon: "🦤" },
      { label: "Lowest Profit", title: "The Donor", icon: "🩸" },
      { label: "Most Rebuys", title: "Mr. Rebuy", icon: "♻️" },
      { label: "Most Entries", title: "Entry King", icon: "🎟️" }
    ]
  };
}

async function renderHall(data) {

  const bestsEl =
    document.getElementById("hall-bests");

  const worstsEl =
    document.getElementById("hall-worsts");


  /*
   * app.js runs on every TLPT page. Only load the full historical event set
   * when the Hall page is actually present.
   */
  if (!bestsEl && !worstsEl) return;


  try {
    const hallHistory = await loadHallHistoryData(data);
    const players = getHallPlayers(data, hallHistory);

    if (!players.length) return;


    /* Rename the room without requiring a champions.html edit. */
    if (worstsEl) {
      const infamyRoom = worstsEl.closest(".hall-room");
      const infamyTitle = infamyRoom?.querySelector(".hall-room-title h3");
      const infamyCopy = infamyRoom?.querySelector(".hall-room-header p");

      if (infamyTitle) {
        infamyTitle.textContent = "All-Time Infamy";
      }

      if (infamyCopy) {
        infamyCopy.textContent =
          "The careers that became legends for all the wrong reasons.";
      }
    }


    function findHallLeader(rule) {

      return [...players].sort((a, b) => {

        const aVal =
          Number(a?.[rule.key] ?? 0);

        const bVal =
          Number(b?.[rule.key] ?? 0);


        if (rule.direction === "asc") {

          if (aVal !== bVal) {
            return aVal - bVal;
          }

        } else if (bVal !== aVal) {

          return bVal - aVal;

        }


        return String(a?.name || "")
          .localeCompare(
            String(b?.name || "")
          );

      })[0];

    }


    if (bestsEl) {

      bestsEl.innerHTML = window.TLPTRoster.sections(HALL_RULES.bests,
        rule => hallCardMarkup(findHallLeader(rule), rule, "best"), { playerOf: findHallLeader });

    }


    if (worstsEl) {

      worstsEl.innerHTML = window.TLPTRoster.sections(HALL_RULES.worsts,
        rule => hallCardMarkup(findHallLeader(rule), rule, "worst"), { playerOf: findHallLeader });

    }

  } catch (error) {
    console.error("TLPT Hall history load failed:", error);
  }

}
function renderChampions(data) {
  const players = data?.players || [];
  const honorsEl = document.getElementById("champions-list");
  const recordsEl = document.getElementById("records-list");
  const { recordItems } = getBalancedHonorsSections(data);

  if (honorsEl && Array.isArray(data?.honors)) {
    honorsEl.innerHTML = window.TLPTRoster.sections(data.honors, honor => {
      const rule = HONOR_RULES[honor.type];
      const player = getLeaderByRule(players, rule);
      if (!player) return "";

      const valueClass = rule?.key === "profit"
        ? statValueClass(player, "profit")
        : "";

      let valueText = honor.note || "";

      if (rule?.key === "profit") {
        valueText = fmtMoney(player.profit);
      } else if (rule?.key) {
        valueText = formatStatValue(player, rule.key);
      }

      return honorsCardMarkup(
        player,
        honorsPageLabel(honor.type),
        honorIcon(honor.type),
        valueText,
        false,
        valueClass
      );
    }, { playerOf: honor => getLeaderByRule(players, HONOR_RULES[honor.type]) });

    initAnimatedCounters(honorsEl);
  }

  if (recordsEl) {
    recordsEl.innerHTML = window.TLPTRoster.sections(recordItems, record => {
      const rule = RECORD_RULES[record.label];
      const player = getLeaderByRule(players, rule);
      if (!player) return "";

      const valueClass = rule?.key === "profit"
        ? statValueClass(player, "profit")
        : rule?.key === "luckIndex"
          ? statValueClass({ profit: player?.luckIndex }, "profit")
          : "";

      const valueText = rule?.key
        ? formatStatValue(player, rule.key)
        : (record.value || "");

      return honorsCardMarkup(
        player,
        record.title || record.label,
        record.icon || recordIcon(record.label),
        valueText,
        false,
        valueClass
      );
    }, { playerOf: record => getLeaderByRule(players, RECORD_RULES[record.label]) });

    initAnimatedCounters(recordsEl);
  }
}

function renderStatLeaders(data) {
  const list = document.getElementById("leaders-list");
  if (!list) return;

  const allPlayers = data?.players || [];
  const eligiblePlayers = allPlayers.filter(player => Number(player?.entries ?? 0) >= 5);
  const { statLeaders } = getBalancedHonorsSections(data);

  if (!eligiblePlayers.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = window.TLPTRoster.sections(statLeaders, stat => {
    const leader = sortPlayers(eligiblePlayers, stat.key)[0];
    if (!leader) return "";

    const statConfig = getStatConfig(stat.key);
    const icon = stat.icon || statConfig?.icon || "🏅";
    const value = formatStatValue(leader, stat.key);
    const valueClass = stat.key === "profit"
      ? statValueClass(leader, "profit")
      : "";

    return `
      <a class="champ-card stat-card-visual honors-card leader-banner-card" href="${playerUrl(leader)}">
        <div class="leader-banner-top">
          <div class="leader-banner-crown">${icon}</div>
          <div class="leader-banner-title">${stat.title}</div>
        </div>

        <div class="honors-card-top leader-banner-body">
          ${playerImageMarkup(leader, "honors")}
          <div class="hall-card-stack">
            <div class="hall-player-name">${displayPlayerName(leader)}</div>
          </div>
        </div>

        <div
          class="honors-card-value ${valueClass}${isNumericValueText(value) ? " honors-card-value--numeric" : ""}"
          data-animate-count="${isNumericValueText(value) ? "true" : "false"}"
          data-target-value="${value}"
        >
          ${value}
        </div>
      </a>
    `;
  }, { playerOf: stat => sortPlayers(eligiblePlayers, stat.key)[0] });

  initAnimatedCounters(list);
}

function renderHonorsSummary() {
  const strip = document.getElementById("honors-summary-strip");
  const comment = document.getElementById("honors-summary-comment");

  if (strip) strip.remove();
  if (comment) comment.remove();
}

