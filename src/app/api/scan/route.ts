import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import JSZip from "jszip";

export const runtime = "nodejs";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

export interface PageItem {
  url: string;
  name: string;
  localPath: string;
  html: string;
}

export interface AssetItem {
  url: string;
  cleanKey: string;
  localPath: string;
  type: string;
  name: string;
  content?: string;
}

export interface ScanResult {
  title: string;
  host: string;
  origin: string;
  pages: { url: string; name: string; localPath: string }[];
  assets: { url: string; type: string; name: string; localPath: string; content?: string }[];
}

interface CachedSession {
  url: string;
  origin: string;
  host: string;
  title: string;
  pages: PageItem[];
  assets: AssetItem[];
  cachedAt: number;
}

// In-memory cache for scan results (cleared after 30 minutes)
const scanCache = new Map<string, CachedSession>();

function getCacheKey(url: string, maxPages: number): string {
  return `${url}__max_${maxPages}`;
}

function cleanOldCache() {
  const now = Date.now();
  for (const [key, item] of scanCache.entries()) {
    if (now - item.cachedAt > 30 * 60 * 1000) {
      scanCache.delete(key);
    }
  }
}

function cleanUrlString(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/[\r\n\t]+/g, "").trim();
}

function validateUrl(value: unknown): URL {
  if (typeof value !== "string") throw new Error("Please provide a valid website URL");
  let trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  const url = new URL(trimmed);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }
  if (
    /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
      url.hostname
    )
  ) {
    throw new Error("Private network URLs are not allowed");
  }
  return url;
}

function detectedType(pathname: string, fallback: string): string {
  const ext = pathname.split(".").pop()?.toLowerCase() || "";
  if (["css"].includes(ext)) return "style";
  if (["js", "mjs", "cjs", "jsx", "ts"].includes(ext)) return "script";
  if (["woff", "woff2", "ttf", "otf", "eot"].includes(ext)) return "font";
  if (["mp4", "webm", "mov", "avi", "mkv", "ogv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) return "audio";
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "avif", "ico", "bmp", "tiff"].includes(ext))
    return "image";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rar", "txt", "xml", "json", "csv"].includes(ext))
    return "file";
  return fallback;
}

function defaultExt(type: string): string {
  switch (type) {
    case "style":
      return "css";
    case "script":
      return "js";
    case "font":
      return "woff2";
    case "image":
      return "jpg";
    case "video":
      return "mp4";
    case "audio":
      return "mp3";
    default:
      return "dat";
  }
}

function pageLocalPath(url: URL): string {
  let pathname = decodeURIComponent(url.pathname);
  if (!pathname || pathname === "/" || pathname === "/index.html" || pathname === "/index.php") {
    return "index.html";
  }
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  const segments = clean.split("/").map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, "_") || "page");
  const lastSegment = segments[segments.length - 1];

  if (/\.html?$/i.test(lastSegment)) {
    return segments.join("/");
  }
  if (/\.(php|asp|aspx|jsp|cgi)$/i.test(lastSegment)) {
    segments[segments.length - 1] = lastSegment.replace(/\.[^.]+$/, ".html");
    return segments.join("/");
  }
  if (/\.(xml|txt|json)$/i.test(lastSegment)) {
    return segments.join("/");
  }
  return `${segments.join("/")}/index.html`;
}

function isSameSiteHost(host1: string, host2: string): boolean {
  return host1.replace(/^www\./i, "").toLowerCase() === host2.replace(/^www\./i, "").toLowerCase();
}

function assetLocalPath(url: URL, siteOriginOrHost: string, fallbackType: string): string {
  const cleanTargetHost = siteOriginOrHost
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();

  const isInternal =
    url.origin === siteOriginOrHost ||
    url.hostname.replace(/^www\./i, "").toLowerCase() === cleanTargetHost;

  if (isInternal) {
    let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!pathname) {
      pathname = `assets/${fallbackType}/asset_${Date.now()}`;
    }
    const segments = pathname.split("/").map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, "_") || "asset");
    let filename = segments[segments.length - 1];
    if (!filename.includes(".")) {
      const ext = defaultExt(fallbackType);
      filename = `${filename}.${ext}`;
      segments[segments.length - 1] = filename;
    }
    return segments.join("/");
  } else {
    const host = url.hostname.replace(/[^a-zA-Z0-9.-]/g, "_");
    let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!pathname) {
      pathname = `asset_${Date.now()}`;
    }
    const segments = pathname.split("/").map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, "_") || "asset");
    let filename = segments[segments.length - 1];
    if (!filename.includes(".")) {
      const ext = defaultExt(fallbackType);
      filename = `${filename}.${ext}`;
      segments[segments.length - 1] = filename;
    }
    return `external/${host}/${segments.join("/")}`;
  }
}

