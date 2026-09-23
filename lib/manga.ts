import "server-only";
import { backendGet } from "./backend";
import type { TitleLogo } from "./logo";

/**
 * Manga, via the apiflix `/atsu` provider.
 *
 * The provider wraps everything as `{ status, success, data }`, so every call
 * here unwraps `data` and hands back a plain shape — the rest of the app
 * should not have to know the envelope exists.
 *
 * Adult titles are filtered out at this layer rather than in the pages. Doing
 * it once, at the source, means a new shelf cannot forget to.
 */

interface Envelope<T> {
  status?: number;
  success?: boolean;
  data?: T;
}

export interface MangaCard {
  id: string;
  title: string;
  thumbnail?: string;
  images?: { small?: string; medium?: string; large?: string };
  type?: string;
  isAdult?: boolean;
  banner?: string;
  poster?: string;
  image?: string;
  authors?: Array<{ id?: string; name?: string; author?: string }>;
  latestChapter?: string;
  rating?: number | string;
  views?: number;
  genres?: Array<{ genre?: string; name?: string; slug?: string } | string>;
}

export interface MangaChapter {
  id: string;
  title?: string;
  number: number;
  pages?: number;
  scanId?: string;
}

export interface MangaDetail {
  id: string;
  title: string;
  englishTitle?: string;
  synopsis?: string;
  type?: string;
  isAdult?: boolean;
  status?: string;
  genres?: Array<{ genre: string; slug: string }>;
  authors?: Array<{ author?: string; name?: string; slug?: string }>;
  poster?: string;
  banner?: string;
  rating?: number | string;
  views?: number;
  totalChapters?: number;
  latestChapter?: string;
}

export interface MangaPage {
  img: string;
  page: number;
}

/** Shelves the provider publishes, in the order they are worth showing. */
export const MANGA_SHELVES: Array<{ key: string; eyebrow: string; title: string }> = [
  { key: "trending-carousel", eyebrow: "Reading now", title: "Trending" },
  { key: "hot-updates", eyebrow: "Fresh chapters", title: "Hot updates" },
  { key: "recently-updated", eyebrow: "Just posted", title: "Recently updated" },
  { key: "top-rated", eyebrow: "The canon", title: "Top rated" },
  { key: "most-bookmarked", eyebrow: "Most followed", title: "Most bookmarked" },
  { key: "popular", eyebrow: "Widely read", title: "Popular" },
  { key: "recently-added", eyebrow: "New to the shelf", title: "Recently added" },
];

/**
 * Coerce a shelf to a list, then drop adult titles.
 *
 * The shelves are not uniformly shaped — most come back as plain arrays but
 * at least one arrives wrapped, and assuming otherwise took a build down.
 * Anything that is not a recognisable list becomes an empty one rather than
 * an exception, because a malformed shelf should cost that shelf and nothing
 * else. Adult filtering happens here so a new shelf cannot forget to.
 */
function safe(value: unknown): MangaCard[] {
  const list = Array.isArray(value)
    ? value
    : Array.isArray((value as { items?: unknown })?.items)
      ? (value as { items: unknown[] }).items
      : Array.isArray((value as { data?: unknown })?.data)
        ? (value as { data: unknown[] }).data
        : Array.isArray((value as { results?: unknown })?.results)
          ? (value as { results: unknown[] }).results
          : [];

  return (list as MangaCard[]).filter((m) => m?.id && !m.isAdult);
}

/** Best poster the provider offers, preferring its pre-sized renditions. */
export function mangaCover(m: MangaCard | MangaDetail | null | undefined): string | undefined {
  if (!m) return undefined;
  const anyM = m as unknown as Record<string, unknown>;

  const check = (val: unknown): string | undefined => {
    if (
      typeof val === "string" &&
      val.trim().length > 0 &&
      val.trim() !== "null" &&
      val.trim() !== "undefined"
    ) {
      return val.trim();
    }
    return undefined;
  };

  let pick: string | undefined;

  // 1. Check nested images object first (Atsu primary format)
  if (anyM.images && typeof anyM.images === "object") {
    const imgs = anyM.images as Record<string, unknown>;
    pick =
      check(imgs.large) ||
      check(imgs.medium) ||
      check(imgs.small) ||
      check(imgs.poster) ||
      check(imgs.cover) ||
      check(imgs.thumbnail) ||
      check(imgs.banner);
  }

  // 2. Check direct property candidates
  if (!pick) {
    pick =
      check(anyM.thumbnail) ||
      check(anyM.poster) ||
      check(anyM.cover) ||
      check(anyM.image) ||
      check(anyM.banner);
  }

  if (pick && pick.includes("atsu.moe") && !pick.startsWith("/api/manga/image")) {
    return `/api/manga/image?url=${encodeURIComponent(pick)}`;
  }

  return pick;
}

