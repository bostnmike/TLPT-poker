(() => {
  "use strict";

  const state = {
    records: [],
    team: "",
    sheet: "",
    goalType: "",
    year: "",
    arena: "",
  };

  const elements = {
    body: document.body,
    status: document.getElementById("vault-state"),
    insights: document.getElementById("vault-insights"),
    resultCount: document.getElementById("vault-result-count"),
    reset: document.getElementById("vault-reset"),
    back: document.getElementById("vault-back-link"),
    sheets: document.getElementById("insight-sheets"),
    goals: document.getElementById("insight-goals"),
    timeline: document.getElementById("insight-timeline"),
    arenas: document.getElementById("insight-arenas"),
  };

  const normalize = (value) => String(value ?? "").trim();

  function teamEra(team) {
    const value = normalize(team).toLocaleLowerCase();
    if (value.includes("boston")) return "boston";
    if (value.includes("florida")) return "florida";
    if (value.includes("canada")) return "canada";
    return "all";
  }

  function countBy(records, valueFor) {
    const counts = new Map();
    for (const record of records) {
      const value = valueFor(record);
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }

  function setEra(era) {
    const normalizedEra = ["boston", "florida", "canada"].includes(era) ? era : "all";
    const teamByEra = { all: "", boston: "Boston Bruins", florida: "Florida Panthers", canada: "Canada" };
    state.team = teamByEra[normalizedEra];
    elements.body.dataset.era = normalizedEra;
    elements.back.href = normalizedEra === "all" ? "../marchand.html" : `../marchand.html?team=${normalizedEra}`;
    for (const button of document.querySelectorAll("[data-vault-era-button]")) {
      const active = button.dataset.vaultEraButton === normalizedEra;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function filteredRecords() {
    return state.records.filter((record) => {
      if (state.team && record.team !== state.team) return false;
      if (state.sheet && record.sourceSheet !== state.sheet) return false;
      if (state.goalType && (record.sourceSheet !== "Goals & Games" || (record.goalType || "Even strength / unmarked") !== state.goalType)) return false;
      if (state.year && (!/^\d{4}-/.test(record.date) || record.date.slice(0, 4) !== state.year)) return false;
      if (state.arena && record.arena !== state.arena) return false;
      return true;
    });
  }

  function renderBars(container, entries, selectedValue, onSelect) {
    const maximum = Math.max(...entries.map((entry) => entry[1]), 1);
    const fragment = document.createDocumentFragment();
    for (const [label, count] of entries) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "marchand-bar-row";
      const active = label === selectedValue;
      row.setAttribute("aria-pressed", String(active));
      row.setAttribute("aria-label", `${active ? "Remove" : "Filter by"} ${label}: ${count} artifacts`);
      row.addEventListener("click", () => onSelect(active ? "" : label));
      const heading = document.createElement("span");
      heading.className = "marchand-bar-row-heading";
      const name = document.createElement("span");
      name.textContent = label;
      const value = document.createElement("strong");
      value.textContent = count;
      heading.append(name, value);
      const track = document.createElement("i");
      const fill = document.createElement("b");
      fill.style.width = `${Math.max((count / maximum) * 100, 4)}%`;
      track.append(fill);
      row.append(heading, track);
      fragment.append(row);
    }
    container.replaceChildren(fragment);
  }

  function render() {
    const records = filteredRecords();
    elements.resultCount.textContent = records.length;

    renderBars(elements.sheets, countBy(records, (record) => record.sourceSheet), state.sheet, (value) => {
      state.sheet = value;
      render();
    });
    renderBars(elements.goals, countBy(
      records.filter((record) => record.sourceSheet === "Goals & Games"),
      (record) => record.goalType || "Even strength / unmarked",
    ), state.goalType, (value) => {
      state.goalType = value;
      render();
    });

    const years = countBy(records, (record) => /^\d{4}-/.test(record.date) ? record.date.slice(0, 4) : "")
      .sort((left, right) => Number(left[0]) - Number(right[0]));
    const maximum = Math.max(...years.map((entry) => entry[1]), 1);
    const timeline = document.createDocumentFragment();
    for (const [year, count] of years) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "marchand-year";
      const active = year === state.year;
      item.setAttribute("aria-pressed", String(active));
      item.setAttribute("aria-label", `${active ? "Remove" : "Filter by"} ${year}: ${count} artifacts`);
      item.addEventListener("click", () => {
        state.year = active ? "" : year;
        render();
      });
      const countLabel = document.createElement("strong");
      countLabel.textContent = count;
      const bar = document.createElement("i");
      bar.style.height = `${Math.max((count / maximum) * 100, 8)}%`;
      const yearLabel = document.createElement("span");
      yearLabel.textContent = year;
      item.append(countLabel, bar, yearLabel);
      timeline.append(item);
    }
    elements.timeline.replaceChildren(timeline);

    renderBars(elements.arenas, countBy(records, (record) => record.arena).slice(0, 8), state.arena, (value) => {
      state.arena = value;
      render();
    });
  }

  function updateTeamCounts() {
    const counts = {
      all: state.records.length,
      boston: state.records.filter((record) => teamEra(record.team) === "boston").length,
      florida: state.records.filter((record) => teamEra(record.team) === "florida").length,
      canada: state.records.filter((record) => teamEra(record.team) === "canada").length,
    };
    for (const [era, count] of Object.entries(counts)) {
      document.getElementById(`vault-count-${era}`).textContent = count;
    }
  }

  function resetExhibit() {
    state.sheet = "";
    state.goalType = "";
    state.year = "";
    state.arena = "";
    setEra("all");
    render();
  }

  function showError() {
    elements.insights.hidden = true;
    elements.status.className = "marchand-loading marchand-error marchand-vault-loading";
    elements.status.replaceChildren();
    const message = document.createElement("p");
    message.textContent = "The collection intelligence could not be loaded.";
    const link = document.createElement("a");
    link.className = "marchand-vault-back";
    link.href = "../marchand.html";
    link.textContent = "Return to the collection";
    elements.status.append(message, link);
  }

  async function loadVault() {
    try {
      const response = await fetch("../data/marchand-pucks.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Collection request failed");
      const payload = await response.json();
      if (!payload?.meta || !Array.isArray(payload.records) || payload.records.length !== payload.meta.records) throw new Error("Collection payload is invalid");
      state.records = payload.records;
      updateTeamCounts();
      const requestedEra = new URLSearchParams(window.location.search).get("team");
      setEra(requestedEra);
      render();
      elements.status.hidden = true;
      elements.insights.hidden = false;
    } catch (error) {
      console.error("Could not load vault intelligence:", error);
      showError();
    }
  }

  for (const button of document.querySelectorAll("[data-vault-era-button]")) {
    button.addEventListener("click", () => {
      state.sheet = "";
      state.goalType = "";
      state.year = "";
      state.arena = "";
      setEra(button.dataset.vaultEraButton);
      render();
    });
  }
  elements.reset.addEventListener("click", resetExhibit);

  loadVault();
})();