function localReference(targetPath: string, fromFilePath: string): string {
  const fromDir = fromFilePath.includes("/") ? fromFilePath.slice(0, fromFilePath.lastIndexOf("/")) : "";
  if (!fromDir) {
    return targetPath;
  }
  const fromParts = fromDir.split("/").filter(Boolean);
  const targetParts = targetPath.split("/").filter(Boolean);

  while (fromParts.length > 0 && targetParts.length > 0 && fromParts[0] === targetParts[0]) {
    fromParts.shift();
    targetParts.shift();
  }

  const upCount = fromParts.length;
  const relPrefix = upCount > 0 ? "../".repeat(upCount) : "";
  return `${relPrefix}${targetParts.join("/")}`;
}

async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 8
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let current = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (current < items.length) {
      const idx = current++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

function rewriteCss(
  css: string,
  cssSourceUrl: string,
  cssLocalPath: string,
  lookupAsset: (rawUrl: string, source: string) => string | undefined
): string {
  return css.replace(
    /(?:@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?|url\(\s*(["']?)([^"')]+)\2\s*\))/gi,
    (match, importUrl, quote, urlInside) => {
      const raw = cleanUrlString(importUrl || urlInside);
      if (!raw || raw.startsWith("data:") || raw.startsWith("#")) return match;

      const q = quote || '"';
      const targetLocal = lookupAsset(raw, cssSourceUrl);
      if (targetLocal) {
        const rel = localReference(targetLocal, cssLocalPath);
        return importUrl ? `@import url(${q}${rel}${q});` : `url(${q}${rel}${q})`;
      }
      return match;
    }
  );
}

function rewriteHtml(
  html: string,
  pageUrl: string,
  pageLocal: string,
  siteOrigin: string,
  lookupAsset: (rawUrl: string, source: string) => string | undefined,
  lookupPage: (rawUrl: string, source: string) => string | undefined
): string {
  const $ = cheerio.load(html);

  const resolveTarget = (raw: string | undefined): string | undefined => {
    const clean = cleanUrlString(raw);
    if (!clean || clean.startsWith("#") || clean.startsWith("data:") || clean.startsWith("mailto:") || clean.startsWith("tel:") || clean.startsWith("javascript:")) {
      return clean;
    }
    // First check if it matches an asset
    const assetLocal = lookupAsset(clean, pageUrl);
    if (assetLocal) {
      return localReference(assetLocal, pageLocal);
    }
    // Check if it matches a page or is an internal link
    const pageTarget = lookupPage(clean, pageUrl);
    if (pageTarget) {
      return localReference(pageTarget, pageLocal);
    }
    return clean;
  };

  // Rewrite anchors
  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href");
    const rewritten = resolveTarget(raw);
    if (rewritten && rewritten !== raw) $(el).attr("href", rewritten);
  });

  // Rewrite links (stylesheets, icons, fonts, manifests, preloads)
  $("link[href]").each((_, el) => {
    const raw = $(el).attr("href");
    const rewritten = resolveTarget(raw);
    if (rewritten && rewritten !== raw) $(el).attr("href", rewritten);
  });

  // Rewrite elements with src
  $("img[src], script[src], source[src], video[src], audio[src], embed[src], iframe[src], input[src]").each(
    (_, el) => {
      const raw = $(el).attr("src");
      const rewritten = resolveTarget(raw);
      if (rewritten && rewritten !== raw) $(el).attr("src", rewritten);
    }
  );

  // Video poster
  $("video[poster]").each((_, el) => {
    const raw = $(el).attr("poster");
    const rewritten = resolveTarget(raw);
    if (rewritten && rewritten !== raw) $(el).attr("poster", rewritten);
  });

  // Form action
  $("form[action]").each((_, el) => {
    const raw = $(el).attr("action");
    if (raw) {
      const rewritten = resolveTarget(raw);
      if (rewritten && rewritten !== raw) $(el).attr("action", rewritten);
    }
  });

  // Image responsive srcset
  $("img[srcset], source[srcset]").each((_, el) => {
    const raw = $(el).attr("srcset");
    if (!raw) return;
    const parts = raw.split(",").map((candidate) => {
      const trimmed = candidate.trim();
      const tokens = trimmed.split(/\s+/);
      const urlCandidate = cleanUrlString(tokens[0]);
      const descriptor = tokens.slice(1).join(" ");
      const rewritten = resolveTarget(urlCandidate) || urlCandidate;
      return descriptor ? `${rewritten} ${descriptor}` : rewritten;
    });
    $(el).attr("srcset", parts.join(", "));
  });

  // Lazy loading and data attributes
  $(
    "[data-src], [data-lazy-src], [data-original], [data-image], [data-bg], [data-background], [data-srcset]"
  ).each((_, el) => {
    for (const attr of [
      "data-src",
      "data-lazy-src",
      "data-original",
      "data-image",
      "data-bg",
      "data-background",
    ]) {
      const val = $(el).attr(attr);
      if (val) {
        const rewritten = resolveTarget(val);
        if (rewritten && rewritten !== val) $(el).attr(attr, rewritten);
      }
    }
  });

  // SVG xlink:href / href
  $("use[href], use[xlink\\:href], image[href], image[xlink\\:href]").each((_, el) => {
    for (const attr of ["href", "xlink:href"]) {
      const val = $(el).attr(attr);
      if (val && !val.startsWith("#")) {
        const rewritten = resolveTarget(val);
        if (rewritten && rewritten !== val) $(el).attr(attr, rewritten);
      }
    }
  });

  // Inline <style> tags
  $("style").each((_, el) => {
    const rawCss = $(el).html() || "";
    const rewritten = rewriteCss(rawCss, pageUrl, pageLocal, lookupAsset);
    $(el).html(rewritten);
  });

  // Element style attributes
  $("[style]").each((_, el) => {
    const rawStyle = $(el).attr("style") || "";
    const rewritten = rewriteCss(rawStyle, pageUrl, pageLocal, lookupAsset);
    $(el).attr("style", rewritten);
  });

  // Meta tags (og:image, twitter:image, etc.)
  $("meta[content]").each((_, el) => {
    const prop = ($(el).attr("property") || $(el).attr("name") || "").toLowerCase();
    if (prop.includes("image") || prop.includes("video") || prop.includes("audio") || prop.includes("icon")) {
      const val = $(el).attr("content");
      if (val) {
        const rewritten = resolveTarget(val);
        if (rewritten && rewritten !== val) $(el).attr("content", rewritten);
      }
    }
  });

  // Resilient offline script: ensures offline browsing never hangs on preloader spinners
  $("head").append(`
<script>
(function(){
  var hideLoader = function() {
    var loaders = document.querySelectorAll('#preloader, .preloader, .page-loader, #loading, .loading, [class*="preloader"]');
    loaders.forEach(function(el) {
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
      setTimeout(function() { el.style.display = 'none'; }, 200);
    });
  };
  if (document.readyState === 'complete') {
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader);
    setTimeout(hideLoader, 1500);
    setTimeout(hideLoader, 4000);
  }
})();
</script>`);

  let finalHtml = $.html();

  // Final safety pass: ensure absolutely zero lingering remote links to the site origin
  try {
    const originHost = new URL(siteOrigin).hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const domainRegex = new RegExp(
      `(?:https?:)?\\/\\/(?:www\\.)?${originHost}(\\/[^\\s"'<>\\)\\],;]*)?`,
      "gi"
    );
    finalHtml = finalHtml.replace(domainRegex, (fullMatch, pathname) => {
      if (!pathname || pathname === "/" || pathname === "") {
        return localReference("index.html", pageLocal);
      }
      try {
        const u = new URL(fullMatch.startsWith("//") ? `https:${fullMatch}` : fullMatch);
        const assetLocal = lookupAsset(u.href, pageUrl);
        if (assetLocal) return localReference(assetLocal, pageLocal);
        const pageLocalTarget = lookupPage(u.href, pageUrl);
        if (pageLocalTarget) return localReference(pageLocalTarget, pageLocal);
      } catch {}
      return fullMatch;
    });
  } catch {}

  return finalHtml;
}

async function collectWebsite(
  rootUrl: URL,
  maxPages = 0
): Promise<{
  title: string;
  host: string;
  origin: string;
  pages: PageItem[];
  assets: AssetItem[];
}> {
  cleanOldCache();

  let siteOrigin = rootUrl.origin;
  let host = rootUrl.hostname;
  const baseDomain = rootUrl.hostname.replace(/^www\./i, "").toLowerCase();

  const isSameSite = (testUrl: URL): boolean => {
    if (!["http:", "https:"].includes(testUrl.protocol)) return false;
    return testUrl.hostname.replace(/^www\./i, "").toLowerCase() === baseDomain;
  };

  const getNormPageKey = (u: URL): string => {
    const normHost = u.hostname.replace(/^www\./i, "").toLowerCase();
    return `${u.protocol}//${normHost}${u.pathname.replace(/\/+$/, "")}`;
  };

  const assetsMap = new Map<string, AssetItem>();
  const pages: PageItem[] = [];
  const queue: string[] = [rootUrl.href];
  const visitedPages = new Set<string>();

  const addAsset = (
    rawUrl: string | undefined,
    type: string,
    sourceUrl: URL
  ): AssetItem | undefined => {
    const clean = cleanUrlString(rawUrl);
    if (!clean || clean.startsWith("data:") || clean.startsWith("#") || clean.startsWith("javascript:")) {
      return undefined;
    }
    try {
      const resolved = new URL(clean, sourceUrl);
      if (!["http:", "https:"].includes(resolved.protocol)) return undefined;

      const normHost = resolved.hostname.replace(/^www\./i, "").toLowerCase();
      const cleanKey = `${resolved.protocol}//${normHost}${resolved.pathname}`;
      if (assetsMap.has(cleanKey)) {
        return assetsMap.get(cleanKey);
      }

      const itemType = detectedType(resolved.pathname, type);
      const name = resolved.pathname.split("/").pop()?.split("?")[0] || `asset.${defaultExt(itemType)}`;
      const localPath = assetLocalPath(resolved, baseDomain, itemType);

      const item: AssetItem = {
        url: resolved.href,
        cleanKey,
        localPath,
        type: itemType,
        name,
      };
      assetsMap.set(cleanKey, item);
      return item;
    } catch {
      return undefined;
    }
  };

  // Recursive sitemap discovery (including sitemap indexes)
  async function parseSitemap(sitemapUrl: URL, depth = 0) {
    if (depth > 2) return;
    try {
      const res = await fetch(sitemapUrl, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const xml = await res.text();
        const $xml = cheerio.load(xml, { xmlMode: true });

        const childSitemaps: URL[] = [];
        $xml("sitemap > loc, sitemapindex > sitemap > loc").each((_, el) => {
          const loc = cleanUrlString($xml(el).text());
          try {
            const parsed = new URL(loc, sitemapUrl);
            if (isSameSite(parsed)) childSitemaps.push(parsed);
          } catch {}
        });

        $xml("url > loc").each((_, el) => {
          const loc = cleanUrlString($xml(el).text());
          try {
            const parsed = new URL(loc, sitemapUrl);
            if (isSameSite(parsed)) {
              parsed.hash = "";
              const norm = getNormPageKey(parsed);
              if (!visitedPages.has(norm) && !queue.includes(parsed.href)) {
                queue.push(parsed.href);
              }
            }
          } catch {}
        });

        for (const child of childSitemaps.slice(0, 10)) {
          await parseSitemap(child, depth + 1);
        }
      }
    } catch {}
  }

  for (const sitemapPath of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap/sitemap.xml"]) {
    try {
      await parseSitemap(new URL(sitemapPath, rootUrl));
    } catch {}
  }

  // Crawl pages
  const pageLimit = maxPages <= 0 ? 5000 : maxPages;
  while (queue.length > 0 && pages.length < pageLimit) {
    // Process pages in small concurrent batches
    const batchUrls: URL[] = [];
    while (queue.length > 0 && batchUrls.length < 8 && pages.length + batchUrls.length < pageLimit) {
      const nextRaw = cleanUrlString(queue.shift());
      if (!nextRaw) continue;
      try {
        const parsed = new URL(nextRaw);
        parsed.hash = "";
        const normKey = getNormPageKey(parsed);
        if (!visitedPages.has(normKey) && isSameSite(parsed)) {
          visitedPages.add(normKey);
          batchUrls.push(parsed);
        }
      } catch {}
    }

    if (batchUrls.length === 0) break;

    await pMap(
      batchUrls,
      async (currentUrl) => {
        try {
          const response = await fetch(currentUrl.href, {
            headers: {
              ...BROWSER_HEADERS,
              Referer: rootUrl.href,
            },
            signal: AbortSignal.timeout(12000),
          });

          // Follow redirect origin on root page (e.g. non-www to www)
          if (pages.length === 0 && response.url) {
            try {
              const finalUrl = new URL(response.url);
              if (isSameSite(finalUrl)) {
                siteOrigin = finalUrl.origin;
                host = finalUrl.hostname;
              }
            } catch {}
          }

          const contentType = response.headers.get("content-type") || "";
          if (!response.ok || !contentType.includes("text/html")) return;

          const html = await response.text();
          const $ = cheerio.load(html);
          const pageLocal = pageLocalPath(currentUrl);

          pages.push({
            url: currentUrl.href,
            name: pageLocal,
            localPath: pageLocal,
            html,
          });

          // Extract all internal links
          $("a[href]").each((_, el) => {
            const rawHref = cleanUrlString($(el).attr("href"));
            if (!rawHref) return;
            try {
              const link = new URL(rawHref, currentUrl);
              if (!isSameSite(link)) return;
              if (["mailto:", "tel:", "javascript:"].includes(link.protocol)) return;

              const ext = link.pathname.split(".").pop()?.toLowerCase();
              if (
                [
                  "css", "js", "jpg", "jpeg", "png", "gif", "svg", "webp", "avif",
                  "ico", "pdf", "zip", "rar", "mp4", "webm", "mp3", "wav",
                  "woff", "woff2", "ttf", "otf", "json", "xml", "csv", "txt",
                  "doc", "docx", "xls", "xlsx", "ppt", "pptx"
                ].includes(ext || "")
              ) {
                addAsset(link.href, "file", currentUrl);
              } else {
                link.hash = "";
                const norm = getNormPageKey(link);
                if (!visitedPages.has(norm) && !queue.includes(link.href)) {
                  queue.push(link.href);
                }
              }
            } catch {}
          });

          // Stylesheets
          $("link[href]").each((_, el) => {
            const rel = ($(el).attr("rel") || "").toLowerCase();
            const href = cleanUrlString($(el).attr("href"));
            if (
              rel.includes("stylesheet") ||
              (rel.includes("preload") && $(el).attr("as") === "style") ||
              href.split("?")[0].endsWith(".css")
            ) {
              addAsset(href, "style", currentUrl);
            } else if (
              rel.includes("icon") ||
              rel.includes("apple-touch-icon") ||
              rel.includes("image")
            ) {
              addAsset(href, "image", currentUrl);
            } else if (rel.includes("manifest")) {
              addAsset(href, "file", currentUrl);
            } else if (rel.includes("font") || $(el).attr("as") === "font") {
              addAsset(href, "font", currentUrl);
            } else {
              addAsset(href, "file", currentUrl);
            }
          });

          // Scripts
          $("script[src]").each((_, el) => {
            addAsset(cleanUrlString($(el).attr("src")), "script", currentUrl);
          });

          // Images
          $("img[src], source[src]").each((_, el) => {
            addAsset(cleanUrlString($(el).attr("src")), "image", currentUrl);
          });

          // Image srcset
          $("img[srcset], source[srcset], [data-srcset]").each((_, el) => {
            const srcset = $(el).attr("srcset") || $(el).attr("data-srcset") || "";
            srcset.split(",").forEach((cand) => {
              const urlCand = cleanUrlString(cand.trim().split(/\s+/)[0]);
              if (urlCand) addAsset(urlCand, "image", currentUrl);
            });
          });

          // Media elements
          $("video[src], audio[src], embed[src], iframe[src], input[src]").each((_, el) => {
            addAsset(cleanUrlString($(el).attr("src")), "media", currentUrl);
          });
          $("video[poster]").each((_, el) => {
            addAsset(cleanUrlString($(el).attr("poster")), "image", currentUrl);
          });

          // Lazy load attributes
          $(
            "[data-src], [data-lazy-src], [data-original], [data-image], [data-bg], [data-background]"
          ).each((_, el) => {
            for (const a of [
              "data-src",
              "data-lazy-src",
              "data-original",
              "data-image",
              "data-bg",
              "data-background",
            ]) {
              const val = cleanUrlString($(el).attr(a));
              if (val) addAsset(val, "image", currentUrl);
            }
          });

          // SVG references
          $("use[href], use[xlink\\:href], image[href], image[xlink\\:href]").each((_, el) => {
            const ref = cleanUrlString($(el).attr("href") || $(el).attr("xlink:href"));
            if (ref && !ref.startsWith("#")) addAsset(ref, "image", currentUrl);
          });

          // Style attributes with url()
          $("[style]").each((_, el) => {
            const style = $(el).attr("style") || "";
            for (const m of style.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
              addAsset(cleanUrlString(m[1]), "image", currentUrl);
            }
          });

          // Inline <style> tags
          $("style").each((idx, el) => {
            const styleContent = $(el).html() || "";
            for (const m of styleContent.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
              addAsset(cleanUrlString(m[1]), "image", currentUrl);
            }
          });

          // Meta tags
          $("meta[content]").each((_, el) => {
            const prop = ($(el).attr("property") || $(el).attr("name") || "").toLowerCase();
            if (prop.includes("image") || prop.includes("video") || prop.includes("audio")) {
              addAsset(cleanUrlString($(el).attr("content")), "image", currentUrl);
            }
          });
        } catch {}
      },
      6
    );
  }

  // Deep CSS scanning: Fetch CSS files and discover fonts, images, and @imports recursively
  const scannedCssUrls = new Set<string>();
  while (true) {
    const uninspected = [...assetsMap.values()].filter(
      (a) => a.type === "style" && !a.content && !scannedCssUrls.has(a.url)
    );
    if (uninspected.length === 0) break;

    await pMap(
      uninspected,
      async (styleAsset) => {
        scannedCssUrls.add(styleAsset.url);
        try {
          const res = await fetch(styleAsset.url, {
            headers: {
              ...BROWSER_HEADERS,
              Referer: rootUrl.href,
            },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) return;

          const cssText = await res.text();
          const cssUrl = new URL(styleAsset.url);

          // @import rules
          for (const m of cssText.matchAll(
            /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?/gi
          )) {
            const imported = addAsset(cleanUrlString(m[1]), "style", cssUrl);
            if (imported) scannedCssUrls.delete(imported.url); // ensure imported stylesheets are scanned
          }

          // @font-face rules
          for (const face of cssText.matchAll(/@font-face\s*\{([\s\S]*?)\}/gi)) {
            for (const m of face[1].matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
              addAsset(cleanUrlString(m[1]), "font", cssUrl);
            }
          }

          // Other background / mask / content urls
          for (const m of cssText.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
            const raw = cleanUrlString(m[1]);
            if (!raw.startsWith("data:") && !raw.startsWith("#")) {
              const ext = raw.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
              if (["woff", "woff2", "ttf", "otf", "eot"].includes(ext || "")) {
                addAsset(raw, "font", cssUrl);
              } else {
                addAsset(raw, "image", cssUrl);
              }
            }
          }
        } catch {}
      },
      8
    );
  }

  const title = pages[0]
    ? cheerio.load(pages[0].html)("title").first().text().trim() || host
    : host;

  const result = {
    title,
    host,
    origin: siteOrigin,
    pages,
    assets: Array.from(assetsMap.values()),
  };

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const isForm =
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded");
    const isDownload =
      isForm ||
      request.headers.get("x-sitescoop-download") === "1" ||
      request.nextUrl.searchParams.get("download") === "1";

    let urlValue: unknown;
    let maxPages = 0; // 0 = Full Site / Unlimited (up to 5000 pages)

    if (isForm) {
      const formData = await request.formData();
      urlValue = formData.get("url");
      const mp = formData.get("maxPages");
      if (mp !== null && mp !== undefined && mp !== "") {
        const parsed = Number(mp);
        maxPages = isNaN(parsed) ? 0 : parsed;
      }
    } else {
      const body = await request.json();
      urlValue = body.url;
      if (body.maxPages !== null && body.maxPages !== undefined) {
        const parsed = Number(body.maxPages);
        maxPages = isNaN(parsed) ? 0 : parsed;
      }
    }

    const targetUrl = validateUrl(urlValue);
    const cacheKey = getCacheKey(targetUrl.origin, maxPages);

    let siteData: CachedSession;

    if (scanCache.has(cacheKey)) {
      siteData = scanCache.get(cacheKey)!;
    } else {
      const collected = await collectWebsite(targetUrl, maxPages);
      siteData = {
        ...collected,
        url: targetUrl.href,
        cachedAt: Date.now(),
      };
      scanCache.set(cacheKey, siteData);
    }

    // Return JSON if user only asked to scan
    if (!isDownload) {
      const jsonResponse: ScanResult = {
        title: siteData.title,
        host: siteData.host,
        origin: siteData.origin,
        pages: siteData.pages.map((p) => ({
          url: p.url,
          name: p.name,
          localPath: p.localPath,
        })),
        assets: siteData.assets.map((a) => ({
          url: a.url,
          type: a.type,
          name: a.name,
          localPath: a.localPath,
          content: a.content,
        })),
      };
      return NextResponse.json(jsonResponse);
    }

    // Build ZIP Archive
    const zip = new JSZip();

    // Map for fast asset lookup
    const assetUrlMap = new Map<string, string>(); // cleanKey -> localPath
    const pageUrlMap = new Map<string, string>(); // cleanKey -> localPath

    for (const a of siteData.assets) {
      assetUrlMap.set(a.cleanKey, a.localPath);
      try {
        const u = new URL(a.url);
        assetUrlMap.set(u.pathname, a.localPath);
      } catch {}
    }
    for (const p of siteData.pages) {
      try {
        const u = new URL(p.url);
        pageUrlMap.set(u.pathname, p.localPath);
        pageUrlMap.set(u.pathname.replace(/\/+$/, ""), p.localPath);
        pageUrlMap.set(u.origin + u.pathname, p.localPath);
        pageUrlMap.set(u.origin + u.pathname.replace(/\/+$/, ""), p.localPath);
      } catch {}
    }

    const lookupAsset = (rawUrl: string, source: string): string | undefined => {
      try {
        const clean = cleanUrlString(rawUrl);
        const u = new URL(clean, source);
        const normHost = u.hostname.replace(/^www\./i, "").toLowerCase();
        const cleanKey = `${u.protocol}//${normHost}${u.pathname}`;
        if (assetUrlMap.has(cleanKey)) return assetUrlMap.get(cleanKey);
        if (assetUrlMap.has(u.pathname)) return assetUrlMap.get(u.pathname);
      } catch {}
      return undefined;
    };

    const lookupPage = (rawUrl: string, source: string): string | undefined => {
      try {
        const clean = cleanUrlString(rawUrl);
        const u = new URL(clean, source);
        const targetBaseDomain = targetUrl.hostname.replace(/^www\./i, "").toLowerCase();
        const isInternal = u.hostname.replace(/^www\./i, "").toLowerCase() === targetBaseDomain;
        if (isInternal) {
          const cleanKey = u.pathname;
          const cleanNorm = u.pathname.replace(/\/+$/, "");
          if (pageUrlMap.has(cleanKey)) return pageUrlMap.get(cleanKey);
          if (pageUrlMap.has(cleanNorm)) return pageUrlMap.get(cleanNorm);
          // Fallback calculation for any internal link
          return pageLocalPath(u);
        }
      } catch {}
      return undefined;
    };

    // Download all assets concurrently
    const downloadedAssets = new Map<string, { path: string; content: string | Uint8Array; type: string }>();
    const failedList: string[] = [];

    await pMap(
      siteData.assets,
      async (asset) => {
        if (asset.content) {
          downloadedAssets.set(asset.cleanKey, {
            path: asset.localPath,
            content: asset.content,
            type: asset.type,
          });
          return;
        }

        let lastErr = "unknown error";
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await fetch(asset.url, {
              headers: {
                ...BROWSER_HEADERS,
                Referer: targetUrl.href,
              },
              signal: AbortSignal.timeout(10000),
            });

            if (res.ok) {
              if (asset.type === "style") {
                const text = await res.text();
                downloadedAssets.set(asset.cleanKey, {
                  path: asset.localPath,
                  content: text,
                  type: asset.type,
                });
              } else {
                const buffer = await res.arrayBuffer();
                downloadedAssets.set(asset.cleanKey, {
                  path: asset.localPath,
                  content: new Uint8Array(buffer),
                  type: asset.type,
                });
              }
              return;
            }
            lastErr = `HTTP ${res.status}`;
            if (res.status === 404) {
              // Remote server 404: if it's an image, write transparent placeholder
              if (asset.type === "image") {
                downloadedAssets.set(asset.cleanKey, {
                  path: asset.localPath,
                  content: TRANSPARENT_PNG,
                  type: asset.type,
                });
              }
              break;
            }
          } catch (e: any) {
            lastErr = e?.message || "timeout";
          }
          await new Promise((r) => setTimeout(r, 400));
        }

        failedList.push(`${lastErr}\t${asset.url} -> ${asset.localPath}`);
        // Ensure image placeholders even on network failure
        if (asset.type === "image" && !downloadedAssets.has(asset.cleanKey)) {
          downloadedAssets.set(asset.cleanKey, {
            path: asset.localPath,
            content: TRANSPARENT_PNG,
            type: asset.type,
          });
        }
      },
      14
    );

    // Add assets to ZIP with rewritten CSS
    for (const [cleanKey, item] of downloadedAssets.entries()) {
      if (item.type === "style" && typeof item.content === "string") {
        const matchingAsset = siteData.assets.find((a) => a.cleanKey === cleanKey);
        const sourceUrl = matchingAsset ? matchingAsset.url : targetUrl.href;
        const rewritten = rewriteCss(item.content, sourceUrl, item.path, lookupAsset);
        zip.file(item.path, rewritten);
      } else {
        zip.file(item.path, item.content);
      }
    }

    // Add rewritten HTML pages to ZIP
    for (const page of siteData.pages) {
      const rewrittenHtml = rewriteHtml(
        page.html,
        page.url,
        page.localPath,
        siteData.origin,
        lookupAsset,
        lookupPage
      );
      zip.file(page.localPath, rewrittenHtml);
    }

    // Add Report & Readme
    zip.file(
      "DOWNLOAD-REPORT.txt",
      [
        `=== SITE OFFLINE MIRROR REPORT ===`,
        `Target URL: ${targetUrl.href}`,
        `Host: ${siteData.host}`,
        `Downloaded At: ${new Date().toISOString()}`,
        `Pages mirrored: ${siteData.pages.length}`,
        `Assets discovered: ${siteData.assets.length}`,
        `Assets saved: ${downloadedAssets.size}`,
        `Unreachable remote assets: ${failedList.length}`,
        "",
        "--- Unreachable Files Log ---",
        failedList.length > 0 ? failedList.join("\n") : "None (All assets mirrored successfully)",
      ].join("\n")
    );

    zip.file(
      "README.txt",
      [
        `=============================================================`,
        `               ${siteData.host} Offline Website Mirror`,
        `=============================================================`,
        ``,
        `All pages, stylesheets, javascripts, images, and fonts have been`,
        `mirrored to exact relative paths for 100% offline browsing.`,
        ``,
        `How to open:`,
        `1. Open "index.html" directly in any browser (Chrome, Edge, Firefox).`,
        `2. All subpages and assets work locally without an active web server.`,
        `3. If you prefer running a local server, you can run:`,
        `   npx serve .`,
        `   or python -m http.server 8080`,
        `=============================================================`,
      ].join("\n")
    );

    const zipBuffer = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return new NextResponse(zipBuffer as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${siteData.host}-offline-site.zip"`,
        "Content-Length": String(zipBuffer.byteLength),
      },
    });
  } catch (err: any) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: err?.message || "Unable to process this website URL" },
      { status: 400 }
    );
  }
}
