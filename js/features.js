/* ═══════════════════════════════════════════════════════════════════
   features.js — Compare · DevScore · ProfileCard · Timeline · Roast
   ═══════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════
   1.  DEVELOPER SCORE
   ════════════════════════════════════════════════════════════════════ */

function calculateDevScore(user, repos, eventStats, streak) {
  const stars    = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
  const repoCount= user.public_repos || repos.length;
  const followers= user.followers || 0;
  const commits  = eventStats.totalCommits || 0;
  const ageYears = (Date.now() - new Date(user.created_at).getTime()) / (365.25 * 86_400_000);

  const starPts  = Math.min(stars      / 1000 * 300, 300);
  const followPts= Math.min(followers  / 500  * 200, 200);
  const repoPts  = Math.min(repoCount  / 50   * 150, 150);
  const commitPts= Math.min(commits    / 500  * 200, 200);
  const agePts   = Math.min(ageYears   / 5    * 150, 150);

  const total = Math.round(starPts + followPts + repoPts + commitPts + agePts);

  const LEVELS = [
    { min: 0,   label: 'Beginner',     emoji: '🌱', color: '#8b949e' },
    { min: 200, label: 'Intermediate', emoji: '⚡', color: '#4facfe' },
    { min: 400, label: 'Advanced',     emoji: '🔥', color: '#43e97b' },
    { min: 600, label: 'Expert',       emoji: '💎', color: '#f093fb' },
    { min: 800, label: 'Legend',       emoji: '👑', color: '#f6d365' },
  ];
  const level = [...LEVELS].reverse().find(l => total >= l.min) || LEVELS[0];

  return {
    total, label: level.label, emoji: level.emoji, color: level.color,
    breakdown: [
      { label: 'Stars',           pts: Math.round(starPts),   max: 300, icon: 'fa-star'        },
      { label: 'Followers',       pts: Math.round(followPts), max: 200, icon: 'fa-users'       },
      { label: 'Repositories',    pts: Math.round(repoPts),   max: 150, icon: 'fa-book'        },
      { label: 'Commit Activity', pts: Math.round(commitPts), max: 200, icon: 'fa-code-commit' },
      { label: 'Account Age',     pts: Math.round(agePts),    max: 150, icon: 'fa-calendar-alt'},
    ],
  };
}

function renderDevScore(data) {
  const card = document.getElementById('dev-score-card');
  if (!card) return;

  const score = calculateDevScore(data.user, data.repos, data, data);
  const R = 54, C = +(2 * Math.PI * R).toFixed(2);

  card.innerHTML = `
    <div class="dev-score-layout">
      <div class="dev-score-ring-wrap">
        <svg width="160" height="160" viewBox="0 0 160 160" aria-label="Developer score ${score.total}/1000">
          <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--border)" stroke-width="12"/>
          <circle id="score-ring-arc" cx="80" cy="80" r="${R}" fill="none"
            stroke="${score.color}" stroke-width="12"
            stroke-dasharray="${C}" stroke-dashoffset="${C}"
            stroke-linecap="round" transform="rotate(-90 80 80)"/>
          <text x="80" y="72" text-anchor="middle" fill="var(--text)"
            font-size="30" font-weight="700" font-family="Inter,sans-serif">${score.total}</text>
          <text x="80" y="90" text-anchor="middle" fill="var(--text-2)"
            font-size="11" font-family="Inter,sans-serif">/1000</text>
        </svg>
        <div class="dev-score-label">
          <span class="score-emoji">${score.emoji}</span>
          <span class="score-level" style="color:${score.color}">${score.label}</span>
        </div>
      </div>

      <div class="dev-score-breakdown">
        <h4 class="breakdown-title">Score Breakdown</h4>
        ${score.breakdown.map(b => `
          <div class="score-row">
            <span class="score-row-lbl"><i class="fas ${b.icon}"></i> ${b.label}</span>
            <div class="score-bar-track">
              <div class="score-bar-fill"
                style="width:0%;background:${score.color}"
                data-target="${((b.pts / b.max) * 100).toFixed(0)}%"></div>
            </div>
            <span class="score-row-pts">${b.pts}<span class="score-max-lbl">/${b.max}</span></span>
          </div>`
        ).join('')}
      </div>
    </div>`;

  /* Animate ring + bars after paint */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const arc = document.getElementById('score-ring-arc');
    if (arc) {
      arc.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)';
      arc.style.strokeDashoffset = (C * (1 - score.total / 1000)).toFixed(2);
    }
    document.querySelectorAll('.score-bar-fill').forEach(bar => {
      bar.style.transition = 'width 1.2s cubic-bezier(.4,0,.2,1)';
      bar.style.width = bar.dataset.target;
    });
  }));
}

