/* Dashboard-only compact layout. Shared scope calculations remain untouched. */
(() => {
  const host = document.getElementById('dashboard-event-scope');
  const toggle = document.getElementById('dashboard-filter-toggle');
  if (!host || !toggle) return;
  const mobile = window.matchMedia('(max-width:700px)');
  const panel = document.getElementById('dashboard-metric-panel');
  const filters = host.closest('.dashboard-event-filters');
  let expanded = false;
  const layout = () => {
    const career = panel?.dataset.dashboardMetricGroup === 'player-dna';
    filters.hidden = career;
    toggle.hidden = career || !mobile.matches;
    host.hidden = career || (mobile.matches && !expanded);
    toggle.setAttribute('aria-expanded', String(!host.hidden));
  };
  toggle.addEventListener('click', () => { expanded = !expanded; layout(); });
  mobile.addEventListener('change', layout);
  if (panel) new MutationObserver(layout).observe(panel, {attributes:true, attributeFilter:['data-dashboard-metric-group']});
  layout();
  const sync = () => {
    const format = host.querySelector('#stat-format');
    const bounty = host.querySelector('#stat-bounty');
    if (!format || !bounty) return;
    const active = format.value !== 'all' || bounty.value !== 'all';
    const label = toggle.querySelector('[data-dashboard-filter-label]');
    const count = window.TLPTStats?.selectedEvents().length || 0;
    label.textContent = active ? [
      format.value === 'all' ? 'All formats' : format.value === 'single' ? 'Sit & Go' : 'Multi-table',
      bounty.selectedOptions[0].textContent
    ].join(' · ') : `All ${count} events`;
    const formatLabel = host.querySelector('label > span');
    if (formatLabel) formatLabel.textContent = 'Event format';
    const formatTrigger = document.getElementById('stat-format-trigger');
    if (formatTrigger) {
      formatTrigger.dataset.fieldLabel = 'Event format';
      formatTrigger.setAttribute('aria-label', `Event format: ${format.selectedOptions[0].textContent}`);
    }
    toggle.classList.toggle('is-filtered', active);
    const reset = host.querySelector('[data-stat-reset]');
    const feedback = host.querySelector('.stat-scope-feedback');
    if (reset && feedback) {
      if (!feedback.contains(reset)) feedback.insertBefore(reset, feedback.querySelector('details'));
      if (!active && document.activeElement === reset) {
        (host.hidden ? toggle : document.getElementById('stat-format-trigger'))?.focus();
      }
      reset.hidden = !active;
      reset.textContent = 'Reset';
    }
    const summary = host.querySelector('[data-stat-scope-summary]');
    if (summary) summary.hidden = true;
    const help = host.querySelector('.stat-scope-help > summary');
    if (help) help.textContent = 'About these filters';
  };
  window.addEventListener('tlpt:stat-scope-change', sync);
  const observer = new MutationObserver(() => {
    if (host.querySelector('#stat-format')) { observer.disconnect(); sync(); }
  });
  observer.observe(host, {childList:true, subtree:true});
  sync();
})();
