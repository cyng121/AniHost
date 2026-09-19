import type { ZoroScheduleEntry } from "./types";

const ANICORE_API = "https://anicore.dpdns.org/v1";

export interface AniCoreScheduleAnime {
  id: number;
  slug: string;
  title: string;
  titleEnglish?: string | null;
  titleNative?: string | null;
  format?: string | null;
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  images?: {
    poster?: string | null;
    cover?: string | null;
    banner?: string | null;
    logo?: string | null;
  } | null;
  trailer?: {
    url?: string | null;
    youtubeId?: string | null;
    thumbnail?: string | null;
    embedUrl?: string | null;
  } | null;
  scores?: {
    average?: number | null;
    anilist?: number | null;
    mal?: number | null;
    malRank?: number | null;
    malMembers?: number | null;
    anilistPopularity?: number | null;
  } | null;
  genres?: Array<{ name: string; slug: string; kind?: string }>;
  studios?: Array<{ name: string; slug: string }>;
}

export interface AniCoreScheduleItem {
  id: number;
  animeId: number;
  number: number;
  seasonNumber?: number;
  title?: string | null;
  airDate: string; // "YYYY-MM-DD"
  runtimeMinutes?: number | null;
  thumbnail?: string | null;
  day: string; // "Monday", "Tuesday", etc.
  time?: string | null; // "23:30", "00:00", etc.
  anime: AniCoreScheduleAnime;
}

export interface AniCoreScheduleResponse {
  window?: { from?: string; to?: string };
  total?: number;
  items: AniCoreScheduleItem[];
}

/**
 * Fetch official schedule from AniCore API (https://anicore.dpdns.org/v1/schedule?days=7)
 */
export async function fetchAniCoreSchedule(days = 7): Promise<AniCoreScheduleItem[]> {
  try {
    const res = await fetch(`${ANICORE_API}/schedule?days=${days}`, {
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 900 },
    });
    if (!res.ok) {
      console.warn(`[AniCore Schedule] returned status ${res.status}`);
      return [];
    }
    const data: AniCoreScheduleResponse = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err) {
    console.error("[AniCore Schedule] Error fetching schedule:", err);
    return [];
  }
}

/**
 * Convert an AniCoreScheduleItem into a rich ZoroScheduleEntry with poster, logo, score, studios, and genres.
 */
export function normalizeAniCoreScheduleItem(item: AniCoreScheduleItem): ZoroScheduleEntry {
  const anime = item.anime || {};
  const english = anime.titleEnglish?.trim();
  const mainTitle = anime.title?.trim() || english || anime.titleNative || "Unknown Title";
  const displayTitle = english && english !== mainTitle ? english : mainTitle;
  const japaneseTitle = anime.titleNative || (anime.title !== displayTitle ? anime.title : undefined);

  const poster = anime.images?.poster || anime.images?.cover || item.thumbnail || undefined;
  const cover = anime.images?.cover || anime.images?.banner || poster;
  const banner = anime.images?.banner || anime.images?.cover || poster;
  const logo = anime.images?.logo || undefined;

  const epNum = item.number || item.seasonNumber;
  const episodeLabel = item.number ? `EP ${item.number}` : undefined;

  const scoreVal = anime.scores?.average ?? anime.scores?.anilist ?? (anime.scores?.mal ? anime.scores.mal * 10 : null);

  return {
    id: String(item.id || item.animeId || anime.id),
    slug: anime.slug || String(anime.id),
    title: displayTitle,
    japaneseTitle,
    englishTitle: english || undefined,
    time: item.time || undefined,
    episodeLabel,
    episodeNumber: epNum,
    image: poster,
    poster,
    cover,
    banner,
    logo,
    type: anime.format || "TV",
    airDate: item.airDate,
    day: item.day,
    score: scoreVal ? Math.round(scoreVal) / 10 : null,
    genres: (anime.genres || []).map((g) => g.name).filter(Boolean),
    studios: (anime.studios || []).map((s) => s.name).filter(Boolean),
  };
}