/* ════════════════════════════════════════════════════════════════════
   2.  COMPARE MODE
   ════════════════════════════════════════════════════════════════════ */

let _cmpDataB = null;

async function startCompare() {
  const input    = document.getElementById('compare-input');
  const username = input?.value?.trim();
  if (!username) { setCmpError('Enter a username to compare against.'); return; }
  if (username.toLowerCase() === (_currentUser || '').toLowerCase()) {
    setCmpError('Enter a different username.'); return;
  }

  setCmpLoading(true);
  hideCmpError();

  try {
    const [user, repos, events] = await Promise.all([
      fetchUser(username),
      fetchRepos(username),
      fetchEvents(username),
    ]);

    const repoStats  = processRepoStats(repos);
    const eventStats = processEventStats(events);
    const streak     = processStreak(events);
    const languages  = processLanguages(repos);

    _cmpDataB = { user, repos, events, languages, ...repoStats, ...eventStats, ...streak };
    renderCompare(_currentData, _cmpDataB);
    document.getElementById('compare-results').classList.remove('hidden');

  } catch (err) {
    setCmpError(err.code === 'NOT_FOUND'
      ? `User "${username}" not found.`
      : err.message || 'Could not load user.');
  } finally {
    setCmpLoading(false);
  }
}

function renderCompare(a, b) {
  _renderCmpProfiles(a, b);
  _renderCmpBars(a, b);
  _renderCmpLanguages(a, b);
  _renderCmpWinners(a, b);
}

function _renderCmpProfiles(a, b) {
  const el = document.getElementById('cmp-profiles');
  if (!el) return;
  el.innerHTML = [a, b].map(d => `
    <div class="cmp-profile-card">
      <img src="${d.user.avatar_url}" alt="${d.user.login}" class="cmp-avatar"/>
      <div class="cmp-info">
        <strong class="cmp-name">${escHtml(d.user.name || d.user.login)}</strong>
        <span class="cmp-login">@${escHtml(d.user.login)}</span>
        <span class="cmp-bio">${escHtml(d.user.bio || '')}</span>
      </div>
    </div>`).join('<div class="cmp-vs-divider">VS</div>');
}

function _renderCmpBars(a, b) {
  const el = document.getElementById('cmp-bars');
  if (!el) return;

  const metrics = [
    { label: '⭐ Total Stars',    va: a.totalStars,        vb: b.totalStars        },
    { label: '👥 Followers',      va: a.user.followers,    vb: b.user.followers    },
    { label: '📦 Public Repos',   va: a.user.public_repos, vb: b.user.public_repos },
    { label: '💻 Recent Commits', va: a.totalCommits,      vb: b.totalCommits      },
    { label: '🔀 Total Forks',    va: a.totalForks,        vb: b.totalForks        },
    { label: '🔥 Longest Streak', va: a.longestStreak,     vb: b.longestStreak     },
  ];

  el.innerHTML = metrics.map(m => {
    const sum  = (m.va || 0) + (m.vb || 0) || 1;
    const pctA = ((m.va || 0) / sum * 100).toFixed(1);
    const pctB = ((m.vb || 0) / sum * 100).toFixed(1);
    const aWins= (m.va || 0) >= (m.vb || 0);
    return `
      <div class="cmp-bar-row">
        <span class="cmp-bar-val cmp-val-a ${aWins ? 'cmp-winner-val' : ''}">${fmtNum(m.va)}</span>
        <div class="cmp-bar-track-wrap">
          <span class="cmp-bar-label">${m.label}</span>
          <div class="cmp-bar-track">
            <div class="cmp-bar-a" style="width:${pctA}%"></div>
            <div class="cmp-bar-b" style="width:${pctB}%"></div>
          </div>
        </div>
        <span class="cmp-bar-val cmp-val-b ${!aWins ? 'cmp-winner-val' : ''}">${fmtNum(m.vb)}</span>
      </div>`;
  }).join('');
}

