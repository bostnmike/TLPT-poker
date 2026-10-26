/* Dashboard-only compact layout. Shared scope calculations remain untouched. */
(() => {
  const host = document.getElementById('dashboard-event-scope');
  const toggle = document.getElementById('dashboard-filter-toggle');
  if (!host || !toggle) return;
  const mobile = window.matchMedia('(max-width:700px)');
  let expanded = false;
  const layout = () => {
    toggle.hidden = !mobile.matches;
    host.hidden = mobile.matches && !expanded;
    toggle.setAttribute('aria-expanded', String(!host.hidden));
  };
  toggle.addEventListener('click', () => { expanded = !expanded; layout(); });
  mobile.addEventListener('change', layout);
  layout();
  const sync = () => {
    const format = host.querySelector('#stat-format');
    const bounty = host.querySelector('#stat-bounty');
    if (!format || !bounty) return;
    const active = format.value !== 'all' || bounty.value !== 'all';
    const label = toggle.querySelector('[data-dashboard-filter-label]');
    label.textContent = [
      format.value === 'all' ? 'All formats' : format.value === 'single' ? 'Sit & Go' : 'Multi-table',
      bounty.value === 'all' ? 'All events' : bounty.selectedOptions[0].textContent
    ].join(' · ');
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
    if (summary) summary.textContent = summary.textContent.replace(' · All league events', '');
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
