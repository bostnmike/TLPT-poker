/* Contextual help uses the same metric names and formulas as the Dashboard. */
(() => {
  const dialog = document.getElementById('dashboard-help');
  const opener = document.querySelector('[data-dashboard-help-open]');
  const content = document.getElementById('dashboard-help-content');
  if (!dialog || !opener || !content) return;
  const views = {
    results: {
      title: 'Results',
      intro: 'See what happened at the tables: eliminations, bounty wins, cashes and bubbles.',
      tip: 'Choose a stat under Show me, then narrow the events if you want. Select a player card to open their profile.',
      metrics: {
        hits: 'Every recorded elimination counts, whether or not a bounty was attached. Busting a player who later rebuys still counts; a live-stack reload is not a knockout.',
        bountiesWon: 'Qualifying opponent-entry bounties collected—not dollars. Keeping your own bounty and winner-only forfeitures do not add bounty wins.',
        timesPlaced: 'Tournament appearances that finished in the money. Collecting a bounty alone is not a tournament cash.',
        bubbles: 'Finishes exactly one position outside the money. More bubbles is not better. It is just more material for the group chat.'
      }
    },
    bankroll: {
      title: 'Bankroll',
      intro: 'Compare money earned or lost, not just who collected the biggest payout.',
      tip: 'Use Profit for the complete result, or Bounty profit / loss for the bounty component alone. Choose an event format or bounty type to narrow the comparison.',
      metrics: {
        profit: 'Total take-home minus tournament entry costs and bounty money posted. Take-home includes tournament prizes, collected and retained bounty returns, and confirmed settlement adjustments.',
        bountyNet: 'Collected plus retained bounty returns, minus bounty money posted. This is already included in overall profit—do not add it a second time.'
      }
    },
    rates: {
      title: 'Rates',
      intro: 'Compare frequency and efficiency rather than raw totals. Always keep the sample size in mind.',
      tip: 'Pick a rate under Show me. Filtering changes both the result and its denominator to the matching events; a short hot streak is not a lifetime guarantee.',
      metrics: {
        roi: 'Profit divided by total cost, including bounty purchases. This is a percentage, not total winnings.',
        hitRate: 'Knockouts divided by all entries: initial buy-ins plus rebuys and reloads. It is shown as a percentage; 100% means one knockout per entry, not a guaranteed elimination.',
        cashRate: 'Tournament cashes divided by initial buy-ins. Rebuys do not add another tournament appearance.',
        bubbleRate: 'Bubble finishes divided by initial buy-ins. A higher value means more near-misses, not better performance.'
      }
    },
    'player-dna': {
      title: 'Player DNA',
      intro: 'Explore career-wide statistical ratings. These describe recorded results—not a scientific personality assessment.',
      tip: 'Choose a career rating under Show me. Event filters are hidden because they do not change these ratings. Your event selections are kept for when you return to another view.',
      metrics: {
        trueSkillScore: 'The combined Power Index blends normalized performance measures and an appearance bonus using fixed benchmarks.',
        luckIndex: 'Actual profit compared with modeled expected profit. It is a statistical comparison, not evidence that the deck has a personal agenda.',
        clutchIndex: 'Normalized career cash frequency: how often a player finishes in the money.',
        aggressionIndex: 'Normalized knockouts per entry—not a measurement of betting behavior.',
        survivorIndex: 'A normalized blend of cash rate, bubble avoidance and knockout rate.',
        tiltIndex: 'A score rewarding fewer rebuys and bubble finishes, with small samples softened toward the middle. It does not measure actual mood.'
      }
    }
  };
  const add = (tag, text, parent = content) => {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  };
  let priorOverflow = '';
  opener.addEventListener('click', () => {
    const select = document.getElementById('dashboard-metric-select');
    const category = document.getElementById('dashboard-metric-panel')?.dataset.dashboardMetricGroup || 'results';
    const view = views[category] || views.results;
    const metrics = DASHBOARD_METRICS_BY_CATEGORY[category] || DASHBOARD_METRICS_BY_CATEGORY.results;
    const selected = metrics.find(metric => metric.key === select?.value) || metrics[0];
    document.getElementById('dashboard-help-title').textContent = view.title + ' · How to use this view';
    content.replaceChildren();
    add('p', view.intro).className = 'dashboard-help-intro';
    window.TLPTGuide.narration(content, {
      title: view.title,
      audio: 'media/norm-narrates/norm-dashboard-' + category + '.mp3'
    });
    add('h3', 'Start here');
    add('p', view.tip);
    add('h3', 'What the numbers mean');
    const list = add('dl', '');
    for (const metric of metrics) {
      const term = add('dt', metric.label + (metric.key === selected.key ? ' · Selected' : ''), list);
      if (metric.key === selected.key) term.className = 'dashboard-help-selected';
      add('dd', view.metrics[metric.key], list);
    }
    const calculation = add('details', '');
    add('summary', selected.label + ' · Calculation', calculation);
    add('p', STAT_FORMULAS[selected.key] || 'See the metric definition above.', calculation);
    add('h3', 'Reading the ranking');
    add('p', 'Players are ordered from highest value to lowest, with alphabetical tie-breaks. Higher is not always better—for example, bubbles. Zero values are omitted; negative financial results remain visible.');
    const scoped = category !== 'player-dna' && window.TLPTStats?.active();
    add('p', scoped
      ? 'This filtered view includes players with a matching tournament appearance and a non-zero value for the selected metric.'
      : 'This view includes players with at least two career entries (initial buy-ins plus rebuys) and a non-zero value for the selected metric.');
    add('p', 'Active players and alumni are grouped separately, but their league-wide ranks are retained. Select any player card for their profile.');
    if (category !== 'player-dna') {
      add('h3', 'What the event filters do');
      add('p', 'Event format selects single-table / Sit & Go, multi-table, or both. Bounties selects events with bounties, without bounties, or both—not whether an individual player opted in. Everyone at a matching event is included.');
      add('p', 'Filters start at All. Reset clears only event filters, not your chosen stat. Career ratings, cards and awards never change. Small samples deserve caution, even when they make you look terrific.');
    }
    priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.scrollTop = 0;
  });
  dialog.querySelector('[data-dashboard-help-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    window.TLPTGuide.stopAudio(dialog);
    document.body.style.overflow = priorOverflow;
    opener.focus();
  });
})();
