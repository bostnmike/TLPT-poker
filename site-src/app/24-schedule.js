function renderSchedule(data) {
  const list = document.getElementById("schedule-list");
  if (!list) return;

  const events = getCurrentEvents(data);

  list.innerHTML = events.map(event => `
    <div class="event-card compact-event-card home-event-hero schedule-event-card ${getEventThemeClass(event)}" data-event-slot="${getEventSlot(event)}">
      <div class="event-card-topline">
        <h2 class="kicker event-title-kicker">${escapeHtmlAttr(event.title)}</h2>
        <div class="schedule-day-pill">${escapeHtmlAttr(getEventDayLabel(event))}</div>
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
          ${buildEventRsvpButtonMarkup(event)}
        </div>

        <div class="event-rsvp-col">
          ${eventRsvpAvatarMarkup(event, data)}
        </div>
      </div>
    </div>
  `).join("");
}

