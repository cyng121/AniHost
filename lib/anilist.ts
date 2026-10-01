import "server-only";
import type { ZoroCard } from "./types";

function getBaseUrl(): string {
  const envBase = process.env.ANIGHOST_API_BASE?.trim();
  if (
    envBase &&
    !envBase.includes("vercel.app") &&
    !envBase.includes("localhost")
  ) {
    return envBase.replace(/\/+$/, "");
  }
  return "https://senpaiflix-backend.onrender.com";
}

const API = getBaseUrl();
const ORIGIN = "https://animextrons.co.in";
const API_BASE = `${API}/api/mal`;
const ANIMETV_BASE = `${API}/api/animetv`;
const TIMEOUT_MS = 25_000;

export async function apiFetch<T = any>(
  query: string,
  opts: { revalidate?: number; signal?: AbortSignal; base?: string } = {}
): Promise<T> {
  const base = opts.base || API_BASE;
  const q = query.startsWith("?") || query.startsWith("/") ? query : `?${query}`;
  const url = `${base}${q}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url, {
      headers: {
        Origin: ORIGIN,
        Referer: `${ORIGIN}/`,
        Accept: "application/json",
        "User-Agent": "AniGhost/1.0",
      },
      signal: controller.signal,
      next: { revalidate: opts.revalidate ?? 300 },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`API returned ${res.status}: ${errText || res.statusText}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const getHomeData = () =>
  apiFetch(`?type=home`, { base: ANIMETV_BASE });

export interface AdvancedSearchOptions {
  search?: string;
  query?: string;
  page?: number;
  perPage?: number;
  genres?: string | string[];
  format?: string;
}

export const searchAnime = (
  queryOrParams: string | AdvancedSearchOptions,
  page = 1,
  perPage = 20,
  options: { genres?: string | string[]; format?: string } = {}
) => {
  let search = "";
  let pageNum = page;
  let perPageNum = perPage;
  let genres = options.genres;
  let format = options.format;

  if (typeof queryOrParams === "object" && queryOrParams !== null) {
    search = queryOrParams.search || queryOrParams.query || "";
    pageNum = queryOrParams.page ?? page;
    perPageNum = queryOrParams.perPage ?? perPage;
    genres = queryOrParams.genres ?? genres;
    format = queryOrParams.format ?? format;
  } else {
    search = String(queryOrParams || "");
  }

  let query = `?type=advanced-search&search=${encodeURIComponent(search)}&page=${pageNum}&perPage=${perPageNum}`;

  if (genres) {
    const genreStr = Array.isArray(genres) ? genres.join(",") : genres;
    query += `&genres=${encodeURIComponent(genreStr)}`;
  }

  if (format) {
    query += `&format=${encodeURIComponent(format)}`;
  }

  return apiFetch(query, { base: ANIMETV_BASE });
};

export const advancedSearchAnime = (params: AdvancedSearchOptions) => searchAnime(params);

export const getAnimeById = (id: string | number) =>
  apiFetch(`?type=anime&id=${id}`);

export const getSchedule = (from: number | string, to: number | string) =>
  apiFetch(
    `?type=schedule&from=${from}&to=${to}`
  );

export const getCategory = ({
  page = 1,
  perPage = 20,
  sort,
  status,
  format,
  genre,
  search,
  isAdult,
  mediaType,
}: {
  page?: number;
  perPage?: number;
  sort?: string;
  status?: string;
  format?: string;
  genre?: string;
  search?: string;
  isAdult?: boolean;
  mediaType?: string;
} = {}) => {
  let query =
    `?type=category&page=${page}&perPage=${perPage}`;

  if (sort) {
    query += `&sort=${sort}`;
  }

  if (status) {
    query += `&status=${status}`;
  }

  if (format) {
    query += `&format=${format}`;
  }

  if (genre) {
    query += `&genre=${encodeURIComponent(
      genre
    )}`;
  }

  if (search) {
    query += `&search=${encodeURIComponent(
      search
    )}`;
  }

  if (isAdult !== undefined) {
    query += `&isAdult=${isAdult}`;
  }

  if (mediaType) {
    query += `&mediaType=${mediaType}`;
  }

  return apiFetch(query, { base: ANIMETV_BASE });
};

export const getStudio = (
  search: string,
  page = 1,
  perPage = 20
) =>
  apiFetch(
    `?type=studio&search=${encodeURIComponent(
      search
    )}&page=${page}&perPage=${perPage}`
  );

export const getNextAiring = (id: string | number) =>
  apiFetch(`?type=next-airing&id=${id}`);

export const getSeasons = (id: string | number) =>
  apiFetch(`?type=seasons&id=${id}`);

export const getMangaHome = () =>
  apiFetch(`?type=manga-home`);

export const searchManga = (
  query: string,
  page = 1,
  perPage = 20
) =>
  apiFetch(
    `?type=search-manga&query=${encodeURIComponent(
      query
    )}&page=${page}&perPage=${perPage}`
  );

export const getMangaById = (id: string | number) =>
  apiFetch(`?type=manga&id=${id}`);

// ─────────────────────────────────────────────────────────────
// MANGA NORMALIZER
// ─────────────────────────────────────────────────────────────

export function normalizeManga(m: any) {
  if (!m) return null;

  const title = m.title?.english || m.title?.romaji || "Unknown";
  const japanese_title = m.title?.native || m.title?.romaji || title;
  const image = m.coverImage?.extraLarge || m.coverImage?.large || "https://placehold.co/200x300/111/444?text=No+Cover";
  const author = m.staff?.edges
    ?.filter((e: any) => ["Story", "Art", "Story & Art"].includes(e.role))
    .map((e: any) => e.node?.name?.full)
    .filter(Boolean)
    .join(", ") || "";

  const STATUS_MAP: Record<string, string> = {
    FINISHED: "Finished",
    RELEASING: "Publishing",
    NOT_YET_RELEASED: "Not Yet Released",
    CANCELLED: "Cancelled",
    HIATUS: "On Hiatus",
  };

  return {
    id: String(m.id),
    title,
    japanese_title,
    image,
    banner: m.bannerImage || image,
    author,
    status: STATUS_MAP[m.status] || m.status || "",
    latestChapter: m.chapters ? `${m.chapters} chapters` : m.status === "RELEASING" ? "Ongoing" : "",
    tags: m.genres || [],
    description: m.description ? m.description.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim() : "",
    year: m.startDate?.year || "",
    score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
    chapters: m.chapters || null,
    volumes: m.volumes || null,
    genres: m.genres || [],
    isAdult: m.isAdult || false,
  };
}

// ─────────────────────────────────────────────────────────────
// ANIME NORMALIZER (ADAPTER TO ZoroCard)
// ─────────────────────────────────────────────────────────────

export function normalizeAnime(m: any): ZoroCard {
  if (!m) return {} as ZoroCard;

  const title = m.title?.english || m.title?.romaji || m.title?.native || "Unknown Title";
  const japaneseTitle = m.title?.native || m.title?.romaji || undefined;
  const image = m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium || "";
  const banner = m.bannerImage || image || undefined;

  const episodeNumber = m.nextAiringEpisode?.episode ? m.nextAiringEpisode.episode - 1 : m.episodes ?? undefined;
  const studio = m.studios?.nodes?.find((s: any) => s.isAnimationStudio)?.name || m.studios?.nodes?.[0]?.name || undefined;

  const STATUS_MAP: Record<string, string> = {
    FINISHED: "Finished",
    RELEASING: "Releasing",
    NOT_YET_RELEASED: "Not Yet Released",
    CANCELLED: "Cancelled",
    HIATUS: "On Hiatus",
  };

  return {
    id: String(m.idMal || m.id),
    slug: String(m.idMal || m.id),
    title,
    japaneseTitle,
    image,
    bannerImage: banner,
    banner,
    type: m.format || "TV",
    duration: m.duration ? `${m.duration}m` : undefined,
    subCount: m.episodes ?? undefined,
    totalEpisodes: m.episodes ?? undefined,
    episodeNumber,
    description: m.description ? m.description.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim() : undefined,
    rank: m.averageScore ?? undefined,
    score: m.averageScore ? Math.round(m.averageScore) / 10 : null,
    status: STATUS_MAP[m.status] || m.status || undefined,
    genres: m.genres ?? [],
    studio,
    trailer: m.trailer ?? undefined,
  };
}
