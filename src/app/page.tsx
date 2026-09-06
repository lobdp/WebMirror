"use client";

import { FormEvent, useState, useMemo } from "react";

type Asset = {
  url: string;
  type: string;
  name: string;
  localPath: string;
  content?: string;
};

type PageItem = {
  url: string;
  name: string;
  localPath: string;
};

type ScanResult = {
  title: string;
  host: string;
  origin: string;
  pages: PageItem[];
  assets: Asset[];
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(0); // 0 = Full Site / Unlimited
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState("Ready to mirror website");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  async function scan(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);
    setStatus("Scanning pages and discovering CSS, JS, fonts, images...");
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), maxPages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to scan this URL");
      setResult(data);
      setStatus(
        `Scan complete! Discovered ${data.pages?.length || 0} pages and ${data.assets?.length || 0} assets.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to scan website");
    } finally {
      setLoading(false);
    }
  }

  async function download(targetUrl?: string) {
    const downloadTarget = targetUrl || url;
    if (!downloadTarget.trim() || downloading) return;

    setDownloading(true);
    setDownloadProgress(5);
    setStatus("Preparing ZIP archive (fetching assets & rewriting relative paths)...");

    let fakeProg = 5;
    const interval = window.setInterval(() => {
      fakeProg = Math.min(88, fakeProg + Math.max(1, Math.ceil((88 - fakeProg) / 6)));
      setDownloadProgress(fakeProg);
    }, 600);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SiteScoop-Download": "1",
        },
        body: JSON.stringify({ url: downloadTarget.trim(), maxPages }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to create the ZIP archive");
      }

      window.clearInterval(interval);
      setStatus("Receiving ZIP archive from server...");
      setDownloadProgress(90);

      const total = Number(response.headers.get("content-length")) || 0;
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Browser could not receive archive stream");

      const parts: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        received += value.byteLength;
        if (total > 0) {
          const streamPercent = 90 + Math.round((received / total) * 10);
          setDownloadProgress(Math.min(99, streamPercent));
        }
      }

      const archive = new Uint8Array(received);
      let offset = 0;
      for (const part of parts) {
        archive.set(part, offset);
        offset += part.byteLength;
      }

      const blob = new Blob([archive.buffer], { type: "application/zip" });
      const dlLink = document.createElement("a");
      const hostName =
        result?.host ||
        new URL(downloadTarget.startsWith("http") ? downloadTarget : `https://${downloadTarget}`)
          .hostname;
      dlLink.href = URL.createObjectURL(blob);
      dlLink.download = `${hostName}-offline-site.zip`;
      document.body.appendChild(dlLink);
      dlLink.click();
      dlLink.remove();
      URL.revokeObjectURL(dlLink.href);

      setDownloadProgress(100);
      setStatus("ZIP download complete! Extract the ZIP and open index.html.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Download failed");
    } finally {
      window.clearInterval(interval);
      setDownloading(false);
    }
  }

  const counts = useMemo(() => {
    return (
      result?.assets.reduce<Record<string, number>>((acc, asset) => {
        acc[asset.type] = (acc[asset.type] || 0) + 1;
        return acc;
      }, {}) || {}
    );
  }, [result]);

  const filteredAssets = useMemo(() => {
    if (!result) return [];
    return result.assets.filter((a) => {
      const matchesFilter = activeFilter === "all" || a.type === activeFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        a.localPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.url.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [result, activeFilter, searchQuery]);

  const filteredPages = useMemo(() => {
    if (!result) return [];
    return result.pages.filter((p) => {
      return (
        !searchQuery.trim() ||
        p.localPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.url.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [result, searchQuery]);

  return (
    <div className="app-container">
      {/* Background ambient lighting effects */}
      <div className="ambient-orb orb-emerald" />
      <div className="ambient-orb orb-indigo" />
      <div className="grid-overlay" />

      {/* Navigation Header */}
      <header className="navbar">
        <div className="nav-shell">
          <div className="brand-group">
            <div className="brand-badge">
              <span className="brand-arrow">↘</span>
            </div>
            <div className="brand-text">
              <span className="brand-title">WebMirror</span>
              <span className="brand-tag">v2.2 Pro</span>
            </div>
          </div>

          <div className="nav-actions">
            <a
              href="https://github.com/lobdp/WebMirror"
              target="_blank"
              rel="noreferrer"
              className="nav-link"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </a>
            <a
              href="https://www.linkedin.com/in/lobdas/"
              target="_blank"
              rel="noreferrer"
              className="nav-btn-creator"
            >
              <span>Creator Profile</span>
              <span className="creator-dot" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="main-content">
        <section className="hero-section">
          <div className="hero-badge">
            <span className="badge-pulse" />
            <span>Universal Recursive Offline Mirror</span>
          </div>

          <h1 className="hero-headline">
            Mirror Any Website.
            <br />
            <span className="gradient-text">Complete. Offline. Flawless.</span>
          </h1>

          <p className="hero-subtext">
            Preserve exact folder structures, recursively extract CSS, fonts, scripts, and media,
            and rewrite all links into 100% offline relative paths with zero broken assets.
          </p>

          {/* Interactive Console Card */}
          <div className="console-card">
            <form onSubmit={scan} className="console-form">
              <div className="console-row-top">
                <div className="input-label-group">
                  <span className="icon-globe">🌐</span>
                  <label htmlFor="url">Target Website URL</label>
                </div>

                <div className="crawl-depth-box">
                  <label htmlFor="maxPages">Crawl Scope:</label>
                  <select
                    id="maxPages"
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    disabled={loading || downloading}
                    className="depth-select"
                  >
                    <option value={0}>🌐 Full Site (All Pages - Unlimited)</option>
                    <option value={1}>⚡ Single Page Only (Instant)</option>
                    <option value={20}>📄 Standard Site (Up to 20 pages)</option>
                    <option value={50}>🏢 Large Site (Up to 50 pages)</option>
                    <option value={150}>📚 Deep Crawl (Up to 150 pages)</option>
                    <option value={500}>📦 Very Large Site (Up to 500 pages)</option>
                    <option value={1500}>🏛️ Massive Archive (Up to 1,500 pages)</option>
                  </select>
                </div>
              </div>

              <div className="console-input-bar">
                <div className="url-input-wrapper">
                  <input
                    id="url"
                    type="text"
                    required
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loading || downloading}
                    className="url-input"
                  />
                  {url && (
                    <button
                      type="button"
                      onClick={() => setUrl("")}
                      className="clear-input-btn"
                      title="Clear URL"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="button-cluster">
                  <button
                    type="submit"
                    disabled={loading || downloading || !url.trim()}
                    className="btn-scan"
                  >
                    {loading ? (
                      <>
                        <span className="spinner-icon" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <span>Scan Site</span>
                        <span className="btn-arrow">→</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => download()}
                    disabled={loading || downloading || !url.trim()}
                    className="btn-download-primary"
                  >
                    {downloading ? (
                      <>
                        <span className="spinner-icon" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <span>Download ZIP</span>
                        <span className="btn-icon-dl">↓</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Telemetry Status Bar */}
            <div className="telemetry-bar">
              <div className="telemetry-left">
                <span className={loading || downloading ? "telemetry-dot pulse-emerald" : "telemetry-dot dot-idle"} />
                <span className="telemetry-status">{status}</span>
              </div>

              {(loading || downloading) && (
                <div className="telemetry-right">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <span className="progress-percent">{downloadProgress}%</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Workspace & Results Section */}
        {result ? (
          <section className="results-section">
            <div className="results-header">
              <div>
                <span className="results-eyebrow">Archived Inventory</span>
                <h2 className="results-title">{result.title || result.host}</h2>
                <p className="results-origin">Target Origin: <code>{result.origin}</code></p>
              </div>

              <button
                onClick={() => download()}
                disabled={downloading}
                className="btn-download-action"
              >
                <span>Download Complete Offline ZIP</span>
                <span className="dl-arrow">↓</span>
              </button>
            </div>

            {/* Stats Dashboard Grid */}
            <div className="stats-dashboard">
              <div className="stat-card">
                <div className="stat-icon icon-html">&lt;/&gt;</div>
                <div className="stat-info">
                  <span className="stat-value">{result.pages.length}</span>
                  <span className="stat-label">HTML Pages</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon icon-css">✦</div>
                <div className="stat-info">
                  <span className="stat-value">{counts.style || 0}</span>
                  <span className="stat-label">CSS Stylesheets</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon icon-js">⌘</div>
                <div className="stat-info">
                  <span className="stat-value">{counts.script || 0}</span>
                  <span className="stat-label">JavaScript</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon icon-font">🔤</div>
                <div className="stat-info">
                  <span className="stat-value">{counts.font || 0}</span>
                  <span className="stat-label">Web Fonts</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon icon-img">🖼</div>
                <div className="stat-info">
                  <span className="stat-value">{counts.image || 0}</span>
                  <span className="stat-label">Images & Media</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon icon-total">📦</div>
                <div className="stat-info">
                  <span className="stat-value">{result.assets.length + result.pages.length}</span>
                  <span className="stat-label">Total Assets</span>
                </div>
              </div>
            </div>

            {/* Interactive File Inspector */}
            <div className="inspector-panel">
              <div className="inspector-toolbar">
                <div className="filter-pills">
                  <button
                    className={activeFilter === "all" ? "pill active" : "pill"}
                    onClick={() => setActiveFilter("all")}
                  >
                    All Files ({result.assets.length + result.pages.length})
                  </button>
                  <button
                    className={activeFilter === "pages" ? "pill active" : "pill"}
                    onClick={() => setActiveFilter("pages")}
                  >
                    Pages ({result.pages.length})
                  </button>
                  <button
                    className={activeFilter === "style" ? "pill active" : "pill"}
                    onClick={() => setActiveFilter("style")}
                  >
                    CSS ({counts.style || 0})
                  </button>
                  <button
                    className={activeFilter === "script" ? "pill active" : "pill"}
                    onClick={() => setActiveFilter("script")}
                  >
                    JS ({counts.script || 0})
                  </button>
                  <button
                    className={activeFilter === "image" ? "pill active" : "pill"}
                    onClick={() => setActiveFilter("image")}
                  >
                    Images ({counts.image || 0})
                  </button>
                  <button
                    className={activeFilter === "font" ? "pill active" : "pill"}
                    onClick={() => setActiveFilter("font")}
                  >
                    Fonts ({counts.font || 0})
                  </button>
                </div>

                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search paths or files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="search-clear"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="file-list">
                {(activeFilter === "all" || activeFilter === "pages") && (
                  <>
                    <div className="list-category-title">
                      <span>HTML Pages (Rewritten with offline relative paths)</span>
                      <span className="count-badge">{filteredPages.length}</span>
                    </div>
                    {filteredPages.map((p) => (
                      <div className="file-row" key={p.url}>
                        <div className="file-type-tag tag-html">&lt;/&gt;</div>
                        <div className="file-details">
                          <strong className="file-path">{p.localPath}</strong>
                          <span className="file-url">Source: {p.url}</span>
                        </div>
                        <span className="badge-mirrored">Mirrored</span>
                      </div>
                    ))}
                  </>
                )}

                {activeFilter !== "pages" && (
                  <>
                    <div className="list-category-title">
                      <span>Assets & Resources</span>
                      <span className="count-badge">{filteredAssets.length}</span>
                    </div>
                    {filteredAssets.slice(0, 150).map((a) => (
                      <div className="file-row" key={`${a.type}-${a.localPath}-${a.url}`}>
                        <div className={`file-type-tag tag-${a.type}`}>
                          {a.type === "image"
                            ? "IMG"
                            : a.type === "style"
                            ? "CSS"
                            : a.type === "script"
                            ? "JS"
                            : a.type === "font"
                            ? "FNT"
                            : "FILE"}
                        </div>
                        <div className="file-details">
                          <strong className="file-path">{a.localPath}</strong>
                          <span className="file-url">
                            {a.type.toUpperCase()} · {a.content ? "Inline code" : a.url}
                          </span>
                        </div>
                        {a.content ? (
                          <span className="badge-inline">Inline</span>
                        ) : (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="file-external-link"
                            title="Inspect remote asset"
                          >
                            ↗
                          </a>
                        )}
                      </div>
                    ))}
                    {filteredAssets.length > 150 && (
                      <div className="list-overflow-banner">
                        <span>
                          ... and <strong>{filteredAssets.length - 150}</strong> more {activeFilter} files will be included in the offline ZIP archive.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        ) : (
          /* Empty / Feature Showcase */
          <section className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-badge">📁</div>
              <h3>Exact Folder Preservation</h3>
              <p>
                Retains the server&apos;s exact URL pathname hierarchy. Assets are stored under
                their authentic folders like <code>assets/css/</code> and <code>assets/img/</code>.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-badge">🔗</div>
              <h3>100% Relative Offline Rewriting</h3>
              <p>
                Mathematically maps <code>../</code> relative paths for every page depth. Zero
                remote requests remain, enabling standalone <code>file:///</code> browsing.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-badge">🔤</div>
              <h3>Deep CSS & Font Scraping</h3>
              <p>
                Recursively analyzes stylesheets for <code>@import</code>, <code>@font-face</code>,
                and background images to capture full visual fidelity.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-badge">🛡️</div>
              <h3>Self-Healing Placeholders</h3>
              <p>
                Automatically injects transparent placeholders for broken 404 remote images and
                bypasses JavaScript preloader spinners offline.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Premium Footer with Creator Link */}
      <footer className="footer">
        <div className="footer-shell">
          <div className="footer-left">
            <div className="footer-brand">
              <span className="footer-mark">↘</span>
              <strong>WebMirror</strong>
            </div>
            <p className="footer-desc">
              Universal website archiver and offline asset mirror. Preserves authentic folder
              structures with 100% relative offline paths.
            </p>
          </div>

          <div className="footer-right">
            <div className="creator-card">
              <span className="creator-label">Created with ❤️ by</span>
              <a
                href="https://www.linkedin.com/in/lobdas/"
                target="_blank"
                rel="noreferrer"
                className="creator-link"
              >
                <div className="creator-avatar">LD</div>
                <div className="creator-info">
                  <span className="creator-name">Lob Das</span>
                  <span className="creator-title">Connect on LinkedIn ↗</span>
                </div>
              </a>
            </div>

            <div className="footer-meta">
              <a
                href="https://github.com/lobdp/WebMirror"
                target="_blank"
                rel="noreferrer"
                className="footer-repo-link"
              >
                GitHub Repository
              </a>
              <span className="meta-separator">•</span>
              <span>MIT Licensed</span>
              <span className="meta-separator">•</span>
              <span>100% Offline Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
