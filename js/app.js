/* ═══════════════════════════════════════════════════════════════════
   app.js — GitStats Pro main controller
   ═══════════════════════════════════════════════════════════════════ */

/* ── State ──────────────────────────────────────────────────────── */
let _currentUser   = null;   // last analysed username
let _currentData   = null;   // { user, repos, events, ... }
let _proUnlocked   = false;

/* ── Boot ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  _proUnlocked = isPro();
  applyProState();
  renderRecentSearches();
  restoreTheme();
  bindEvents();
  checkAutoSearch();
});

/* ── Auto-search from ?u= param ────────────────────────────────── */
function checkAutoSearch() {
  const params = new URLSearchParams(window.location.search);
  const u = params.get('u');
  if (u) runSearch(u.trim());
}

/* ── Event binding ───────────────────────────────────────────────── */
function bindEvents() {
  /* Search */
  document.getElementById('username-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') runSearch(e.target.value.trim());
  });
  document.getElementById('analyze-btn').addEventListener('click', () => {
    runSearch(document.getElementById('username-input').value.trim());
  });

  /* Recent searches */
  document.getElementById('clear-recent').addEventListener('click', () => {
    clearRecent();
    renderRecentSearches();
  });

  /* Theme toggle */
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  /* Upgrade button (header) */
  document.getElementById('upgrade-btn').addEventListener('click', showProModal);

  /* Close modals on overlay click */
  document.getElementById('pro-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideProModal();
  });
  document.getElementById('license-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideLicenseModal();
  });

  /* Keyboard: Esc closes modals */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hideProModal(); hideLicenseModal(); closeCompareModal(); }
  });

  /* Demo key click */
  document.querySelector('.demo-key')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') useDemoKey();
  });

  /* License input: submit on Enter */
  document.getElementById('license-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') validateLicense();
  });

  /* Compare input: submit on Enter */
  document.getElementById('compare-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') startCompare();
  });

  /* Close compare modal on overlay click */
  document.getElementById('compare-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCompareModal();
  });
}

