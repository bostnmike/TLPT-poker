/* app.js */
async function loadSiteData() {
  const baseRes = await fetch("/data/generated/site-data.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!baseRes.ok) {
    throw new Error(`Failed to load site-data.json (${baseRes.status})`);
  }

  const baseData = await baseRes.json();

  const eventsRes = await fetch("/data/events.json?v=" + Date.now(), {
    cache: "no-store"
  });

  if (!eventsRes.ok) {
    throw new Error(`Failed to load events.json (${eventsRes.status})`);
  }

  const eventsData = await eventsRes.json();
  const attendance = await loadLiveRsvpEvents(eventsData.events || []);

  return {
    ...baseData,
    events: attendance.events,
    noGameDays: attendance.noGameDays,
    rsvpUnavailable: attendance.unavailable,
    rsvpRevision: attendance.revision
  };
}

const LIVE_RSVP_FEED = "https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/public/events";
async function loadLiveRsvpEvents(fallback) {
  try {
    const response = await fetch(LIVE_RSVP_FEED, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("RSVP feed unavailable");
    const feed = await response.json();
    if (feed.schemaVersion !== 1 || !Array.isArray(feed.events)) throw new Error("Invalid RSVP feed");
    const dateKey = value => {
      if (/^(?:date\s+)?tbd$/i.test(String(value).trim())) return "pending";
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const match = String(value).match(/(?:^|,\s*)([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
      const month = match && ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(match[1]) + 1;
      return month ? `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}` : String(value);
    };
    const events = feed.events.map(event => {
      // Manual preview positions remain in the existing site workflow, separate from live RSVP ownership.
      const reference = fallback.find(saved => saved.slot === event.slot && dateKey(saved.date) === dateKey(event.date));
      return reference && Object.prototype.hasOwnProperty.call(reference, "seatAssignments") ? { ...event, seatAssignments: reference.seatAssignments } : event;
    });
    return { events, noGameDays: Array.isArray(feed.noGameDays) ? feed.noGameDays : [], unavailable: false, revision: feed.revision };
  } catch {
    // Static answers are an import snapshot, never a second live authority.
    return { events: fallback.map(event => ({ ...event, rsvps: {}, waitlist: [], apple_invite_url: "", rsvp_url: "https://tlpt-rsvp.tlpt-bostnmike.workers.dev/", rsvpUnavailable: true })), unavailable: true };
  }
}
function renderLiveRsvpStatus(unavailable) {
  // This notice belongs only in the Schedule header, never on other pages.
  if (!document.getElementById("schedule-list")) return;
  const notice = document.getElementById("live-rsvp-status");
  if (!notice) return;
  notice.textContent = unavailable ? "Live schedule unavailable. Reconnect or refresh to see games open for RSVPs." : "Games open for RSVPs · schedule and lineups sync every minute. RSVP is not payment or recorded attendance.";
}

function renderNoGameNotices(data) {
  const target = document.getElementById("no-game-notices");
  if (!target) return;
  const notices = data.rsvpUnavailable ? [] : (data.noGameDays || []);
  target.innerHTML = notices.map(item => {
    const date = new Date(item.date + "T12:00:00Z").toLocaleDateString("en-US", {timeZone:"America/New_York",month:"long",day:"numeric",year:"numeric"});
    return `<div class="no-game-notice"><img class="no-game-icon" src="images/site/chip-T-25000.png" alt="" aria-hidden="true" width="64" height="64" decoding="async"><div><strong>${escapeHtmlAttr(item.label)}</strong><p>${escapeHtmlAttr(date)} · The felt gets the night off.</p></div></div>`;
  }).join("");
}

function renderSiteLoadFailure() {
  const existingPanel = document.getElementById("site-load-error");
  if (existingPanel) return existingPanel;

  const mainContent = document.getElementById("main-content");
  if (!mainContent) return null;

  const failurePanel = document.createElement("section");
  failurePanel.id = "site-load-error";
  failurePanel.className = "section";
  failurePanel.setAttribute("role", "alert");
  failurePanel.setAttribute("aria-labelledby", "site-load-error-title");
  failurePanel.innerHTML = `
    <div class="section-head page-title-row compact-page-title-row">
      <h2 id="site-load-error-title" class="page-title-gold">The Cards Didn’t Load</h2>
    </div>
    <p class="muted">
      The latest league data couldn’t be loaded. Check your connection and try again.
    </p>
    <div class="hero-actions">
      <button class="btn active" type="button" data-site-load-retry>Try Again</button>
      <a class="btn" href="/index.html">Return Home</a>
    </div>
  `;

  const retryButton = failurePanel.querySelector("[data-site-load-retry]");
  retryButton?.addEventListener("click", () => {
    window.location.reload();
  });

  mainContent.prepend(failurePanel);
  return failurePanel;
}