function _renderCmpLanguages(a, b) {
  const el = document.getElementById('cmp-languages');
  if (!el) return;

  const setA = new Set(a.languages.map(l => l.name));
  const setB = new Set(b.languages.map(l => l.name));

  const onlyA  = a.languages.filter(l => !setB.has(l.name));
  const shared = a.languages.filter(l => setB.has(l.name));
  const onlyB  = b.languages.filter(l => !setA.has(l.name));

  const langPill = l =>
    `<span class="lang-pill" style="border-color:${l.color};color:${l.color}">
       <span class="lang-pill-dot" style="background:${l.color}"></span>${l.name}
     </span>`;

  el.innerHTML = `
    <div class="lang-overlap-grid">
      <div class="lang-col lang-col-a">
        <div class="lang-col-header" style="color:var(--blue)">@${escHtml(a.user.login)} only</div>
        <div class="lang-pills">${onlyA.map(langPill).join('') || '<em>—</em>'}</div>
      </div>
      <div class="lang-col lang-col-shared">
        <div class="lang-col-header" style="color:var(--accent)">Both use</div>
        <div class="lang-pills">${shared.map(langPill).join('') || '<em>None</em>'}</div>
      </div>
      <div class="lang-col lang-col-b">
        <div class="lang-col-header" style="color:var(--purple)">@${escHtml(b.user.login)} only</div>
        <div class="lang-pills">${onlyB.map(langPill).join('') || '<em>—</em>'}</div>
      </div>
    </div>`;
}

function _renderCmpWinners(a, b) {
  const el = document.getElementById('cmp-winners');
  if (!el) return;

  const na = a.user.login, nb = b.user.login;

  const contests = [
    {
      emoji: '🏆', title: 'Open Source Legend',
      aScore: a.totalStars,      bScore: b.totalStars,
      fmt: v => `${fmtNum(v)} stars`,
    },
    {
      emoji: '👥', title: 'More Popular',
      aScore: a.user.followers,  bScore: b.user.followers,
      fmt: v => `${fmtNum(v)} followers`,
    },
    {
      emoji: '🔥', title: 'More Active',
      aScore: a.totalCommits,    bScore: b.totalCommits,
      fmt: v => `${fmtNum(v)} commits`,
    },
    {
      emoji: '📦', title: 'Repo Creator',
      aScore: a.user.public_repos, bScore: b.user.public_repos,
      fmt: v => `${fmtNum(v)} repos`,
    },
    {
      emoji: '⚡', title: 'Streak Champion',
      aScore: a.longestStreak,   bScore: b.longestStreak,
      fmt: v => `${v}d streak`,
    },
  ];

  el.innerHTML = contests.map(c => {
    const tie    = c.aScore === c.bScore;
    const aWins  = c.aScore > c.bScore;
    const winner = tie ? 'Tie' : (aWins ? `@${na}` : `@${nb}`);
    const diff   = tie
      ? `Both at ${c.fmt(c.aScore)}`
      : `${c.fmt(aWins ? c.aScore : c.bScore)} vs ${c.fmt(aWins ? c.bScore : c.aScore)}`;
    return `
      <div class="winner-badge">
        <span class="winner-emoji">${c.emoji}</span>
        <div class="winner-info">
          <span class="winner-title">${c.title}</span>
          <span class="winner-name">${winner}</span>
          <span class="winner-diff">${diff}</span>
        </div>
      </div>`;
  }).join('');
}

