import "server-only";
import { api } from "./backend";

export interface AnimeSeason {
  id: number;
  seasonNumber: number;
  title: string;
  romajiTitle?: string;
  slug: string;
  description?: string;
  cover: string | null;
  banner?: string | null;
  format?: string;
  episodes?: number | null;
  status?: string;
  year?: number | null;
  score?: number | null;
  href: string;
}

export type AnimeRelation = AnimeSeason;

export interface AnimeCharacter {
  id: number;
  name: string;
  nativeName?: string;
  role: string;
  image: string | null;
  voiceActor?: {
    name: string;
    language?: string;
    image?: string | null;
  } | null;
}

export interface AnimeRecommendation {
  id: number;
  title: string;
  romajiTitle?: string;
  englishTitle?: string;
  nativeTitle?: string;
  cover: string | null;
  banner?: string | null;
  format?: string;
  episodes?: number | null;
  status?: string;
  score?: number | null;
  genres?: string[];
  href: string;
}

export interface AnimeTrailer {
  id: string;
  site?: string;
  thumbnail?: string;
}

export interface AnimeFranchiseData {
  seasons: AnimeSeason[];
  characters: AnimeCharacter[];
  recommendations: AnimeRecommendation[];
  trailer?: AnimeTrailer | null;
  anilistId?: number | null;
  malId?: number | null;
}

interface AniListMediaNode {
  id: number;
  idMal?: number | null;
  type?: string;
  format?: string;
  episodes?: number | null;
  status?: string;
  seasonYear?: number | null;
  averageScore?: number | null;
  bannerImage?: string | null;
  description?: string | null;
  title?: {
    userPreferred?: string;
    english?: string;
    romaji?: string;
    native?: string;
  };
  coverImage?: {
    extraLarge?: string;
    large?: string;
    medium?: string;
  };
  trailer?: {
    id?: string;
    site?: string;
    thumbnail?: string;
  } | null;
  recommendations?: {
    nodes?: Array<{
      mediaRecommendation?: {
        id: number;
        idMal?: number | null;
        format?: string;
        episodes?: number | null;
        status?: string;
        averageScore?: number | null;
        genres?: string[];
        title?: {
          userPreferred?: string;
          english?: string;
          romaji?: string;
          native?: string;
        };
        coverImage?: {
          extraLarge?: string;
          large?: string;
          medium?: string;
        };
      };
    }>;
  };
  relations?: {
    edges?: Array<{
      relationType: string;
      node?: AniListMediaNode;
    }>;
  };
  characters?: {
    edges?: Array<{
      role: string;
      node: {
        id: number;
        name?: {
          userPreferred?: string;
          full?: string;
          native?: string;
        };
        image?: {
          large?: string;
          medium?: string;
        };
      };
      voiceActors?: Array<{
        name?: {
          userPreferred?: string;
          full?: string;
          native?: string;
        };
        languageV2?: string;
        image?: {
          large?: string;
          medium?: string;
        };
      }>;
    }>;
  };
}

async function fetchAniListMedia(id?: number | null, search?: string | null): Promise<AniListMediaNode | null> {
  const { getAnimeById, searchAnime } = await import("./anilist");

  try {
    let mediaId: number | null = Number.isFinite(id) && (id ?? 0) > 0 ? Number(id) : null;

    if (!mediaId && search) {
      const searchRes = await searchAnime(search, 1, 1);
      const firstResult = searchRes?.Page?.media?.[0];
      if (firstResult?.id) {
        mediaId = Number(firstResult.id);
      }
    }

    if (!mediaId) return null;

    const data = await getAnimeById(mediaId);
    return data?.Media ?? null;
  } catch {
    return null;
  }
}

interface FranchiseCacheEntry {
  data: AnimeFranchiseData;
  expiresAt: number;
}

const franchiseCache = new Map<string, FranchiseCacheEntry>();
const inFlightFranchise = new Map<string, Promise<AnimeFranchiseData>>();
const FRANCHISE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function makeFranchiseKey(anilistId?: number | null, title?: string): string {
  if (anilistId && Number.isFinite(Number(anilistId)) && Number(anilistId) > 0) {
    return `id:${Number(anilistId)}`;
  }
  return `title:${(title ?? "").trim().toLowerCase()}`;
}

/**
 * Fetch franchise seasons, characters, recommendations, and trailer from AniList worker.
 * Seasons are retrieved directly from /api/anilist?type=seasons&id={anilistId}.
 */
