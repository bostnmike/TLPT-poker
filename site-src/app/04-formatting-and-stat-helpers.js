function normalizeQuoteName(name) {
  const trimmed = (name || "").trim();
  if (["A.I. Dave", "A.I Dave", "A.l. Dave", "A.l Dave"].includes(trimmed)) {
    return "A.I. Dave";
  }
  return trimmed;
}

function ensureQuoted(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return "“They just haven't said anything funny... yet!”";
  const unwrapped = cleaned.replace(/^["“”]+|["“”]+$/g, "").trim();
  return `“${unwrapped}”`;
}

function fmtMoney(n) {
  const num = Number(n ?? 0);
  const sign = num < 0 ? "-" : "";
  return `${sign}$${Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

function fmtPct(n) {
  return `${(Number(n ?? 0) * 100).toFixed(1)}%`;
}

function fmtNum(n) {
  return Number(n ?? 0).toFixed(1);
}

function parseAnimatedValue(text) {
  const raw = String(text ?? "").trim();

  if (!raw) return null;

  const isMoney = raw.includes("$");
  const isPct = raw.includes("%");
  const negative = raw.startsWith("-");

  const numeric = Number(raw.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(numeric)) return null;

  return {
    raw,
    numeric,
    isMoney,
    isPct,
    negative
  };
}

function formatAnimatedValue(value, meta) {
  const safeValue = Number(value) || 0;
  const sign = meta.negative ? "-" : "";

  if (meta.isMoney) {
    return `${sign}$${Math.round(safeValue).toLocaleString("en-US")}`;
  }

  if (meta.isPct) {
    return `${sign}${safeValue.toFixed(1)}%`;
  }

  if (meta.raw.includes(".")) {
    return `${sign}${safeValue.toFixed(1)}`;
  }

  return `${sign}${Math.round(safeValue).toLocaleString("en-US")}`;
}

function animateCountUp(el, duration = 1100) {
  if (!el || el.dataset.countAnimated === "true") return;

  const meta = parseAnimatedValue(el.dataset.targetValue || el.textContent);
  if (!meta) return;

  el.dataset.countAnimated = "true";

  if (prefersReducedMotion()) {
    el.textContent = meta.raw;
    return;
  }

  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = meta.numeric * eased;

    el.textContent = formatAnimatedValue(current, meta);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = meta.raw;
    }
  }

  requestAnimationFrame(tick);
}

function initAnimatedCounters(scope = document) {
  scope.querySelectorAll("[data-animate-count]").forEach(el => animateCountUp(el));
}

function formatProfileStatValue(player, config) {
  const value = player?.[config.key];

  if (config.type === "money") return fmtMoney(value);
  if (config.type === "pct") return fmtPct(value);
  if (config.type === "num") return fmtNum(value);

  return String(value ?? "-");
}

function getStatConfig(key) {
  return PROFILE_STAT_CONFIG.find(stat => stat.key === key) || null;
}

function sortPlayers(players, key) {
  return [...(players || [])].sort((a, b) => {
    const aVal = Number(a?.[key] ?? 0);
    const bVal = Number(b?.[key] ?? 0);
    if (bVal !== aVal) return bVal - aVal;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

function dashboardPlayersForMetric(players, sortKey) {
  return (players || []).filter(player => {
    const metricValue = Number(player?.[sortKey]);
    return Number(player?.entries ?? 0) >= 2 &&
      Number.isFinite(metricValue) &&
      metricValue !== 0;
  });
}

function formatStatLabel(key) {
  const stat = getStatConfig(key);
  return stat?.dashboardLabel || stat?.label || key;
}

function statIcon(key) {
  const stat = getStatConfig(key);
  return stat?.icon || "♦️";
}

function formatStatValue(player, key) {

  if (key === "hallScore") {
    return `${fmtNum(player?.hallScore ?? 0)} / 100`;
  }

  if (key === "variancePain") {
    return fmtNum(player?.variancePain ?? 0);
  }

  if (key === "knockoutRate") {
    return Number(player?.knockoutRate ?? 0).toFixed(2);
  }

  if (key === "timesBusted" || key === "lazarusCount") {
    return String(Math.round(Number(player?.[key] ?? 0)));
  }

  const stat = getStatConfig(key);

  if (!stat) {
    return String(player?.[key] ?? "-");
  }

  return formatProfileStatValue(player, stat);
}

