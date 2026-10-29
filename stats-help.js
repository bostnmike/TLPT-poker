/* Shared page-level narration and separate, written-only help dialogs. */
(() => {
  // Square viewports into the approved 1983 × 793 cast artwork. Reuse one
  // cached image; never redraw faces or randomly change a guide's character.
  const portrait = 'images/site/norm-many-faces.jpg';
  const portraits = {
    referee: [365, 80, 270],
    weather: [660, 75, 280],
    clock: [1065, 75, 280],
    explorer: [1385, 80, 310],
    detective: [65, 290, 285],
    hotline: [525, 325, 285],
    classic: [870, 310, 285],
    host: [1205, 340, 290]
  };
  const add = (parent, tag, text, className) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    parent.append(el);
    return el;
  };
  function headshot(parent) {
    const frame = add(parent, 'span', '', 'norm-headshot');
    frame.setAttribute('aria-hidden', 'true');
    const img = add(frame, 'img');
    img.src = portrait;
    img.alt = '';
    img.width = 1983;
    img.height = 793;
    img.decoding = 'async';
    return key => {
      const character = Object.hasOwn(portraits, key) ? key : 'classic';
      const [x, y, size] = portraits[character];
      frame.dataset.normCharacter = character;
      img.style.width = (1983 / size * 100) + '%';
      img.style.left = (-x / size * 100) + '%';
      img.style.top = (-y / size * 100) + '%';
    };
  }
  function mount(opener, currentView) {
    const section = document.createElement('section');
    section.className = 'norm-page-guide';
    const anchor = opener.closest('.control-deck-heading, .dashboard-summary-row') || opener;
    anchor.after(section);
    const syncPortrait = headshot(section);
    const intro = add(section, 'div', '', 'norm-page-intro');
    add(intro, 'h3', 'Norm Narrates');
    const description = add(intro, 'p');
    const controls = add(section, 'div', '', 'norm-page-controls');
    const audio = add(controls, 'audio', '', 'norm-page-audio');
    audio.controls = true;
    audio.preload = 'none';
    const status = add(section, 'p', '', 'norm-narration-status');
    status.hidden = true;
    status.setAttribute('role', 'status');
    opener.textContent = 'Read-me guide ↗';
    opener.title = 'If Norm’s not enough, open the written guide.';
    opener.classList.add('norm-read-guide');
    controls.append(opener);
    opener.addEventListener('click', () => audio.pause());
    audio.addEventListener('error', () => {
      if (!audio.getAttribute('src')) return;
      status.textContent = 'Norm’s microphone is taking a break. The written guide is still available through the Read-me guide link.';
      status.hidden = false;
    });
    const sync = () => {
      const view = currentView();
      syncPortrait(view.portrait);
      section.setAttribute('aria-label', 'Norm Narrates: ' + view.title);
      description.textContent = view.audio ? 'Norm’s take on ' + view.title + '.' : 'The recording is on the way. Open the Read-me guide.';
      audio.setAttribute('aria-label', 'Listen to Norm explain ' + view.title);
      opener.setAttribute('aria-label', 'Read-me guide: ' + view.title);
      audio.hidden = !view.audio;
      if ((audio.getAttribute('src') || '') === (view.audio || '')) return;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      status.hidden = true;
      if (view.audio) audio.src = view.audio;
    };
    sync();
    window.addEventListener('pagehide', () => audio.pause());
    return sync;
  }
  window.TLPTGuide = { mount };
  const opener = document.querySelector('[data-stats-help-open]');
  if (!opener) return;
  const key = opener.dataset.statsHelpOpen;
  const currentView = () => window.TLPTStatsGuides[key === 'knockouts' && document.querySelector('[data-knockouts-view="bounties"]')?.getAttribute('aria-pressed') === 'true' ? 'bounties' : key];
  const sync = mount(opener, currentView);
  const viewObserver = new MutationObserver(sync);
  document.querySelectorAll('[data-knockouts-view]').forEach(button => {
    viewObserver.observe(button, {attributes:true, attributeFilter:['aria-pressed']});
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
    document.body.style.overflow = priorOverflow;
    opener.focus();
  });
})();
