async function renderNewsPage() {
  const pageTitle = document.getElementById('news-page-title');
  const pageEmoji = document.getElementById('news-page-emoji');
  const pageKicker = document.getElementById('news-page-kicker');
  const authorStrip = document.getElementById('news-author-strip');
  const summaryGrid = document.getElementById('news-summary-grid');
  const statbarShell = document.getElementById('news-statbar-shell');
  const trendShell = document.getElementById('news-trend-shell');
  const introNote = document.getElementById('news-intro-note');
  const blogFeed = document.getElementById('news-blog-feed');
  const archiveList = document.getElementById('news-archive-list');

  if (!blogFeed) return;

  try {
    const response = await fetch('news-data.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load news-data.json (${response.status})`);
    }

    const data = await response.json();

    renderPageMeta(data.page, pageTitle, pageEmoji, pageKicker, introNote);
    renderAuthor(data.author, authorStrip);

    const weeks = Array.isArray(data.weeks) ? data.weeks : [];
    if (!weeks.length) {
      blogFeed.innerHTML = `
        <article class="news-post-card news-post-featured">
          <div class="news-post-meta">
            <div class="news-post-kicker">The Week That Was</div>
            <div class="news-post-dateline">No entries yet</div>
          </div>
          <h3 class="news-post-title">No News Yet</h3>
          <p class="news-post-dek">Add your first week object to news-data.json.</p>
        </article>
      `;
      if (summaryGrid) summaryGrid.innerHTML = '';
      if (statbarShell) statbarShell.innerHTML = '';
      if (trendShell) trendShell.innerHTML = '';
      if (archiveList) archiveList.innerHTML = '';
      return;
    }

    const latestWeek = weeks[0];

    renderSummaryCards(latestWeek.summaryCards || [], summaryGrid);
    renderStatPills(latestWeek.statPills || [], statbarShell);
    renderTrendStrip(latestWeek.trendUp || [], latestWeek.trendDown || [], trendShell);
    renderWeeks(weeks, blogFeed);
    renderArchiveList(weeks, archiveList);
  } catch (error) {
    console.error('Error rendering news page:', error);
    blogFeed.innerHTML = `
      <article class="news-post-card news-post-featured">
        <div class="news-post-meta">
          <div class="news-post-kicker">The Week That Was</div>
          <div class="news-post-dateline">Load error</div>
        </div>
        <h3 class="news-post-title">Couldn’t Load News</h3>
        <p class="news-post-dek">Check news-data.json and try again.</p>
      </article>
    `;
  }
}

function renderPageMeta(page, pageTitle, pageEmoji, pageKicker, introNote) {
  if (!page) return;

  if (pageTitle) pageTitle.textContent = page.title || 'The Week That Was';
  if (pageEmoji) pageEmoji.textContent = page.emoji || '🧑🏻‍💻';
  if (pageKicker) pageKicker.textContent = page.kicker || '';
  if (introNote) {
    introNote.innerHTML = page.introNote ? `<p>${page.introNote}</p>` : '';
  }
}

function renderAuthor(author, container) {
  if (!container || !author) return;

  container.innerHTML = `
    <div class="news-author-strip">
      <div class="news-author-avatar-wrap">
        ${renderAvatar({
          src: author.avatar,
          alt: author.name,
          fallback: author.fallback || getInitials(author.name)
        })}
      </div>

      <div class="news-author-copy">
        <div class="news-author-title-stack">
          <p class="news-author-kicker">${escapeHtml(author.role || 'Weekly Columnist')}</p>
          <h3 class="news-author-name">By ${escapeHtml(author.name || 'BostnMike')}</h3>
        </div>
        <p class="news-author-blurb">${escapeHtml(author.blurb || '')}</p>
      </div>
    </div>
  `;
}

