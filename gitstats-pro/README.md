# GitStats Pro — GitHub Profile Analytics Dashboard

> **The most beautiful way to showcase your GitHub activity.**  
> Stars, streaks, heatmaps, charts, achievements — all in one shareable dashboard.

![GitStats Pro Preview](https://img.shields.io/badge/GitStats-Pro-238636?style=for-the-badge&logo=github)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## ✨ Features

### Free Tier
| Feature | Details |
|---------|---------|
| Profile section | Avatar, bio, location, company, join date, follower counts |
| 4 stat cards | Total stars · forks · repos · recent commits |
| Top 3 repositories | Stars, forks, language, last updated |

### Pro Tier (License Key)
| Feature | Details |
|---------|---------|
| All 8 stat cards | + Pull requests · issues · longest streak · current streak |
| 5 analytics charts | Languages donut · commit activity · stars bar · repo size · followers |
| Contribution heatmap | GitHub-style 52-week grid with tooltips |
| Achievement badges | 10 badges based on your real activity |
| Export as PNG | Download your entire dashboard as a 2× PNG |
| Share link | One-click URL with `?u=username` param |
| Copy summary | Text summary ready for Twitter / LinkedIn |

---

## 🚀 Quick Start (local)

```bash
# 1. Clone or download the repo
git clone https://github.com/YOUR_USERNAME/gitstats-pro.git
cd gitstats-pro

# 2. Open in browser — no build step needed
open index.html       # macOS
start index.html      # Windows
xdg-open index.html   # Linux

# Or spin up a local dev server (recommended for CORS)
npx serve .           # requires Node.js
# then visit http://localhost:3000
```

That's it. No npm install, no webpack, no backend.

---

## 🌐 Deploy on GitHub Pages (free)

1. Push this folder to a GitHub repository named `gitstats-pro`
2. Go to **Settings → Pages**
3. Source: **Deploy from a branch** → `main` / `(root)`
4. Click **Save** — your live URL will be:
   `https://YOUR_USERNAME.github.io/gitstats-pro/`

> **Custom domain:** Add a `CNAME` file with your domain, then configure DNS.

---

## 💳 Setting Up the License System

### 1 — Create your Gumroad product

1. Sign up at [gumroad.com](https://gumroad.com)
2. Create a **Digital Product** → name it "GitStats Pro"
3. Set price to **$24** (recommended)
4. Note your **product permalink** (e.g. `gitstats-pro`)

### 2 — Update the product ID

In [js/app.js](js/app.js) find `verifyGumroadKey` and replace:

```js
const PRODUCT_ID = 'gitstats-pro';   // ← your Gumroad permalink
```

### 3 — (Optional) CORS proxy for server-side validation

Gumroad's license API may reject browser requests due to CORS.  
Deploy this 10-line Cloudflare Worker to proxy the call:

```js
// worker.js — deploy at workers.cloudflare.com (free tier)
export default {
  async fetch(req) {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const body = await req.text();
    const ghRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await ghRes.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
```

Then in `app.js` replace the fetch URL with your worker URL.

### 4 — Demo key

The key `GITSTATS-PRO-DEMO-2024` always unlocks Pro locally — great for screenshots and demos. Remove or change it before your public launch.

---

## 📡 GitHub API Notes

| Endpoint | Used for |
|----------|---------|
| `GET /users/{username}` | Profile data |
| `GET /users/{username}/repos?per_page=100&sort=stars` | All repos |
| `GET /users/{username}/events?per_page=100&page=1..3` | Commit activity, streaks, heatmap |

**Rate limits (unauthenticated):** 60 requests/hour per IP.  
For higher limits, add a GitHub PAT to the `Authorization` header in `ghFetch()` in `github.js`:

```js
headers: {
  'Accept': 'application/vnd.github.v3+json',
  'Authorization': 'token YOUR_GITHUB_PAT',  // optional
},
```

> Note: The Events API retains ~90 days of activity (max 300 events). The heatmap and commit chart reflect this window, not the full year.

---

## 🗂 File Structure

```
gitstats-pro/
├── index.html        — Single-page app shell
├── css/
│   └── style.css     — All styles (dark + light theme, responsive)
├── js/
│   ├── utils.js      — Formatting, localStorage, clipboard, PNG export
│   ├── github.js     — GitHub API calls + data processing
│   ├── charts.js     — Chart.js 4 chart definitions
│   └── app.js        — Main controller (search, render, modals, pro)
├── .gitignore
└── README.md
```

---

## 🛠 Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| [Chart.js](https://www.chartjs.org/) | 4.4 | All charts (CDN) |
| [html2canvas](https://html2canvas.hertzen.com/) | 1.4 | PNG export (CDN) |
| [Font Awesome](https://fontawesome.com/) | 6.5 | Icons (CDN) |
| [Inter](https://rsms.me/inter/) | — | UI font (Google Fonts CDN) |
| GitHub REST API | v3 | Data source (no auth required) |

No build tools, no frameworks, no Node required.

---

## 📄 License

MIT — free for personal and commercial use with attribution.  
Pro features require a valid Gumroad license key.

---

## 🙌 Credits

- Data provided by the [GitHub REST API](https://docs.github.com/en/rest)
- Inspired by [github-readme-stats](https://github.com/anuraghazra/github-readme-stats)
- Built with ❤️ by the GitStats Pro team
