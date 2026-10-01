export const runtime = "edge";
import type { MetadataRoute } from "next";
import { getHomeData, getCategory } from "@/lib/anilist";
import { mangaHome } from "@/lib/manga";
import { getCartoonSeries, getCartoonMovies } from "@/lib/animesalt";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

// All anime genres supported by the app
const ANIME_GENRES = [
  "action",
  "adventure",
  "boys-love",
  "cars",
  "comedy",
  "cyberpunk",
  "dementia",
  "demons",
  "drama",
  "ecchi",
  "erotica",
  "fantasy",
  "game",
  "girls-love",
  "gourmet",
  "harem",
  "historical",
  "horror",
  "isekai",
  "josei",
  "kids",
  "magic",
  "mahou-shoujo",
  "martial-arts",
  "mecha",
  "military",
  "music",
  "mystery",
  "parody",
  "police",
  "psychological",
  "romance",
  "samurai",
  "school",
  "sci-fi",
  "seinen",
  "shoujo",
  "shoujo-ai",
  "shounen",
  "shounen-ai",
  "slice-of-life",
  "space",
  "sports",
  "super-power",
  "supernatural",
  "suspense",
  "thriller",
  "vampire",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 1. Primary Hubs & Static Pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: siteUrl("/browse"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/movies"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/cartoon"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/manga"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/schedule"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: siteUrl("/shorts"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: siteUrl("/apps"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: siteUrl("/copyright"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // 2. All 48 Anime Genre Browse Hubs
  const genrePages: MetadataRoute.Sitemap = ANIME_GENRES.map((slug) => ({
    url: siteUrl(`/genre/${slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // 3. Dynamic Content Collections (Safely fetched with Promise.allSettled)
  const animeIds = new Set<string>();
  const mangaIds = new Set<string>();
  const cartoonIds = new Set<string>();

  try {
    const [homeRes, popularRes, topScoredRes, mangaRes, cartoonSeriesRes, cartoonMoviesRes] =
      await Promise.allSettled([
        getHomeData(),
        getCategory({ sort: "POPULARITY_DESC", perPage: 40 }),
        getCategory({ sort: "SCORE_DESC", perPage: 40 }),
        mangaHome(),
        getCartoonSeries(1),
        getCartoonMovies(1),
      ]);

    // Harvest Anime from Home Feed (Spotlight, Trending, Popular, Upcoming)
    if (homeRes.status === "fulfilled" && homeRes.value) {
      const home = homeRes.value;
      const lists = [
        home?.spotlight?.media,
        home?.topTodayTrending?.media,
        home?.topWeekPopular?.media,
        home?.popularAnime?.media,
        home?.upcomingAnime?.media,
      ];
      for (const list of lists) {
        if (Array.isArray(list)) {
          for (const m of list) {
            const id = m?.idMal ?? m?.id;
            if (id != null) animeIds.add(String(id));
          }
        }
      }
    }

    // Harvest Anime from Popular list
    if (popularRes.status === "fulfilled" && popularRes.value) {
      const media = popularRes.value?.Page?.media;
      if (Array.isArray(media)) {
        for (const m of media) {
          const id = m?.idMal ?? m?.id;
          if (id != null) animeIds.add(String(id));
        }
      }
    }

    // Harvest Anime from Top Scored list
    if (topScoredRes.status === "fulfilled" && topScoredRes.value) {
      const media = topScoredRes.value?.Page?.media;
      if (Array.isArray(media)) {
        for (const m of media) {
          const id = m?.idMal ?? m?.id;
          if (id != null) animeIds.add(String(id));
        }
      }
    }

    // Harvest Manga titles across all home shelves
    if (mangaRes.status === "fulfilled" && mangaRes.value) {
      for (const shelf of Object.values(mangaRes.value)) {
        if (Array.isArray(shelf)) {
          for (const card of shelf) {
            if (card?.id && !card.isAdult) {
              mangaIds.add(String(card.id));
            }
          }
        }
      }
    }

    // Harvest Cartoon series
    if (cartoonSeriesRes.status === "fulfilled" && cartoonSeriesRes.value?.ok) {
      const items = cartoonSeriesRes.value.data?.items;
      if (Array.isArray(items)) {
        for (const c of items) {
          if (c?.id) cartoonIds.add(String(c.id));
        }
      }
    }

    // Harvest Cartoon movies
    if (cartoonMoviesRes.status === "fulfilled" && cartoonMoviesRes.value?.ok) {
      const items = cartoonMoviesRes.value.data?.items;
      if (Array.isArray(items)) {
        for (const c of items) {
          if (c?.id) cartoonIds.add(String(c.id));
        }
      }
    }
  } catch {
    // If upstream network fails, sitemap will still reliably yield static and genre hubs
  }

  // 4. Map Dynamic URLs
  const animePages: MetadataRoute.Sitemap = Array.from(animeIds).map((id) => ({
    url: siteUrl(`/anime/${encodeURIComponent(id)}`),
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const mangaPages: MetadataRoute.Sitemap = Array.from(mangaIds).map((id) => ({
    url: siteUrl(`/manga/${encodeURIComponent(id)}`),
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const cartoonPages: MetadataRoute.Sitemap = Array.from(cartoonIds).map((id) => ({
    url: siteUrl(`/cartoon/${encodeURIComponent(id)}`),
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [
    ...staticPages,
    ...genrePages,
    ...animePages,
    ...mangaPages,
    ...cartoonPages,
  ];
}