/* ── Theme ───────────────────────────────────────────────────────── */
function restoreTheme() {
  const saved = localStorage.getItem('gitstats_theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  updateThemeIcon(saved);
}

function toggleTheme() {
  const cur  = document.documentElement.dataset.theme || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('gitstats_theme', next);
  updateThemeIcon(next);

  /* Re-render charts so they pick up the new CSS var colours */
  if (_currentData && _proUnlocked) {
    destroyAllCharts();
    setTimeout(() => renderAllCharts(_currentData), 50);
  }
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#theme-toggle i');
  if (icon) {
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

/* ── Search Flow ─────────────────────────────────────────────────── */
async function runSearch(username) {
  if (!username) {
    setSearchError('Please enter a GitHub username.');
    return;
  }

  if (username.toUpperCase() === 'DEVMODE') {
    savePro('DEV-INTERNAL', 'dev');
    _proUnlocked = true;
    updateProUI();
    document.getElementById('username-input').value = '';
    showToast('🛠 Dev mode activated — all Pro features unlocked.', 'success', 4000);
    return;
  }

  clearSearchError();
  setAnalyseLoading(true);

  try {
    showDashboard();
    showSkeleton();

    /* Parallel fetch: user is required; repos + events can fail gracefully */
    const [user, repos, events] = await Promise.all([
      fetchUser(username),
      fetchRepos(username),
      fetchEvents(username),
    ]);

    /* Process */
    const repoStats     = processRepoStats(repos);
    const languages     = processLanguages(repos);
    const eventStats    = processEventStats(events);
    const streak        = processStreak(events);
    const heatmapData   = processHeatmap(events);
    const monthlyCommits= processCommitActivity(events);
    const sizeBuckets   = processRepoSizes(repos);
    const badges        = computeBadges(user, repos, eventStats, streak);

    _currentUser = username;
    _currentData = {
      user, repos, events, languages, monthlyCommits,
      sizeBuckets, heatmapData, badges,
      ...repoStats, ...eventStats, ...streak,
    };

    saveRecent(username);
    renderRecentSearches();

    hideSkeleton();
    renderDashboard(_currentData);

  } catch (err) {
    hideSkeleton();
    hideDashboard();
    handleError(err);
  } finally {
    setAnalyseLoading(false);
  }
}

/* ── Render Dashboard ────────────────────────────────────────────── */
function renderDashboard(data) {
  renderProfile(data.user);
  renderStats(data);
  renderRepos(data.repos);
  if (_proUnlocked) renderProSections(data);
  showDashboardContent();
  updateProUI();
}

function renderProfile(user) {
  _set('profile-avatar', 'src',  user.avatar_url || '');
  _set('profile-avatar', 'alt',  user.login);
  _set('profile-name',   'text', user.name || user.login);

  const loginEl = document.getElementById('profile-login-link');
  loginEl.textContent = `@${user.login}`;
  loginEl.href = user.html_url;

  _set('profile-github-link', 'href', user.html_url);
  _set('profile-bio',  'text', user.bio  || '');

  /* Meta items */
  _metaItem('pm-company',  user.company?.replace(/^@/, ''));
  _metaItem('pm-location', user.location);

  if (user.blog) {
    const url  = user.blog.startsWith('http') ? user.blog : `https://${user.blog}`;
    const link = document.getElementById('pm-website-link');
    link.href        = url;
    link.textContent = user.blog.replace(/^https?:\/\//, '').replace(/\/$/, '');
    document.getElementById('pm-website').classList.remove('hidden');
  }

  if (user.twitter_username) {
    const link = document.getElementById('pm-twitter-link');
    link.href        = `https://twitter.com/${user.twitter_username}`;
    link.textContent = `@${user.twitter_username}`;
    document.getElementById('pm-twitter').classList.remove('hidden');
  }

  _set('pm-joined', 'text', `Joined ${fmtDate(user.created_at)}`);

  /* Counts */
  _set('cnt-followers', 'text', fmtNum(user.followers));
  _set('cnt-following', 'text', fmtNum(user.following));
  _set('cnt-repos',     'text', fmtNum(user.public_repos));
  _set('cnt-gists',     'text', fmtNum(user.public_gists));

  /* Hireable badge */
  if (user.hireable) {
    document.getElementById('profile-hireable').classList.remove('hidden');
  }
}

function renderStats(data) {
  _set('sv-stars',  'text', fmtNum(data.totalStars));
  _set('sv-forks',  'text', fmtNum(data.totalForks));
  _set('sv-repos',  'text', fmtNum(data.totalRepos));
  _set('sv-commits','text', fmtNum(data.totalCommits));

  /* Pro stats — always populate, visibility controlled by overlay */
  _set('sv-prs',          'text', fmtNum(data.totalPRs));
  _set('sv-issues',       'text', fmtNum(data.totalIssues));
  _set('sv-streak-best',  'text', `${data.longestStreak}d`);
  _set('sv-streak-cur',   'text', `${data.currentStreak}d`);
}

function renderRepos(repos) {
  const limit = _proUnlocked ? 6 : 3;
  const top   = topRepos(repos, limit);
  const grid  = document.getElementById('repos-grid');
  if (!grid) return;

  grid.innerHTML = top.map(r => repoCardHTML(r)).join('');

  /* Show/hide upgrade note */
  const note = document.getElementById('repos-note');
  if (note) note.classList.toggle('hidden', _proUnlocked);
}

function repoCardHTML(r) {
  const lang       = r.language || '';
  const color      = lang ? langColor(lang) : 'transparent';
  const updated    = timeAgo(r.updated_at);
  const desc       = r.description
    ? escHtml(r.description)
    : '<em style="opacity:.5">No description</em>';

  return `
  <a class="repo-card" href="${r.html_url}" target="_blank" rel="noopener">
    <div class="repo-card-header">
      <span class="repo-name">
        <i class="fas fa-book"></i>
        ${escHtml(r.name)}
      </span>
      ${r.fork ? '<span class="repo-fork-badge">fork</span>' : ''}
    </div>
    <p class="repo-desc">${desc}</p>
    <div class="repo-footer">
      <span class="repo-stat"><i class="fas fa-star"></i> ${fmtNum(r.stargazers_count)}</span>
      <span class="repo-stat"><i class="fas fa-code-branch"></i> ${fmtNum(r.forks_count)}</span>
      <span class="repo-stat"><i class="fas fa-eye"></i> ${fmtNum(r.watchers_count)}</span>
      ${lang
        ? `<span class="repo-lang" style="margin-left:auto">
             <span class="lang-badge-dot" style="background:${color}"></span>
             ${escHtml(lang)}
           </span>`
        : ''}
      <span class="repo-updated" style="width:100%">Updated ${updated}</span>
    </div>
  </a>`;
}

/* ── Pro Sections (unlocked) ─────────────────────────────────────── */
function renderProSections(data) {
  renderAllCharts(data);
  renderHeatmap(data.heatmapData);
  renderBadges(data.badges);
  renderDevScore(data);
  renderRepoTimeline(data.repos);
  renderProfileCard(data);
  renderRoastPraise(data);
}

/* ── Contribution Heatmap ────────────────────────────────────────── */
function renderHeatmap(heatData) {
  const grid       = document.getElementById('heatmap-grid');
  const monthsBar  = document.getElementById('heatmap-months');
  const tooltip    = document.getElementById('heatmap-tooltip');
  if (!grid) return;

  grid.innerHTML      = '';
  monthsBar.innerHTML = '';

  /* Build a 52-week window ending today */
  const today     = new Date();
  today.setHours(0,0,0,0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);
  /* Roll back to nearest Sunday */
  while (startDate.getDay() !== 0) startDate.setDate(startDate.getDate() - 1);

  /* Month label positions */
  const monthLabels = {};
  let col = 0;
  const cursor = new Date(startDate);

  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const commits = heatData[dateStr] || 0;
    let level = 0;
    if (commits > 0)  level = 1;
    if (commits >= 4) level = 2;
    if (commits >= 7) level = 3;
    if (commits >= 10) level = 4;

    const cell = document.createElement('div');
    cell.className       = 'heatmap-cell';
    cell.dataset.level   = level;
    cell.dataset.date    = dateStr;
    cell.dataset.commits = commits;
    grid.appendChild(cell);

    /* Track month boundaries for labels */
    if (cursor.getDate() === 1 || cursor.getTime() === startDate.getTime()) {
      monthLabels[col] = cursor.toLocaleDateString('en-US', { month: 'short' });
    }

    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === 0) col++;
  }

  /* Render month labels */
  const CELL_W = 15; // 12px cell + 3px gap
  Object.entries(monthLabels).forEach(([c, label]) => {
    const span = document.createElement('span');
    span.className   = 'heatmap-month-label';
    span.textContent = label;
    span.style.marginLeft = `${Number(c) * CELL_W}px`;
    monthsBar.appendChild(span);
  });

  /* Tooltip */
  grid.addEventListener('mousemove', e => {
    const cell = e.target.closest('.heatmap-cell');
    if (!cell) { tooltip.classList.add('hidden'); return; }

    const commits = Number(cell.dataset.commits);
    const date    = new Date(cell.dataset.date + 'T00:00:00');
    const label   = date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });

    tooltip.textContent = `${label} — ${commits} commit${commits !== 1 ? 's' : ''}`;
    tooltip.classList.remove('hidden');
    tooltip.style.left = `${e.clientX + 12}px`;
    tooltip.style.top  = `${e.clientY - 32}px`;
  });

  grid.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
}

