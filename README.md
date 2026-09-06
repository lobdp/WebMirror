# ↘ WebMirror

> **Complete Website Archiver & Offline Asset Mirror**  
> Download any public website with its entire folder and file structure intact, rewriting all links, styles, scripts, fonts, and images into 100% offline relative paths.

---

## 🌟 Key Features

- **Exact Directory & Path Preservation**:
  - Mirrored directly from the target site's URL structure (`assets/css/...`, `assets/js/...`, `assets/img/...`, `about/index.html`).
  - No messy arbitrary folder renaming or broken hierarchy.
- **100% Offline Relative Path Rewriting**:
  - Rewrites all internal links, anchors, stylesheets, scripts, fonts, media, and images to mathematically computed relative paths (`../`, `../../`).
  - Zero remaining remote live-domain references. Opens directly from your local filesystem via `file:///` without an active web server.
- **Recursive Asset Discovery**:
  - Deep CSS parsing: extracts `@import`, `@font-face` (woff2, woff, ttf), and background images.
  - Full HTML asset scraping: `<link>`, `<script>`, `<img>`, `<picture>`, `<source>`, `<video>`, `<audio>`, `srcset`, `data-src`, inline styles, and SVG references.
- **Full Site / Deep Crawling Support**:
  - Built-in sitemap parser (`/sitemap.xml`, `/sitemap_index.xml`) and recursive link crawler.
  - Flexible crawl limit options: Single Page, Standard Site, Large Site, or **Full Site (Unlimited)**.
- **Fast Concurrent Processing & Caching**:
  - High-speed concurrent queue with per-asset retry and browser emulation headers.
  - In-memory scan cache prevents redundant re-crawls during packaging.
- **Fallback Placeholders**:
  - Remote 404 images automatically receive lightweight transparent placeholders to prevent broken image icons on offline viewing.
- **Offline Preloader Bypass**:
  - Injected script ensures offline sites never hang indefinitely on JS loading spinners.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.18 or higher)
- npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/lobdp/WebMirror.git
cd WebMirror
npm install
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Usage

1. Enter any public website URL (e.g. `https://example.com`).
2. Choose your crawl depth or select **Full Site (All Pages - Unlimited)**.
3. Click **Scan Site** to inspect the file inventory, or click **Download ZIP ↓** to directly download the complete offline archive.
4. Extract the downloaded ZIP file and double-click `index.html` to browse the entire website offline.

---

## 🏗️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **HTML/CSS Parsing**: [Cheerio](https://cheerio.js.org/)
- **Archive Generation**: [JSZip](https://stuk.github.io/jszip/)
- **Styling**: Vanilla CSS & TailwindCSS

---

## 📄 License

MIT License. Free to use for personal and commercial projects.
