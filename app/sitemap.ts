export const runtime = "edge";
import type { MetadataRoute } from "next";
import { getHomeData } from "@/lib/anilist";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: siteUrl("/browse"), lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: siteUrl("/manga"), lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: siteUrl("/schedule"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: siteUrl("/apps"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: siteUrl("/copyright"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  let home: any = null;
  try {
    home = await getHomeData();
  } catch {
    return staticPages;
  }

  const pool = [
    ...(home?.spotlight?.media ?? []),
    ...(home?.topTodayTrending?.media ?? []),
    ...(home?.topWeekPopular?.media ?? []),
    ...(home?.popularAnime?.media ?? []),
    ...(home?.upcomingAnime?.media ?? []),
  ]
    .map((m) => m?.id)
    .filter((id) => id != null);

  const titles = [...new Set(pool)].map((id) => ({
    url: siteUrl(`/anime/${encodeURIComponent(id)}`),
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...titles];
}