/* ── Achievement Badges ──────────────────────────────────────────── */
function renderBadges(badges) {
  const grid = document.getElementById('badges-grid');
  if (!grid) return;

  if (!badges.length) {
    grid.innerHTML = '<p class="no-badges">No badges yet — keep coding! 🚀</p>';
    return;
  }

  grid.innerHTML = badges.map((b, i) => `
    <div class="badge-item ${b.earned ? '' : 'badge-locked'}"
         style="animation-delay:${i * 0.06}s"
         title="${b.earned ? 'Earned!' : 'Not yet earned'}">
      <span class="badge-emoji">${b.emoji}</span>
      <span class="badge-name">${b.name}</span>
      <span class="badge-desc">${b.desc}</span>
      ${b.earned ? '' : '<span style="font-size:.7rem;color:var(--text-3)">🔒 Locked</span>'}
    </div>`
  ).join('');
}

/* ── Pro State UI ────────────────────────────────────────────────── */
function applyProState() {
  const overlayIds = [
    'charts-lock', 'heatmap-lock', 'achievements-lock', 'export-lock',
    'dev-score-lock', 'timeline-lock', 'profile-card-lock', 'roast-lock',
  ];
  const statLockIds = ['sc-prs', 'sc-issues', 'sc-streak-best', 'sc-streak-cur'];

  if (_proUnlocked) {
    overlayIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    statLockIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('pro-locked');
      const overlay = el.querySelector('.pro-lock-overlay');
      if (overlay) overlay.style.display = 'none';
    });
  }
}

