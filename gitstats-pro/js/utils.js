/* ═══════════════════════════════════════════════════════════════════
   utils.js — formatting helpers, localStorage, clipboard, export
   ═══════════════════════════════════════════════════════════════════ */

/* ── Number Formatting ─────────────────────────────────────────── */
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  n = Number(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
}

/* ── Date Formatting ───────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  const months= Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (mins   < 1)   return 'just now';
  if (mins   < 60)  return `${mins}m ago`;
  if (hours  < 24)  return `${hours}h ago`;
  if (days   < 30)  return `${days}d ago`;
  if (months < 12)  return `${months}mo ago`;
  return `${years}y ago`;
}

/* ── GitHub language colour map ────────────────────────────────── */
const LANG_COLORS = {
  JavaScript:  '#f1e05a', TypeScript:  '#3178c6', Python:      '#3572A5',
  Java:        '#b07219', Go:          '#00ADD8', Rust:        '#dea584',
  'C++':       '#f34b7d', C:           '#555555', 'C#':        '#178600',
  Ruby:        '#701516', PHP:         '#4F5D95', Swift:       '#F05138',
  Kotlin:      '#A97BFF', Dart:        '#00B4AB', Scala:       '#c22d40',
  Shell:       '#89e051', PowerShell:  '#012456', HTML:        '#e34c26',
  CSS:         '#563d7c', SCSS:        '#c6538c', Vue:         '#41b883',
  Svelte:      '#ff3e00', Elixir:      '#6e4a7e', Haskell:     '#5e5086',
  Lua:         '#000080', R:           '#198CE7', MATLAB:      '#e16737',
  Vim:         '#199f4b', Dockerfile:  '#384d54', Makefile:    '#427819',
  Assembly:    '#6E4C13', Nix:         '#7e7eff', Clojure:     '#db5855',
  Erlang:      '#B83998', OCaml:       '#3be133', Perl:        '#0298c3',
  ObjectiveC:  '#438eff', CoffeeScript:'#244776', 'F#':        '#b845fc',
};

function langColor(lang) {
  return LANG_COLORS[lang] || '#8b949e';
}

/* ── Recent Searches (localStorage) ───────────────────────────── */
const LS_RECENT = 'gitstats_recent';
const MAX_RECENT = 8;

function saveRecent(username) {
  if (!username) return;
  let list = getRecent();
  list = list.filter(u => u.toLowerCase() !== username.toLowerCase());
  list.unshift(username);
  list = list.slice(0, MAX_RECENT);
  try { localStorage.setItem(LS_RECENT, JSON.stringify(list)); } catch (_) {}
}

function getRecent() {
  try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); } catch (_) { return []; }
}

function clearRecent() {
  try { localStorage.removeItem(LS_RECENT); } catch (_) {}
}

/* ── Pro Licence (localStorage) ────────────────────────────────── */
const LS_PRO_KEY   = 'gitstats_pro_key';
const LS_PRO_EMAIL = 'gitstats_pro_email';
const DEMO_KEY     = 'GITSTATS-PRO-DEMO-2024';

function isPro() {
  try { return !!localStorage.getItem(LS_PRO_KEY); } catch (_) { return false; }
}

function savePro(key, email) {
  try {
    localStorage.setItem(LS_PRO_KEY, key);
    if (email) localStorage.setItem(LS_PRO_EMAIL, email);
  } catch (_) {}
}

function clearPro() {
  try {
    localStorage.removeItem(LS_PRO_KEY);
    localStorage.removeItem(LS_PRO_EMAIL);
  } catch (_) {}
}

/* ── Clipboard ─────────────────────────────────────────────────── */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    /* fallback */
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  } catch (_) { return false; }
}

/* ── Toast notifications ────────────────────────────────────────── */
let _toastTimer = null;

function showToast(message, type = 'info', duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;

  el.className = `toast toast-${type}`;
  el.innerHTML = `${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}`;
  el.classList.remove('hidden');

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.classList.add('hidden'); }, duration);
}

/* ── Share URL ──────────────────────────────────────────────────── */
function buildShareURL(username) {
  const base = window.location.href.split('?')[0];
  return `${base}?u=${encodeURIComponent(username)}`;
}

/* ── Export as PNG via html2canvas ─────────────────────────────── */
async function exportDashboardPNG(username) {
  const content = document.getElementById('dashboard-content');
  if (!content || typeof html2canvas === 'undefined') {
    showToast('Export library not loaded, try again.', 'error');
    return;
  }

  showToast('Generating PNG…', 'info', 6000);

  try {
    const canvas = await html2canvas(content, {
      backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0d1117',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      ignoreElements: el =>
        el.classList.contains('section-lock-overlay') ||
        el.classList.contains('pro-lock-overlay')     ||
        el.id === 'export-section',
    });

    const link = document.createElement('a');
    link.download = `gitstats-${username}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('PNG downloaded!', 'success');
  } catch (e) {
    console.error('Export error:', e);
    showToast('Export failed. Try a smaller window.', 'error');
  }
}

/* ── Copy text summary ──────────────────────────────────────────── */
async function copyStatsSummary(data) {
  const { username, totalStars, currentStreak, totalRepos } = data;
  const text =
    `🐙 GitStats Pro | @${username} | ⭐ ${fmtNum(totalStars)} stars | ` +
    `🔥 ${currentStreak} day streak | 📦 ${fmtNum(totalRepos)} repos | ` +
    `gitstats-pro.github.io`;
  const ok = await copyToClipboard(text);
  if (ok) showToast('Stats summary copied!', 'success');
  else    showToast('Could not copy — try manually.', 'error');
}
