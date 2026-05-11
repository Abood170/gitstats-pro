/* ═══════════════════════════════════════════════════════════════════
   charts.js — Chart.js 4 wrappers
   All charts share a coherent dark/light-aware palette.
   ═══════════════════════════════════════════════════════════════════ */

/* Registry so we can destroy before re-creating on new searches */
const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

function destroyAllCharts() {
  Object.keys(_charts).forEach(destroyChart);
}

/* ── Theme helpers ──────────────────────────────────────────────── */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function chartDefaults() {
  return {
    textColor:   cssVar('--text-2'),
    gridColor:   cssVar('--border'),
    borderColor: cssVar('--border'),
    tooltipBg:   cssVar('--bg-3'),
    tooltipText: cssVar('--text'),
  };
}

/* Shared plugin config */
function sharedPlugins(title = '') {
  const t = chartDefaults();
  return {
    legend:  { display: false },
    tooltip: {
      backgroundColor: t.tooltipBg,
      titleColor:      t.tooltipText,
      bodyColor:       t.textColor,
      borderColor:     t.borderColor,
      borderWidth:     1,
      padding:         10,
      cornerRadius:    8,
    },
    title: title
      ? { display: true, text: title, color: t.textColor, font: { size: 12 } }
      : { display: false },
  };
}

/* Shared scale config */
function sharedScales(axis = 'xy') {
  const t = chartDefaults();
  const scaleOpts = {
    grid:  { color: t.gridColor, drawBorder: false },
    ticks: { color: t.textColor, font: { size: 11 } },
  };
  const scales = {};
  if (axis.includes('x')) scales.x = { ...scaleOpts };
  if (axis.includes('y')) scales.y = { ...scaleOpts };
  return scales;
}

/* ── 1. Languages — Donut ────────────────────────────────────────── */
function renderLanguagesChart(languages) {
  destroyChart('languages');
  const ctx = document.getElementById('chart-languages');
  if (!ctx || !languages.length) return;

  const labels = languages.map(l => l.name);
  const data   = languages.map(l => l.count);
  const colors = languages.map(l => l.color);

  _charts.languages = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor:     cssVar('--bg-2'),
        borderWidth:     3,
        hoverOffset:     8,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              '65%',
      plugins: {
        ...sharedPlugins(),
        tooltip: {
          ...sharedPlugins().tooltip,
          callbacks: {
            label: ctx =>
              ` ${ctx.label}: ${ctx.parsed} repo${ctx.parsed !== 1 ? 's' : ''}`,
          },
        },
      },
    },
  });

  /* Custom legend */
  const legend = document.getElementById('lang-legend');
  if (legend) {
    legend.innerHTML = languages.map(l =>
      `<span class="lang-legend-item">
        <span class="lang-dot" style="background:${l.color}"></span>
        ${l.name}
      </span>`
    ).join('');
  }
}

/* ── 2. Commit Activity — Line ───────────────────────────────────── */
function renderCommitChart(monthlyBuckets) {
  destroyChart('commits');
  const ctx = document.getElementById('chart-commits');
  if (!ctx) return;

  const t       = chartDefaults();
  const labels  = Object.keys(monthlyBuckets).map(k => {
    const [y, m] = k.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });
  const data    = Object.values(monthlyBuckets);
  const accent  = cssVar('--accent');

  _charts.commits = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Commits',
        data,
        borderColor:     accent,
        backgroundColor: accent.replace(')', ', .15)').replace('rgb', 'rgba'),
        borderWidth:     2,
        pointRadius:     3,
        pointHoverRadius:6,
        fill:            true,
        tension:         .35,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: sharedPlugins(),
      scales: {
        ...sharedScales(),
        y: {
          ...sharedScales().y,
          beginAtZero: true,
          ticks: {
            ...sharedScales().y.ticks,
            precision: 0,
          },
        },
      },
    },
  });
}

/* ── 3. Stars per Repo — Horizontal Bar ─────────────────────────── */
function renderStarsChart(repos) {
  destroyChart('stars');
  const ctx = document.getElementById('chart-stars');
  if (!ctx) return;

  const top  = [...repos]
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 10);

  const labels = top.map(r => r.name);
  const data   = top.map(r => r.stargazers_count || 0);

  const palette = [
    '#f6d365','#fda085','#f093fb','#f5576c','#4facfe',
    '#43e97b','#38f9d7','#a18cd1','#fbc2eb','#667eea',
  ];

  _charts.stars = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Stars',
        data,
        backgroundColor: data.map((_, i) => palette[i % palette.length] + 'cc'),
        borderColor:     data.map((_, i) => palette[i % palette.length]),
        borderWidth:     1,
        borderRadius:    5,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      indexAxis:           'y',
      plugins: sharedPlugins(),
      scales: {
        x: {
          ...sharedScales('x').x,
          beginAtZero: true,
          ticks: { ...sharedScales('x').x.ticks, precision: 0 },
        },
        y: {
          grid:  { display: false },
          ticks: { color: chartDefaults().textColor, font: { size: 11 } },
        },
      },
    },
  });
}

/* ── 4. Repo Size Distribution — Bar ────────────────────────────── */
function renderSizeChart(sizeBuckets) {
  destroyChart('size');
  const ctx = document.getElementById('chart-size');
  if (!ctx) return;

  const labels = Object.keys(sizeBuckets);
  const data   = Object.values(sizeBuckets);
  const blue   = cssVar('--blue');

  _charts.size = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Repos',
        data,
        backgroundColor: blue + '55',
        borderColor:     blue,
        borderWidth:     1,
        borderRadius:    6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: sharedPlugins(),
      scales: {
        ...sharedScales(),
        y: {
          ...sharedScales().y,
          beginAtZero: true,
          ticks: { ...sharedScales().y.ticks, precision: 0 },
        },
      },
    },
  });
}

/* ── 5. Followers Overview — Doughnut (simple) ───────────────────── */
function renderFollowersChart(user) {
  destroyChart('followers');
  const ctx = document.getElementById('chart-followers');
  if (!ctx) return;

  const followers = user.followers || 0;
  const following = user.following || 0;
  const empty     = Math.max(0, Math.max(followers, following) - Math.min(followers, following));

  _charts.followers = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   ['Followers', 'Following'],
      datasets: [{
        data:            [followers, following],
        backgroundColor: [cssVar('--accent') + 'cc', cssVar('--blue') + 'cc'],
        borderColor:     [cssVar('--accent'), cssVar('--blue')],
        borderWidth:     2,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              '60%',
      plugins: {
        ...sharedPlugins(),
        legend: {
          display:  true,
          position: 'bottom',
          labels: {
            color:      chartDefaults().textColor,
            boxWidth:   12,
            padding:    12,
            font:       { size: 12 },
          },
        },
        tooltip: {
          ...sharedPlugins().tooltip,
          callbacks: { label: c => ` ${c.label}: ${fmtNum(c.parsed)}` },
        },
      },
    },
  });
}

/* ── Render all charts at once ───────────────────────────────────── */
function renderAllCharts({ languages, monthlyCommits, repos, sizeBuckets, user }) {
  renderLanguagesChart(languages);
  renderCommitChart(monthlyCommits);
  renderStarsChart(repos);
  renderSizeChart(sizeBuckets);
  renderFollowersChart(user);
}