export interface MangaArt {
  cover: string | null;
  banner: string | null;
}

/**
 * Fetch official high-resolution widescreen banner and cover for a manga from AniList.
 */
export async function findMangaArt(title: string): Promise<MangaArt> {
  if (!title || !title.trim()) return { cover: null, banner: null };
  try {
    const cleanTitle = title
      .replace(/\s*\(.*?\)/g, "")
      .replace(/\s+[-–—]\s+.*$/, "")
      .replace(/\s*:\s*.*$/, "")
      .trim();

    const query = `
      query ($search: String) {
        Media(search: $search, type: MANGA) {
          bannerImage
          coverImage {
            extraLarge
            large
            medium
          }
        }
      }
    `;

    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { search: cleanTitle || title } }),
      next: { revalidate: 604_800 },
    });

    if (!res.ok) return { cover: null, banner: null };
    const json = await res.json();
    const media = json?.data?.Media;
    return {
      banner: media?.bannerImage ?? null,
      cover: media?.coverImage?.extraLarge ?? media?.coverImage?.large ?? media?.coverImage?.medium ?? null,
    };
  } catch {
    return { cover: null, banner: null };
  }
}

/**
 * Fetch official high-resolution widescreen banner for a manga from AniList.
 */
export async function findMangaBanner(title: string): Promise<string | null> {
  const art = await findMangaArt(title);
  return art.banner ?? art.cover;
}

/**
 * Fetch the TMDB title-treatment logo for a manga title.
 * Searches TMDB multi-search, then pulls the /images endpoint for the best
 * English (or Japanese fallback) logo.  Returns null when none is found.
 */
export async function findMangaLogo(title: string): Promise<TitleLogo | null> {
  if (!title?.trim()) return null;

  const REVALIDATE = 604_800;
  const clean = title
    .replace(/\s*\(.*?\)/g, "")
    .replace(/\s+[-–—]\s+.*$/, "")
    .replace(/\s*:\s*.*$/, "")
    .trim();

  const candidates = Array.from(new Set([clean, title].filter(Boolean)));

  for (const q of candidates) {
    try {
      const searchRes = await backendGet<{
        results?: Array<{ id: number; media_type?: string }>;
      }>(`/api/tmdb/search/multi?query=${encodeURIComponent(q)}&include_adult=false`, {
        revalidate: REVALIDATE,
      });

      if (!searchRes.ok || !searchRes.data?.results?.length) continue;

      const hit =
        searchRes.data.results.find((r) => r.media_type === "tv" || r.media_type === "movie") ??
        null;

      if (!hit?.id) continue;

      const tmdbType = hit.media_type === "movie" ? "movie" : "tv";
      const imgRes = await backendGet<{
        logos?: Array<{ file_path: string; width: number; height: number; iso_639_1: string | null }>;
      }>(`/api/tmdb/${tmdbType}/${hit.id}/images?include_image_language=en,ja,null`, {
        revalidate: REVALIDATE,
      });

      if (!imgRes.ok || !imgRes.data?.logos?.length) continue;

      const logos = imgRes.data.logos;
      const pick = (lang: string | null | undefined) =>
        lang === undefined
          ? logos.slice().sort((a, b) => b.width - a.width)[0]
          : logos.filter((l) => l.iso_639_1 === lang).sort((a, b) => b.width - a.width)[0];

      const logo = pick("en") ?? pick("ja") ?? pick(null) ?? pick(undefined);
      if (!logo) continue;

      return {
        path: logo.file_path,
        width: logo.width,
        height: logo.height,
        lang: logo.iso_639_1,
        vector: logo.file_path.toLowerCase().endsWith(".svg"),
      };
    } catch {
      // continue to next candidate
    }
  }

  return null;
}

export async function mangaHome(): Promise<Record<string, MangaCard[]>> {
  const res = await backendGet<Envelope<Record<string, unknown>>>("/atsu/home", {
    revalidate: 600,
  });
  if (!res.ok) return {};
  const out: Record<string, MangaCard[]> = {};
  for (const [key, value] of Object.entries(res.data?.data ?? {})) out[key] = safe(value);
  return out;
}

