<div align="center">

# 🌐 WebMirror

### The Ultimate Website Mirroring & Offline Asset Archiver

[![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<p align="center">
  <b>Download entire websites with their exact directory hierarchy preserved and all assets rewritten to 100% offline relative paths.</b>
  <br />
  <i>No broken styles. No missing fonts. Zero remaining live-domain requests. Instant local browsing via <code>file:///</code>.</i>
</p>

---

[Key Features](#-key-features) •
[Why WebMirror?](#-why-webmirror-vs-others) •
[How It Works](#-how-it-works) •
[Quick Start](#-quick-start) •
[Crawl Depth Controls](#-crawl-depth-controls) •
[Tech Stack](#-tech-stack)

</div>

<br />

---

## 💡 Why WebMirror vs. Others?

Most website copiers (like legacy `wget`, `HTTrack`, or basic scraper scripts) produce broken offline copies because modern web apps use dynamic CSS `url()` fonts, CDNs, `srcset`, lazy-loaded images, and JavaScript loaders that freeze offline. **WebMirror was built from the ground up to solve all of these problems.**

| Feature | Legacy Copiers (`wget`, `HTTrack`) | Basic Browser Extensions | ⚡ WebMirror |
| :--- | :---: | :---: | :---: |
| **Directory Preservation** | Cluttered / Mangled | Flat / Single folder | **Exact Mirror of Original Paths** |
| **Recursive CSS & Font Scraping** | Often misses `@font-face` / `@import` | Misses fonts & SVGs | **Recursive Deep Extraction** |
| **Offline Relative Rewriting** | Hardcoded or broken | Often stays absolute | **Mathematically Computed `../` Levels** |
| **CDN & External Asset Archiving** | Leaves live CDN links | Blocks external calls | **Mirrored under `external/<domain>/...`** |
| **Zero Lingering Remote Links** | ❌ (leaves many live URLs) | ❌ | **100% Zero Live Links Remaining** |
| **Missing Image Protection** | Ugly broken image boxes | Broken icons | **Automated Clean Fallback Placeholders** |
| **Preloader Spinner Freeze** | Stuck on spinner forever | Often fails | **Auto-Dismiss Offline Script Injected** |
| **Speed & Concurrency** | Slow single-thread | Browser tab heavy | **High-speed 14x Concurrent Engine** |

---

## ✨ Key Features

### 🗂️ 1. True Hierarchy & Directory Preservation
WebMirror analyzes the original server's URL pathnames and mirrors them directly on your disk:
- `https://example.com/assets/css/main.css` ➔ `assets/css/main.css`
- `https://example.com/assets/img/logo/brand.png` ➔ `assets/img/logo/brand.png`
- `https://example.com/assets/fonts/font.woff2` ➔ `assets/fonts/font.woff2`
- `https://example.com/products/item-42` ➔ `products/item-42/index.html`

### 🔗 2. Intelligent Offline Relative Path Rewriter
Every single reference in every HTML and CSS file is converted to point to its corresponding local file based on directory depth:
- In `index.html`: `assets/css/main.css`
- In `products/index.html`: `../assets/css/main.css`
- In `products/category/item/index.html`: `../../../assets/css/main.css`
- In `assets/css/main.css`: `../fonts/font.woff2`

### 🎨 3. Deep Recursive Asset & Font Extraction
- **CSS Dependencies**: Automatically scans `@import url(...)`, `@font-face { src: url(...) }`, `background-image: url(...)`, and cursor/mask URLs recursively.
- **HTML Tags**: Extracts `link[href]`, `script[src]`, `img[src]`, `picture`, `source[srcset]`, `video[src/poster]`, `audio[src]`, and SVG `<use xlink:href>`.
- **Lazy Load Attributes**: Automatically discovers `data-src`, `data-lazy-src`, `data-original`, `data-bg`, and `data-srcset`.

### 🛡️ 4. Offline Resilience & Self-Healing
- **Broken Image Protection**: If a remote server returns `404 Not Found` for an asset, WebMirror provides a transparent placeholder buffer so your offline pages never show broken image icons.
- **Offline Preloader Bypass**: Modern sites often freeze on loading spinners offline because analytics or tracking scripts are blocked. WebMirror injects a micro-script that auto-dismisses preloaders once the DOM is ready.

### 🌐 5. Full Site Deep Crawling & Sitemap Integration
- Automatically checks `/sitemap.xml` and `/sitemap_index.xml` to discover all pages immediately.
- Crawls internal pages concurrently, filtering out external domains, auth routes, and anchor fragments.

### ⚡ 6. Instant ZIP Packaging & Smart Caching
- An in-memory cache saves discovered assets after scanning. Clicking **Download ZIP** reuses the scan results instantly—no redundant crawling!

---

## 🔄 How It Works

```
 ┌─────────────────┐
 │ Input Site URL  │ ➔ Validate & emulate modern browser headers
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ Sitemap & Crawl │ ➔ Concurrently crawl internal pages & build link graph
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ Deep CSS & Font │ ➔ Recursively parse stylesheets for fonts, icons & bg images
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ Concurrent Down │ ➔ Download all assets in parallel (14x concurrency + retries)
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ Relative Rewrite│ ➔ Convert all URLs to local relative paths (zero remote links)
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ ZIP Generation  │ ➔ Stream compressed offline-ready ZIP archive
 └─────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.18 or higher recommended)
- `npm`, `pnpm`, or `yarn`

### 1. Clone the Repository
```bash
git clone https://github.com/lobdp/WebMirror.git
cd WebMirror
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build
```bash
npm run build
npm run start
```

---

## ⚙️ Crawl Depth Controls

Select the crawl depth that matches your needs:

| Option | Depth / Page Cap | Best Used For |
| :--- | :---: | :--- |
| **🌐 Full Site (All Pages - Unlimited)** | **Up to 5,000 pages** | **Complete archives of blogs, portfolios & e-commerce sites** |
| **Single Page Only (Instant)** | 1 Page | Landing pages, single-page promotional sites |
| **Standard Site** | Up to 20 pages | Small corporate websites, basic portfolios |
| **Large Site** | Up to 50 pages | Company sites with service catalogues |
| **Deep Crawl** | Up to 150 pages | Content-heavy publications and news sites |
| **Very Large Site** | Up to 500 pages | Product stores and documentation hubs |
| **Massive Archive** | Up to 1,500 pages | Complete library or documentation repositories |

---

## 💻 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI & Styling**: Vanilla CSS Design System with [TailwindCSS v4](https://tailwindcss.com/)
- **HTML Engine**: [Cheerio](https://cheerio.js.org/)
- **Archiving Engine**: [JSZip](https://stuk.github.io/jszip/)

---

## 📂 Output Folder Structure

When you unzip the downloaded archive, your website will be ready to open locally:

```
my-site-offline-site/
├── index.html              <-- Main homepage (double-click to open!)
├── about/
│   └── index.html          <-- Clean relative subpage
├── products/
│   ├── index.html
│   └── item-1/
│       └── index.html
├── assets/
│   ├── css/
│   │   ├── bootstrap.min.css
│   │   └── main.css
│   ├── js/
│   │   ├── jquery.min.js
│   │   └── main.js
│   ├── img/
│   │   ├── logo/
│   │   └── banner.jpg
│   └── fonts/
│       └── font.woff2
├── external/               <-- External CDN libraries mirrored locally
│   └── code.jquery.com/
├── DOWNLOAD-REPORT.txt     <-- Complete audit report of all mirrored assets
└── README.txt              <-- Offline instructions
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/lobdp/WebMirror/issues).

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built with ❤️ by <a href="https://www.linkedin.com/in/lobdas/" target="_blank">lobdp</a>. Star ⭐ this repository if you found it useful!</sub>
</div>
