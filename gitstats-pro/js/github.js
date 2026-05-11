/* ═══════════════════════════════════════════════════════════════════
   github.js — GitHub REST API calls + data processing
   ═══════════════════════════════════════════════════════════════════ */

const GH_API = 'https://api.github.com';

/* ── Low-level fetch with error normalisation ───────────────────── */
async function ghFetch(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });

  if (!res.ok) {
    if (res.status === 404) throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });

    if (res.status === 403 || res.status === 429) {
      const reset = res.headers.get('X-RateLimit-Reset');
      const resetAt = reset
        ? new Date(Number(reset) * 1000).toLocaleTimeString()
        : 'soon';
      throw Object.assign(
        new Error(`GitHub rate limit reached. Resets at ${resetAt}.`),
        { code: 'RATE_LIMITED' }
      );
    }

    throw Object.assign(
      new Error(`GitHub API error (${res.status})`),
      { code: 'API_ERROR', status: res.status }
    );
  }

  return res.json();
}

/* ── Public API ─────────────────────────────────────────────────── */
async function fetchUser(username) {
  return ghFetch(`${GH_API}/users/${encodeURIComponent(username)}`);
}

async function fetchRepos(username) {
  try {
    /* Sort by stars; owner-only for cleaner stats */
    return await ghFetch(
      `${GH_API}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=stars&type=owner`
    );
  } catch (_) { return []; }
}

async function fetchEvents(username) {
  /* GitHub keeps at most ~90 days / 300 events across 3 pages */
  const pages = [];
  for (let page = 1; page <= 3; page++) {
    try {
      const batch = await ghFetch(
        `${GH_API}/users/${encodeURIComponent(username)}/events?per_page=100&page=${page}`
      );
      if (!batch.length) break;
      pages.push(...batch);
    } catch (_) { break; }
  }
  return pages;
}

/* ── Data Processors ────────────────────────────────────────────── */

function processRepoStats(repos) {
  let totalStars = 0, totalForks = 0, totalWatchers = 0;
  repos.forEach(r => {
    totalStars    += r.stargazers_count || 0;
    totalForks    += r.forks_count      || 0;
    totalWatchers += r.watchers_count   || 0;
  });
  return { totalStars, totalForks, totalWatchers, totalRepos: repos.length };
}

function processLanguages(repos) {
  const counts = {};
  repos.forEach(r => {
    if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, color: langColor(name) }));
}

function processEventStats(events) {
  let totalCommits = 0, totalPRs = 0, totalIssues = 0;

  events.forEach(ev => {
    switch (ev.type) {
      case 'PushEvent':
        totalCommits += ev.payload?.commits?.length || 0;
        break;
      case 'PullRequestEvent':
        if (ev.payload?.action === 'opened' || ev.payload?.action === 'closed') totalPRs++;
        break;
      case 'IssuesEvent':
        if (ev.payload?.action === 'opened') totalIssues++;
        break;
    }
  });

  return { totalCommits, totalPRs, totalIssues };
}

function processStreak(events) {
  const pushDates = new Set(
    events
      .filter(e => e.type === 'PushEvent')
      .map(e => e.created_at.slice(0, 10))
  );

  if (!pushDates.size) return { currentStreak: 0, longestStreak: 0 };

  const sorted = Array.from(pushDates).sort().reverse(); // newest first

  /* Current streak: walk backwards from today */
  let currentStreak = 0;
  const todayStr     = new Date().toISOString().slice(0, 10);
  const yestStr      = isoDate(Date.now() - 86_400_000);
  let cursor = pushDates.has(todayStr) ? todayStr : (pushDates.has(yestStr) ? yestStr : null);

  if (cursor) {
    let d = new Date(cursor);
    while (pushDates.has(d.toISOString().slice(0, 10))) {
      currentStreak++;
      d = new Date(d.getTime() - 86_400_000);
    }
  }

  /* Longest streak: scan sorted list */
  let longestStreak = 0, tempStreak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((prev - curr) / 86_400_000);
    if (diff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return { currentStreak, longestStreak };
}

function processHeatmap(events) {
  /* Returns { 'YYYY-MM-DD': commitCount } for last 364 days */
  const map = {};
  events
    .filter(e => e.type === 'PushEvent')
    .forEach(e => {
      const date = e.created_at.slice(0, 10);
      map[date] = (map[date] || 0) + (e.payload?.commits?.length || 0);
    });
  return map;
}

function processCommitActivity(events) {
  /* Monthly buckets for the last 12 months */
  const buckets = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    buckets[monthKey(d)] = 0;
  }
  events
    .filter(e => e.type === 'PushEvent')
    .forEach(e => {
      const k = e.created_at.slice(0, 7); // 'YYYY-MM'
      if (k in buckets) buckets[k] += e.payload?.commits?.length || 0;
    });
  return buckets;
}

