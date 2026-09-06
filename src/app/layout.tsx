import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#080c14",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://siteclonepro.vercel.app"),
  title: {
    default: "SiteClonePro — AI-Powered Universal Website Archiver & Offline Mirror",
    template: "%s | SiteClonePro",
  },
  description:
    "Universal AI-assisted website archiver and offline mirroring engine. Mirror and download complete websites with 100% authentic folder structures, offline relative path rewriting, CSS & web font extraction, and zero broken assets. Created by Lob Das.",
  applicationName: "SiteClonePro",
  keywords: [
    "siteclonepro",
    "site clone pro",
    "website archiver",
    "offline website downloader",
    "mirror website offline",
    "clone website",
    "website copier",
    "offline web scraper",
    "download entire website",
    "html css js downloader",
    "relative path rewriter",
    "offline website viewer",
    "full site crawler",
    "webmirror",
    "lob das",
    "website mirror tool",
    "extract web fonts offline",
    "archive html locally",
    "save website offline",
    "universal website mirror",
  ],
  authors: [{ name: "Lob Das", url: "https://www.linkedin.com/in/lobdas/" }],
  creator: "Lob Das",
  publisher: "Lob Das",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "https://siteclonepro.vercel.app",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://siteclonepro.vercel.app",
    siteName: "SiteClonePro",
    title: "SiteClonePro — AI-Powered Universal Website Archiver & Offline Mirror",
    description:
      "Archive and download complete websites offline with exact folder hierarchy, relative links rewriting, and full CSS/fonts extraction. Created by Lob Das.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SiteClonePro - Universal Website Archiver created by Lob Das",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SiteClonePro — AI-Powered Universal Website Archiver",
    description:
      "Download complete websites offline with 100% authentic folder structures and offline relative paths. Created by Lob Das.",
    creator: "@lobdas",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "SiteClonePro",
        operatingSystem: "All (Windows, macOS, Linux, iOS, Android)",
        applicationCategory: "DeveloperApplication",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        author: {
          "@type": "Person",
          name: "Lob Das",
          url: "https://www.linkedin.com/in/lobdas/",
          sameAs: [
            "https://www.linkedin.com/in/lobdas/",
            "https://github.com/lobdp",
          ],
        },
        description:
          "AI-assisted universal offline website archiver and asset mirror that preserves exact folder structures and rewrites links to 100% relative paths.",
        featureList: [
          "Universal recursive offline mirroring",
          "Authentic folder hierarchy preservation (assets/css, assets/js, assets/img)",
          "100% relative path mathematical rewriting for standalone file:/// browsing",
          "Deep CSS @import and @font-face discovery",
          "Self-healing placeholder fallback for remote 404 assets",
          "Unlimited full-site multi-page crawling",
          "Instant streaming ZIP packaging with zero live domain links",
        ],
      },
      {
        "@type": "WebSite",
        name: "SiteClonePro",
        url: "https://siteclonepro.vercel.app",
        author: {
          "@type": "Person",
          name: "Lob Das",
          url: "https://www.linkedin.com/in/lobdas/",
        },
        description:
          "Universal AI-powered website archiver and offline asset mirroring utility.",
      },
    ],
  };

  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable} dark`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen antialiased bg-[#080c14] text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
