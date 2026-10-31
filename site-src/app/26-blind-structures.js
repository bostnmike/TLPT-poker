function escapeHtmlAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildChipImageCandidates(chip) {
  const original = String(chip.image || "").trim();
  const labelNumber = String(chip.label || "").replace(/[^0-9]/g, "");
  const dir = original.includes("/") ? original.slice(0, original.lastIndexOf("/") + 1) : "";
  const exts = ["png", "webp", "jpg", "jpeg"];
  const bases = [
    `chip-T-${labelNumber}`,
    `chip-T${labelNumber}`,
    `chip-t-${labelNumber}`,
    `chip-t${labelNumber}`,
    `Chip-T-${labelNumber}`,
    `Chip-T${labelNumber}`
  ];
  const candidates = [];
  if (original) candidates.push(original);
  bases.forEach(base => exts.forEach(ext => candidates.push(`${dir}${base}.${ext}`)));
  return [...new Set(candidates.filter(Boolean))];
}

function buildRulesChipCard(chip, formatKey) {
  const candidates = buildChipImageCandidates(chip);
  const firstCandidate = escapeHtmlAttr(candidates[0] || "");
  const candidateAttr = escapeHtmlAttr(candidates.join("|"));
  const label = escapeHtmlAttr(chip.label);
  const chipCount = CHIP_SET_TEXT[formatKey]?.[chip.label] ?? 0;
  const chipClass = `chip-${String(chip.label).replace(/[^0-9]/g, "")}`;

  return `
    <div class="rules-chip-card ${chipClass}" title="${label} • Set per player = ${chipCount}">
    <img
        class="rules-chip-image"
        src="${firstCandidate}"
        alt="${label}"
        data-candidates="${candidateAttr}"
        data-candidate-index="0"
        data-image-error-action="candidate-list"
        loading="lazy"
        decoding="async"
        fetchpriority="auto"
        width="76"
        height="76"
      >
      <div class="rules-chip-fallback">${label}</div>
      <div class="rules-chip-label">${label}</div>
      <div class="rules-chip-count">Set per player = ${chipCount}</div>
    </div>
  `;
}

function buildRulesChipPanel(format, formatKey) {
  if (!Array.isArray(format?.chips) || !format.chips.length) return "";

  return `
    <div class="rules-chip-panel">
      <div class="rules-chip-grid rules-chip-grid-${format.chips.length}">
        ${format.chips.map(chip => buildRulesChipCard(chip, formatKey)).join("")}
      </div>
    </div>
  `;
}

function buildRulesFormatCallout(format) {
  if (!format?.bounty) return "";

  if (format.combinePayoutAndBounty && format.payoutLabel && format.projectedPool) {
    return `
      <aside class="rules-money-callout" role="note" aria-label="Projected Prize Pool and ${escapeHtmlAttr(format.bounty.title)}">
        <div class="rules-money-section rules-money-prize">
          <div class="rules-money-icon" aria-hidden="true">💵</div>
          <div>
            <h3>Projected Prize Pool: ${escapeHtmlAttr(format.projectedPool)}</h3>
            <p>${escapeHtmlAttr(format.payoutLabel)}</p>
            ${format.payoutNote ? `<p>${escapeHtmlAttr(format.payoutNote)}</p>` : ""}
          </div>
        </div>
        <div class="rules-money-section rules-money-bounty">
          <div class="rules-money-icon" aria-hidden="true">🏷️</div>
          <div>
            <h3>${escapeHtmlAttr(format.bounty.title)}</h3>
            <p>${escapeHtmlAttr(format.bounty.text)}</p>
            ${format.bounty.rulesLink ? '<p><a href="rules.html#rules-mtt-bounties">Read MTT bounty rules →</a></p>' : ""}
          </div>
        </div>
      </aside>
    `;
  }

  return `
    <aside class="rules-bounty-callout" role="note" aria-label="${escapeHtmlAttr(format.bounty.title)}">
      <div class="rules-bounty-icon" aria-hidden="true">🏷️</div>
      <div>
        <h3>${escapeHtmlAttr(format.bounty.title)}</h3>
        <p>${escapeHtmlAttr(format.bounty.text)}</p>
      </div>
    </aside>
  `;
}

function buildRulesTimerRail(format) {
  const levelMinutes = Number(format?.levelMinutes ?? 20);
  const breakMinutes = Number(format?.breakMinutes ?? 10);
  const levelLengthLabel = format?.levelLengthLabel || `${levelMinutes} min`;
  const runtimeLabel = format?.runtimeLabel || `${Number(format?.runtimeMinutes ?? 300)} min`;

  const breakRows = Array.isArray(format?.levels)
    ? format.levels.filter(row => row.type === "break")
    : [];

  const breakDurationCounts = breakRows.reduce((counts, row) => {
    const duration = Number(row.durationMinutes ?? breakMinutes);
    counts.set(duration, (counts.get(duration) || 0) + 1);
    return counts;
  }, new Map());

  const breakLengthLabel = [...breakDurationCounts.entries()]
    .map(([duration, count]) => `${count} × ${duration} min`)
    .join(" + ");

  const playableLevels = Array.isArray(format?.levels)
    ? format.levels.filter(row => row.type === "level").length
    : 0;
  const payoutLabel = format?.payoutLabel
    || (format?.payoutPlaces ? `Top ${Number(format.payoutPlaces)}` : "");
  const showPayoutInRail = payoutLabel && !format?.combinePayoutAndBounty;

  return `
    <div class="timer-rail">
      <div class="timer-pill"><strong>Levels:</strong> ${playableLevels}</div>
      <div class="timer-pill"><strong>Level Length:</strong> ${levelLengthLabel}</div>
      <div class="timer-pill"><strong>Breaks:</strong> ${breakLengthLabel}</div>
      <div class="timer-pill"><strong>Estimated Runtime:</strong> ${runtimeLabel}</div>
      ${showPayoutInRail ? `<div class="timer-pill${format?.payoutLabel ? " timer-pill-payouts" : ""}"><strong>💵 Projected Prize Pool:</strong> <span>${escapeHtmlAttr(payoutLabel)}</span></div>` : ""}
    </div>
  `;
}

