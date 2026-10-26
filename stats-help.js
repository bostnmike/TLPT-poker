/* Shared, opt-in guide UI. No audio URL is requested until a reviewed recording is enabled. */
(() => {
  const portrait = 'images/site/norm-headshot.png';
  const add = (parent, tag, text, className) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    parent.append(el);
    return el;
  };
  function headshot(parent) {
    const img = add(parent, 'img', '', 'norm-headshot');
    img.src = portrait;
    img.alt = '';
    img.width = 56;
    img.height = 56;
    img.decoding = 'async';
  }
  function invitation(button, ready) {
    button.replaceChildren();
    button.classList.add('norm-help-invite');
    headshot(button);
    const copy = add(button, 'span', '', 'norm-invite-copy');
    add(copy, 'strong', ready ? 'Norm Narrates' : 'Let Norm explain');
    add(copy, 'span', ready ? 'Listen or read · How to use this view' : 'Read the guide · Audio coming soon');
    add(button, 'span', '↗', 'norm-invite-arrow').setAttribute('aria-hidden', 'true');
  }
  function narration(parent, view) {
    const section = add(parent, 'section', '', 'norm-narration');
    section.setAttribute('aria-label', 'Norm Narrates: ' + view.title);
    const heading = add(section, 'div', '', 'norm-narration-heading');
    headshot(heading);
    const copy = add(heading, 'div');
    add(copy, 'h3', 'Norm Narrates');
    add(copy, 'p', view.audio ? 'Press play for the tour. The written guide is below.' : 'The recording is on the way. Read the guide below.');
    if (!view.audio) return;
    const audio = add(section, 'audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = view.audio;
    audio.setAttribute('aria-label', 'Listen to Norm explain ' + view.title);
    const status = add(section, 'p', '', 'dashboard-narration-status');
    status.hidden = true;
    status.setAttribute('role', 'status');
    audio.addEventListener('error', () => {
      if (!audio.getAttribute('src')) return;
      status.textContent = 'Norm’s microphone is taking a break. The complete written guide is still below.';
      status.hidden = false;
    });
  }
  function stopAudio(dialog) {
    dialog.querySelectorAll('audio').forEach(audio => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
  }
  window.TLPTGuide = { narration, stopAudio };
  const dashboard = document.querySelector('[data-dashboard-help-open]');
  if (dashboard) invitation(dashboard, true);
  const opener = document.querySelector('[data-stats-help-open]');
  if (!opener) return;
  const key = opener.dataset.statsHelpOpen;
  const currentView = () => window.TLPTStatsGuides[key === 'knockouts' && document.querySelector('[data-knockouts-view="bounties"]')?.getAttribute('aria-pressed') === 'true' ? 'bounties' : key];
  invitation(opener, Boolean(currentView().audio));
  document.querySelectorAll('[data-knockouts-view]').forEach(button => {
    button.addEventListener('click', () => {
      queueMicrotask(() => invitation(opener, Boolean(currentView().audio)));
    });
  });
  const dialog = document.getElementById('stats-help');
  const title = document.getElementById('stats-help-title');
  const close = dialog.querySelector('[data-stats-help-close]');
  const content = dialog.querySelector('.stats-help-content');
  let priorOverflow = '';
  opener.addEventListener('click', () => {
    const view = currentView();
    title.textContent = view.title + ' · How to use this view';
    content.replaceChildren();
    add(content, 'p', view.intro);
    narration(content, view);
    for (const [heading, body] of view.sections) {
      add(content, 'h3', heading);
      add(content, 'p', body);
    }
    if (view.scope) {
      add(content, 'h3', 'What the event filters do');
      add(content, 'p', 'Event format selects single-table / Sit & Go, multi-table, or both. Bounties selects events with or without bounties—not whether a particular player opted in. Everyone at a matching event is included. Filters start at All / All. Reset to All clears those event filters, not your other page choices. Career ratings, cards and awards never change.');
    }
    priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.scrollTop = 0;
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    stopAudio(dialog);
    document.body.style.overflow = priorOverflow;
    opener.focus();
  });
})();
