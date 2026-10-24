// Independent editing contract for events.json. No production data is rewritten.
export function auditRsvpEvent(event, data, app, maxSeats = 9) {
  const errors = [], warnings = [];
  let checks = 0;
  const label = `events.json ${event?.slot || event?.title || "event"}`;
  const check = (ok, message) => { checks++; if (!ok) errors.push(`${label}: ${message}`); };
  const warn = message => warnings.push(`${label}: ${message}`);
  const result = () => ({ checks, errors, warnings });
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  check(object(event), "event must be an object");
  if (!object(event)) return result();
  const snapshot = JSON.stringify(event);
  const rsvps = event.rsvps ?? {};
  check(object(rsvps), "rsvps must be an object mapping player IDs to yes, no, maybe or tbd");
  const tableCount = event.tables ?? (event.slot === "mtt" ? 2 : 1);
  check(Number.isInteger(tableCount) && [1, 2].includes(tableCount), "tables must be 1 or 2");
  const assignments = event.seatAssignments ?? [];
  check(Array.isArray(assignments), "seatAssignments must be an array of table arrays (or omitted)");
  if (errors.length) return result();
  const roster = new Map(data.players.map(p => [p.slug.toLowerCase(), p]));
  const answers = new Map();
  for (const [rawId, value] of Object.entries(rsvps)) {
    const id = rawId.toLowerCase(), location = `rsvps[${JSON.stringify(rawId)}]`;
    check(roster.has(id), `${location}: unknown player ID; use an existing roster slug`);
    check(!answers.has(id), `${location}: duplicate player ID with different capitalization`);
    const status = value == null || value === "" ? "tbd" : typeof value === "string" ? value.toLowerCase() : null;
    check(["yes", "no", "maybe", "tbd"].includes(status), `${location}: invalid status ${JSON.stringify(value)}; use yes, no, maybe or tbd (case-insensitive)`);
    answers.set(id, status);
  }
  const seen = new Set();
  assignments.forEach((table, ti) => {
    check(Array.isArray(table), `seatAssignments[${ti}]: expected a table array`);
    if (!Array.isArray(table)) return;
    if (ti >= tableCount) warn(`seatAssignments[${ti}] is beyond the configured table count and is ignored`);
    if (table.length > maxSeats) warn(`seatAssignments[${ti}] has more than ${maxSeats} entries; extra positions are ignored`);
    table.forEach((rawId, si) => {
      const location = `seatAssignments[${ti}][${si}]`;
      check(typeof rawId === "string", `${location}: use a player ID or "" for an open chair`);
      if (typeof rawId !== "string" || rawId === "") return;
      const id = rawId.toLowerCase();
      check(roster.has(id), `${location}: unknown player ID ${JSON.stringify(rawId)}`);
      if (seen.has(id)) warn(`${location}: duplicate ${JSON.stringify(rawId)}; only the first eligible assignment is used`);
      seen.add(id);
    });
  });
  if (errors.length) return result();
  const order = (a, b) => {
    const rank = p => p.slug === "bostnmike" ? 0 : p.rosterStatus === "alumni" ? 2 : 1;
    return rank(a) - rank(b) || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  };
  const members = [...answers.keys()].map(id => roster.get(id));
  const ordered = [...members].sort(order);
  if (members.some((p, i) => p.slug !== ordered[i].slug)) warn("RSVP key order differs from the preferred Commish/active/alumni order; the site sorts it automatically");
  const confirmed = ordered.filter(p => answers.get(p.slug.toLowerCase()) === "yes");
  const expectedCounts = Object.fromEntries(["yes", "no", "maybe", "tbd"].map(status => [status, [...answers.values()].filter(s => s === status).length]));
  const counts = app.get("getRsvpCounts")(event);
  for (const status of Object.keys(expectedCounts)) {
    check(counts[status] === expectedCounts[status], `${status} count must match the RSVP answers`);
    const expectedNames = ordered.filter(p => answers.get(p.slug.toLowerCase()) === status).map(p => app.get("displayPlayerNamePlain")(p));
    check(JSON.stringify(app.get("getRsvpPlayersByStatus")(event, data, status)) === JSON.stringify(expectedNames), `${status} display must sort independently of JSON key order and capitalization`);
  }
  check(JSON.stringify(app.get("getConfirmedRsvpPlayers")(event, data).map(p => p.slug)) === JSON.stringify(confirmed.map(p => p.slug)), "confirmed roster must match normalized answers");
  const expected = Array.from({ length: tableCount }, () => []);
  const placed = new Set();
  assignments.slice(0, tableCount).forEach((table, ti) => {
    for (const rawId of table.slice(0, maxSeats)) {
      if (rawId === "") { expected[ti].push(null); continue; }
      const id = rawId.toLowerCase();
      if (answers.get(id) !== "yes" || placed.has(id)) continue;
      expected[ti].push(roster.get(id).slug);
      placed.add(id);
    }
  });
  for (const player of confirmed) {
    if (placed.has(player.slug.toLowerCase())) continue;
    let target = -1;
    for (let ti = 0; ti < tableCount; ti++) {
      if (expected[ti].length >= maxSeats) continue;
      if (target < 0 || expected[ti].filter(Boolean).length < expected[target].filter(Boolean).length) target = ti;
    }
    if (target < 0) continue;
    expected[target].push(player.slug);
    placed.add(player.slug.toLowerCase());
  }
  const actual = app.get("getEventSeatingTables")(event, data, maxSeats).map(table => Array.from(table, p => p?.slug ?? null));
  check(JSON.stringify(actual) === JSON.stringify(expected), `manual preview mismatch; expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  const shown = actual.flat().filter(Boolean);
  check(new Set(shown).size === shown.length, "a player must never occupy two preview chairs");
  const html = app.get("eventRsvpAvatarMarkup")(event, data, maxSeats);
  check((html.match(/class="event-rsvp-seat-player"/g) || []).length === shown.length, "avatar count must match preview players");
  check((html.match(/class="event-empty-seat"/g) || []).length === tableCount * maxSeats - shown.length, "all remaining preview positions must render as empty chairs");
  for (const player of confirmed.filter(p => !shown.includes(p.slug))) {
    const name = app.get("escapeHtmlAttr")(app.get("displayPlayerNamePlain")(player));
    check(html.includes("Confirmed, not placed in this preview:") && html.includes(name), `confirmed player ${player.slug} must remain visible when the preview is full`);
  }
  check(JSON.stringify(event) === snapshot, "rendering must not rewrite source RSVP answers or manual positions");
  return result();
}