function buildRulesBlindTable(format) {
  let rowIndex = 0;
  const tableLabel = `${format.title} blind levels`;
  const payoutPlaces = Number(format?.payoutPlaces ?? 0);
  const showEffectiveBb = format.showEffectiveBb !== false;
  const showTypicalRemainingPlayers = format.showTypicalRemainingPlayers === true;
  const columnCount = 5 + Number(showEffectiveBb) + Number(showTypicalRemainingPlayers);
  const effectiveBbHeader = showEffectiveBb ? '<th scope="col">Effective BB</th>' : "";
  const typicalRemainingHeader = showTypicalRemainingPlayers
    ? '<th scope="col">Typical Remaining Players</th>'
    : "";
  const rows = format.levels.map(row => {
    if (row.type === "break") {
      return `<tr class="blind-break"><td colspan="${columnCount}">${row.note}</td></tr>`;
    }
    const zebra = rowIndex % 2 === 0 ? "blind-row-dark" : "blind-row-light";
    const typicalRemaining = Number.parseInt(String(row.remaining ?? ""), 10);
    const isPayoutRow = payoutPlaces > 0
      && Number.isFinite(typicalRemaining)
      && typicalRemaining <= payoutPlaces;
    const rowClass = `${zebra}${isPayoutRow ? " blind-row-payout" : ""}`;
    const duration = row.duration || `${Number(format.levelMinutes ?? 20)} min`;
    const effectiveBbCell = showEffectiveBb ? `<td>${row.eff}</td>` : "";
    const typicalRemainingCell = showTypicalRemainingPlayers
      ? `<td>${row.remaining}</td>`
      : "";
    rowIndex += 1;
    return `
      <tr class="${rowClass}">
        <td role="rowheader">${row.level}</td>
        <td>${duration}</td>
        <td>${row.sb}</td>
        <td>${row.bb}</td>
        <td>${row.ante}</td>
        ${effectiveBbCell}
        ${typicalRemainingCell}
      </tr>
    `;
  }).join("");

  return `
    <div class="blind-sheet">
      <div class="blind-table-scroll" role="region" aria-label="Scrollable ${escapeHtmlAttr(tableLabel)}" tabindex="0">
        <table class="blind-table" aria-label="${escapeHtmlAttr(tableLabel)}">
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">Duration</th>
              <th scope="col">Small Blind</th>
              <th scope="col">Big Blind</th>
              <th scope="col">Ante</th>
              ${effectiveBbHeader}
              ${typicalRemainingHeader}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="blind-note">${format.blindNote || `Gold rows mark ${Number(format.breakMinutes ?? 10)}-minute breaks and chip-up points. Black and gray rows are ${Number(format.levelMinutes ?? 20)}-minute live levels.`}</p>
    </div>
  `;
}

function setActiveFormatButton(formatKey) {
  Object.keys(RULES_FORMATS).forEach(key => {
    const btn = document.getElementById(`format-btn-${key}`);
    if (btn) {
      const isActive = key === formatKey;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  });

}

function showFormat(formatKey) {
  const format = RULES_FORMATS[formatKey];
  const host = document.getElementById("format-content");
  if (!format || !host) return;
  if (formatKey === "sunday" && !hasOpenSundayGame(window.siteData)) return;

  setActiveFormatButton(formatKey);
  host.dataset.rulesFormat = formatKey;

  host.innerHTML = `
    <div class="rules-format">
      <div class="format-head">
        <div>
          <h2 class="format-title format-title-${formatKey}">${format.title}</h2>
          ${format.description ? `<p class="format-description">${format.description}</p>` : ""}
          ${format.assumption ? `<p class="format-description"><strong>${format.assumption}</strong></p>` : ""}
        </div>
      </div>
      ${buildRulesTimerRail(format)}
      ${buildRulesFormatCallout(format)}
      ${buildRulesChipPanel(format, formatKey)}
      ${buildRulesBlindTable(format)}
    </div>
  `;
}

function hasOpenSundayGame(data) {
  return !data?.rsvpUnavailable && getCurrentEvents(data).some(event => event.slot === "sunday");
}

function syncOptionalRulesFormats(data) {
  const button = document.getElementById("format-btn-sunday");
  const host = document.getElementById("format-content");
  if (!button || !host) return;
  const available = hasOpenSundayGame(data);
  const moveFocus = !available && document.activeElement === button;
  button.hidden = !available;
  if (!available && host.dataset.rulesFormat === "sunday") {
    showFormat("40k");
    // Do not close a PDF the user is reading when the Commish closes Sunday.
    const guide = document.getElementById("mtt-guide-panel");
    if (guide && !guide.hidden) setActiveFormatButton(null);
  }
  if (moveFocus) document.getElementById("format-btn-40k")?.focus({ preventScroll: true });
}

function initRulesPage(data) {
  const host = document.getElementById("format-content");
  if (!host) return;

  document.querySelectorAll("[data-rules-format]").forEach(button => {
    button.addEventListener("click", () => showFormat(button.dataset.rulesFormat));
  });

  showFormat("40k");
  syncOptionalRulesFormats(data);
}

