(() => {
  "use strict";

  const state = { records: [], goalies: {}, team: "", view: "goalies", selected: "" };
  const { goalType: goalTypeLabel, recordTitle } = window.MarchandLabels;
  const byId = (id) => document.getElementById(id);
  const elements = {
    body: document.body,
    status: byId("vault-state"),
    insights: byId("vault-insights"),
    resultCount: byId("vault-result-count"),
    reset: byId("vault-reset"),
    search: byId("vault-search"),
    sort: byId("vault-sort"),
    title: byId("vault-breakdown-title"),
    note: byId("vault-breakdown-note"),
    summary: byId("vault-breakdown-summary"),
    groupHeading: byId("vault-group-heading"),
    countHeading: byId("vault-count-heading"),
    caption: byId("vault-table-caption"),
    rows: byId("vault-breakdown-body"),
    empty: byId("vault-no-results"),
    history: byId("vault-history-story"),
  };
  const normalize = (value) => String(value ?? "").trim();
  const isGoal = (record) => record.sourceSheet === "Goals & Games" && ["4NF Goal", "PO Goal", "RS Goal"].includes(record.category);
  function isMarchandGoal(record) {
    return isGoal(record) && record.goalieScoredAgainst && record.goalieScoredAgainst !== "Empty net (no goaltender)";
  }
  const views = {
    goalies: { title: "Goalies scored against", singular: "Goalie", plural: "goalies", key: (record) => record.goalieScoredAgainst, include: isMarchandGoal, metric: "Goals represented", goals: true, note: "Every recorded opposing goalie. Assists and empty-net goals are excluded. A goal represented by more than one puck counts once in the goal total; both pucks remain listed." },
    arenas: { title: "Every arena in the vault", singular: "Arena", plural: "arenas", key: (record) => record.arena || "Not recorded", metric: "Games represented", note: "Every arena name recorded in the collection. Historical venue names are preserved as catalogued. Open an arena to see all of its pucks." },
    years: { title: "The complete collection timeline", singular: "Year", plural: "years", key: (record) => record.date.slice(0, 4), metric: "Games represented", note: "Every calendar year represented in the collection, including goals, assists, milestones and team artifacts." },
    goals: { title: "Every Goal Type", singular: "Goal Type", plural: "goal types", key: (record) => goalTypeLabel(record.goalType, false) || "Not Recorded", include: isGoal, metric: "Goals represented", goals: true, note: "Marchand goal records only, including Empty-Net Goals. Open the Goal Type Key for symbols and codes. Combined labels retain every applicable goal type." },
    sheets: { title: "Every collection wing", singular: "Collection wing", plural: "collection wings", key: (record) => record.sourceSheet, metric: "Games represented", note: "Explore Goals & Games, Career Milestones and the complete Road to History collection. Every matching puck is included." },
  };

  function teamEra(team) {
    const value = normalize(team).toLowerCase();
    if (value.includes("boston")) return "boston";
    if (value.includes("florida")) return "florida";
    if (value.includes("canada")) return "canada";
    return "all";
  }

  function setEra(era) {
    const selected = ["boston", "florida", "canada"].includes(era) ? era : "all";
    state.team = { all: "", boston: "Boston Bruins", florida: "Florida Panthers", canada: "Canada" }[selected];
    elements.body.dataset.era = selected;
    for (const link of document.querySelectorAll("[data-vault-back]")) {
      link.href = selected === "all" ? "../marchand.html" : `../marchand.html?team=${selected}`;
    }
    for (const button of document.querySelectorAll("[data-vault-era-button]")) {
      const active = button.dataset.vaultEraButton === selected;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function filteredRecords() {
    return state.records.filter((record) => !state.team || record.team === state.team);
  }

  function eventKey(record, goals) {
    const game = `${record.team}|${record.date}|${record.opponent}`;
    return goals ? `${game}|${record.period}|${record.time}|${record.careerStat}` : game;
  }

  function groupsFor(records, view) {
    const groups = new Map();
    for (const record of records) {
      if (view.include && !view.include(record)) continue;
      const label = view.key(record);
      if (!groups.has(label)) groups.set(label, { label, records: [], events: new Set() });
      const group = groups.get(label);
      group.records.push(record);
      group.events.add(eventKey(record, view.goals));
    }
    return [...groups.values()].map((group) => {
      group.records.sort((a, b) => a.date.localeCompare(b.date) || a.inventoryId - b.inventoryId);
      return { ...group, count: group.events.size, first: group.records[0].date, latest: group.records[group.records.length - 1].date };
    });
  }

  function dateLabel(value) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  }

  function node(tag, text, className = "") {
    const result = document.createElement(tag);
    if (text != null) result.textContent = text;
    if (className) result.className = className;
    return result;
  }

  function artifactLabel(record) {
    return recordTitle(record);
  }

  function goaliePortrait(name) {
    const portrait = node("span", null, "marchand-goalie-portrait");
    portrait.setAttribute("aria-hidden", "true");
    const player = state.goalies[name];
    const initials = () => { portrait.textContent = name.split(/[ -]/).map((part) => part[0]).slice(0, 2).join(""); };
    if (!player?.headshot) { initials(); return portrait; }
    const img = node("img");
    img.src = player.headshot;
    img.alt = "";
    img.width = 56;
    img.height = 56;
    img.loading = "lazy";
    img.addEventListener("error", initials, { once: true });
    portrait.append(img);
    return portrait;
  }

  function detailsRow(group, index) {
    const row = node("tr", null, "marchand-breakdown-detail-row");
    const cell = node("td");
    cell.colSpan = 5;
    const panel = node("section", null, "marchand-breakdown-details");
    panel.id = `vault-group-${index}`;
    panel.setAttribute("aria-label", `${group.label}: all matching pucks`);
    panel.append(node("h4", `${group.label} · ${group.records.length} puck${group.records.length === 1 ? "" : "s"}`));
    const list = node("div", null, "marchand-explorer-pucks");
    for (const record of group.records) {
      const card = node("article", null, "marchand-explorer-puck");
      const link = node("a", `#${record.inventoryId} · ${artifactLabel(record)}`);
      const params = new URLSearchParams({ team: teamEra(record.team), artifact: record.key });
      link.href = `../marchand.html?${params}`;
      link.setAttribute("aria-label", `Open deep dive for artifact ${record.inventoryId}: ${artifactLabel(record)}`);
      card.append(link, node("p", `${dateLabel(record.date)} · ${record.opponent} · ${record.arena}`));
      const point = ["Assist", "RS Point"].includes(record.category);
      const emoji = point ? "🍎" : record.puckType === "Goal Scored Puck" ? "🍪" : "🏒";
      card.append(node("p", [`${emoji} ${record.puckType}`, record.period && `Period ${record.period} · ${record.time}`, goalTypeLabel(record.goalType), record.goalieScoredAgainst && `Goalie: ${record.goalieScoredAgainst}`].filter(Boolean).join(" · ")));
      const detailLink = node("a", "Open full deep dive ↗", "marchand-explorer-detail-hint");
      detailLink.href = link.href;
      card.append(detailLink);
      list.append(card);
    }
    panel.append(list);
    cell.append(panel);
    row.append(cell);
    return row;
  }

  function render() {
    const records = filteredRecords();
    const view = views[state.view];
    const groups = groupsFor(records, view);
    const query = normalize(elements.search.value).toLocaleLowerCase();
    const shown = groups.filter((group) => group.label.toLocaleLowerCase().includes(query));
    shown.sort((a, b) => {
      if (elements.sort.value === "name") return a.label.localeCompare(b.label, undefined, { numeric: true });
      if (elements.sort.value === "recent") return b.latest.localeCompare(a.latest) || a.label.localeCompare(b.label);
      return b.count - a.count || b.records.length - a.records.length || a.label.localeCompare(b.label);
    });
    if (!shown.some((group) => group.label === state.selected)) state.selected = "";
    elements.history.hidden = !(state.view === "sheets" && state.selected === "Road to History");
    elements.resultCount.textContent = records.length;
    elements.title.textContent = view.title;
    elements.note.textContent = view.note;
    elements.groupHeading.textContent = view.singular;
    elements.countHeading.textContent = view.metric;
    elements.caption.textContent = `${view.title} — complete collection breakdown`;
    elements.search.placeholder = `Search ${view.plural}…`;
    elements.summary.textContent = `Showing ${shown.length} of ${groups.length} ${view.plural} · ${shown.reduce((sum, group) => sum + group.records.length, 0)} puck records`;
    elements.empty.hidden = shown.length > 0;
    for (const button of document.querySelectorAll("[data-vault-view]")) {
      button.setAttribute("aria-pressed", String(button.dataset.vaultView === state.view));
    }
    const fragment = document.createDocumentFragment();
    shown.forEach((group, index) => {
      const row = node("tr");
      const nameCell = node("th");
      nameCell.scope = "row";
      const button = node("button", `${state.selected === group.label ? "−" : "+"} `, "marchand-group-button");
      if (state.view === "goalies") button.append(goaliePortrait(group.label));
      button.append(node("span", group.label));
      button.type = "button";
      button.setAttribute("aria-expanded", String(state.selected === group.label));
      button.setAttribute("aria-controls", `vault-group-${index}`);
      button.addEventListener("click", () => {
        state.selected = state.selected === group.label ? "" : group.label;
        render();
        elements.rows.querySelectorAll(".marchand-group-button")[index]?.focus({ preventScroll: true });
        if (!elements.history.hidden) elements.history.scrollIntoView({ block: "nearest" });
      });
      nameCell.append(button);
      row.append(nameCell, node("td", group.count, "marchand-breakdown-number"), node("td", group.records.length), node("td", dateLabel(group.first)), node("td", dateLabel(group.latest)));
      fragment.append(row);
      const detail = detailsRow(group, index);
      detail.hidden = state.selected !== group.label;
      fragment.append(detail);
    });
    elements.rows.replaceChildren(fragment);
  }

  function resetSelection() {
    state.selected = "";
    elements.search.value = "";
  }

  function updateTeamCounts() {
    for (const era of ["all", "boston", "florida", "canada"]) {
      byId(`vault-count-${era}`).textContent = state.records.filter((record) => era === "all" || teamEra(record.team) === era).length;
    }
  }

  async function loadVault() {
    try {
      const response = await fetch("../data/marchand-pucks.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Collection request failed");
      const payload = await response.json();
      if (!payload?.meta || !Array.isArray(payload.records) || payload.records.length !== payload.meta.records) throw new Error("Collection payload is invalid");
      state.records = payload.records;
      // A portrait request failure must not prevent browsing the collection.
      state.goalies = await fetch("../data/marchand-goalies.json", { cache: "no-store" })
        .then((result) => result.ok ? result.json() : {}).then((data) => data.goalies || {}).catch(() => ({}));
      window.MarchandLabels.renderKey(byId("goal-type-key-items"));
      updateTeamCounts();
      setEra(new URLSearchParams(window.location.search).get("team"));
      render();
      elements.status.hidden = true;
      elements.insights.hidden = false;
    } catch (error) {
      console.error("Could not load vault intelligence:", error);
      elements.insights.hidden = true;
      elements.status.className = "marchand-loading marchand-error marchand-vault-loading";
      const retry = node("button", "Try again", "marchand-vault-reset");
      retry.type = "button";
      retry.addEventListener("click", loadVault);
      elements.status.replaceChildren(node("p", "The collection database could not be loaded."), retry);
    }
  }

  for (const button of document.querySelectorAll("[data-vault-view]")) {
    button.addEventListener("click", () => {
      state.view = button.dataset.vaultView;
      resetSelection();
      elements.sort.value = state.view === "years" ? "name" : "count";
      render();
    });
  }
  for (const button of document.querySelectorAll("[data-vault-era-button]")) {
    button.addEventListener("click", () => { resetSelection(); setEra(button.dataset.vaultEraButton); render(); });
  }
  elements.search.addEventListener("input", render);
  elements.sort.addEventListener("change", render);
  elements.reset.addEventListener("click", () => {
    resetSelection();
    state.view = "goalies";
    elements.sort.value = "count";
    setEra("all");
    render();
  });
  loadVault();
})();
