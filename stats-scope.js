/* Shared event filters. Factual views only; career objects are never mutated. */
(() => {
  const formats = { all: 'All Formats', single: 'Single Table / Sit & Go', mtt: 'Multi-Table' };
  const bounties = { all: 'All Events', with: 'With Bounties', without: 'Without Bounties' };
  const totals = ['entries', 'buyIns', 'rebuys', 'hits', 'timesPlaced', 'bubbles',
    'profit', 'totalCost', 'totalWinnings', 'bountiesWon', 'bountyPaid', 'bountyCollected',
    'bountyRetained', 'bountyWinnings', 'bountyNet', 'settlementAdjustment'];
  const factualKeys = new Set([...totals, 'roi', 'cashRate', 'bubbleRate', 'hitRate',
    'tournamentCost', 'tournamentWinnings', 'tournamentProfit']);
  let state = { format: 'all', bounty: 'all' };
  let events = [];
  let ready;
  let mounted = false;
  function normalize(value) {
    return { format: Object.hasOwn(formats, value?.format) ? value.format : 'all',
      bounty: Object.hasOwn(bounties, value?.bounty) ? value.bounty : 'all' };
  }
  function active(scope = state) { return scope.format !== 'all' || scope.bounty !== 'all'; }
  function select(source = events, scope = state) {
    return source.filter(event => (scope.format === 'all' || event.format === scope.format)
      && (scope.bounty === 'all' || event.bounty === (scope.bounty === 'with')));
  }
  function aggregate(players, source) {
    const rows = new Map(players.map(player => [player.slug,
      { ...player, ...Object.fromEntries(totals.map(key => [key, 0])) }]));
    for (const event of source) for (const result of event.players) {
      if (!(result.entries > 0)) continue;
      const row = rows.get(result.slug);
      if (!row) throw new Error(`Unknown player in statistical history: ${result.slug}`);
      for (const key of totals) row[key] += Number(result[key] || 0);
    }
    for (const row of rows.values()) {
      row.tournamentCost = row.totalCost - row.bountyPaid;
      row.tournamentWinnings = row.totalWinnings - row.bountyWinnings - row.settlementAdjustment;
      row.tournamentProfit = row.tournamentWinnings - row.tournamentCost;
      row.roi = row.totalCost ? row.profit / row.totalCost : 0;
      row.cashRate = row.buyIns ? row.timesPlaced / row.buyIns : 0;
      row.bubbleRate = row.buyIns ? row.bubbles / row.buyIns : 0;
      row.hitRate = row.entries ? row.hits / row.entries : 0;
    }
    return [...rows.values()];
  }
  function players(career) { return active() ? aggregate(career, select()) : career; }
  function knockoutView(source) {
    const byKiller = {}, byVictim = {}, claims = [], bountyEvents = new Set();
    const bump = (map, first, second) => {
      map[first] ||= {};
      map[first][second] = (map[first][second] || 0) + 1;
    };
    for (const event of source) for (const entry of event.knockouts) {
      bump(byKiller, entry.killer, entry.victim);
      bump(byVictim, entry.victim, entry.killer);
      if (entry.bountyAmount) {
        const claim = { eventId: event.eventId, killer: entry.killer, victim: entry.victim, amount: entry.bountyAmount };
        for (const key of ['victimEntry', 'killerEntry']) if (key in entry) claim[key] = entry[key];
        claims.push(claim);
        bountyEvents.add(event.eventId);
      }
    }
    return { byKiller, byVictim, eventsProcessed: source.map(e => e.eventId),
      bounties: { claims, eventsProcessed: [...bountyEvents] } };
  }
  function knockouts(career) { return active() ? knockoutView(select()) : career; }
  function eventIds() { return new Set(select().map(event => event.eventId)); }
  function updateSummary() {
    const count = select().length;
    const summary = document.querySelector('[data-stat-scope-summary]');
    if (summary) summary.textContent = `${formats[state.format]} · ${bounties[state.bounty]} · ${count} qualifying event${count === 1 ? '' : 's'}.${count === 0 ? ' No events match these filters.' : count < 5 ? ' Small sample—brag responsibly.' : ''}`;
  }
  function setScope(next) {
    const normalized = normalize(next);
    if (state.format === normalized.format && state.bounty === normalized.bounty) return;
    state = normalized;
    try { sessionStorage.setItem('tlpt-stat-scope', JSON.stringify(state)); } catch { /* private browsing */ }
    document.querySelectorAll('[data-stat-scope] select').forEach(select => {
      select.value = state[select.dataset.scopeKey];
    });
    updateSummary();
    window.dispatchEvent(new CustomEvent('tlpt:stat-scope-change'));
  }
  function mount() {
    const host = document.querySelector('[data-stat-scope]');
    if (!host || mounted) return;
    mounted = true;
    host.innerHTML = `<div class="stat-scope-controls">
      <label for="stat-format"><span>Format</span><select id="stat-format" data-scope-key="format">${Object.entries(formats).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
      <label for="stat-bounty"><span>Bounties</span><select id="stat-bounty" data-scope-key="bounty">${Object.entries(bounties).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
      <button type="button" class="btn" data-stat-reset>Reset to All</button>
      </div><p class="stat-scope-summary" data-stat-scope-summary role="status" aria-live="polite"></p>
      <p class="stat-scope-note">Filters apply to event results, not career ratings, cards or awards. “With Bounties” includes everyone at those events, including opt-outs.</p>`;
    host.querySelectorAll('select').forEach(select => {
      select.value = state[select.dataset.scopeKey];
      select.addEventListener('change', () => setScope({ ...state, [select.dataset.scopeKey]: select.value }));
    });
    host.querySelector('[data-stat-reset]').addEventListener('click', () => {
      setScope({ format: 'all', bounty: 'all' });
      // Notify the shared accessible select renderer without triggering another update.
      host.querySelectorAll('select').forEach(select => select.dispatchEvent(new Event('change', { bubbles: true })));
    });
    updateSummary();
  }
  async function init() {
    if (!ready) ready = (async () => {
      try { state = normalize(JSON.parse(sessionStorage.getItem('tlpt-stat-scope') || '{}')); } catch { state = normalize(); }
      const response = await fetch(`data/generated/stat-events.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load statistical event filters');
      const data = await response.json();
      if (data.version !== 1 || !Array.isArray(data.events)) throw new Error('Invalid statistical event data');
      events = data.events;
      mount();
    })();
    return ready;
  }
  window.TLPTStats = { init, active, players, knockouts, eventIds, isFactual: key => factualKeys.has(key),
    // Pure functions shared with regression tests.
    select, aggregate, knockoutView, normalize };
})();
