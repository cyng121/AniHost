/**
 * lib/catalog.ts
 *
 * Direct client & server library for catalog.animetvplus.site metadata, search,
 * episode listings, season trees, and artwork.
 *
 * NOTE: Stream resolvers (/api/byse and /api/vidmoly) are omitted here per project guidelines.
 */

export const CATALOG_API_BASE = "https://catalog.animetvplus.site/api";

export interface CatalogAnimeItem {
  mal_id: string | number;
  anilist_id?: number;
  canonical_mal_id?: string;
  canonical_title: string;
  english_title?: string;
  romaji_title?: string;
  native_title?: string;
  cover_image?: string;
  cr_poster?: string;
  cr_hero?: string;
  detail_banner?: string;
  title_logo?: string;
  banner_image?: string;
  thumbnail_1080_url?: string;
  genres_json?: string;
  format?: string;
  status?: string;
  score?: number;
  season_year?: number;
  season_name?: string;
  current_episodes?: number;
  m3u8_episode_count?: number;
}

export interface CatalogSearchResponse {
  items: CatalogAnimeItem[];
  total?: number;
  page?: number;
}

export interface CatalogCrSeason {
  season_id?: string;
  season_number?: number;
  title?: string;
  description?: string;
  episode_count?: number;
  episodes?: CatalogEpisode[];
  poster?: string;
}

export interface CatalogCrCard {
  mal_id?: string | number;
  has_cr?: number;
  detail_banner?: string | null;
  hero_banner?: string | null;
  title_logo?: string | null;
  poster?: string | null;
  synopsis?: string | null;
  title_english?: string | null;
  title_romaji?: string | null;
  seasons?: CatalogCrSeason[];
  episodes?: CatalogEpisode[];
  fanart?: {
    hdclearart?: string[];
    showbackground?: string[];
    tvbanner?: string[];
  } | null;
}

export interface CatalogEpisode {
  ep: number;
  sequence_number?: number;
  title?: string;
  thumbnail?: string;
  cr_season_id?: string;
  season_number?: number;
  duration_ms?: number;
  has_stream?: boolean;
}

export interface CatalogFanart {
  hdclearart?: string[];
  showbackground?: string[];
  tvbanner?: string[];
}

/** Default fetch headers */
const DEFAULT_HEADERS = {
  Accept: "application/json",
  "User-Agent": "AniGhost/1.0",
};

