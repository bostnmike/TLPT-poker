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

    const featuredContent = data.featuredContent || {};
    renderSummaryCards(featuredContent.summaryCards || [], summaryGrid);
    renderStatPills(featuredContent.statPills || [], statbarShell);
    renderTrendStrip(featuredContent.trendUp || [], featuredContent.trendDown || [], trendShell);

    const weeks = Array.isArray(data.weeks) ? data.weeks : [];
    if (!weeks.length) {
      renderEmptyState(summaryGrid, statbarShell, trendShell, blogFeed, archiveList);
      return;
    }

    renderWeeks(weeks, blogFeed);
    renderArchiveList(weeks, archiveList);
  } catch (error) {
    console.error('Error rendering news page:', error);
    renderErrorState(blogFeed, summaryGrid, statbarShell, trendShell, archiveList);
  }
}

function renderPageMeta(page, pageTitle, pageEmoji, pageKicker, introNote) {
  const safePage = page || {};

  if (pageTitle) pageTitle.textContent = safePage.title || 'The Week That Was';
  if (pageEmoji) pageEmoji.textContent = safePage.emoji || '🧑🏻‍💻';
  if (pageKicker) pageKicker.textContent = safePage.kicker || '';
  if (introNote) {
    introNote.innerHTML = safePage.introNote ? `<p>${escapeHtml(safePage.introNote)}</p>` : '';
  }
}

