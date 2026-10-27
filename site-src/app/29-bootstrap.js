async function main() {
  const data = await loadSiteData();
  window.siteData = data;
  if (window.TLPTStats) {
    await window.TLPTStats.init();
    window.addEventListener('tlpt:stat-scope-change', () => {
      renderStandings(standingsStatSelection);
      renderDashboard(dashboardStatSelection);
      renderPlayerProfile(data);
    });
  }

  renderLiveRsvpStatus(data.rsvpUnavailable);
  renderNoGameNotices(data);
  renderHomePage(data);
  renderLeagueSnapshot(data);
  renderStandings(DEFAULT_STANDINGS_SORT);
  renderDashboard(DEFAULT_DASHBOARD_SORT);
  renderPlayers(data);
  renderPlayerProfile(data);
  renderSchedule(data);
  await renderHall(data);
  initRulesPage();
  initSorting();
  initCrewViewToggle();
  initCrewSearch();
  initEventRsvpNameHover();
  if (document.getElementById("home-events-list") || document.getElementById("schedule-list")) {
    setInterval(async () => {
      if (document.hidden) return;
      const live = await loadLiveRsvpEvents(data.events);
      if (live.unavailable === data.rsvpUnavailable && !live.unavailable && live.revision === data.rsvpRevision && JSON.stringify(live.noGameDays) === JSON.stringify(data.noGameDays)) return;
      data.events = live.events; data.rsvpUnavailable = live.unavailable; data.rsvpRevision = live.revision;
      data.noGameDays = live.noGameDays;
      renderNoGameNotices(data);
      renderLiveRsvpStatus(live.unavailable); renderHomePage(data); renderSchedule(data);
    }, 60000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  main()
    .then(() => {
      const reportEls = document.querySelectorAll("[data-commissioner-report]");

      if (!reportEls.length) return;

      let currentIndex = -1;

      function renderNewReport() {
        const result = getRandomCommissionerReport(currentIndex);
        currentIndex = result.index;

        if (prefersReducedMotion()) {
          reportEls.forEach(reportEl => {
            typeTextIntoElement(reportEl, result.text, 10);
          });
          return;
        }

        reportEls.forEach(reportEl => {
          reportEl.classList.add("is-fading");
        });

        setTimeout(() => {
          reportEls.forEach(reportEl => {
            reportEl.textContent = "";
            reportEl.classList.remove("is-typing-done");
            reportEl.classList.remove("is-fading");
            typeTextIntoElement(reportEl, result.text, 10);
          });
        }, 450);
      }

      const initial = getRandomCommissionerReport();
      currentIndex = initial.index;

      reportEls.forEach(reportEl => {
        typeTextIntoElement(reportEl, initial.text, 10);
      });

      setInterval(renderNewReport, 45 * 1000);
    })
    .catch(error => {
      console.error("TLPT site load failed:", error);
      renderSiteLoadFailure();
    });
});