/** Generic fetch helper with timeout & error handling */
async function catalogFetch<T>(endpoint: string, init?: RequestInit): Promise<T | null> {
  const url = endpoint.startsWith("http") ? endpoint : `${CATALOG_API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...DEFAULT_HEADERS,
        ...init?.headers,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Search & Discovery
// ---------------------------------------------------------------------------

export async function fetchCatalogSearch(
  query: string,
  options: { limit?: number; page?: number; genre?: string; fmt?: string; sort?: string } = {}
): Promise<CatalogAnimeItem[]> {
  if (!query || !query.trim()) return [];
  const params = new URLSearchParams({ q: query.trim() });
  if (options.limit) params.set("limit", String(options.limit));
  if (options.page) params.set("page", String(options.page));
  if (options.genre) params.set("genre", options.genre);
  if (options.fmt) params.set("fmt", options.fmt);
  if (options.sort) params.set("sort", options.sort);

  const data = await catalogFetch<CatalogSearchResponse | CatalogAnimeItem[]>(`/search?${params.toString()}`);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items || [];
}

// ---------------------------------------------------------------------------
// 2. Crunchyroll Cards & Season Trees
// ---------------------------------------------------------------------------

/**
 * Fetch full Crunchyroll detail payload including detail banner, title logo,
 * season tree, and season episode listings.
 */
export async function fetchCrCard(malId: number | string, full: boolean = true): Promise<CatalogCrCard | null> {
  if (!malId || String(malId) === "0") return null;
  const fullParam = full ? "?full=1" : "?full=0";
  return catalogFetch<CatalogCrCard>(`/cr/card/${malId}${fullParam}`, {
    next: { revalidate: 3600 },
  });
}

/**
 * Fetch episodes for a specific season of an anime.
 */
export async function fetchCrSeasonEpisodes(
  malId: number | string,
  seasonNumber: number | string
): Promise<CatalogEpisode[]> {
  if (!malId || String(malId) === "0") return [];
  const data = await catalogFetch<CatalogEpisode[] | { items?: CatalogEpisode[]; episodes?: CatalogEpisode[] }>(
    `/cr/season/${malId}/${seasonNumber}`,
    { next: { revalidate: 1800 } }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items || data.episodes || [];
}

// ---------------------------------------------------------------------------
// 3. Seasonal Anime Endpoints
// ---------------------------------------------------------------------------

/**
 * Fetch anime released in a specific year and season quarter (e.g. 2026 / FALL).
 */
export async function fetchSeasonalAnime(
  year: number | string,
  season: "WINTER" | "SPRING" | "SUMMER" | "FALL" | string
): Promise<CatalogAnimeItem[]> {
  const data = await catalogFetch<CatalogAnimeItem[] | { items?: CatalogAnimeItem[] }>(
    `/anime/season/${year}/${season.toUpperCase()}`,
    { next: { revalidate: 3600 } }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items || [];
}

/**
 * Fetch currently airing seasonal anime.
 */
export async function fetchAiringSeason(
  year?: number | string,
  season?: string
): Promise<CatalogAnimeItem[]> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (season) params.set("season", season.toUpperCase());
  const queryString = params.toString() ? `?${params.toString()}` : "";

  const data = await catalogFetch<CatalogAnimeItem[] | { items?: CatalogAnimeItem[] }>(
    `/anime/airing-season${queryString}`,
    { next: { revalidate: 300 } }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items || [];
}

// ---------------------------------------------------------------------------
// 4. Catalog Listings & Collections
// ---------------------------------------------------------------------------

export async function fetchNewReleases(): Promise<CatalogAnimeItem[]> {
  const data = await catalogFetch<CatalogAnimeItem[] | { items?: CatalogAnimeItem[] }>(
    "/anime/new-releases",
    { next: { revalidate: 300 } }
  );
  if (!data) return [];
  return Array.isArray(data) ? data : data.items || [];
}

export async function fetchAiringAnime(): Promise<CatalogAnimeItem[]> {
  const data = await catalogFetch<CatalogAnimeItem[] | { items?: CatalogAnimeItem[] }>(
    "/anime/airing",
    { next: { revalidate: 300 } }
  );
  if (!data) return [];
  return Array.isArray(data) ? data : data.items || [];
}

export async function fetchTopRated(): Promise<CatalogAnimeItem[]> {
  const data = await catalogFetch<CatalogAnimeItem[] | { items?: CatalogAnimeItem[] }>(
    "/anime/top-rated",
    { next: { revalidate: 1800 } }
  );
  if (!data) return [];
  return Array.isArray(data) ? data : data.items || [];
}

export async function fetchPopular(): Promise<CatalogAnimeItem[]> {
  const data = await catalogFetch<CatalogAnimeItem[] | { items?: CatalogAnimeItem[] }>(
    "/anime/popular",
    { next: { revalidate: 1800 } }
  );
  if (!data) return [];
  return Array.isArray(data) ? data : data.items || [];
}

export async function fetchByGenre(genre: string): Promise<CatalogAnimeItem[]> {
  const data = await catalogFetch<CatalogAnimeItem[] | { items?: CatalogAnimeItem[] }>(
    `/anime/genre/${encodeURIComponent(genre)}`,
    { next: { revalidate: 1800 } }
  );
  if (!data) return [];
  return Array.isArray(data) ? data : data.items || [];
}

export async function fetchByYear(year: number | string): Promise<CatalogAnimeItem[]> {
  const data = await catalogFetch<CatalogAnimeItem[] | { items?: CatalogAnimeItem[] }>(
    `/anime/year/${year}`,
    { next: { revalidate: 3600 } }
  );
  if (!data) return [];
  return Array.isArray(data) ? data : data.items || [];
}

export async function fetchRecentEpisodes(): Promise<CatalogAnimeItem[]> {
  const data = await catalogFetch<CatalogAnimeItem[] | { items?: CatalogAnimeItem[] }>(
    "/anime/recent-episodes",
    { next: { revalidate: 300 } }
  );
  if (!data) return [];
  return Array.isArray(data) ? data : data.items || [];
}

// ---------------------------------------------------------------------------
// 5. Episode Metadata
// ---------------------------------------------------------------------------

export async function fetchCatalogEpisodes(
  malId: number | string,
  options: { cr_season_id?: string; seq_min?: number; seq_max?: number; page?: number; limit?: number; fetchAll?: boolean } = {}
): Promise<CatalogEpisode[]> {
  if (!malId || String(malId) === "0") return [];
  const params = new URLSearchParams();
  if (options.cr_season_id) params.set("cr_season_id", options.cr_season_id);
  if (options.seq_min) params.set("seq_min", String(options.seq_min));
  if (options.seq_max) params.set("seq_max", String(options.seq_max));
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));

  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await catalogFetch<
    | CatalogEpisode[]
    | {
        items?: CatalogEpisode[];
        episodes?: CatalogEpisode[];
        num_episodes?: number;
        has_more?: boolean;
        page?: number;
      }
  >(`/episodes/${malId}${query}`);

  if (!data) return [];
  if (Array.isArray(data)) return data;

  const firstPageEpisodes = data.items || data.episodes || [];

  // If user didn't request a single specific page and there are more episodes across pages, fetch all in parallel
  if (options.page === undefined && options.fetchAll !== false && data.has_more && data.num_episodes && data.num_episodes > 100) {
    const totalPages = Math.min(Math.ceil(data.num_episodes / 100), 20);
    const remainingPagePromises = [];

    for (let p = 2; p <= totalPages; p++) {
      const pParams = new URLSearchParams(params);
      pParams.set("page", String(p));
      remainingPagePromises.push(
        catalogFetch<{ items?: CatalogEpisode[]; episodes?: CatalogEpisode[] }>(
          `/episodes/${malId}?${pParams.toString()}`
        ).catch(() => null)
      );
    }

    const pages = await Promise.all(remainingPagePromises);
    let allEpisodes = [...firstPageEpisodes];
    for (const pageRes of pages) {
      if (pageRes) {
        const eps = pageRes.items || pageRes.episodes || [];
        allEpisodes = allEpisodes.concat(eps);
      }
    }

    return dedupeEpisodesByNumber(allEpisodes);
  }

  // The catalog API can repeat an episode (e.g. overlapping season
  // concatenation) even on a single page, so dedupe here too.
  return dedupeEpisodesByNumber(firstPageEpisodes);
}

/** Keep the first occurrence of each episode number, sorted ascending. */
function dedupeEpisodesByNumber(list: CatalogEpisode[]): CatalogEpisode[] {
  const seen = new Set<number>();
  const unique: CatalogEpisode[] = [];
  for (const ep of list) {
    if (ep && typeof ep.ep === "number" && !seen.has(ep.ep)) {
      seen.add(ep.ep);
      unique.push(ep);
    }
  }
  return unique.sort((a, b) => a.ep - b.ep);
}

// ---------------------------------------------------------------------------
// 6. Fanart & Artwork
// ---------------------------------------------------------------------------

export async function fetchFanart(malId: number | string): Promise<CatalogFanart | null> {
  if (!malId || String(malId) === "0") return null;
  return catalogFetch<CatalogFanart>(`/fanart/${malId}`, { next: { revalidate: 86400 } });
}