/* ── Helpers ────────────────────────────────────────────────────── */
function isoDate(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/* ── Top repos for cards ────────────────────────────────────────── */
function topRepos(repos, limit = 6) {
  return [...repos]
    .filter(r => !r.fork)
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, limit);
}

/* ── Repo size bucketing ────────────────────────────────────────── */
function processRepoSizes(repos) {
  const buckets = { '< 1 KB': 0, '1–100 KB': 0, '100 KB–1 MB': 0, '1–10 MB': 0, '> 10 MB': 0 };
  repos.forEach(r => {
    const kb = r.size || 0;
    if      (kb < 1)     buckets['< 1 KB']++;
    else if (kb < 100)   buckets['1–100 KB']++;
    else if (kb < 1000)  buckets['100 KB–1 MB']++;
    else if (kb < 10000) buckets['1–10 MB']++;
    else                 buckets['> 10 MB']++;
  });
  return buckets;
}

/* ── Achievements ────────────────────────────────────────────────── */
function computeBadges(user, repos, eventStats, streak) {
  const { totalStars }   = processRepoStats(repos);
  const { longestStreak, currentStreak } = streak;
  const joinYear = new Date(user.created_at).getFullYear();

  const BADGES = [
    {
      id: 'star-collector',
      emoji: '🌟', name: 'Star Collector',
      desc: '100+ total stars earned',
      earned: totalStars >= 100,
    },
    {
      id: 'commit-streak',
      emoji: '🔥', name: 'Streak Master',
      desc: '30+ day commit streak',
      earned: longestStreak >= 30,
    },
    {
      id: 'open-sourcer',
      emoji: '🐙', name: 'Open Sourcer',
      desc: '10+ public repositories',
      earned: (user.public_repos || 0) >= 10,
    },
    {
      id: 'popular-dev',
      emoji: '👥', name: 'Popular Dev',
      desc: '100+ followers',
      earned: (user.followers || 0) >= 100,
    },
    {
      id: 'early-adopter',
      emoji: '🦋', name: 'Early Adopter',
      desc: 'Joined GitHub before 2020',
      earned: joinYear < 2020,
    },
    {
      id: 'prolific-coder',
      emoji: '💎', name: 'Prolific Coder',
      desc: '500+ recent commits',
      earned: eventStats.totalCommits >= 500,
    },
    {
      id: 'repo-creator',
      emoji: '🚀', name: 'Repo Creator',
      desc: '50+ repositories',
      earned: (user.public_repos || 0) >= 50,
    },
    {
      id: 'active-now',
      emoji: '⚡', name: 'On Fire',
      desc: '7+ day current streak',
      earned: currentStreak >= 7,
    },
    {
      id: 'mega-star',
      emoji: '💫', name: 'Mega Star',
      desc: '1000+ total stars',
      earned: totalStars >= 1000,
    },
    {
      id: 'pr-champion',
      emoji: '🤝', name: 'PR Champion',
      desc: '50+ pull requests',
      earned: eventStats.totalPRs >= 50,
    },
  ];

  /* Earned badges first, then locked */
  return BADGES.sort((a, b) => Number(b.earned) - Number(a.earned));
}
