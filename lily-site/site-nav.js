/* Standalone navigation only. This script never reads or submits inquiry fields. */
(() => {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;
  const toggle = header.querySelector('[data-nav-toggle]');
  const nav = document.getElementById(toggle.getAttribute('aria-controls'));
  const mobile = window.matchMedia('(max-width: 1020px)');
  const alwaysCollapsible = header.dataset.collapsibleNav === 'always';
  const collapsible = () => alwaysCollapsible || mobile.matches;
  let open = false;
  header.classList.add('nav-ready');

  const close = (restoreFocus = false) => {
    open = false;
    toggle.setAttribute('aria-expanded', 'false');
    nav.hidden = collapsible();
    if (restoreFocus) toggle.focus();
  };
  const setLayout = () => {
    toggle.hidden = !collapsible();
    close(nav.contains(document.activeElement) && collapsible());
  };
  setLayout();
  mobile.addEventListener('change', setLayout);
  toggle.addEventListener('click', () => {
    if (open) {
      close(true);
    } else {
      open = true;
      nav.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) close(true);
  });
  document.addEventListener('click', event => {
    if (open && !header.contains(event.target)) close();
  });
  header.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (open && !header.contains(document.activeElement)) close();
    }, 0);
  });

  const links = [...nav.querySelectorAll('a[href^="#"]'), ...header.querySelectorAll('.header-contact[href^="#"]')];
  const targets = links.map(link => ({
    link,
    section: document.getElementById(link.getAttribute('href').slice(1))
  })).filter(item => item.section);
  header.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const section = document.getElementById(link.getAttribute('href').slice(1));
    if (!section) return;
    close();
    const heading = section.querySelector('h1, h2') || section;
    heading.setAttribute('tabindex', '-1');
    // Move focus after native anchor navigation; prevent a second scroll jump.
    requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  });

  let scheduled = false;
  const updateCurrent = () => {
    scheduled = false;
    const boundary = header.getBoundingClientRect().height + 40;
    let current = null;
    for (const item of targets) {
      const rect = item.section.getBoundingClientRect();
      if (rect.top <= boundary && rect.bottom > boundary) current = item;
    }
    for (const item of targets) {
      if (item === current) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    }
  };
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(updateCurrent);
    }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('load', schedule);
  updateCurrent();
})();
