"use client";

import { FormEvent, useState } from "react";

type Asset = { url: string; type: string; name: string; localPath: string; content?: string };
type PageItem = { url: string; name: string; localPath: string };
type ScanResult = {
  title: string;
  host: string;
  origin: string;
  pages: PageItem[];
  assets: Asset[];
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState("Ready to mirror website");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>("all");

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
      const hostName = result?.host || new URL(downloadTarget.startsWith("http") ? downloadTarget : `https://${downloadTarget}`).hostname;
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

  const counts =
    result?.assets.reduce<Record<string, number>>((acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {}) || {};

  const filteredAssets =
    result?.assets.filter((a) => {
      if (activeFilter === "all") return true;
      return a.type === activeFilter;
    }) || [];

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">
          <span className="brand-mark">↘</span> WebMirror
        </div>
        <span className="nav-note">Complete Site Downloader / Offline Archiver</span>
      </nav>

      <section className="hero">
        <p className="eyebrow">Local Website Mirror & Asset Downloader</p>
        <h1>Download any site with all files & folders.</h1>
        <p className="lede">
          Enter any website URL. WebMirror preserves the original folder structure, downloads all
          HTML, CSS, JavaScript, fonts, images, and media, and rewrites all links to 100% offline
          relative paths.
        </p>

        <form onSubmit={scan} className="scan-form">
          <div className="form-settings-row">
            <label htmlFor="url">Target Website URL</label>
            <div className="crawl-depth-select">
              <span>Crawl limit:</span>
              <select
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                disabled={loading || downloading}
              >
                <option value={0}>🌐 Full Site (All Pages - Unlimited)</option>
                <option value={1}>Single Page Only (Instant)</option>
                <option value={20}>Standard Site (Up to 20 pages)</option>
                <option value={50}>Large Site (Up to 50 pages)</option>
                <option value={150}>Deep Crawl (Up to 150 pages)</option>
                <option value={500}>Very Large Site (Up to 500 pages)</option>
                <option value={1500}>Massive Archive (Up to 1,500 pages)</option>
              </select>
            </div>
          </div>

          <div className="input-row">
            <input
              id="url"
              type="text"
              required
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading || downloading}
            />
            <button type="submit" disabled={loading || downloading}>
              {loading ? "Scanning..." : "Scan Site →"}
            </button>
            <button
              type="button"
              className="direct-dl-btn"
              onClick={() => download()}
              disabled={loading || downloading || !url.trim()}
              title="Crawl and download ZIP immediately"
            >
              {downloading ? "Downloading..." : "Download ZIP ↓"}
            </button>
          </div>
        </form>

        <div className="status-container">
          <p className="status">
            <span className={loading || downloading ? "pulse" : "status-dot"} />
            {status}
          </p>
          {(loading || downloading) && (
            <div className="download-progress-area" aria-live="polite">
              <div className="download-progress">
                <span style={{ width: `${downloadProgress}%` }} />
              </div>
              <small>{downloadProgress}%</small>
            </div>
          )}
        </div>
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inventory Overview</p>
            <h2>{result ? result.title || result.host : "Website Inventory"}</h2>
          </div>
          {result && (
            <button
              className="download"
              onClick={() => download()}
              disabled={downloading}
            >
              {downloading ? "Packaging ZIP..." : "Download Full ZIP"}
              <span>↓</span>
            </button>
          )}
        </div>

        {result ? (
          <>
            <div className="stats">
              <div>
                <strong>{result.pages.length}</strong>
                <span>HTML Pages</span>
              </div>
              <div>
                <strong>{counts.style || 0}</strong>
                <span>CSS Stylesheets</span>
              </div>
              <div>
                <strong>{counts.script || 0}</strong>
                <span>JS Scripts</span>
              </div>
              <div>
                <strong>{counts.font || 0}</strong>
                <span>Fonts</span>
              </div>
              <div>
                <strong>{counts.image || 0}</strong>
                <span>Images</span>
              </div>
              <div>
                <strong>{counts.file || 0}</strong>
                <span>Other Files</span>
              </div>
            </div>

            <div className="filter-tabs">
              <button
                className={activeFilter === "all" ? "active" : ""}
                onClick={() => setActiveFilter("all")}
              >
                All Files ({result.assets.length + result.pages.length})
              </button>
              <button
                className={activeFilter === "pages" ? "active" : ""}
                onClick={() => setActiveFilter("pages")}
              >
                Pages ({result.pages.length})
              </button>
              <button
                className={activeFilter === "style" ? "active" : ""}
                onClick={() => setActiveFilter("style")}
              >
                CSS ({counts.style || 0})
              </button>
              <button
                className={activeFilter === "script" ? "active" : ""}
                onClick={() => setActiveFilter("script")}
              >
                JS ({counts.script || 0})
              </button>
              <button
                className={activeFilter === "image" ? "active" : ""}
                onClick={() => setActiveFilter("image")}
              >
                Images ({counts.image || 0})
              </button>
              <button
                className={activeFilter === "font" ? "active" : ""}
                onClick={() => setActiveFilter("font")}
              >
                Fonts ({counts.font || 0})
              </button>
            </div>

            <div className="asset-list">
              {(activeFilter === "all" || activeFilter === "pages") && (
                <>
                  <p className="list-label">HTML Pages (Saved as exact relative paths)</p>
                  {result.pages.map((p) => (
                    <div className="asset" key={p.url}>
                      <span className="asset-icon html">&lt;/&gt;</span>
                      <div>
                        <strong>{p.localPath}</strong>
                        <small>Source URL: {p.url}</small>
                      </div>
                      <span className="file-state">Mirrored</span>
                    </div>
                  ))}
                </>
              )}

              {activeFilter !== "pages" && (
                <>
                  <p className="list-label">Assets & Resources</p>
                  {filteredAssets.slice(0, 100).map((a) => (
                    <div className="asset" key={`${a.type}-${a.localPath}-${a.url}`}>
                      <span className={`asset-icon ${a.type}`}>
                        {a.type === "image"
                          ? "🖼"
                          : a.type === "style"
                          ? "✦"
                          : a.type === "font"
                          ? "🔤"
                          : a.type === "script"
                          ? "⌘"
                          : "📄"}
                      </span>
                      <div>
                        <strong>{a.localPath}</strong>
                        <small>
                          {a.type.toUpperCase()} ·{" "}
                          {a.content ? "inline" : new URL(a.url).hostname}
                        </small>
                      </div>
                      {a.content ? (
                        <span className="file-state">Inline</span>
                      ) : (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open original asset URL"
                        >
                          ↗
                        </a>
                      )}
                    </div>
                  ))}
                  {filteredAssets.length > 100 && (
                    <p className="overflow-note">
                      ... and {filteredAssets.length - 100} more {activeFilter} files will be
                      included in the ZIP download.
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="empty">
            <span className="empty-mark">＋</span>
            <p>
              Enter a website URL above and click <strong>Scan Site</strong> or{" "}
              <strong>Download ZIP</strong> to mirror the full website locally.
            </p>
          </div>
        )}
      </section>

      <footer>
        WebMirror Website Archiver · All mirrored files preserve original directory paths and
        convert to local relative offline links.
      </footer>
    </main>
  );
}
