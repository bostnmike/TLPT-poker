function archetypeFormulaText(name) {
  if (name === "The Hitman") return "Hitman = Aggression Index + (Hits × 0.8)";
  if (name === "The Closer") return "Closer = Clutch Index × 1.25";
  if (name === "The Grinder") return "Grinder = (Survivor Index × 1.05) + (Composure Index × 0.45) − (Aggression Index × 0.35)";
  if (name === "The Lucky Devil") return "Lucky Devil = Luck Index × 1.15";
  if (name === "The Wildcard") return "Wildcard = ((100 − Composure Index) × 1.1) + (Rebuys × 0.8)";
  if (name === "The Bubble Magnet") return "Bubble Magnet = (Bubbles × 4) + (Clutch Index × 0.15)";
  if (name === "The Technician") return "Technician = (Clutch Index + Survivor Index + Aggression Index) ÷ 3";
  return "";
}

function tierFormulaText(name) {
  const base = "Tier Score = (True Skill × 1.5) + (Clutch × 1.1) + (Aggression × 0.65) + (Survivor × 1.0) + (Composure × 1.25) + sample bonus − rebuy penalty.";

  if (name === "The Apex Predator") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: top 15% of Tier Scores.</span>
      <br><span class="tier-formula-drop">• Relegation line: fall below the 15% cutoff and you drop.</span>
    `;
  }

  if (name === "The Table Crusher") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: 15% to 35%.</span>
      <br><span class="tier-formula-drop">• Relegation line: fall below the 30% cutoff.</span>
    `;
  }

  if (name === "The Shot Maker") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: 35% to 60%.</span>
      <br><span class="tier-formula-drop">• Relegation line: fall below the 60% cutoff.</span>
    `;
  }

  if (name === "The Gambler") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: 60% to 80%.</span>
      <br><span class="tier-formula-drop">• Relegation line: fall below the 80% cutoff.</span>
    `;
  }

  if (name === "The League Sponsor") {
    return `
      ${base}
      <br><span class="tier-formula-range">• Range: bottom 20% (80% to 100%).</span>
      <br><span class="tier-formula-drop">• Good news, there's nowhere to go but up...</span>
    `;
  }

  return base;
}
 
function buildArchetypeGuideCard() {
  const defaultItem = ARCHETYPE_GUIDE[0];
  const defaultFormula = archetypeFormulaText(defaultItem.name);

  return `
    <div class="event-card home-guide-card home-guide-card-archetype">
      <div class="home-formula-display" id="home-archetype-formula-display">
        <div class="home-formula-display-title">Archetype Formula</div>
        <div class="home-formula-display-body">${defaultFormula}</div>
      </div>

      <div class="event-guide-rows">
        <div class="player-archetype-line event-guide-line">
          <span class="profile-line-desc">
            ${ARCHETYPE_GUIDE.map(item => `
              <button
                type="button"
                class="home-guide-pill home-guide-pill-reveal"
                data-formula-target="home-archetype-formula-display"
                data-formula-title="Archetype Formula"
                data-formula-text="${archetypeFormulaText(item.name).replace(/"/g, "&quot;")}"
                data-archetype-tone="${item.name
                  .replace(/^The\\s+/i, "")
                  .toLowerCase()
                  .replace(/\\s+/g, "")
                  .replace("luckydevil", "lucky")}"
              >
                ${item.emoji} ${item.name}
              </button>
            `).join("")}
          </span>
        </div>
      </div>
    </div>
  `;
}

function buildTierGuideCard() {
  const defaultItem = TIER_GUIDE[0];
  const defaultFormula = tierFormulaText(defaultItem.name);

  return `
    <div class="event-card home-guide-card home-guide-card-tier">
      <div class="home-formula-display" id="home-tier-formula-display">
        <div class="home-formula-display-title">Tier Formula</div>
        <div class="home-formula-display-body">${defaultFormula}</div>
      </div>

      <div class="event-guide-rows">
        <div class="player-tier-line event-guide-line">
          <span class="profile-line-desc">
            ${TIER_GUIDE.map(item => `
              <button
                type="button"
                class="home-guide-pill home-guide-pill-reveal"
                data-formula-target="home-tier-formula-display"
                data-formula-title="Tier Formula"
                data-formula-text="${tierFormulaText(item.name).replace(/"/g, "&quot;")}"
              >
                ${item.emoji} ${item.name}
              </button>
            `).join("")}
          </span>
        </div>
      </div>
    </div>
  `;
}

function wireHomeFormulaReveal(scope = document) {
  scope.querySelectorAll(".home-guide-pill-reveal").forEach(button => {
    button.addEventListener("mouseenter", () => {
      const targetId = button.dataset.formulaTarget;
      const title = button.dataset.formulaTitle || "Formula";
      const text = button.dataset.formulaText || "";

      const host = document.getElementById(targetId);
      if (!host) return;

      host.innerHTML = `
        <div class="home-formula-display-title">${title}</div>
        <div class="home-formula-display-body">${text}</div>
      `;
    });

    button.addEventListener("focus", () => {
      const targetId = button.dataset.formulaTarget;
      const title = button.dataset.formulaTitle || "Formula";
      const text = button.dataset.formulaText || "";

      const host = document.getElementById(targetId);
      if (!host) return;

      host.innerHTML = `
        <div class="home-formula-display-title">${title}</div>
        <div class="home-formula-display-body">${text}</div>
      `;
    });
  });
}