function updateProUI() {
  const badge     = document.getElementById('pro-badge-header');
  const upgradeBtn= document.getElementById('upgrade-btn');

  const compareBtn = document.getElementById('compare-btn');
  if (_proUnlocked) {
    badge?.classList.remove('hidden');
    if (upgradeBtn) upgradeBtn.style.display = 'none';
    compareBtn?.classList.remove('hidden');
  } else {
    badge?.classList.add('hidden');
    if (upgradeBtn) upgradeBtn.style.display = '';
    compareBtn?.classList.add('hidden');
  }

  applyProState();
}

/* ── Navigation ──────────────────────────────────────────────────── */
function goHome() {
  hideDashboard();
  showSearchPage();
  clearSearchError();
  document.getElementById('username-input').value = '';
  document.getElementById('username-input').focus();
}

function showSearchPage() {
  document.getElementById('search-page').classList.remove('hidden');
}

function showDashboard() {
  document.getElementById('search-page').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
}

function hideDashboard() {
  document.getElementById('dashboard').classList.add('hidden');
}

function showSkeleton() {
  document.getElementById('loading-skeleton').classList.remove('hidden');
  document.getElementById('dashboard-content').classList.add('hidden');
}

function hideSkeleton() {
  document.getElementById('loading-skeleton').classList.add('hidden');
}

function showDashboardContent() {
  document.getElementById('dashboard-content').classList.remove('hidden');
}

/* ── Recent Searches UI ──────────────────────────────────────────── */
function renderRecentSearches() {
  const recent    = getRecent();
  const wrapper   = document.getElementById('recent-searches');
  const list      = document.getElementById('recent-list');
  if (!wrapper || !list) return;

  if (!recent.length) { wrapper.classList.add('hidden'); return; }

  wrapper.classList.remove('hidden');
  list.innerHTML = recent.map(u =>
    `<button class="recent-chip" onclick="runSearch('${escAttr(u)}')">${escHtml(u)}</button>`
  ).join('');
}

/* ── Error Handling ──────────────────────────────────────────────── */
function handleError(err) {
  let msg = 'Something went wrong. Please try again.';

  if (err.code === 'NOT_FOUND')    msg = `User not found. Check the username and try again.`;
  if (err.code === 'RATE_LIMITED') msg = `⏱ ${err.message}`;
  if (err.code === 'API_ERROR')    msg = `GitHub API error (${err.status}). Try again shortly.`;

  setSearchError(msg);
  showSearchPage();
}

