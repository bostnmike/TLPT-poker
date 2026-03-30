{\rtf1\ansi\ansicpg1252\cocoartf2869
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww17220\viewh23340\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 async function renderNewsPage() \{\
  const feed = document.getElementById('news-blog-feed');\
  if (!feed) return;\
\
  const res = await fetch('news-data.json');\
  const data = await res.json();\
\
  const kicker = document.getElementById('news-page-kicker');\
  if (kicker) kicker.textContent = data.page.kicker;\
\
  const intro = document.getElementById('news-intro-note');\
  if (intro) intro.innerHTML = `<p>$\{data.page.introNote\}</p>`;\
\
  const author = document.getElementById('news-author-strip');\
  if (author) \{\
    author.innerHTML = `\
      <div class="news-author-strip">\
        <div class="news-author-avatar-wrap">\
          <span class="player-avatar-wrap">\
            <img\
              class="player-avatar table"\
              src="$\{data.author.avatar\}"\
              alt="$\{data.author.name\}"\
              loading="lazy"\
              decoding="async"\
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"\
            />\
            <span class="player-avatar-fallback table" style="display:none;">$\{data.author.fallback\}</span>\
          </span>\
        </div>\
\
        <div class="news-author-copy">\
          <div class="news-author-title-stack">\
            <p class="news-author-kicker">$\{data.author.role\}</p>\
            <h3 class="news-author-name">By $\{data.author.name\}</h3>\
          </div>\
          <p class="news-author-blurb">$\{data.author.blurb\}</p>\
        </div>\
      </div>\
    `;\
  \}\
\
  const latest = data.weeks[0];\
\
  const summaryGrid = document.getElementById('news-summary-grid');\
  if (summaryGrid) \{\
    summaryGrid.innerHTML = latest.summaryCards.map(renderSummaryCard).join('');\
  \}\
\
  const statbarShell = document.getElementById('news-statbar-shell');\
  if (statbarShell) \{\
    statbarShell.innerHTML = renderStatBar(latest.statPills || []);\
  \}\
\
  const trendShell = document.getElementById('news-trend-shell');\
  if (trendShell) \{\
    trendShell.innerHTML = renderTrendShell(latest.trendUp || [], latest.trendDown || []);\
  \}\
\
  feed.innerHTML = data.weeks.map(renderWeek).join('');\
\
  const archiveList = document.getElementById('news-archive-list');\
  if (archiveList) \{\
    archiveList.innerHTML = data.weeks\
      .map((week, index) => \{\
        const activeClass = index === 0 ? ' is-active' : '';\
        return `<a class="news-archive-link$\{activeClass\}" href="#$\{week.id\}">$\{week.date\}</a>`;\
      \})\
      .join('');\
  \}\
\}\
\
function renderAvatar(avatar) \{\
  return `\
    <span class="player-avatar-wrap">\
      <img\
        class="player-avatar table"\
        src="$\{avatar.src\}"\
        alt="$\{avatar.alt\}"\
        loading="lazy"\
        decoding="async"\
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"\
      />\
      <span class="player-avatar-fallback table" style="display:none;">$\{avatar.fallback || ''\}</span>\
    </span>\
  `;\
\}\
\
function renderSummaryCard(card) \{\
  let headHtml = '';\
\
  if (Array.isArray(card.avatars) && card.avatars.length > 1) \{\
    headHtml = `\
      <div class="news-summary-head news-summary-head-multi">\
        <div class="news-summary-avatar-row">\
          $\{card.avatars.map(renderAvatar).join('')\}\
        </div>\
        <div class="news-summary-head-copy">\
          <div class="news-summary-player">$\{card.player\}</div>\
          <div class="news-summary-value">$\{card.value\}</div>\
        </div>\
      </div>\
    `;\
  \} else if (card.avatar) \{\
    headHtml = `\
      <div class="news-summary-head">\
        <span class="player-avatar-wrap">\
          <img\
            class="player-avatar table"\
            src="$\{card.avatar\}"\
            alt="$\{card.player\}"\
            loading="lazy"\
            decoding="async"\
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"\
          />\
          <span class="player-avatar-fallback table" style="display:none;">$\{card.fallback || ''\}</span>\
        </span>\
        <div class="news-summary-head-copy">\
          <div class="news-summary-player">$\{card.player\}</div>\
          <div class="news-summary-value">$\{card.value\}</div>\
        </div>\
      </div>\
    `;\
  \} else \{\
    headHtml = `\
      <div class="news-summary-player">$\{card.player\}</div>\
      <div class="news-summary-value">$\{card.value\}</div>\
    `;\
  \}\
\
  return `\
    <article class="news-summary-card news-summary-card-$\{card.tone\}">\
      <div class="news-summary-label">$\{card.label\}</div>\
      $\{headHtml\}\
      <p class="news-summary-copy">$\{card.copy\}</p>\
    </article>\
  `;\
\}\
\
function renderStatBar(items) \{\
  if (!items.length) return '';\
\
  return `\
    <div class="news-statbar-grid">\
      $\{items\
        .map(\
          (item) => `\
            <div class="news-stat-pill">\
              <span>$\{item.label\}</span>\
              <strong>$\{item.value\}</strong>\
            </div>\
          `\
        )\
        .join('')\}\
    </div>\
  `;\
\}\
\
function renderTrendShell(up, down) \{\
  if (!up.length && !down.length) return '';\
\
  return `\
    <div class="news-trend-grid">\
      <div class="news-trend-col up">\
        <h3>Trending Up</h3>\
        $\{up.map((name) => `<div>$\{name\}</div>`).join('')\}\
      </div>\
\
      <div class="news-trend-col down">\
        <h3>Trending Down</h3>\
        $\{down.map((name) => `<div>$\{name\}</div>`).join('')\}\
      </div>\
    </div>\
  `;\
\}\
\
function renderWeek(week) \{\
  return `\
    <article id="$\{week.id\}" class="news-post-card$\{week.featured ? ' news-post-featured' : ''\}">\
      <div class="news-post-meta">\
        <div class="news-post-kicker">The Week That Was</div>\
        <div class="news-post-dateline">Date Line: $\{week.date\}</div>\
      </div>\
\
      <h3 class="news-post-title">The Week That Was</h3>\
      <p class="news-post-dek">$\{week.dek\}</p>\
\
      <div class="news-post-body">\
        $\{week.html\}\
      </div>\
    </article>\
  `;\
\}\
\
document.addEventListener('DOMContentLoaded', renderNewsPage);}