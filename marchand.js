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
  const TEAM_CANADA_CREST = "images/site/hockey-canada-crest.png";
  const SWEDEN_CREST = "https://commons.wikimedia.org/wiki/Special:FilePath/Sweden%20national%20ice%20hockey%20team%20badge.svg";
  const CATEGORY_LABELS = Object.freeze({
    "4NF Goal": "4 Nations Faceoff",
    Assist: "Assist",
    Milestone: "Milestone",
    "PO Goal": "Playoff Goal",
    "Road to History": "Road to History",
    "RS Goal": "Regular Season Goal",
    "RS Point": "Regular Season Point",
  });
  const OPPONENT_CODES = Object.freeze({
    "Anaheim Ducks": "ANA",
    "Arizona Coyotes": "ARI",
    "Boston Bruins": "BOS",
    "Buffalo Sabres": "BUF",
    "Calgary Flames": "CGY",
    "Carolina Hurricanes": "CAR",
    "Chicago Blackhawks": "CHI",
    "Colorado Avalanche": "COL",
    "Columbus Blue Jackets": "CBJ",
    "Dallas Stars": "DAL",
    "Detroit Red Wings": "DET",
    "Edmonton Oilers": "EDM",
    "Florida Panthers": "FLA",
    "Los Angeles Kings": "LAK",
    "Minnesota Wild": "MIN",
    "Montreal Canadiens": "MTL",
    "Nashville Predators": "NSH",
    "New Jersey Devils": "NJD",
    "New York Islanders": "NYI",
    "New York Rangers": "NYR",
    "Ottawa Senators": "OTT",
    "Philadelphia Flyers": "PHI",
    "Pittsburgh Penguins": "PIT",
    "San Jose Sharks": "SJS",
    "Seattle Kraken": "SEA",
    "St. Louis Blues": "STL",
    Sweden: "SWE",
    "Tampa Bay Lightning": "TBL",
    "Toronto Maple Leafs": "TOR",
    "Utah Hockey Club": "UTA",
    "Vancouver Canucks": "VAN",
    "Vegas Golden Knights": "VGK",
    "Washington Capitals": "WSH",
    "Winnipeg Jets": "WPG",
  });
  const ARENA_LOCATIONS = Object.freeze({
    "Amalie Arena": "Tampa, Florida",
    "Amerant Bank Arena": "Sunrise, Florida",
    "American Airlines Center": "Dallas, Texas",
    "Ball Arena": "Denver, Colorado",
    "Barclays Center": "Brooklyn, New York",
    "Bell Centre": "Montréal, Quebec, Canada",
    "Benchmark Int’l Arena": "Tampa, Florida",
    "Bridgestone Arena": "Nashville, Tennessee",
    "Canada Life Centre": "Winnipeg, Manitoba, Canada",
    "Canadian Tire Centre": "Ottawa, Ontario, Canada",
    "Capital One Arena": "Washington, District of Columbia",
    "Climate Pledge Arena": "Seattle, Washington",
    "Crypto.com Arena": "Los Angeles, California",
    "Delta Center": "Salt Lake City, Utah",
    "Enterprise Center": "St. Louis, Missouri",
    "FLA Live Arena": "Sunrise, Florida",
    "Gila River Arena": "Glendale, Arizona",
    "Grand Casino Arena": "St. Paul, Minnesota",
    "Honda Center": "Anaheim, California",
    "KeyBank Center": "Buffalo, New York",
    "Lenovo Center": "Raleigh, North Carolina",
    "Little Caesars Arena": "Detroit, Michigan",
    "Madison Square Garden": "New York, New York",
    "Nationwide Arena": "Columbus, Ohio",
    "PNC Arena": "Raleigh, North Carolina",
    "PPG Paints Arena": "Pittsburgh, Pennsylvania",
    "Prudential Center": "Newark, New Jersey",
    "Rogers Arena": "Vancouver, British Columbia, Canada",
    "Rogers Place": "Edmonton, Alberta, Canada",
    "SAP Center": "San Jose, California",
    "Scotiabank Arena": "Toronto, Ontario, Canada",
    "Scotiabank Saddledome": "Calgary, Alberta, Canada",
    "T-Mobile Arena": "Las Vegas, Nevada",
    "TD Garden": "Boston, Massachusetts",
    "UBS Arena": "Elmont, New York",
    "United Center": "Chicago, Illinois",
    "Wells Fargo Center": "Philadelphia, Pennsylvania",
  });

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
    themeKicker: document.getElementById("marchand-theme-kicker"),
    vaultLink: document.getElementById("vault-insights-link"),
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
    mediaGrid: document.getElementById("artifact-media-grid"),
    puckImage: document.getElementById("artifact-puck-image"),
    puckPlaceholder: document.getElementById("artifact-puck-placeholder"),
    puckPhotoId: document.getElementById("artifact-puck-photo-id"),
    videoPanel: document.getElementById("artifact-video-panel"),
    videoFrame: document.getElementById("artifact-video"),
    videoSource: document.getElementById("artifact-video-source"),
    watchDialog: document.getElementById("artifact-video-dialog"),
    watchDialogClose: document.getElementById("artifact-video-dialog-close"),
    watchDialogTitle: document.getElementById("artifact-video-dialog-title"),
    watchDialogSubtitle: document.getElementById("artifact-video-dialog-subtitle"),
    watchFrame: document.getElementById("artifact-video-only"),
    watchSource: document.getElementById("artifact-video-only-source"),
  };

  const normalize = (value) => String(value ?? "").trim();
  const lower = (value) => normalize(value).toLocaleLowerCase();
  const categoryLabel = (value) => CATEGORY_LABELS[value] || value || "Collection artifact";
  const arenaLocation = (arena) => ARENA_LOCATIONS[arena] || "Location not recorded";

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

  function setOptions(select, records, key, placeholder, displayValue = (value) => value) {
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
      option.textContent = displayValue(value);
      fragment.append(option);
    }
    select.replaceChildren(fragment);
  }

  function setEra(era, updateTeamFilter = true) {
    elements.body.dataset.era = era;
    const kickerByEra = {
      all: "The Private Collection · Exhibit 63",
      boston: "Boston Bruins Collection · Exhibit 63",
      florida: "Florida Panthers Collection · Exhibit 63",
      canada: "Team Canada Collection · Exhibit 63",
    };
    elements.themeKicker.textContent = kickerByEra[era] || kickerByEra.all;
    if (elements.vaultLink) {
      elements.vaultLink.href = era === "all" ? "marchand-vault/" : `marchand-vault/?team=${era}`;
    }
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
    const sourceCounts = Object.fromEntries(countBy(payload.records, (record) => record.sourceSheet));
    const totals = {
      all: payload.records.length,
      boston: payload.records.filter((record) => teamEra(record.team) === "boston").length,
      florida: payload.records.filter((record) => teamEra(record.team) === "florida").length,
      canada: payload.records.filter((record) => teamEra(record.team) === "canada").length,
    };
    document.getElementById("stat-records").textContent = payload.records.length;
    document.getElementById("stat-goals").textContent = sourceCounts["Goals & Games"] || 0;
    document.getElementById("stat-milestones").textContent = sourceCounts.Milestones || 0;
    document.getElementById("stat-history").textContent = sourceCounts["Road to History"] || 0;
    document.getElementById("stat-videos").textContent = payload.records.filter((record) => record.videoUrl).length;
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

  function decodedNames(record) {
    return (record.playerCodes || []).map((code) => {
      const player = state.players[code];
      return player ? `${code} ${player.name}` : code;
    });
  }

  function searchableText(record) {
    const source = (record.sourceData || []).flatMap((field) => [field.label, field.value, field.url]);
    return lower([JSON.stringify(record), categoryLabel(record.category), arenaLocation(record.arena), ...source, ...decodedNames(record)].join(" "));
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
      if (state.sortKey === "location") {
        leftValue = arenaLocation(left.arena);
        rightValue = arenaLocation(right.arena);
      }
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

  function opponentLogo(record) {
    const code = OPPONENT_CODES[record.opponent] || "NHL";
    const logo = document.createElement("span");
    logo.className = "marchand-opponent-logo";
    const fallback = document.createElement("span");
    fallback.textContent = code;
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("load", () => { fallback.hidden = true; }, { once: true });
    image.addEventListener("error", () => { image.remove(); }, { once: true });
    image.src = code === "SWE" ? SWEDEN_CREST : `https://assets.nhle.com/logos/nhl/svg/${code}_light.svg`;
    logo.append(image, fallback);
    return logo;
  }

  function opponentCell(record) {
    const td = document.createElement("td");
    const opponent = document.createElement("span");
    opponent.className = "marchand-opponent";
    const name = document.createElement("strong");
    name.textContent = record.opponent || "Not recorded";
    opponent.append(opponentLogo(record), name);
    td.append(opponent);
    return td;
  }

  function tablePlayerCodes(record) {
    const codes = [...(record.playerCodes || [])];
    if (record.sourceSheet === "Goals & Games" && !codes.includes("BM63")) codes.unshift("BM63");
    return [...new Set(codes)];
  }

  function playerChip(code) {
    const player = state.players[code];
    const chip = document.createElement("span");
    chip.className = "marchand-player-chip";
    chip.title = player?.name || code;
    chip.setAttribute("aria-label", player ? `${code}, ${player.name}` : code);
    const portrait = document.createElement("span");
    portrait.className = "marchand-player-chip-portrait";
    const fallback = document.createElement("span");
    fallback.textContent = code.slice(0, 2).toUpperCase();
    portrait.append(fallback);
    if (player?.headshot) {
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("load", () => { fallback.hidden = true; }, { once: true });
      image.addEventListener("error", () => { image.remove(); }, { once: true });
      image.src = player.headshot;
      portrait.append(image);
    }
    const label = document.createElement("strong");
    label.textContent = code;
    chip.append(portrait, label);
    return chip;
  }

  function playersCell(record) {
    const td = document.createElement("td");
    td.className = "marchand-players-cell";
    const codes = tablePlayerCodes(record);
    if (!codes.length) {
      const teamArtifact = document.createElement("span");
      teamArtifact.className = "marchand-team-artifact";
      teamArtifact.textContent = "Team artifact";
      td.append(teamArtifact);
      return td;
    }
    const roster = document.createElement("span");
    roster.className = "marchand-player-roster";
    roster.append(...codes.map(playerChip));
    td.append(roster);
    return td;
  }

  function renderRows(records) {
    const fragment = document.createDocumentFragment();
    for (const record of records) {
      const row = document.createElement("tr");
      row.dataset.team = teamEra(record.team);

      row.append(cell(String(record.inventoryId), "marchand-id"));

      const deepDiveCell = document.createElement("td");
      deepDiveCell.className = "marchand-deep-dive-cell";
      const deepDive = document.createElement("button");
      deepDive.type = "button";
      deepDive.className = "marchand-deep-dive-button";
      deepDive.setAttribute("aria-label", `Deep dive into artifact ${record.inventoryId}`);
      deepDive.innerHTML = "<span>Deep</span><span>Dive</span>";
      deepDive.addEventListener("click", () => openArtifact(record));
      deepDiveCell.append(deepDive);
      row.append(deepDiveCell);

      row.append(cell(displayDate(record.date), "marchand-date"));
      row.append(opponentCell(record));
      row.append(cell(record.arena, record.arena ? "" : "marchand-muted"));
      row.append(cell(arenaLocation(record.arena), "marchand-location"));
      row.append(playersCell(record));

      const puckCell = document.createElement("td");
      const puckPill = document.createElement("span");
      puckPill.className = "marchand-puck-pill";
      puckPill.textContent = record.puckType || "Not recorded";
      puckCell.append(puckPill);
      row.append(puckCell);

      const watchCell = document.createElement("td");
      watchCell.className = "marchand-watch-cell";
      const watch = document.createElement("button");
      watch.type = "button";
      watch.className = "marchand-watch-button";
      watch.disabled = !record.videoUrl;
      watch.setAttribute("aria-label", record.videoUrl ? `Watch video for artifact ${record.inventoryId}` : `No film available for artifact ${record.inventoryId}`);
      watch.innerHTML = record.videoUrl ? '<span aria-hidden="true">▶</span> Watch' : "No film";
      if (record.videoUrl) watch.addEventListener("click", () => openVideo(record));
      watchCell.append(watch);
      row.append(watchCell);
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
      const image = document.createElement("img");
      image.src = TEAM_CANADA_CREST;
      image.alt = "Hockey Canada crest";
      crest.append(image);
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
        const shown = field.label === "Date"
          ? displayDate(field.value)
          : (field.label === "Category" ? categoryLabel(field.value) : field.value);
        value.textContent = player && /assist/i.test(field.label) ? `${field.value} — ${player.name}` : shown || "—";
      }
      item.append(label, value);
      fragment.append(item);
    }
    elements.sourceGrid.replaceChildren(fragment);
  }

  function showPuckPlaceholder(record) {
    elements.puckImage.hidden = true;
    elements.puckImage.removeAttribute("src");
    elements.puckImage.alt = "";
    elements.puckPlaceholder.hidden = false;
    elements.puckPhotoId.textContent = `Artifact No. ${record.inventoryId}`;
  }

  function renderPuckPhoto(record) {
    const imageUrl = normalize(record.imageUrl);
    if (!imageUrl) {
      showPuckPlaceholder(record);
      return;
    }
    elements.puckPhotoId.textContent = `Artifact No. ${record.inventoryId}`;
    elements.puckPlaceholder.hidden = true;
    elements.puckImage.hidden = false;
    elements.puckImage.alt = `Artifact ${record.inventoryId} puck photograph`;
    elements.puckImage.onerror = () => showPuckPlaceholder(record);
    elements.puckImage.src = imageUrl;
  }

  function closeArtifact() {
    elements.videoFrame.removeAttribute("src");
    if (elements.dialog.open) elements.dialog.close();
  }

  function closeVideo() {
    elements.watchFrame.removeAttribute("src");
    if (elements.watchDialog.open) elements.watchDialog.close();
  }

  function openVideo(record) {
    const playerUrl = embedUrl(record);
    if (!playerUrl) return;
    elements.watchDialog.dataset.team = teamEra(record.team);
    elements.watchDialogTitle.textContent = recordTitle(record);
    elements.watchDialogSubtitle.textContent = [displayDate(record.date), record.team, record.opponent, record.arena].filter(Boolean).join(" · ");
    elements.watchFrame.src = playerUrl;
    elements.watchFrame.title = `${recordTitle(record)} video`;
    elements.watchSource.href = record.videoUrl;
    if (typeof elements.watchDialog.showModal === "function") elements.watchDialog.showModal();
    else elements.watchDialog.setAttribute("open", "");
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
    renderPuckPhoto(record);

    addFact("Collection wing", record.sourceSheet);
    addFact("Team", record.team);
    addFact("Category", categoryLabel(record.category));
    addFact("Puck type", record.puckType);
    addFact("Date", displayDate(record.date));
    addFact("Arena", record.arena);
    addFact("City / region", arenaLocation(record.arena));
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
    elements.mediaGrid.classList.toggle("has-no-video", !playerUrl);
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
      setOptions(elements.category, state.records, "category", "All categories", categoryLabel);
      setOptions(elements.arena, state.records, "arena", "All arenas");
      setOptions(elements.puck, state.records, "puckType", "All puck types");
      updateHero(payload);
      const requestedEra = new URLSearchParams(window.location.search).get("team");
      if (["boston", "florida", "canada"].includes(requestedEra)) setEra(requestedEra);
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
  elements.watchDialogClose.addEventListener("click", closeVideo);
  elements.watchDialog.addEventListener("close", () => elements.watchFrame.removeAttribute("src"));
  elements.watchDialog.addEventListener("click", (event) => {
    if (event.target !== elements.watchDialog) return;
    const bounds = elements.watchDialog.getBoundingClientRect();
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    if (!inside) closeVideo();
  });

  loadCollection();
})();