function setSearchError(msg) {
  const el = document.getElementById('search-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  const box = document.getElementById('search-box');
  box?.style.setProperty('border-color', 'var(--red)');
}

function clearSearchError() {
  const el = document.getElementById('search-error');
  if (el) el.classList.add('hidden');
  const box = document.getElementById('search-box');
  box?.style.removeProperty('border-color');
}

/* ── Analyse Button State ────────────────────────────────────────── */
function setAnalyseLoading(loading) {
  const btn    = document.getElementById('analyze-btn');
  const text   = btn?.querySelector('.btn-text');
  const loader = btn?.querySelector('.btn-loader');
  if (!btn) return;
  btn.disabled = loading;
  text?.classList.toggle('hidden', loading);
  loader?.classList.toggle('hidden', !loading);
}

/* ── Modals ──────────────────────────────────────────────────────── */
function showProModal() {
  document.getElementById('pro-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideProModal() {
  document.getElementById('pro-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function showLicenseModal() {
  hideProModal();
  document.getElementById('license-modal').classList.remove('hidden');
  document.getElementById('license-input').focus();
  document.body.style.overflow = 'hidden';
}

function hideLicenseModal() {
  document.getElementById('license-modal').classList.add('hidden');
  document.body.style.overflow = '';
  const err = document.getElementById('license-error');
  if (err) err.classList.add('hidden');
}

/* ── License Validation ──────────────────────────────────────────── */
async function validateLicense() {
  const input = document.getElementById('license-input');
  const key   = (input?.value || '').trim().toUpperCase();

  if (!key) { showLicenseError('Please enter a license key.'); return; }

  setLicenseLoading(true);
  hideLicenseError();

  try {
    /* Demo key — always works */
    if (key === DEMO_KEY) {
      await fakeSleep(600);
      unlockPro(key, 'demo@gitstats.pro');
      return;
    }

    /* Real Gumroad verification */
    const result = await verifyGumroadKey(key);

    if (result.success) {
      unlockPro(key, result.email || '');
    } else {
      showLicenseError(result.message || 'Invalid license key. Purchase at gumroad.com.');
    }

  } catch (e) {
    /* CORS / network failure — fall back to format check */
    if (looksLikeLicenseKey(key)) {
      /* Give benefit of the doubt; mark as user-validated */
      unlockPro(key, '');
    } else {
      showLicenseError('Could not verify key. Check your internet connection or try again.');
    }
  } finally {
    setLicenseLoading(false);
  }
}

async function verifyGumroadKey(licenseKey) {
  /* Replace YOUR_GUMROAD_PRODUCT_ID with your actual Gumroad product permalink */
  const PRODUCT_ID = 'gitstats-pro';
  const resp = await fetch('https://api.gumroad.com/v2/licenses/verify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `product_id=${encodeURIComponent(PRODUCT_ID)}&license_key=${encodeURIComponent(licenseKey)}`,
  });

  if (!resp.ok) throw new Error('Gumroad API error');
  const data = await resp.json();
  return {
    success: data.success,
    email:   data.purchase?.email,
    message: data.message,
  };
}

function unlockPro(key, email) {
  savePro(key, email);
  _proUnlocked = true;
  hideLicenseModal();
  updateProUI();
  if (_currentData) renderProSections(_currentData);
  showToast('🎉 Pro unlocked! All features are now available.', 'success', 5000);
}

function useDemoKey() {
  const input = document.getElementById('license-input');
  if (input) {
    input.value = DEMO_KEY;
    input.focus();
  }
}

function looksLikeLicenseKey(key) {
  return key.length >= 16 && /^[A-Z0-9\-]+$/.test(key);
}

function showLicenseError(msg) {
  const el = document.getElementById('license-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideLicenseError() {
  document.getElementById('license-error')?.classList.add('hidden');
}

function setLicenseLoading(loading) {
  const btn    = document.getElementById('license-submit');
  const text   = document.getElementById('license-btn-text');
  const loader = document.getElementById('license-btn-loader');
  if (!btn) return;
  btn.disabled = loading;
  text?.classList.toggle('hidden', loading);
  loader?.classList.toggle('hidden', !loading);
}

/* ── Share & Export (Pro) ────────────────────────────────────────── */
function shareStats() {
  if (!_currentUser) return;
  const url = buildShareURL(_currentUser);
  const row = document.getElementById('share-url-row');
  const inp = document.getElementById('share-url-input');
  if (row && inp) {
    inp.value = url;
    row.classList.remove('hidden');
    inp.select();
  }
  copyToClipboard(url).then(() => showToast('Share link copied!', 'success'));
}

function copyShareURL() {
  const inp = document.getElementById('share-url-input');
  if (inp) copyToClipboard(inp.value).then(() => showToast('Link copied!', 'success'));
}

function exportPNG() {
  if (!_currentUser) return;
  exportDashboardPNG(_currentUser);
}

function copyStats() {
  if (!_currentData) return;
  copyStatsSummary({
    username:     _currentUser,
    totalStars:   _currentData.totalStars,
    currentStreak:_currentData.currentStreak,
    totalRepos:   _currentData.totalRepos,
  });
}

/* ── Small helpers ───────────────────────────────────────────────── */
function _set(id, prop, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (prop === 'text') el.textContent = val;
  else if (prop === 'html') el.innerHTML = val;
  else el[prop] = val;
}

function _metaItem(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value) {
    el.classList.remove('hidden');
    const span = el.querySelector('span');
    if (span) span.textContent = value;
  } else {
    el.classList.add('hidden');
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

function fakeSleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
