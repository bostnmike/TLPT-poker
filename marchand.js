(() => {
  "use strict";

  const state = {
    records: [],
    filtered: [],
    meta: null,
    players: {},
    sortKey: "date",
    sortDirection: "desc",
  };

  const elements = {
    body: document.body,
    search: document.getElementById("collection-search"),
    team: document.getElementById("team-filter"),
    sheet: document.getElementById("sheet-filter"),
    category: document.getElementById("category-filter"),
    arena: document.getElementById("arena-filter"),
    puck: document.getElementById("puck-filter"),
    video: document.getElementById("video-filter"),
    clear: document.getElementById("clear-filters"),
    status: document.getElementById("collection-state"),
    tableShell: document.getElementById("collection-table-shell"),
    tableBody: document.getElementById("collection-body"),
    empty: document.getElementById("empty-state"),
    resultCount: document.getElementById("result-count"),
    insightSheets: document.getElementById("insight-sheets"),
    insightGoals: document.getElementById("insight-goals"),
    insightTimeline: document.getElementById("insight-timeline"),
    insightArenas: document.getElementById("insight-arenas"),
    dialog: document.getElementById("artifact-dialog"),
    dialogClose: document.getElementById("artifact-dialog-close"),
    dialogCrest: document.getElementById("artifact-dialog-crest"),
    dialogNumber: document.getElementById("artifact-dialog-number"),
    dialogTeam: document.getElementById("artifact-dialog-team"),
    dialogTitle: document.getElementById("artifact-dialog-title"),
    dialogSubtitle: document.getElementById("artifact-dialog-subtitle"),
    dialogFacts: document.getElementById("artifact-dialog-facts"),
    dialogNotes: document.getElementById("artifact-dialog-notes"),
    personnel: document.getElementById("artifact-personnel"),
    personnelTitle: document.getElementById("artifact-personnel-title"),
    personnelGrid: document.getElementById("artifact-personnel-grid"),
    provenance: document.getElementById("artifact-provenance"),
    sourceGrid: document.getElementById("artifact-source-grid"),
    videoPanel: document.getElementById("artifact-video-panel"),
    videoFrame: document.getElementById("artifact-video"),
    videoSource: document.getElementById("artifact-video-source"),
  };

  const normalize = (value) => String(value ?? "").trim();
  const lower = (value) => normalize(value).toLocaleLowerCase();

  function teamEra(team) {
    const value = lower(team);
    if (value.includes("boston")) return "boston";
    if (value.includes("florida")) return "florida";
    if (value.includes("canada")) return "canada";
    return "all";
  }

  function recordTitle(record) {
    if (record.description) return record.description;
    if (record.category.includes("Goal") && record.careerStat) return `Career goal #${record.careerStat}`;
    if (record.category === "Assist" && record.careerStat) return `Career assist #${record.careerStat}`;
    if (record.category === "RS Point" && record.careerStat) return `Career point #${record.careerStat}`;
    return record.category || "Collection artifact";
  }

  function recordSubtitle(record) {
    const details = [record.sourceSheet];
    if (record.seasonStat) details.push(`Season #${record.seasonStat}`);
    if (record.goalType) details.push(record.goalType);
    if (record.homeRoad) details.push(record.homeRoad);
    return details.join(" · ");
  }

  function displayDate(value) {
    if (!value) return "Not recorded";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  }

  function dateValue(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : Number.NEGATIVE_INFINITY;
  }

  function setOptions(select, records, key, placeholder) {
    const values = [...new Set(records.map((record) => normalize(record[key])).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
    const fragment = document.createDocumentFragment();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = placeholder;
    fragment.append(all);
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      fragment.append(option);
    }
    select.replaceChildren(fragment);
  }

  function setEra(era, updateTeamFilter = true) {
    elements.body.dataset.era = era;
    for (const button of document.querySelectorAll("[data-era-button]")) {
      const active = button.dataset.eraButton === era;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    if (updateTeamFilter) {
      const teamByEra = { all: "", boston: "Boston Bruins", florida: "Florida Panthers", canada: "Canada" };
      elements.team.value = teamByEra[era] || "";
    }
  }

  function updateHero(payload) {
    const totals = {
      all: payload.records.length,
      boston: payload.records.filter((record) => teamEra(record.team) === "boston").length,
      florida: payload.records.filter((record) => teamEra(record.team) === "florida").length,
      canada: payload.records.filter((record) => teamEra(record.team) === "canada").length,
    };
    document.getElementById("stat-records").textContent = payload.meta.records;
    document.getElementById("stat-goals").textContent = payload.meta.goalsAndGames;
    document.getElementById("stat-milestones").textContent = payload.meta.milestones;
    document.getElementById("stat-history").textContent = payload.meta.roadToHistory;
    document.getElementById("stat-videos").textContent = payload.meta.videos;
    for (const [era, count] of Object.entries(totals)) {
      document.getElementById(`era-count-${era}`).textContent = count;
    }
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

  function renderBars(container, entries) {
    const maximum = Math.max(...entries.map((entry) => entry[1]), 1);
    const fragment = document.createDocumentFragment();
    for (const [label, count] of entries) {
      const row = document.createElement("div");
      row.className = "marchand-bar-row";
      const heading = document.createElement("div");
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

  function renderInsights(records) {
    renderBars(elements.insightSheets, countBy(records, (record) => record.sourceSheet));
    renderBars(elements.insightGoals, countBy(
      records.filter((record) => record.sourceSheet === "Goals & Games"),
      (record) => record.goalType || "Even strength / unmarked",
    ));

    const yearEntries = countBy(records, (record) => /^\d{4}-/.test(record.date) ? record.date.slice(0, 4) : "")
      .sort((left, right) => Number(left[0]) - Number(right[0]));
    const yearMax = Math.max(...yearEntries.map((entry) => entry[1]), 1);
    const timeline = document.createDocumentFragment();
    for (const [year, count] of yearEntries) {
      const item = document.createElement("div");
      item.className = "marchand-year";
      const countLabel = document.createElement("strong");
      countLabel.textContent = count;
      const bar = document.createElement("i");
      bar.style.height = `${Math.max((count / yearMax) * 100, 8)}%`;
      const yearLabel = document.createElement("span");
      yearLabel.textContent = year;
      item.append(countLabel, bar, yearLabel);
      timeline.append(item);
    }
    elements.insightTimeline.replaceChildren(timeline);
    renderBars(elements.insightArenas, countBy(records, (record) => record.arena).slice(0, 8));
  }

  function decodedNames(record) {
    return (record.playerCodes || []).map((code) => {
      const player = state.players[code];
      return player ? `${code} ${player.name}` : code;
    });
  }

  function searchableText(record) {
    const source = (record.sourceData || []).flatMap((field) => [field.label, field.value, field.url]);
    return lower([JSON.stringify(record), ...source, ...decodedNames(record)].join(" "));
  }

  function filteredRecords() {
    const query = lower(elements.search.value);
    return state.records.filter((record) => {
      if (elements.team.value && record.team !== elements.team.value) return false;
      if (elements.sheet.value && record.sourceSheet !== elements.sheet.value) return false;
      if (elements.category.value && record.category !== elements.category.value) return false;
      if (elements.arena.value && record.arena !== elements.arena.value) return false;
      if (elements.puck.value && record.puckType !== elements.puck.value) return false;
      if (elements.video.checked && !record.videoUrl) return false;
      return !query || searchableText(record).includes(query);
    });
  }

  function sortedRecords(records) {
    const direction = state.sortDirection === "asc" ? 1 : -1;
    return [...records].sort((left, right) => {
      let leftValue = left[state.sortKey];
      let rightValue = right[state.sortKey];
      if (state.sortKey === "date") {
        leftValue = dateValue(leftValue);
        rightValue = dateValue(rightValue);
      }
      if (state.sortKey === "inventoryId") {
        leftValue = Number(leftValue);
        rightValue = Number(rightValue);
      }
      if (typeof leftValue === "number" && typeof rightValue === "number") return (leftValue - rightValue) * direction;
      return normalize(leftValue).localeCompare(normalize(rightValue), undefined, { numeric: true, sensitivity: "base" }) * direction;
    });
  }

  function cell(text, className = "") {
    const td = document.createElement("td");
    td.textContent = text || "—";
    if (className) td.className = className;
    return td;
  }

  function renderRows(records) {
    const fragment = document.createDocumentFragment();
    for (const record of records) {
      const row = document.createElement("tr");
      row.dataset.team = teamEra(record.team);
      row.append(cell(String(record.inventoryId), "marchand-id"));
      row.append(cell(displayDate(record.date), "marchand-date"));

      const teamCell = document.createElement("td");
      const teamPill = document.createElement("span");
      teamPill.className = "marchand-team-pill";
      teamPill.dataset.team = teamEra(record.team);
      teamPill.textContent = record.team || "Unassigned";
      teamCell.append(teamPill);
      row.append(teamCell);

      const artifactCell = document.createElement("td");
      const title = document.createElement("span");
      title.className = "marchand-artifact-title";
      title.textContent = recordTitle(record);
      const subtitle = document.createElement("span");
      subtitle.className = "marchand-artifact-subtitle";
      subtitle.textContent = recordSubtitle(record);
      artifactCell.append(title, subtitle);
      row.append(artifactCell);

      row.append(cell(record.opponent, record.opponent ? "" : "marchand-muted"));
      row.append(cell(record.arena, record.arena ? "" : "marchand-muted"));

      const puckCell = document.createElement("td");
      const puckPill = document.createElement("span");
      puckPill.className = "marchand-puck-pill";
      puckPill.textContent = record.puckType || "Not recorded";
      puckCell.append(puckPill);
      row.append(puckCell);

      const actionCell = document.createElement("td");
      const action = document.createElement("button");
      action.type = "button";
      action.className = "marchand-open-button";
      action.dataset.hasVideo = String(Boolean(record.videoUrl));
      action.setAttribute("aria-label", `${record.videoUrl ? "Watch video and explore" : "Explore"} artifact ${record.inventoryId}`);
      action.textContent = record.videoUrl ? "▶ Deep dive" : "Deep dive";
      action.addEventListener("click", () => openArtifact(record));
      actionCell.append(action);
      row.append(actionCell);
      fragment.append(row);
    }
    elements.tableBody.replaceChildren(fragment);
  }

  function updateSortLabels() {
    for (const button of document.querySelectorAll("[data-sort]")) {
      const active = button.dataset.sort === state.sortKey;
      button.querySelector("span").textContent = active ? (state.sortDirection === "asc" ? "↑" : "↓") : "↕";
      const th = button.closest("th");
      if (active) th.setAttribute("aria-sort", state.sortDirection === "asc" ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    }
  }

  function render() {
    state.filtered = sortedRecords(filteredRecords());
    const count = state.filtered.length;
    elements.resultCount.textContent = count;
    elements.status.textContent = `${count} of ${state.records.length} artifacts on display.`;
    elements.status.className = "visually-hidden";
    elements.tableShell.hidden = count === 0;
    elements.empty.hidden = count !== 0;
    renderRows(state.filtered);
    updateSortLabels();
  }

  function clearFilters() {
    elements.search.value = "";
    elements.team.value = "";
    elements.sheet.value = "";
    elements.category.value = "";
    elements.arena.value = "";
    elements.puck.value = "";
    elements.video.checked = false;
    setEra("all", false);
    render();
  }

  function embedUrl(record) {
    if (record.videoProvider === "youtube") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(record.videoId)}?rel=0`;
    if (record.videoProvider === "nhl") return `https://players.brightcove.net/6415718365001/default_default/index.html?videoId=${encodeURIComponent(record.videoId)}&autoplay=false&muted=false&applicationId=nhl`;
    return "";
  }

  function createCrest(era, className = "") {
    const crest = document.createElement("span");
    crest.className = `marchand-crest ${className}`.trim();
    if (era === "canada") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 112");
      svg.setAttribute("aria-label", "Red maple leaf");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M50 1 58 20 72 11 68 31 89 27 81 46 99 53 76 66 82 82 57 77 58 111 42 111 43 77 18 82 24 66 1 53 19 46 11 27 32 31 28 11 42 20Z");
      svg.append(path);
      crest.append(svg);
      return crest;
    }
    const team = era === "florida" ? { code: "FLA", name: "Florida Panthers" } : { code: "BOS", name: "Boston Bruins" };
    const image = document.createElement("img");
    image.src = `https://assets.nhle.com/logos/nhl/svg/${team.code}_light.svg`;
    image.alt = `${team.name} logo`;
    crest.append(image);
    return crest;
  }

  function addFact(label, value) {
    if (value == null || normalize(value) === "") return;
    const fact = document.createElement("div");
    fact.className = "marchand-fact";
    const factLabel = document.createElement("span");
    factLabel.textContent = label;
    const factValue = document.createElement("strong");
    factValue.textContent = String(value);
    fact.append(factLabel, factValue);
    elements.dialogFacts.append(fact);
  }

  function createPersonnelCard(code, role) {
    const player = state.players[code];
    const card = document.createElement(player?.nhlProfileUrl ? "a" : "article");
    card.className = "marchand-person-card";
    if (player?.nhlProfileUrl) {
      card.href = player.nhlProfileUrl;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }
    const portrait = document.createElement("span");
    portrait.className = "marchand-person-portrait";
    if (player?.headshot) {
      const image = document.createElement("img");
      image.src = player.headshot;
      image.alt = `${player.name} headshot`;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.remove();
        portrait.textContent = code.slice(0, 2).toUpperCase();
      }, { once: true });
      portrait.append(image);
    } else {
      portrait.textContent = code === "Unassisted" ? "—" : code.slice(0, 2).toUpperCase();
    }
    const copy = document.createElement("span");
    copy.className = "marchand-person-copy";
    const roleLabel = document.createElement("small");
    roleLabel.textContent = role;
    const name = document.createElement("strong");
    name.textContent = player?.name || code;
    const detail = document.createElement("span");
    detail.textContent = player ? `${code} · #${player.sourceNumber}${player.position ? ` · ${player.position}` : ""}` : "Recorded in source workbook";
    copy.append(roleLabel, name, detail);
    card.append(portrait, copy);
    return card;
  }

  function renderPersonnel(record) {
    const personnel = [];
    if (record.primaryAssist) personnel.push([record.primaryAssist, "Primary assist"]);
    if (record.secondaryAssist) personnel.push([record.secondaryAssist, "Secondary assist"]);
    if (!personnel.length) {
      for (const code of record.playerCodes || []) personnel.push([code, code === "BM63" ? "Collection subject" : "Player in this record"]);
    }
    const seen = new Set();
    const unique = personnel.filter(([code]) => {
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    });
    elements.personnel.hidden = unique.length === 0;
    elements.personnelTitle.textContent = record.primaryAssist || record.secondaryAssist ? "Assist gallery" : "Players in this record";
    elements.personnelGrid.replaceChildren(...unique.map(([code, role]) => createPersonnelCard(code, role)));
  }

  function renderSourceRecord(record) {
    elements.provenance.textContent = `${record.sourceSheet} · spreadsheet row ${record.sourceRow} · Inventory ID ${record.inventoryId}`;
    const fragment = document.createDocumentFragment();
    for (const field of record.sourceData || []) {
      const item = document.createElement("div");
      item.className = "marchand-source-field";
      const label = document.createElement("span");
      label.textContent = field.label;
      let value;
      if (field.url) {
        value = document.createElement("a");
        value.href = field.url;
        value.target = "_blank";
        value.rel = "noopener noreferrer";
        value.textContent = `${field.value || "Open video"} ↗`;
      } else {
        value = document.createElement("strong");
        const player = state.players[field.value];
        const shown = field.label === "Date" ? displayDate(field.value) : field.value;
        value.textContent = player && /assist/i.test(field.label) ? `${field.value} — ${player.name}` : shown || "—";
      }
      item.append(label, value);
      fragment.append(item);
    }
    elements.sourceGrid.replaceChildren(fragment);
  }

  function closeArtifact() {
    elements.videoFrame.removeAttribute("src");
    if (elements.dialog.open) elements.dialog.close();
  }

  function openArtifact(record) {
    const era = teamEra(record.team);
    elements.dialog.dataset.team = era;
    elements.dialogCrest.replaceChildren(createCrest(era));
    elements.dialogNumber.textContent = `Artifact No. ${record.inventoryId}`;
    elements.dialogTeam.textContent = record.team || "Collection";
    elements.dialogTitle.textContent = recordTitle(record);
    elements.dialogSubtitle.textContent = [displayDate(record.date), record.arena, record.opponent].filter(Boolean).join(" · ");
    elements.dialogFacts.replaceChildren();

    addFact("Collection wing", record.sourceSheet);
    addFact("Team", record.team);
    addFact("Category", record.category);
    addFact("Puck type", record.puckType);
    addFact("Date", displayDate(record.date));
    addFact("Arena", record.arena);
    addFact("Opponent", record.opponent);
    addFact("Home / road", record.homeRoad);
    addFact("Career stat", record.careerStat == null ? "" : `#${record.careerStat}`);
    addFact("Season stat", record.seasonStat == null ? "" : `#${record.seasonStat}`);
    addFact("Game", record.game);
    addFact("Wins", record.wins);
    addFact("Losses", record.losses);
    addFact("Points", record.points);
    addFact("Period", record.period);
    addFact("Time", record.time);
    addFact("Goal type", record.goalType);
    addFact("Final score", record.score);

    renderPersonnel(record);
    renderSourceRecord(record);

    elements.dialogNotes.hidden = !record.notes;
    elements.dialogNotes.textContent = record.notes ? `Collection note: ${record.notes}` : "";

    const playerUrl = embedUrl(record);
    elements.videoPanel.hidden = !playerUrl;
    if (playerUrl) {
      elements.videoFrame.src = playerUrl;
      elements.videoSource.href = record.videoUrl;
      elements.videoFrame.title = `${recordTitle(record)} video`;
    } else {
      elements.videoFrame.removeAttribute("src");
      elements.videoSource.removeAttribute("href");
    }

    if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
    else elements.dialog.setAttribute("open", "");
  }

  function showError() {
    elements.tableShell.hidden = true;
    elements.empty.hidden = true;
    elements.status.className = "marchand-loading marchand-error";
    const title = document.createElement("p");
    title.textContent = "The vault could not be opened.";
    const detail = document.createElement("small");
    detail.textContent = "Check your connection and try again.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Try again";
    retry.addEventListener("click", loadCollection, { once: true });
    elements.status.replaceChildren(title, detail, retry);
  }

  function validatePayload(payload) {
    return Boolean(payload?.meta && Array.isArray(payload.records)
      && payload.records.length === payload.meta.records
      && payload.records.every((record) => record.key && Number.isFinite(record.inventoryId) && Array.isArray(record.sourceData)));
  }

  async function loadCollection() {
    elements.status.className = "marchand-loading";
    elements.status.innerHTML = '<span class="marchand-loader-puck" aria-hidden="true">63</span><p>Opening the vault…</p>';
    try {
      const [collectionResponse, playersResponse] = await Promise.all([
        fetch("data/marchand-pucks.json", { cache: "no-store" }),
        fetch("data/marchand-players.json", { cache: "no-store" }),
      ]);
      if (!collectionResponse.ok || !playersResponse.ok) throw new Error("Museum data request failed");
      const [payload, decoder] = await Promise.all([collectionResponse.json(), playersResponse.json()]);
      if (!validatePayload(payload) || !decoder?.players) throw new Error("Museum payload is invalid");
      state.records = payload.records;
      state.meta = payload.meta;
      state.players = decoder.players;
      setOptions(elements.team, state.records, "team", "All teams");
      setOptions(elements.sheet, state.records, "sourceSheet", "All collection wings");
      setOptions(elements.category, state.records, "category", "All categories");
      setOptions(elements.arena, state.records, "arena", "All arenas");
      setOptions(elements.puck, state.records, "puckType", "All puck types");
      updateHero(payload);
      renderInsights(state.records);
      render();
    } catch (error) {
      console.error("Could not load Marchand collection:", error);
      showError();
    }
  }

  for (const control of [elements.team, elements.sheet, elements.category, elements.arena, elements.puck, elements.video]) {
    control.addEventListener("change", () => {
      if (control === elements.team) setEra(teamEra(elements.team.value), false);
      render();
    });
  }
  elements.search.addEventListener("input", render);
  elements.clear.addEventListener("click", clearFilters);
  document.querySelector("[data-empty-reset]").addEventListener("click", clearFilters);

  for (const button of document.querySelectorAll("[data-era-button]")) {
    button.addEventListener("click", () => {
      setEra(button.dataset.eraButton);
      render();
    });
  }

  for (const button of document.querySelectorAll("[data-sort]")) {
    button.addEventListener("click", () => {
      if (state.sortKey === button.dataset.sort) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      else {
        state.sortKey = button.dataset.sort;
        state.sortDirection = button.dataset.sort === "date" ? "desc" : "asc";
      }
      render();
    });
  }

  elements.dialogClose.addEventListener("click", closeArtifact);
  elements.dialog.addEventListener("close", () => elements.videoFrame.removeAttribute("src"));
  elements.dialog.addEventListener("click", (event) => {
    if (event.target !== elements.dialog) return;
    const bounds = elements.dialog.getBoundingClientRect();
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    if (!inside) closeArtifact();
  });

  loadCollection();
})();