export async function mangaSearch(query: string): Promise<MangaCard[]> {
  if (!query.trim()) return [];
  const res = await backendGet<Envelope<unknown>>(
    `/atsu/search?q=${encodeURIComponent(query)}`,
    { revalidate: 600 },
  );
  if (!res.ok) return [];
  const items = safe(res.data?.data);

  // The upstream /atsu/search endpoint often returns empty thumbnails.
  // Enrich the top few items with posters from mangaDetail in parallel so cards have cover art.
  const needsPoster = items.filter((m) => !mangaCover(m));
  if (needsPoster.length > 0) {
    await Promise.allSettled(
      needsPoster.slice(0, 6).map(async (item) => {
        try {
          const detail = await mangaDetail(item.id);
          if (detail) {
            const c = mangaCover(detail);
            if (c) {
              item.poster = c;
              item.thumbnail = c;
            }
            if (detail.rating && !item.rating) item.rating = detail.rating;
            if (detail.authors && !item.authors) item.authors = detail.authors;
            if (detail.latestChapter && !item.latestChapter) item.latestChapter = detail.latestChapter;
          }
        } catch {
          // ignore individual enrichment failure
        }
      })
    );
  }

  return items;
}

export async function mangaDetail(id: string): Promise<MangaDetail | null> {
  const res = await backendGet<Envelope<MangaDetail>>(`/atsu/detail/${encodeURIComponent(id)}`, {
    revalidate: 1800,
  });
  return res.ok && res.data?.data?.id ? res.data.data : null;
}

/** Chapters live on /info, but fallback to /detail if /info is empty. */
export async function mangaChapters(id: string): Promise<MangaChapter[]> {
  const res = await backendGet<Envelope<{ chapters?: MangaChapter[] }>>(
    `/atsu/info/${encodeURIComponent(id)}`,
    { revalidate: 900 },
  );
  if (res.ok && res.data?.data?.chapters && res.data.data.chapters.length > 0) {
    return (res.data.data.chapters)
      .filter((c) => c?.id && Number.isFinite(c.number))
      .sort((a, b) => a.number - b.number);
  }

  // Fallback: check if detail endpoint contains chapters
  const detail = await mangaDetail(id);
  const detailChapters = (detail as any)?.chapters;
  if (Array.isArray(detailChapters) && detailChapters.length > 0) {
    return detailChapters
      .filter((c: any) => c?.id && Number.isFinite(c.number))
      .sort((a: any, b: any) => a.number - b.number);
  }

  return [];
}

/**
 * Pages for one chapter. Both ids are required; the provider 400s without.
 *
 * Note the shape: the shelves return `data` as a list, but a chapter returns
 * `data` as an object with the list under `pages`. The provider is not
 * consistent about this, so the list is dug out rather than assumed.
 */
export async function mangaPages(mangaId: string, chapterId: string): Promise<MangaPage[]> {
  if (!mangaId || !chapterId) return [];
  const res = await backendGet<Envelope<{ pages?: MangaPage[] } | MangaPage[]>>(
    `/atsu/read?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`,
    { revalidate: 86_400 },
  );
  if (!res.ok) return [];

  const payload = res.data?.data;
  const list: MangaPage[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.pages)
      ? payload.pages
      : [];

  return list
    .filter((p) => typeof p?.img === "string")
    .sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
}

/**
 * Fetch intelligent manga recommendations based on primary genre, matching type, and popular catalog titles.
 */
export async function mangaRecommendations(
  mangaId: string,
  genres?: Array<{ genre: string; slug: string }> | string[],
  type?: string,
): Promise<MangaCard[]> {
  const seen = new Set<string>();
  seen.add(mangaId);
  const candidates: MangaCard[] = [];

  const genreNames = (genres ?? [])
    .map((g) => (typeof g === "string" ? g : g?.genre || (g as any)?.name || "").trim())
    .filter(Boolean);

  // Load popular / top-rated shelves from mangaHome (cached, fast, already formatted)
  try {
    const shelves = await mangaHome();
    const priorityShelves = ["popular", "top-rated", "trending-carousel", "hot-updates", "recently-updated"];
    for (const key of priorityShelves) {
      for (const item of shelves[key] ?? []) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          candidates.push(item);
        }
      }
    }
  } catch {
    // ignore
  }

  // Score candidates by matching type, matching genres, and rating
  const targetType = (type || "Manga").toLowerCase();
  const lowerGenres = genreNames.map((g) => g.toLowerCase());

  const scored = candidates.map((item) => {
    let score = 0;
    const itemType = (item.type || "").toLowerCase();
    if (itemType === targetType) score += 3;

    const itemGenres = (item.genres ?? []).map((g: any) =>
      (typeof g === "string" ? g : g?.genre || g?.name || "").toLowerCase(),
    );

    for (const tg of lowerGenres) {
      if (itemGenres.some((ig: string) => ig.includes(tg))) {
        score += 4;
      }
    }

    if (typeof item.rating === "number") {
      score += item.rating * 0.2;
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 10).map((s) => s.item);
}