/* Compare modal helpers */
function openCompareModal() {
  if (!_currentUser) { showToast('Search a profile first.', 'error'); return; }

  /* Pre-fill user A badge */
  const av = document.getElementById('cmp-avatar-a');
  const ln = document.getElementById('cmp-login-a');
  if (av && _currentData) av.src = _currentData.user.avatar_url;
  if (ln && _currentUser) ln.textContent = _currentUser;

  document.getElementById('compare-results').classList.add('hidden');
  document.getElementById('compare-input').value = '';
  hideCmpError();
  document.getElementById('compare-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('compare-input').focus();
}

function closeCompareModal() {
  document.getElementById('compare-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function setCmpLoading(on) {
  const btn  = document.getElementById('compare-go-btn');
  const text = document.getElementById('cmp-btn-text');
  const load = document.getElementById('cmp-btn-loader');
  if (!btn) return;
  btn.disabled = on;
  text?.classList.toggle('hidden', on);
  load?.classList.toggle('hidden', !on);
}

function setCmpError(msg) {
  const el = document.getElementById('compare-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function hideCmpError() {
  document.getElementById('compare-error')?.classList.add('hidden');
}

/* ════════════════════════════════════════════════════════════════════
   3.  SHAREABLE PROFILE CARD
   ════════════════════════════════════════════════════════════════════ */

function renderProfileCard(data) {
  const el = document.getElementById('shareable-card');
  if (!el) return;

  const score    = calculateDevScore(data.user, data.repos, data, data);
  const topLang  = data.languages?.[0];
  const isDark   = document.documentElement.dataset.theme !== 'light';

  el.innerHTML = `
    <div class="pc-inner" id="pc-export-target">
      <div class="pc-header">
        <img src="${data.user.avatar_url}" alt="${data.user.login}" class="pc-avatar" crossorigin="anonymous"/>
        <div class="pc-identity">
          <span class="pc-name">${escHtml(data.user.name || data.user.login)}</span>
          <span class="pc-login">@${escHtml(data.user.login)}</span>
          ${data.user.bio ? `<span class="pc-bio">${escHtml(data.user.bio.slice(0, 60))}${data.user.bio.length > 60 ? '…' : ''}</span>` : ''}
        </div>
        <div class="pc-score-badge" style="border-color:${score.color}">
          <span class="pc-score-num" style="color:${score.color}">${score.total}</span>
          <span class="pc-score-label">${score.emoji} ${score.label}</span>
        </div>
      </div>

      <div class="pc-stats">
        <div class="pc-stat"><span class="pc-stat-num">${fmtNum(data.totalStars)}</span><span class="pc-stat-lbl">⭐ Stars</span></div>
        <div class="pc-stat"><span class="pc-stat-num">${fmtNum(data.user.followers)}</span><span class="pc-stat-lbl">👥 Followers</span></div>
        <div class="pc-stat"><span class="pc-stat-num">${fmtNum(data.user.public_repos)}</span><span class="pc-stat-lbl">📦 Repos</span></div>
        <div class="pc-stat"><span class="pc-stat-num">${data.longestStreak}d</span><span class="pc-stat-lbl">🔥 Streak</span></div>
      </div>

      ${topLang ? `
      <div class="pc-lang-bar">
        <span class="lang-dot-sm" style="background:${topLang.color}"></span>
        Top language: <strong>${escHtml(topLang.name)}</strong>
      </div>` : ''}

      <div class="pc-footer">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
            0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01
            1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
            0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27
            2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
            1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01
            2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        Generated by <strong>GitStats Pro</strong>
      </div>
    </div>`;
}

async function downloadProfileCard() {
  const target = document.getElementById('pc-export-target');
  if (!target || typeof html2canvas === 'undefined') {
    showToast('Canvas not ready, try again.', 'error'); return;
  }
  showToast('Generating card…', 'info', 4000);
  try {
    const canvas = await html2canvas(target, {
      backgroundColor: null,
      scale: 3,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
    const a  = document.createElement('a');
    a.href   = canvas.toDataURL('image/png');
    a.download = `gitstats-card-${_currentUser || 'profile'}.png`;
    a.click();
    showToast('Card downloaded!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Export failed.', 'error');
  }
}

/* ════════════════════════════════════════════════════════════════════
   4.  REPO TIMELINE
   ════════════════════════════════════════════════════════════════════ */

function renderRepoTimeline(repos) {
  const container = document.getElementById('timeline-inner');
  if (!container) return;

  /* Sort by creation date ascending, exclude forks */
  const sorted = [...repos]
    .filter(r => !r.fork)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (!sorted.length) {
    container.innerHTML = '<p style="color:var(--text-2);text-align:center;padding:1rem">No original repos found.</p>';
    return;
  }

  const minYear = new Date(sorted[0].created_at).getFullYear();
  const maxYear = new Date(sorted[sorted.length - 1].created_at).getFullYear();
  const spanYears = maxYear - minYear || 1;

  /* Group by year for the year labels */
  const byYear = {};
  sorted.forEach(r => {
    const y = new Date(r.created_at).getFullYear();
    byYear[y] = (byYear[y] || 0) + 1;
  });

  /* Build SVG */
  const W = 900, H = 120, lineY = 60, dotR = 7;
  const pad = 40;
  const usableW = W - pad * 2;

  const dateToX = iso => {
    const d = new Date(iso);
    const totalMs = new Date(maxYear + 1, 0, 1) - new Date(minYear, 0, 1);
    const elapsedMs = d - new Date(minYear, 0, 1);
    return pad + (elapsedMs / totalMs) * usableW;
  };

  const dots = sorted.map((r, i) => {
    const x      = dateToX(r.created_at);
    const offset = (i % 2 === 0) ? -30 : 20; // alternate above/below
    const stars  = r.stargazers_count || 0;
    const radius = Math.min(dotR + Math.sqrt(stars) * 0.3, 14);
    return { r, x, offset, radius };
  });

  /* Year labels */
  const yearLabels = [];
  for (let y = minYear; y <= maxYear; y++) {
    const x = dateToX(`${y}-01-01`);
    yearLabels.push({ y, x });
  }

  const svgDots = dots.map(({ r, x, offset, radius }) => {
    const color = r.language ? langColor(r.language) : '#8b949e';
    return `
      <g class="tl-dot-group" tabindex="0"
        aria-label="${escHtml(r.name)}: ${r.stargazers_count || 0} stars, created ${fmtDate(r.created_at)}">
        <line x1="${x}" y1="${lineY}" x2="${x}" y2="${lineY + offset}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3"/>
        <circle cx="${x}" cy="${lineY + offset}" r="${radius}"
          fill="${color}33" stroke="${color}" stroke-width="2" class="tl-dot"/>
        <text x="${x}" y="${lineY + offset - radius - 4}" text-anchor="middle"
          font-size="8" fill="var(--text-3)" font-family="Inter,sans-serif"
          class="tl-label">${escHtml(r.name.length > 12 ? r.name.slice(0,12) + '…' : r.name)}</text>
        <title>${escHtml(r.name)} · ⭐ ${fmtNum(r.stargazers_count)} · ${fmtDate(r.created_at)}</title>
      </g>`;
  }).join('');

  const svgYears = yearLabels.map(({ y, x }) => `
    <line x1="${x}" y1="${lineY - 8}" x2="${x}" y2="${lineY + 8}" stroke="var(--border)" stroke-width="1"/>
    <text x="${x}" y="${lineY + 22}" text-anchor="middle"
      font-size="11" fill="var(--text-3)" font-family="Inter,sans-serif">${y}</text>`
  ).join('');

  container.innerHTML = `
    <div class="timeline-scroll">
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="timeline-svg" role="img" aria-label="Repository creation timeline">
        <!-- spine -->
        <line x1="${pad}" y1="${lineY}" x2="${W - pad}" y2="${lineY}" stroke="var(--border)" stroke-width="2"/>
        ${svgYears}
        ${svgDots}
      </svg>
    </div>
    <p class="timeline-caption">${sorted.length} original repos from ${minYear}${minYear !== maxYear ? ` – ${maxYear}` : ''} · Dot size = ⭐ stars</p>`;
}

/* ════════════════════════════════════════════════════════════════════
   5.  GITHUB ROAST / PRAISE
   ════════════════════════════════════════════════════════════════════ */

let _roastMode = 'roast';

function switchRoastTab(mode) {
  _roastMode = mode;
  document.getElementById('roast-tab')?.classList.toggle('active',  mode === 'roast');
  document.getElementById('praise-tab')?.classList.toggle('active', mode === 'praise');
  if (_currentData) renderRoastPraise(_currentData);
}

function renderRoastPraise(data) {
  const el = document.getElementById('roast-output');
  if (!el) return;

  const text = _roastMode === 'roast'
    ? _generateRoast(data)
    : _generatePraise(data);

  el.innerHTML = `<p class="roast-text">${text}</p>`;
}

function _generateRoast(data) {
  const lines = [];
  const c  = data.totalCommits || 0;
  const s  = data.totalStars    || 0;
  const f  = data.user.followers || 0;
  const rp = data.user.public_repos || 0;
  const cs = data.currentStreak || 0;
  const ls = data.longestStreak || 0;
  const ageYears = Math.floor((Date.now() - new Date(data.user.created_at).getTime()) / (365.25 * 86_400_000));

  /* Activity */
  if (c === 0)        lines.push(`Zero commits in the last 90 days. GitHub sent a welfare check — it's worried about you. 👻`);
  else if (c < 10)    lines.push(`${c} commits in 90 days? That's basically one commit every other Netflix episode. Peak productivity. 📺`);
  else if (c < 50)    lines.push(`${c} commits recently. Your contribution graph looks like a lawn after a drought — mostly brown with a few desperate green patches. 🌵`);
  else                lines.push(`${fmtNum(c)} commits! Okay, you're clearly allergic to touching grass. We respect the dedication though. 🌱`);

  /* Stars */
  if (s === 0)        lines.push(`Zero stars across all repos. Even your "Hello World" project is giving crickets. Your mom starred it once but then forgot the password. 🦗`);
  else if (s < 10)    lines.push(`${s} total stars? That's fewer than the number of times you've googled "how to center a div." 🎯`);
  else if (s < 100)   lines.push(`${s} stars — you're in the "promising" category, which is code for "not there yet." Keep shipping! 🚢`);
  else                lines.push(`${fmtNum(s)} stars? Not bad. Not viral-open-source-celebrity bad, but respectable. Your parents would be proud if they knew what a GitHub was. ⭐`);

  /* Followers */
  if (f < 5)          lines.push(`${f} followers. Even your git history has more commits than you have fans. Time to post something on social media — maybe a hot take about tabs vs spaces. 🔥`);
  else if (f < 50)    lines.push(`${f} followers. A cozy underground fanbase. Very indie. Very niche. Very "I don't need validation." (You do.) 🙈`);

  /* Streak */
  if (cs === 0 && ls === 0) lines.push(`Current streak: 0 days. The heatmap page is so empty it's been mistaken for a minimalist art installation. 🎨`);
  else if (cs === 0)        lines.push(`Current streak: 0 days. You had a longest streak of ${ls} days and just... stopped. What happened? Did the WiFi go out? ❓`);

  /* Repo count */
  if (rp > 60)        lines.push(`${rp} repos and still counting. Starting repos is easy. Finishing them is a completely different skill — one you haven't unlocked yet. 📦`);

  /* Age */
  if (ageYears >= 5 && s < 50)  lines.push(`${ageYears} years on GitHub and ${fmtNum(s)} total stars. That's… commitment to the journey, not the destination. 🛤️`);

  const selected = lines.slice(0, 3).join(' ');
  return selected + ' <strong>But hey — every great dev started exactly here. Keep building. 💪</strong>';
}

function _generatePraise(data) {
  const lines = [];
  const c  = data.totalCommits || 0;
  const s  = data.totalStars    || 0;
  const f  = data.user.followers || 0;
  const rp = data.user.public_repos || 0;
  const cs = data.currentStreak || 0;
  const ls = data.longestStreak || 0;
  const ageYears = Math.floor((Date.now() - new Date(data.user.created_at).getTime()) / (365.25 * 86_400_000));
  const topLang  = data.languages?.[0]?.name || 'code';

  /* Stars */
  if      (s >= 100_000) lines.push(`${fmtNum(s)} stars?! You're not just a developer — you're a <em>movement</em>. GitHub should name a street after you. 🌟`);
  else if (s >= 10_000)  lines.push(`${fmtNum(s)} total stars! You've built things that thousands of people actually rely on. That's legacy-level stuff. 🏛️`);
  else if (s >= 1_000)   lines.push(`${fmtNum(s)} stars across your repos. The community has spoken — your work genuinely matters. That's rare. ⭐`);
  else if (s >= 100)     lines.push(`${s} stars and growing! Real developers noticed your work. Word is spreading. 🚀`);
  else                   lines.push(`Every great repo started at 0 stars. You're actively building and shipping — that's more than most people do. 💻`);

  /* Commits */
  if      (c >= 500)     lines.push(`${fmtNum(c)} commits recently?! Your keyboard probably needs a vacation. You're a machine — an elegant, caffeinated machine. ☕`);
  else if (c >= 100)     lines.push(`${c} commits in the last 90 days. Consistency like that is a superpower. Most people just bookmark tutorials. 📚`);
  else if (c >= 30)      lines.push(`${c} recent commits — you're showing up and doing the work. That discipline compounds over time. 📈`);

  /* Streak */
  if      (ls >= 100)    lines.push(`A ${ls}-day longest streak! That's not dedication, that's a <em>lifestyle</em>. The green squares bow to you. 🟩`);
  else if (ls >= 30)     lines.push(`${ls}-day streak! Most people can't commit to drinking water daily. You're doing it with code. 💎`);
  else if (ls >= 7)      lines.push(`${ls}-day personal best streak. Consistency is what separates good devs from great ones. You're on the right track. ⚡`);
  if      (cs >= 14)     lines.push(`And you're currently ${cs} days into a streak right now! Don't stop — the momentum is real. 🔥`);

  /* Followers */
  if      (f >= 10_000)  lines.push(`${fmtNum(f)} followers! You've built a genuine community around your work. That's influence money can't buy. 👑`);
  else if (f >= 1_000)   lines.push(`${fmtNum(f)} followers — you're a respected voice developers actually listen to. 🎙️`);
  else if (f >= 100)     lines.push(`${f} followers and growing. The right people are noticing your ${topLang} skills. 🌐`);

  /* Age */
  if (ageYears >= 10)    lines.push(`${ageYears} years on GitHub? You've literally watched the open-source ecosystem grow up. OG status, undisputed. 🦋`);
  else if (ageYears >= 5) lines.push(`${ageYears} years of consistent building — that kind of longevity shows real love for the craft. 🛠️`);

  /* Repos */
  if (rp >= 50)          lines.push(`${rp} public repos! You ship. A lot. That bias toward action is the most underrated developer trait. 📦`);

  return lines.slice(0, 4).join(' ') || `You're a developer who shows up and builds things. That alone puts you ahead of 90% of people who "want to learn to code someday." Keep going. 🚀`;
}