function renderAuthor(author, container) {
  if (!container) return;

  const safeAuthor = author || {};

  container.innerHTML = `
    <div class="news-author-strip">
      <div class="news-author-avatar-wrap">
        ${renderAvatar({
          src: safeAuthor.avatar || '',
          alt: safeAuthor.name || 'BostnMike',
          fallback: safeAuthor.fallback || getInitials(safeAuthor.name || 'BostnMike')
        })}
      </div>

      <div class="news-author-copy">
        <div class="news-author-title-stack">
          <p class="news-author-kicker">${escapeHtml(safeAuthor.role || 'Weekly Columnist')}</p>
          <h3 class="news-author-name">By ${escapeHtml(safeAuthor.name || 'BostnMike')}</h3>
        </div>
        <p class="news-author-blurb">${escapeHtml(safeAuthor.blurb || '')}</p>
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
  const tone = escapeHtml(card?.tone || 'blue');
  const label = escapeHtml(card?.label || '');
  const player = escapeHtml(card?.player || '');
  const value = escapeHtml(card?.value || '');
  const copy = escapeHtml(card?.copy || '');

  let headHtml = '';

  if (Array.isArray(card?.avatars) && card.avatars.length > 1) {
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
  } else if (card?.avatar) {
    headHtml = `
      <div class="news-summary-head">
        ${renderAvatar({
          src: card.avatar,
          alt: card.player || '',
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
      <div class="news-summary-head-copy">
        <div class="news-summary-player">${player}</div>
        <div class="news-summary-value">${value}</div>
      </div>
    `;
  }

  return `
    <article class="news-summary-card news-summary-card-${tone}">
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
                <div class="news-stat-pill-top">
                  ${
                    item?.icon
                      ? `<span class="news-stat-pill-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>`
                      : ''
                  }
                  <span>${escapeHtml(item?.label || '')}</span>
                </div>
                <strong>${escapeHtml(item?.value || '')}</strong>
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

  const upList = Array.isArray(up) ? up : [];
  const downList = Array.isArray(down) ? down : [];

  if (!upList.length && !downList.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <section class="section news-trend-shell">
      <div class="news-trend-grid">
        <div class="news-trend-col up">
          <h3>Trending Up</h3>
          ${upList.map(renderTrendItem).join('')}
        </div>

        <div class="news-trend-col down">
          <h3>Trending Down</h3>
          ${downList.map(renderTrendItem).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderTrendItem(item) {
  if (typeof item === 'string') {
    return `
      <div class="news-trend-item">
        <div class="news-trend-item-copy">
          <div class="news-trend-item-name">${escapeHtml(item)}</div>
        </div>
      </div>
    `;
  }

  const icon = item?.icon
    ? `<span class="news-trend-item-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>`
    : '';

  const avatar = item?.avatar
    ? `
      <span class="news-trend-item-avatar">
        <img
          class="player-avatar table"
          src="${escapeHtml(item.avatar)}"
          alt="${escapeHtml(item?.name || '')}"
          loading="lazy"
          decoding="async"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <span class="player-avatar-fallback table" style="display:none;">${escapeHtml(
          item?.fallback || getInitials(item?.name || '')
        )}</span>
      </span>
    `
    : '';

  return `
    <div class="news-trend-item">
      ${avatar}
      ${icon}
      <div class="news-trend-item-copy">
        <div class="news-trend-item-name">${escapeHtml(item?.name || '')}</div>
        ${
          item?.note
            ? `<div class="news-trend-item-note">${escapeHtml(item.note)}</div>`
            : ''
        }
      </div>
    </div>
  `;
}

function renderWeeks(weeks, container) {
  const explicitFeaturedIndex = weeks.findIndex((week) => week?.featured === true);
  const featuredIndex = explicitFeaturedIndex >= 0 ? explicitFeaturedIndex : 0;

  container.innerHTML = weeks
    .map((week, index) => renderWeek(week, index, index === featuredIndex))
    .join('');
}

function renderWeek(week, index, isFeatured) {
  const id = escapeHtml(week?.id || `week-${index}`);
  const date = escapeHtml(week?.date || '');
  const title = escapeHtml(week?.title || 'The Week That Was');
  const dek = escapeHtml(week?.dek || '');
  const bodyHtml = typeof week?.html === 'string' ? week.html : '';

  return `
    <article id="${id}" class="news-post-card${isFeatured ? ' news-post-featured' : ''}">
      <div class="news-post-meta">
        <div class="news-post-kicker">The Week That Was</div>
        <div class="news-post-dateline">Date Line: ${date}</div>
      </div>

      <h3 class="news-post-title">${title}</h3>
      <p class="news-post-dek">${dek}</p>

      <div class="news-post-body">
        ${bodyHtml}
      </div>
    </article>
  `;
}

function renderArchiveList(weeks, container) {
  if (!container) return;

  const explicitFeaturedIndex = weeks.findIndex((week) => week?.featured === true);
  const featuredIndex = explicitFeaturedIndex >= 0 ? explicitFeaturedIndex : 0;

  container.innerHTML = weeks
    .map((week, index) => {
      const activeClass = index === featuredIndex ? ' is-active' : '';
      return `
        <a class="news-archive-link${activeClass}" href="#${escapeHtml(week?.id || '')}">
          ${escapeHtml(week?.date || '')}
        </a>
      `;
    })
    .join('');
}

function renderAvatar(avatar) {
  const src = escapeHtml(avatar?.src || '');
  const alt = escapeHtml(avatar?.alt || '');
  const fallback = escapeHtml(avatar?.fallback || getInitials(avatar?.alt || ''));

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

function renderEmptyState(summaryGrid, statbarShell, trendShell, blogFeed, archiveList) {
  if (summaryGrid) summaryGrid.innerHTML = '';
  if (statbarShell) statbarShell.innerHTML = '';
  if (trendShell) trendShell.innerHTML = '';

  if (blogFeed) {
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
  }

  if (archiveList) archiveList.innerHTML = '';
}

function renderErrorState(blogFeed, summaryGrid, statbarShell, trendShell, archiveList) {
  if (summaryGrid) summaryGrid.innerHTML = '';
  if (statbarShell) statbarShell.innerHTML = '';
  if (trendShell) trendShell.innerHTML = '';
  if (archiveList) archiveList.innerHTML = '';

  if (blogFeed) {
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

function getInitials(name) {
  return String(name || '')
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
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', renderNewsPage);
