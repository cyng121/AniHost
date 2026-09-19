import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

/**
 * Crawl rules.
 *
 * The catalogue is worth indexing; the machinery around it is not. /api is
 * proxy plumbing, /watch and /search are per-session views that would only
 * dilute the index, and /settings is personal to the device.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/watch/", "/search", "/settings"],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
