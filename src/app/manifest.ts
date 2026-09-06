import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SiteClonePro — Universal Website Archiver & Offline Mirror",
    short_name: "SiteClonePro",
    description:
      "Archive and download complete websites offline with exact folder structures, AI-powered relative path rewriting, and zero broken assets.",
    start_url: "/",
    display: "standalone",
    background_color: "#080c14",
    theme_color: "#080c14",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/favicon.svg",
        sizes: "64x64",
        type: "image/svg+xml",
      },
    ],
  };
}