function renderSummaryCards(cards, container) {
  if (!container) return;
  if (!Array.isArray(cards) || !cards.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = cards.map(renderSummaryCard).join('');
}

function renderSummaryCard(card) {
  const tone = card.tone || 'blue';
  const label = escapeHtml(card.label || '');
  const player = escapeHtml(card.player || '');
  const value = escapeHtml(card.value || '');
  const copy = escapeHtml(card.copy || '');

  let headHtml = '';

  if (Array.isArray(card.avatars) && card.avatars.length > 1) {
    headHtml = `
      <div class="news-summary-head news-summary-head-multi">
        <div class="news-summary-avatar-row">
          ${card.avatars.map(renderAvatar).join('')}
        </div>
        <div class="news-summary-head-copy">
          <div class="news-summary-player">${player}</div>
          <div class="news-summary-value">${value}</div>
        </div>
      </div>
    `;
  } else if (card.avatar) {
    headHtml = `
      <div class="news-summary-head">
        ${renderAvatar({
          src: card.avatar,
          alt: card.player,
          fallback: card.fallback || getInitials(card.player || '')
        })}
        <div class="news-summary-head-copy">
          <div class="news-summary-player">${player}</div>
          <div class="news-summary-value">${value}</div>
        </div>
      </div>
    `;
  } else {
    headHtml = `
      <div class="news-summary-player">${player}</div>
      <div class="news-summary-value">${value}</div>
    `;
  }

  return `
    <article class="news-summary-card news-summary-card-${escapeHtml(tone)}">
      <div class="news-summary-label">${label}</div>
      ${headHtml}
      <p class="news-summary-copy">${copy}</p>
    </article>
  `;
}

function renderStatPills(items, container) {
  if (!container) return;
  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <section class="section news-statbar-shell">
      <div class="news-statbar-grid">
        ${items
          .map(
            (item) => `
              <div class="news-stat-pill">
                <span>${escapeHtml(item.label || '')}</span>
                <strong>${escapeHtml(item.value || '')}</strong>
              </div>
            `
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderTrendStrip(up, down, container) {
  if (!container) return;
  if ((!Array.isArray(up) || !up.length) && (!Array.isArray(down) || !down.length)) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <section class="section news-trend-shell">
      <div class="news-trend-grid">
        <div class="news-trend-col up">
          <h3>Trending Up</h3>
          ${(up || []).map((name) => `<div>${escapeHtml(name)}</div>`).join('')}
        </div>

        <div class="news-trend-col down">
          <h3>Trending Down</h3>
          ${(down || []).map((name) => `<div>${escapeHtml(name)}</div>`).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderWeeks(weeks, container) {
  container.innerHTML = weeks.map((week, index) => renderWeek(week, index === 0)).join('');
}

function renderWeek(week, isLatest) {
  const id = escapeHtml(week.id || '');
  const date = escapeHtml(week.date || '');
  const title = escapeHtml(week.title || 'The Week That Was');
  const dek = escapeHtml(week.dek || '');
  const featuredClass = week.featured || isLatest ? ' news-post-featured' : '';
  const html = typeof week.html === 'string' ? week.html : '';

  return `
    <article id="${id}" class="news-post-card${featuredClass}">
      <div class="news-post-meta">
        <div class="news-post-kicker">The Week That Was</div>
        <div class="news-post-dateline">Date Line: ${date}</div>
      </div>

      <h3 class="news-post-title">${title}</h3>
      <p class="news-post-dek">${dek}</p>

      <div class="news-post-body">
        ${html}
      </div>
    </article>
  `;
}

function renderArchiveList(weeks, container) {
  if (!container) return;

  container.innerHTML = weeks
    .map((week, index) => {
      const activeClass = index === 0 ? ' is-active' : '';
      return `<a class="news-archive-link${activeClass}" href="#${escapeHtml(week.id || '')}">${escapeHtml(
        week.date || ''
      )}</a>`;
    })
    .join('');
}

function renderAvatar(avatar) {
  const src = escapeHtml(avatar.src || '');
  const alt = escapeHtml(avatar.alt || '');
  const fallback = escapeHtml(avatar.fallback || getInitials(avatar.alt || ''));

  return `
    <span class="player-avatar-wrap">
      <img
        class="player-avatar table"
        src="${src}"
        alt="${alt}"
        loading="lazy"
        decoding="async"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      />
      <span class="player-avatar-fallback table" style="display:none;">${fallback}</span>
    </span>
  `;
}

function getInitials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', renderNewsPage);
