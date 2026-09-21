(() => {
  "use strict";
  const categories = Object.freeze({
    "4NF Goal": "4 Nations Faceoff",
    Assist: "Assist",
    Milestone: "Milestone",
    "PO Goal": "Playoff Goal",
    "Road to History": "Road to History",
    "RS Goal": "Regular-Season Goal",
    "RS Point": "Regular-Season Point",
  });
  const goalTypes = Object.freeze({
    ESG: "Even-Strength Goal",
    PPG: "Power-Play Goal",
    SHG: "Short-Handed Goal",
    GWG: "Game-Winning Goal",
    OT: "Overtime Goal",
    PS: "Penalty-Shot Goal",
    ENG: "Empty-Net Goal",
  });
  const goalEmojis = Object.freeze({ ESG: "⚖️", PPG: "⚡", SHG: "🛡️", GWG: "✅", OT: "⏱️", PS: "🏒", ENG: "🥅" });
  const category = (value) => categories[value] || value || "Collection Artifact";
  function goalType(value, includeCode = true) {
    if (!value) return "";
    const codes = String(value).match(/ESG|PPG|SHG|GWG|ENG|OT|PS/g);
    if (!codes || String(value).replace(/ESG|PPG|SHG|GWG|ENG|OT|PS|[\s&+,/]/g, "")) return value;
    return [...new Set(codes)].map((code) => `${goalEmojis[code]} ${goalTypes[code]}${includeCode ? ` (${code})` : ""}`).join(" & ");
  }
  function perfectionLine(record) {
    let codes = [];
    if (record.sourceSheet === "Goals & Games") {
      const point = ["Assist", "RS Point"].includes(record.category);
      const scorer = record.scorerCode || (point ? record.notes?.match(/\bon ([A-Za-z]{1,3}\d{1,2}) goal\b/i)?.[1] : "BM63");
      codes = [scorer, record.primaryAssist, record.secondaryAssist];
    } else if (record.puckType === "Goal Scored Puck") {
      codes = String(record.description || "").match(/\b[A-Za-z]{1,3}\d{1,2}\b/g) || [];
    }
    const unique = new Set(codes.map((code) => String(code || "").toUpperCase()));
    return unique.size === 3 && ["BM63", "DP88", "PB37"].every((code) => unique.has(code)) ? "🤌🏻 Perfection Line" : "";
  }
  function recordTitle(record) {
    if (record.description) return record.description;
    const label = record.category === "4NF Goal" ? "4 Nations Faceoff Goal" : category(record.category);
    return `${label}${record.careerStat ? ` #${record.careerStat}` : ""}`;
  }
  function renderKey(container) {
    container.replaceChildren(...Object.keys(goalTypes).map((code) => {
      const item = document.createElement("span");
      item.textContent = goalType(code);
      return item;
    }));
  }
  window.MarchandLabels = Object.freeze({ category, goalType, recordTitle, renderKey, perfectionLine });
})();