export async function findAnimeFranchiseData(
  anilistId?: number | null,
  title?: string,
): Promise<AnimeFranchiseData> {
  const cacheKey = makeFranchiseKey(anilistId, title);

  const cached = franchiseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const inFlight = inFlightFranchise.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const fetchPromise = (async (): Promise<AnimeFranchiseData> => {
  const id = Number(anilistId);

  // 1. Fetch seasons from /api/anilist?type=seasons&id={anilistId}
  let seasons: AnimeSeason[] = [];
  if (Number.isFinite(id) && id > 0) {
    try {
      const seasonsRes = await api.anilistSeasons(id);
      if (seasonsRes?.ok && Array.isArray(seasonsRes.data) && seasonsRes.data.length > 0) {
        seasons = seasonsRes.data.map((item, index) => {
          const parsedNum = item.season ? parseInt(item.season.replace(/\D/g, ""), 10) : NaN;
          const seasonNumber = Number.isFinite(parsedNum) && parsedNum > 0 ? parsedNum : (item.data_number ?? index) + 1;
          const sTitle = item.title || item.season || `Season ${seasonNumber}`;
          const seasonId = String(item.id ?? item.data_id ?? index + 1);

          return {
            id: Number(item.id ?? item.data_id ?? index + 1),
            seasonNumber,
            title: sTitle,
            slug: seasonId,
            cover: item.season_poster ?? null,
            banner: item.season_poster ?? null,
            format: item.format,
            episodes: item.episodes,
            year: item.seasonYear,
            href: `/watch/${seasonId}/1`,
          };
        });
      }
    } catch {
      // Fallback
    }
  }

  // 2. Fetch characters, recommendations & trailer from AniList worker API
  const characters: AnimeCharacter[] = [];
  const recommendations: AnimeRecommendation[] = [];
  let trailer: AnimeTrailer | null = null;
  let resolvedAnilistId = Number.isFinite(id) && id > 0 ? id : null;
  let resolvedMalId: number | null = null;

  try {
    const root = await fetchAniListMedia(Number.isFinite(id) && id > 0 ? id : null, title);
    if (root) {
      if (!resolvedAnilistId && root.id) {
        resolvedAnilistId = root.id;
      }
      if (root.idMal) {
        resolvedMalId = root.idMal;
      }
      if (root.trailer?.id) {
        trailer = {
          id: root.trailer.id,
          site: root.trailer.site || "youtube",
          thumbnail: root.trailer.thumbnail,
        };
      }
    }

    // Prioritize official working trailer from AniCore
    try {
      const { fetchAniCoreTrailerForAnime } = await import("./anicore-trailers");
      const anicoreTrailer = await fetchAniCoreTrailerForAnime(title || "", resolvedMalId || resolvedAnilistId || (Number.isFinite(id) ? id : null));
      if (anicoreTrailer?.youtubeId) {
        trailer = {
          id: anicoreTrailer.youtubeId,
          site: "youtube",
          thumbnail: anicoreTrailer.thumbnail,
        };
      }
    } catch {
      // Fallback to existing trailer
    }

    // Characters extraction
    if (root?.characters?.edges) {
      const seenChars = new Set<number>();
      for (const edge of root.characters.edges) {
        const node = edge?.node;
        if (!node || seenChars.has(node.id)) continue;
        seenChars.add(node.id);

        const va = edge.voiceActors?.[0];
        characters.push({
          id: node.id,
          name: node.name?.userPreferred || node.name?.full || "Character",
          nativeName: node.name?.native,
          role: edge.role === "MAIN" ? "Main" : "Supporting",
          image: node.image?.large ?? node.image?.medium ?? null,
          voiceActor: va
            ? {
                name: va.name?.userPreferred || va.name?.full || "",
                language: va.languageV2 || "Japanese",
                image: va.image?.large ?? va.image?.medium ?? null,
              }
            : null,
        });
      }
    }

    // Recommendations extraction
    if (root?.recommendations?.nodes) {
      const seenRecs = new Set<number>();
      for (const edge of root.recommendations.nodes) {
        const rec = edge?.mediaRecommendation;
        if (!rec || !rec.id || seenRecs.has(rec.id)) continue;
        seenRecs.add(rec.id);

        const recTitle = rec.title?.english || rec.title?.userPreferred || rec.title?.romaji || "Anime";
        recommendations.push({
          id: rec.id,
          title: recTitle,
          romajiTitle: rec.title?.romaji,
          englishTitle: rec.title?.english,
          nativeTitle: rec.title?.native,
          cover: rec.coverImage?.extraLarge || rec.coverImage?.large || rec.coverImage?.medium || null,
          format: rec.format,
          episodes: rec.episodes,
          status: rec.status,
          score: rec.averageScore,
          genres: rec.genres,
          href: `/anime/${rec.id}`,
        });
      }
    }
  } catch {
    // Ignore AniList error
  }

  return {
    seasons,
    characters,
    recommendations,
    trailer,
    anilistId: resolvedAnilistId,
    malId: resolvedMalId,
  };
  })();

  inFlightFranchise.set(cacheKey, fetchPromise);
  try {
    const data = await fetchPromise;
    const expiresAt = Date.now() + FRANCHISE_CACHE_TTL_MS;
    franchiseCache.set(cacheKey, { data, expiresAt });
    if (data.anilistId) {
      franchiseCache.set(`id:${data.anilistId}`, { data, expiresAt });
    }
    if (title) {
      franchiseCache.set(`title:${title.trim().toLowerCase()}`, { data, expiresAt });
    }
    return data;
  } finally {
    inFlightFranchise.delete(cacheKey);
  }
}
