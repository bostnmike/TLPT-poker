async function renderNewsPage() {
  const pageTitle = document.getElementById('news-page-title');
  const pageEmoji = document.getElementById('news-page-emoji');
  const pageKicker = document.getElementById('news-page-kicker');
  const authorStrip = document.getElementById('news-author-strip');
  const summaryGrid = document.getElementById('news-summary-grid');
  const statbarShell = document.getElementById('news-statbar-shell');
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
      renderEmptyState(summaryGrid, statbarShell, blogFeed, archiveList);
      return;
    }

    const latestWeek = weeks[0];

    renderSummaryCards(latestWeek.summaryCards || [], summaryGrid);
    renderStatPills(latestWeek.statPills || [], statbarShell);
    renderWeeks(weeks, blogFeed);
    renderArchiveList(weeks, archiveList);
  } catch (error) {
    console.error('Error rendering news page:', error);
    renderErrorState(blogFeed, summaryGrid, statbarShell, archiveList);
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
  const valueHtml = value ? `<div class="news-summary-value">${value}</div>` : '';

  const hasMulti = Array.isArray(card?.avatars) && card.avatars.length;
  const hasSingle = !!card?.avatar;

  let headHtml = '';

  if (hasMulti) {
    headHtml = `
      <div class="news-summary-head news-summary-head-multi">
        <div class="news-summary-avatar-row">
          ${card.avatars.map((avatar) => renderAvatar(avatar)).join('')}
        </div>
        <div class="news-summary-head-copy">
          <div class="news-summary-player">${player}</div>
          ${valueHtml}
        </div>
      </div>
    `;
  } else if (hasSingle) {
    headHtml = `
      <div class="news-summary-head">
        ${renderAvatar({
          src: card.avatar,
          alt: card.player || '',
          fallback: card.fallback || getInitials(card.player || '')
        })}
        <div class="news-summary-head-copy">
          <div class="news-summary-player">${player}</div>
          ${valueHtml}
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

function renderStatPills(pills, container) {
  if (!container) return;

  if (!Array.isArray(pills) || !pills.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="news-statbar-shell">
      <div class="news-statbar-grid">
        ${pills
          .map(
            (pill) => `
              <div class="news-stat-pill">
                <div class="news-stat-pill-top">
                  <span class="news-stat-pill-icon">${escapeHtml(pill?.icon || '')}</span>
                  <span>${escapeHtml(pill?.label || '')}</span>
                </div>
                <strong>${escapeHtml(pill?.value || '')}</strong>
              </div>
            `
          )
          .join('')}
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
  const title = escapeHtml(week?.title || `TWTW: ${week?.eventName || 'Event'}`);
  const dek = escapeHtml(week?.dek || '');
  const bodyHtml = renderWeekBody(week);

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

function renderWeekBody(week) {
  return `
    ${renderMainStory(week)}
    ${renderGameSpotlight(week)}
    ${renderWhatTheFeltSaid(week)}
    ${renderRoastSection(week)}
    ${renderNumbersThatMatter(week)}
    ${renderQuickHits(week)}
    ${renderTLDR(week)}
  `;
}

function renderMainStory(week) {
  const html = typeof week?.mainStoryHtml === 'string' ? week.mainStoryHtml : '';
  if (!html) return '';

  return `
    <section class="news-story-section">
      <h4>📰 The Main Story</h4>
      ${html}
    </section>
  `;
}

function renderGameSpotlight(week) {
  const spotlight = week?.spotlight;
  if (!spotlight) return '';

  const kicker = escapeHtml(spotlight?.kicker || 'Game Spotlight');
  const player = escapeHtml(spotlight?.player || '');
  const pills = Array.isArray(spotlight?.pills) ? spotlight.pills : [];
  const hasMulti = Array.isArray(spotlight?.avatars) && spotlight.avatars.length;

  const avatarBlock = hasMulti
    ? `
      <div class="news-receipt-avatar-row">
        ${spotlight.avatars.map((avatar) => renderAvatar(avatar)).join('')}
      </div>
    `
    : `
      <div class="news-receipt-avatar-row">
        <span class="player-avatar-wrap">
          <img
            class="player-avatar table"
            src="${escapeHtml(spotlight?.avatar || '')}"
            alt="${player}"
            loading="lazy"
            decoding="async"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <span class="player-avatar-fallback table" style="display:none;">
            ${escapeHtml(spotlight?.fallback || getInitials(player))}
          </span>
        </span>
      </div>
    `;

  return `
    <section class="news-story-section">
      <h4>🔦 Game Spotlight</h4>
      <div class="news-receipt-panel">
        <div class="news-receipt-lead">
          <div class="news-receipt-top news-receipt-top-split">
            <div class="news-receipt-copy">
              <div class="news-receipt-kicker">${kicker}</div>
              <div class="news-receipt-name">${player}</div>
            </div>
            ${avatarBlock}
          </div>
        </div>

        <div class="news-receipt-pills">
          ${pills.map((pill) => `<span class="news-receipt-pill">${escapeHtml(pill)}</span>`).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderWhatTheFeltSaid(week) {
  const items = Array.isArray(week?.feltSaid) ? week.feltSaid.slice(0, 4) : [];
  if (!items.length) return '';

  return `
    <section class="news-story-section">
      <h4>👂🏼 Felt Whispers</h4>
      <div class="news-felt-grid">
        ${items
          .map((item) => {
            const label = item?.label || '';
            const icon = escapeHtml(item?.icon || getFeltWhisperIcon(label));

            return `
              <div class="news-felt-card">
                <div class="news-felt-label-row">
                  <span class="news-felt-icon">${icon}</span>
                  <div class="news-felt-label">${escapeHtml(label)}</div>
                </div>
                <div class="news-felt-value">${escapeHtml(item?.value || '')}</div>
                <p class="news-felt-note">${escapeHtml(item?.note || '')}</p>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function getFeltWhisperIcon(label) {
  const normalized = String(label || '').toLowerCase();

  if (normalized.includes('first blood')) return '🩸';
  if (normalized.includes('first gone')) return '☠️';
  if (normalized.includes('table killer')) return '🪓';
  if (normalized.includes('how it ended')) return '🏁';
  return '🃏';
}

function renderRoastSection(week) {
  const html = typeof week?.roastHtml === 'string' ? week.roastHtml : '';
  if (!html) return '';

  return `
    <section class="news-story-section">
      <h4>🎙️ Host Roast</h4>
      <div class="news-pull-quote news-pull-quote-self-roast">
        <div class="news-pull-quote-row">
          <span class="player-avatar-wrap">
            <img
              class="player-avatar table"
              src="images/players/bostnmike.jpg"
              alt="BostnMike"
              loading="lazy"
              decoding="async"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <span class="player-avatar-fallback table" style="display:none;">BM</span>
          </span>
          ${html}
        </div>
      </div>
    </section>
  `;
}

function renderNumbersThatMatter(week) {
  const items = Array.isArray(week?.numbersThatMatter) ? week.numbersThatMatter : [];
  if (!items.length) return '';

  return `
    <section class="news-story-section">
      <h4>🔢 Numbers That Matter</h4>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </section>
  `;
}

function renderQuickHits(week) {
  const left = Array.isArray(week?.quickHitsLeft) ? week.quickHitsLeft : [];
  const right = Array.isArray(week?.quickHitsRight) ? week.quickHitsRight : [];
  if (!left.length && !right.length) return '';

  return `
    <section class="news-story-section">
      <h4>🔥 Quick Hits</h4>
      <div class="news-quickhits-grid">
        <ul>${left.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        <ul>${right.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
    </section>
  `;
}

function renderTLDR(week) {
  const tldr = escapeHtml(week?.tldr || '');
  if (!tldr) return '';

  return `
    <section class="news-story-section">
      <div class="news-section-divider"><span>TL;DR</span></div>
      <p>${tldr}</p>
    </section>
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

function getInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
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

function renderEmptyState(summaryGrid, statbarShell, blogFeed, archiveList) {
  if (summaryGrid) summaryGrid.innerHTML = '';
  if (statbarShell) statbarShell.innerHTML = '';

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

function renderErrorState(blogFeed, summaryGrid, statbarShell, archiveList) {
  if (summaryGrid) summaryGrid.innerHTML = '';
  if (statbarShell) statbarShell.innerHTML = '';
  if (archiveList) archiveList.innerHTML = '';

  if (blogFeed) {
    blogFeed.innerHTML = `
      <article class="news-post-card news-post-featured">
        <div class="news-post-meta">
          <div class="news-post-kicker">The Week That Was</div>
          <div class="news-post-dateline">Load error</div>
        </div>
        <h3 class="news-post-title">Could not load the archive</h3>
        <p class="news-post-dek">Check news-data.json for valid JSON and the new event-based schema.</p>
      </article>
    `;
  }
}

document.addEventListener('DOMContentLoaded', renderNewsPage);
