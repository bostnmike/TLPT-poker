function getRsvpCounts(event) {
  const statuses = Object.values(event?.rsvps || {}).map(value =>
    String(value || "tbd").toLowerCase()
  );

  return {
    yes: statuses.filter(status => status === "yes").length,
    maybe: statuses.filter(status => status === "maybe").length - (event?.waitlist?.length || 0),
    tbd: statuses.filter(status => status === "tbd").length,
    no: statuses.filter(status => status === "no").length
  };
}

function formatRsvpLine(event) {
  const counts = getRsvpCounts(event);
  return `At the Table = ${counts.yes} • On the Rail = ${counts.maybe} • In the Tank = ${counts.tbd} • Folded Pre = ${counts.no}${event?.waitlist?.length ? ` • Waitlisted = ${event.waitlist.length}` : ""}`;
}

function getPlayerBySlug(slug, data) {
  const players = data?.players || [];
  const cleanSlug = String(slug || "").toLowerCase();

  return players.find(player =>
    String(player.slug || "").toLowerCase() === cleanSlug
  );
}

function getDisplayNameForRsvpSlug(slug, data) {
  const player = getPlayerBySlug(slug, data);

  if (player) {
    return displayPlayerNamePlain(player);
  }

  return String(slug || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

// Event rosters: Commish first, then active and alumni alphabetically.
// Explicit table assignments and historical finish orders are not rosters.
function compareEventRosterPlayers(a, b) {
  if (a.slug === "bostnmike" && b.slug !== "bostnmike") return -1;
  if (b.slug === "bostnmike" && a.slug !== "bostnmike") return 1;
  return Number(isPlayerAlumni(a)) - Number(isPlayerAlumni(b))
    || displayPlayerNamePlain(a).localeCompare(displayPlayerNamePlain(b), "en", { sensitivity: "base" });
}

function getRsvpPlayersByStatus(event, data, statusKey) {
  const rsvps = event?.rsvps || {};
  const targetStatus = String(statusKey || "").toLowerCase();

  return Object.entries(rsvps)
    .filter(([slug, status]) => String(status || "tbd").toLowerCase() === targetStatus && !(targetStatus === "maybe" && event?.waitlist?.some(item => item.slug === slug)))
    .map(([slug]) => getPlayerBySlug(slug, data) || { slug, name: getDisplayNameForRsvpSlug(slug, data) })
    .sort(compareEventRosterPlayers)
    .map(displayPlayerNamePlain)
    .filter(Boolean);
}

function formatRsvpNameList(names, emptyText = "Nobody yet", options = {}) {
  const {
    maxNames = 8,
    collapseAfter = 12
  } = options;

  if (!names || !names.length) return emptyText;

  if (names.length >= collapseAfter) {
    return `${names.length} players`;
  }

  const visibleNames = names.slice(0, maxNames);
  const remaining = names.length - visibleNames.length;

  return remaining > 0
    ? `${visibleNames.join(", ")} +${remaining} more`
    : visibleNames.join(", ");
}

function eventRsvpForecastMarkup(event, data) {
  if (event?.rsvpUnavailable) return `<p class="muted">The live lineup will return when the RSVP connection recovers.</p>`;
  // Event attendance stays together regardless of league membership status.
  const namesForStatus = (status, options) => escapeHtmlAttr(formatRsvpNameList(
    getRsvpPlayersByStatus(event, data, status), "Nobody yet", options
  ));

  return `
    <div class="event-rsvp-forecast" aria-label="Table forecast">
      <div class="event-rsvp-forecast-title">Table Forecast</div>
      ${event?.waitlist?.length ? `<div class="event-rsvp-forecast-row"><span class="event-rsvp-forecast-label">Waitlist</span><span class="event-rsvp-forecast-names">${event.waitlist.map(item => `${item.position}. ${escapeHtmlAttr(getDisplayNameForRsvpSlug(item.slug, data))}`).join(", ")}</span></div>` : ""}

      <div class="event-rsvp-forecast-row event-rsvp-forecast-maybe">
        <span class="event-rsvp-forecast-label">On the Rail</span>
        <span class="event-rsvp-forecast-names">${namesForStatus("maybe", {
          maxNames: 6,
          collapseAfter: 12
        })}</span>
      </div>

      <div class="event-rsvp-forecast-row event-rsvp-forecast-tbd">
        <span class="event-rsvp-forecast-label">In the Tank</span>
        <span class="event-rsvp-forecast-names">${namesForStatus("tbd", {
          maxNames: 8,
          collapseAfter: 14
        })}</span>
      </div>

      <div class="event-rsvp-forecast-row event-rsvp-forecast-no">
        <span class="event-rsvp-forecast-label">Folded Pre</span>
        <span class="event-rsvp-forecast-names">${namesForStatus("no", {
          maxNames: 4,
          collapseAfter: 8
        })}</span>
      </div>
    </div>
  `;
}

function getConfirmedRsvpPlayers(event, data) {
  const players = data?.players || [];
  const rsvps = event?.rsvps || {};

  return Object.entries(rsvps)
    .filter(([, status]) => String(status || "").toLowerCase() === "yes")
    .map(([slug]) =>
      players.find(player => String(player.slug || "").toLowerCase() === String(slug).toLowerCase())
    )
    .filter(Boolean)
    .sort(compareEventRosterPlayers);
}

function buildRsvpSummaryMarkup(event, extraClass = "") {
  if (event?.rsvpUnavailable) return `<p class="muted" role="status">Live RSVP counts unavailable</p>`;
  const counts = getRsvpCounts(event);
  const summaryClass = ["event-rsvp-summary", extraClass].filter(Boolean).join(" ");

  return `
    <div class="event-rsvp-summary-wrap">
      <div class="${summaryClass}" aria-label="Table forecast summary">
        <span class="event-rsvp-pill yes">At the Table = ${counts.yes}</span>
        <span class="event-rsvp-pill maybe">On the Rail = ${counts.maybe}</span>
        <span class="event-rsvp-pill tbd">In the Tank = ${counts.tbd}</span>
        <span class="event-rsvp-pill no">Folded Pre = ${counts.no}</span>
      </div>
    </div>
  `;
}

const EVENT_SLOT_ORDER = Object.freeze(["friday", "saturday", "mtt"]);

function getEventSlot(event) {
  const explicitSlot = String(event?.slot || "").trim().toLowerCase();
  if (EVENT_SLOT_ORDER.includes(explicitSlot)) return explicitSlot;

  const eventIdentity = `${event?.day || ""} ${event?.date || ""}`.toLowerCase();
  if (/mtt|multi-table/.test(eventIdentity)) return "mtt";
  if (/friday/.test(eventIdentity)) return "friday";
  if (/saturday/.test(eventIdentity)) return "saturday";
  return "event";
}

function getEventTableCount(event) {
  const configuredCount = Number(event?.tables);
  if (Number.isInteger(configuredCount) && configuredCount > 0) {
    return configuredCount;
  }

  return getEventSlot(event) === "mtt" ? 2 : 1;
}

function getEventCapacity(event, maxSeats = 9) {
  const configuredCapacity = Number(event?.capacity);
  if (Number.isInteger(configuredCapacity) && configuredCapacity > 0) {
    return configuredCapacity;
  }

  return getEventTableCount(event) * maxSeats;
}

function getEventSeatingTables(event, data, maxSeats = 9) {
  const tableCount = getEventTableCount(event);
  const confirmedPlayers = getConfirmedRsvpPlayers(event, data);
  const playerBySlug = new Map(
    confirmedPlayers.map(player => [String(player.slug || "").toLowerCase(), player])
  );
  const configuredTables = Array.isArray(event?.seatAssignments)
    ? event.seatAssignments
    : [];
  const tables = Array.from({ length: tableCount }, () => []);
  const assignedSlugs = new Set();

  configuredTables.slice(0, tableCount).forEach((seatSlugs, tableIndex) => {
    if (!Array.isArray(seatSlugs)) return;

    seatSlugs.slice(0, maxSeats).forEach(slug => {
      // An explicit empty string is a held-open preview position, not a player.
      if (slug === "") {
        tables[tableIndex].push(null);
        return;
      }
      const normalizedSlug = String(slug || "").toLowerCase();
      const player = playerBySlug.get(normalizedSlug);
      if (!player || assignedSlugs.has(normalizedSlug)) return;
      tables[tableIndex].push(player);
      assignedSlugs.add(normalizedSlug);
    });
  });

  confirmedPlayers.forEach(player => {
    const normalizedSlug = String(player.slug || "").toLowerCase();
    if (assignedSlugs.has(normalizedSlug)) return;

    const availableTableIndex = tables
      .map((players, index) => ({ index, slots: players.length, count: players.filter(Boolean).length }))
      .filter(table => table.slots < maxSeats)
      .sort((a, b) => a.count - b.count || a.index - b.index)[0]?.index;

    if (availableTableIndex === undefined) return;
    tables[availableTableIndex].push(player);
    assignedSlugs.add(normalizedSlug);
  });

  return tables;
}

function eventRsvpTableMarkup(players, maxSeats = 9, options = {}) {
  const {
    tableNumber = 1,
    showTableHeading = false,
    compact = false
  } = options;
  const seatedPlayers = players.slice(0, maxSeats);
  const confirmedCount = seatedPlayers.filter(Boolean).length;
  const emptySeats = Math.max(maxSeats - seatedPlayers.length, 0);
  const isHotTable = confirmedCount / maxSeats >= 0.8;
  const tableLabel = `Table ${tableNumber}`;
  const emptyChair = '<img class="event-empty-seat-image" src="images/site/tlpt-poker-chair-256.webp" width="256" height="256" alt="" aria-hidden="true" decoding="async">';
  const rowClass = [
    "event-rsvp-avatar-row",
    isHotTable ? "is-hot-table" : "",
    compact ? "is-two-table-row" : ""
  ].filter(Boolean).join(" ");

  return `
    <div class="event-rsvp-table${compact ? " is-two-table" : ""}">
      ${showTableHeading ? `
        <div class="event-rsvp-table-heading">
          <span>${tableLabel}</span>
          <span>${confirmedCount} / ${maxSeats} RSVPs shown</span>
        </div>
      ` : ""}
      <div class="${rowClass}" aria-label="${tableLabel}: ${confirmedCount} of ${maxSeats} confirmed RSVPs shown">
        <div class="event-rsvp-center-name" aria-hidden="true"></div>
        ${seatedPlayers.map(player => {
          if (!player) return `<span class="event-empty-seat" aria-label="${tableLabel}: manually held-open RSVP spot">${emptyChair}</span>`;
          const displayName = displayPlayerNamePlain(player);
          return `
            <span class="event-rsvp-seat-player" data-player-name="${String(displayName).replace(/"/g, "&quot;")}" tabindex="0" aria-label="${tableLabel} RSVP preview: ${String(displayName).replace(/"/g, "&quot;")}">
              ${playerImageMarkup(player, "table", { intrinsicSize: 96 })}
            </span>
          `;
        }).join("")}
        ${Array.from({ length: emptySeats }).map(() => `
          <span class="event-empty-seat" aria-label="${tableLabel}: open RSVP spot">${emptyChair}</span>
        `).join("")}
      </div>
    </div>
  `;
}

function eventRsvpAvatarMarkup(event, data, maxSeats = 9, options = {}) {
  const tableCount = getEventTableCount(event);
  const seatingTables = getEventSeatingTables(event, data, maxSeats);
  const displayedSlugs = new Set(seatingTables.flat().filter(Boolean).map(player => player.slug));
  const unplacedPlayers = getConfirmedRsvpPlayers(event, data).filter(player => !displayedSlugs.has(player.slug));

  const {
    showRotatorNav = false,
    showRotatorLabel = true,
    rotatorDay = "",
    rotatorDotsMarkup = "",
    summaryPlacement = "bottom"
  } = options;

  const tableMarkup = tableCount === 1
    ? eventRsvpTableMarkup(seatingTables[0] || [], maxSeats)
    : (() => {
        return `
          <div class="event-rsvp-tables event-rsvp-tables-two" aria-label="Two-table RSVP preview; Tournament Director software assigns official seats">
            ${seatingTables.map((players, index) => eventRsvpTableMarkup(players, maxSeats, {
              tableNumber: index + 1,
              showTableHeading: true,
              compact: true
            })).join("")}
          </div>
        `;
      })();

  return `
    <div class="event-rsvp-block${tableCount === 2 ? " event-rsvp-block-two-table" : ""}">
      ${tableMarkup}

      ${tableCount === 2 ? `<p class="event-rsvp-seating-note">RSVP preview only • Tournament Director software assigns official seats.</p>` : ""}
      ${unplacedPlayers.length ? `<p class="event-rsvp-seating-note"><strong>Confirmed, not placed in this preview:</strong> ${unplacedPlayers.map(player => escapeHtmlAttr(displayPlayerNamePlain(player))).join(", ")}. Update the manual layout to place them.</p>` : ""}

      ${showRotatorNav ? `
        <div class="home-rotator-nav-inline">
          ${showRotatorLabel ? `
            <div class="home-rotator-nav-label">
              Now Showing: <span class="home-event-rotator-day">${rotatorDay}</span>
            </div>
          ` : ""}
          <div class="home-event-rotator-dots home-event-rotator-dots-inline">
            ${rotatorDotsMarkup}
          </div>
        </div>
      ` : ""}

      ${summaryPlacement === "bottom" ? buildRsvpSummaryMarkup(event) : ""}
    </div>
  `;
}

function buildEventAdminStatusMarkup(event) {
  if (event?.rsvpUnavailable) return "";
  if (getEventSlot(event) !== "mtt") return "";

  const counts = getRsvpCounts(event);
  const capacity = getEventCapacity(event);
  const openSeats = Math.max(capacity - counts.yes, 0);
  const overflow = event?.waitlist?.length || Math.max(counts.yes - capacity, 0);
  const mergeAt = Number(event?.mergeAt) || 9;

  return `
    <div class="event-admin-status" aria-label="Multi-table tournament status">
      <span><strong>${counts.yes}</strong> confirmed</span>
      <span><strong>${openSeats}</strong> ${openSeats === 1 ? "seat" : "seats"} open</span>
      <span><strong>${counts.maybe}</strong> on the rail</span>
      ${overflow ? `<span class="is-waitlist"><strong>${overflow}</strong> waiting</span>` : ""}
      <span><strong>${mergeAt}</strong>-handed merge</span>
    </div>
  `;
}

function projectedTableSize(event, maxSeats = 9) {
  const counts = getRsvpCounts(event);
  const seatCapacity = maxSeats * getEventTableCount(event);
  const minPlayers = Math.min(counts.yes, seatCapacity);
  const maxPlayers = Math.min(counts.yes + counts.maybe + counts.tbd, seatCapacity);
  return minPlayers === maxPlayers ? `${minPlayers} players` : `${minPlayers}–${maxPlayers} players`;
}

function tableFillPercent(event, maxSeats = 9) {
  const counts = getRsvpCounts(event);
  const seatCapacity = maxSeats * getEventTableCount(event);
  return Math.min((counts.yes / seatCapacity) * 100, 100);
}

function tableFillMarkup(event, maxSeats = 9) {
  if (event?.rsvpUnavailable) return `<p class="muted">Seat availability unavailable</p>`;
  const counts = getRsvpCounts(event);
  const seatCapacity = maxSeats * getEventTableCount(event);
  const fillPct = tableFillPercent(event, maxSeats);

  return `
    <div class="fill-widget">
      <div class="fill-header">
        <span class="fill-label">Table Fill</span>
        <span class="fill-seats">${counts.yes} / ${seatCapacity} seats locked</span>
      </div>
      <div class="fill-bar"><div class="fill-bar-value" style="width:${fillPct}%"></div></div>
    </div>
  `;
}

function getEventDayLabel(event) {
  if (event?.day) return String(event.day).trim();

  const rawDate = String(event?.date || "").trim();
  if (/friday/i.test(rawDate)) return "Friday";
  if (/saturday/i.test(rawDate)) return "Saturday";

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", { weekday: "long" });
  }

  return "Event";
}

function getEventButtonLabel(event) {
  return `RSVP for ${getEventDayLabel(event)}`;
}

function getEventThemeClass(event) {
  const slot = getEventSlot(event);
  if (slot === "friday") return "schedule-event-card-top";
  if (slot === "saturday") return "schedule-event-card-bottom";
  return "schedule-event-card-mtt";
}

function buildEventRsvpButtonMarkup(event, extraClasses = "") {
  const className = ["btn", "btn-rsvp", extraClasses].filter(Boolean).join(" ");
  const inviteUrl = event?.rsvp_url ? `https://tlpt-rsvp.tlpt-bostnmike.workers.dev/${event.id ? `?event=${encodeURIComponent(event.id)}` : ""}` : String(event?.apple_invite_url || "").trim();

  if (!inviteUrl) {
    return `<span class="${className} is-disabled" aria-disabled="true">${escapeHtmlAttr(getEventDayLabel(event))} Invite Coming Soon</span>`;
  }

  return `<a class="${className}" href="${inviteUrl}" target="_blank" rel="noopener">${escapeHtmlAttr(getEventButtonLabel(event))}</a>`;
}

