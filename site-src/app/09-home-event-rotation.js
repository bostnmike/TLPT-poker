function getEventDateKey(event) {
  const date = String(event?.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (!date || /tbd/i.test(date)) return "9999-12-31";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "9999-12-31" : parsed.toISOString().slice(0, 10);
}

function getCurrentEvents(data) {
  return [...(data?.events || [])]
    .filter(Boolean)
    .filter(event => event.rsvpOpen === true && !event.rsvpUnavailable)
    .filter(event => String(event?.title || "").trim() !== "")
    .map(event => ({
      ...event,
      slot: getEventSlot(event),
      day: getEventDayLabel(event)
    }))
    .sort((a, b) => getEventDateKey(a).localeCompare(getEventDateKey(b))
      || EVENT_SLOT_ORDER.indexOf(a.slot) - EVENT_SLOT_ORDER.indexOf(b.slot));
}

function getHomeEvents(data) {
  const current = getCurrentEvents(data);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const selected = EVENT_SLOT_ORDER.map(slot => {
    const list = current.filter(event => event.slot === slot);
    return list.find(event => getEventDateKey(event) >= today) || list.at(-1);
  }).filter(Boolean);
  return current.filter(event => selected.includes(event));
}

function getHomeEventRotationIndex(events) {
  if (!events.length) return 0;
  const rotationWindowMs = 10000;
  return Math.floor(Date.now() / rotationWindowMs) % events.length;
}

function buildHomeEventButtonsMarkup(event) {
  const slot = getEventSlot(event);
  return `
    <div class="home-event-fixed-buttons home-event-fixed-buttons-inline">
      ${buildEventRsvpButtonMarkup(event, `home-dual-rsvp-btn home-dual-rsvp-btn-${slot}`)}
    </div>
  `;
}

function buildHomeRotatorDotsMarkup(events, activeIndex) {
  return events.map((dotEvent, dotIndex) => {
    const dayLabel = escapeHtmlAttr(getEventDayLabel(dotEvent));
    const eventSlot = getEventSlot(dotEvent);
    const isActive = dotIndex === activeIndex;

    return `
      <button
        class="home-event-dot${isActive ? " is-active" : ""}"
        type="button"
        data-home-event-index="${dotIndex}"
        data-home-event-slot="${eventSlot}"
        aria-label="Show ${dayLabel} event"
        aria-pressed="${isActive ? "true" : "false"}"
      >${dayLabel}</button>
    `;
  }).join("");
}

function buildHomeEventCard(event, data, allEvents, activeIndex, index) {
  const dayLabel = escapeHtmlAttr(getEventDayLabel(event));
  const eventSlot = getEventSlot(event);
  const themeClass = getEventThemeClass(event);

  const buttonsMarkup = buildHomeEventButtonsMarkup(event);
  const dotsMarkup = allEvents.length > 1
    ? buildHomeRotatorDotsMarkup(allEvents, activeIndex)
    : "";

  return `
    <div
      class="event-card compact-event-card home-event-hero schedule-event-card ${themeClass} home-rotating-event-card"
      data-event-day="${dayLabel}"
      data-event-slot="${eventSlot}"
    >
      <div class="event-card-topline">
        <div class="kicker event-title-kicker">${escapeHtmlAttr(event.title)}</div>

        <div class="home-event-top-right">
          <div class="schedule-day-pill">${dayLabel}</div>
        </div>
      </div>

      <div class="event-layout-grid">
        <div class="event-details-col">
          <div class="event-format-title">${escapeHtmlAttr(event.format || "")}</div>
          <div class="event-structure">${escapeHtmlAttr(event.structure || "")}</div>
          <h3>${escapeHtmlAttr(event.date)}</h3>
          <p class="muted"><strong>Start:</strong> ${escapeHtmlAttr(event.time)}</p>
          <p class="muted"><strong>Estimated End:</strong> ${escapeHtmlAttr(event.endTime || "")}</p>
          <p class="muted"><strong>Location:</strong> ${escapeHtmlAttr(event.location)}</p>
          <p class="muted">${escapeHtmlAttr(event.address || "")}</p>
          ${buildEventAdminStatusMarkup(event)}
          ${eventRsvpForecastMarkup(event, data)}
          ${buttonsMarkup}
        </div>

        <div class="event-rsvp-col">
          ${eventRsvpAvatarMarkup(event, data, 9, {
            showRotatorNav: allEvents.length > 1,
            showRotatorLabel: false,
            rotatorDotsMarkup: dotsMarkup,
            summaryPlacement: "bottom"
          })}
        </div>
      </div>
    </div>
  `;
}

function ensureHomeCommissionerSection() {
  const eventsList = document.getElementById("home-events-list");
  if (!eventsList) return null;

  const eventsSection = eventsList.closest(".section");
  if (!eventsSection) return null;

  let commissionerSection = document.getElementById("home-commissioner-section");

  if (!commissionerSection) {
    commissionerSection = document.createElement("section");
    commissionerSection.id = "home-commissioner-section";
    commissionerSection.className = "section home-commissioner-section";
    eventsSection.insertAdjacentElement("afterend", commissionerSection);
  }

  commissionerSection.innerHTML = `
    <div class="section-head page-title-row">
      <h2>🌶️ Hot Takes: The Commissioner’s Report</h2>
    </div>
    <div class="home-commissioner-shell">
      <p class="commissioner-typing-target" data-commissioner-report></p>
    </div>
  `;

  return commissionerSection;
}

