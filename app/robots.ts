export const runtime = "edge";
import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

/**
 * Enhanced crawl rules for search engine indexing.
 *
 * Directs search engine crawlers (Googlebot, Bingbot, etc.) to index all
 * valuable public pages (catalogues, genres, anime/manga/cartoon pages),
 * while blocking internal APIs, video streaming proxies, and personal session routes.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/cdn/",
          "/m3u8/",
          "/saves/",
          "/watch/",
          "/search",
          "/settings",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

