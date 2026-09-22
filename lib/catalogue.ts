import "server-only";
import { api, backendGet } from "./backend";
import type { ZoroEpisode, ZoroInfo } from "./types";

/**
 * One place that answers "what is this title, and what can I watch?".
 *
 * /zoro/info already returns the full episode list with the opaque `ids`
 * handles, so the common path is a single request. Some titles come back with
 * an empty list even though /zoro/episodes has them, so that endpoint stays as
 * a fallback rather than as the default second round trip.
 */

export type TitleResult =
  | { ok: true; info: ZoroInfo; episodes: ZoroEpisode[]; episodeError?: string }
  | { ok: false; status: number; error: string };

interface MappingData {
  title?: { english?: string; romaji?: string; native?: string };
  cover_image?: string;
  format?: string;
  status?: string;
  episodes?: number;
  mal_id?: number;
  synonyms?: string[];
}

interface TitleCacheEntry {
  data: TitleResult;
  expiresAt: number;
}

const titleCache = new Map<string, TitleCacheEntry>();
const inFlightTitles = new Map<string, Promise<TitleResult>>();
const TITLE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function normalizeTitleKey(slug: string): string {
  return slug.trim().toLowerCase();
}

export function getCachedTitle(slug: string): TitleResult | null {
  const key = normalizeTitleKey(slug);
  const entry = titleCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  return null;
}

export function setCachedTitle(keys: (string | number | undefined | null)[], data: TitleResult) {
  const expiresAt = Date.now() + TITLE_CACHE_TTL_MS;
  for (const k of keys) {
    if (k != null) {
      const normalized = normalizeTitleKey(String(k));
      if (normalized) {
        titleCache.set(normalized, { data, expiresAt });
      }
    }
  }
}

export async function loadTitle(slug: string): Promise<TitleResult> {
  const key = normalizeTitleKey(slug);

  const cached = getCachedTitle(key);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightTitles.get(key);
  if (inFlight) {
    return inFlight;
  }

  const fetchPromise = (async (): Promise<TitleResult> => {
    let mappingData: MappingData | null = null;
    let anilistId: number | string | null = null;
    let malId: number | string | null = null;
    let media: any = null;
    let malMedia: any = null;

    if (/^\d+$/.test(slug)) {
      anilistId = slug;

      // 1. First test if animetv returns valid media details for this ID
      try {
        const { getAnimeById } = await import("./anilist");
        const aniData = await getAnimeById(slug);
        const hasDetails = Boolean(
          aniData?.Media?.coverImage?.extraLarge ||
          aniData?.Media?.coverImage?.large ||
          aniData?.Media?.bannerImage ||
          (aniData?.Media?.title?.romaji && !aniData.Media.title.romaji.startsWith("http"))
        );
        if (hasDetails) {
          media = aniData.Media;
          malId = media.idMal || slug;
        }
      } catch {
        // Fallback
      }

      // 2. If no usable media was found, slug is likely an AniList ID. Resolve to MAL ID via ARM.
      if (!media) {
        try {
          const armRes = await fetch(`https://arm.haglund.dev/api/v2/ids?source=anilist&id=${slug}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(4000),
            next: { revalidate: 86_400 },
          });
          if (armRes.ok) {
            const arm = await armRes.json();
            if (arm?.myanimelist) {
              malId = arm.myanimelist;
              const { getAnimeById } = await import("./anilist");
              const crData = await getAnimeById(arm.myanimelist);
              if (crData?.Media) {
                media = crData.Media;
              }
            }
          }
        } catch {
          // ARM unavailable
        }
      }
    } else {
      const cleanSearch = slug
        .replace(/-\d+$/, "")
        .replace(/-/g, " ")
        .trim();

      try {
        const { searchAnime } = await import("./anilist");
        const searchRes = await searchAnime(cleanSearch || slug.replace(/-/g, " "), 1, 1);
        const first = searchRes?.Page?.media?.[0];
        if (first?.id) {
          anilistId = first.id;
          malId = first.idMal || first.id;
          media = first;
        }
      } catch {
        // Fallback
      }
    }

    const targetMalId = malId || media?.idMal || (media?.id && /^\d+$/.test(String(media.id)) ? media.id : null);

    // Fetch canonical MAL metadata (titles, full synopsis, genres, studios, status, episodes, score)
    if (targetMalId) {
      try {
        const malRes = await backendGet<{ Media: any }>(`/api/mal?type=anime&id=${targetMalId}`, {
          revalidate: 21_600,
        });
        if (malRes.ok && malRes.data?.Media) {
          malMedia = malRes.data.Media;
        }
      } catch {
        // MAL fallback
      }
    }

    if (!media && !malMedia && anilistId) {
      try {
        const mapRes = await backendGet<MappingData>(
          `/api/mapping?anilist_id=${anilistId}`,
          { revalidate: 86_400 },
        );
        if (mapRes.ok && mapRes.data) {
          mappingData = mapRes.data;
        }
      } catch {
        // Ignore
      }
    }

    if (!media && !malMedia && !mappingData) {
      return { ok: false, status: 404, error: "Anime title not found" };
    }

    const isUrl = (s?: string | null) => typeof s === "string" && s.startsWith("http");
    const titleStr =
      (!isUrl(malMedia?.title?.english) && malMedia?.title?.english) ||
      (!isUrl(malMedia?.title?.romaji) && malMedia?.title?.romaji) ||
      (!isUrl(media?.title?.english) && media?.title?.english) ||
      (!isUrl(media?.title?.romaji) && media?.title?.romaji) ||
      (!isUrl(media?.title?.userPreferred) && media?.title?.userPreferred) ||
      (!isUrl(mappingData?.title?.english) && mappingData?.title?.english) ||
      (!isUrl(mappingData?.title?.romaji) && mappingData?.title?.romaji) ||
      (!isUrl(media?.title?.native) && media?.title?.native) ||
      (!isUrl(malMedia?.title?.native) && malMedia?.title?.native) ||
      slug.replace(/-/g, " ");

    const effectiveId = malId || media?.idMal || media?.id || anilistId || slug;

    const info: ZoroInfo = {
      id: String(effectiveId),
      slug: String(effectiveId),
      title: titleStr,
      japaneseTitle: malMedia?.title?.native || media?.title?.native || mappingData?.title?.native || media?.title?.romaji,
      image:
        media?.coverImage?.extraLarge ||
        media?.coverImage?.large ||
        malMedia?.coverImage?.extraLarge ||
        malMedia?.coverImage?.large ||
        mappingData?.cover_image,
      bannerImage:
        media?.bannerImage ||
        malMedia?.bannerImage ||
        media?.coverImage?.extraLarge ||
        media?.coverImage?.large ||
        undefined,
      type: media?.format || malMedia?.format || mappingData?.format || "TV",
      status: malMedia?.status || media?.status || mappingData?.status || "Finished",
      totalEpisodes: malMedia?.episodes || media?.episodes || mappingData?.episodes,
      anilistId: Number(anilistId || media?.id || effectiveId),
      malId: targetMalId ? Number(targetMalId) : (/^\d+$/.test(String(effectiveId)) ? Number(effectiveId) : null),
      synonyms: malMedia?.synonyms?.length ? malMedia.synonyms : (media?.synonyms || mappingData?.synonyms),
      description: malMedia?.description || media?.description,
      genres: malMedia?.genres?.length ? malMedia.genres : (media?.genres || []),
      score: malMedia?.averageScore ?? media?.averageScore ?? media?.meanScore ?? null,
      year: malMedia?.seasonYear || malMedia?.startDate?.year || media?.seasonYear || media?.startDate?.year || undefined,
      isAdult: malMedia?.isAdult ?? media?.isAdult ?? false,
      nextAiringEpisode: media?.nextAiringEpisode
        ? { episode: media.nextAiringEpisode.episode, airingAt: media.nextAiringEpisode.airingAt }
        : null,
      studios: malMedia?.studios?.nodes?.length
        ? malMedia.studios.nodes.map((n: any) => n.name).filter(Boolean)
        : (media?.studios?.nodes?.length
          ? media.studios.nodes.map((n: any) => n.name).filter(Boolean)
          : undefined),
    };

    let inline: ZoroEpisode[] = [];
    const targetEpisodeId = info.malId || info.anilistId || effectiveId;

    // Fetch episode metadata and seasons
    if (targetEpisodeId) {
      try {
        let [episodesRes, seasonsRes] = await Promise.all([
          api.anilistEpisodes(targetEpisodeId),
          api.anilistSeasons(targetEpisodeId),
        ]);

        // Fallback to /api/mal?type=episodes if animetv returned empty or dummy (length <= 1 and no image)
        if (
          !episodesRes.ok ||
          !Array.isArray(episodesRes.data) ||
          episodesRes.data.length === 0 ||
          (episodesRes.data.length === 1 && !episodesRes.data[0].img)
        ) {
          const malEpRes = await backendGet<any[]>(`/api/mal?type=episodes&id=${targetEpisodeId}`, {
            revalidate: 21_600,
          });
          if (malEpRes.ok && Array.isArray(malEpRes.data) && malEpRes.data.length > 0) {
            episodesRes = malEpRes;
          }
        }

        if (episodesRes && episodesRes.ok && Array.isArray(episodesRes.data) && episodesRes.data.length > 0) {
          // Normalize list: if single episode has number 0 (like a movie), normalize it to episode 1
          const rawList = episodesRes.data.map((item) => {
            const num = Number(item.number);
            if (episodesRes.data.length === 1 && (!Number.isFinite(num) || num <= 0)) {
              return { ...item, number: 1 };
            }
            return item;
          });

          // Filter and deduplicate by episode number, preferring items with high-res img
          const validEpisodes = rawList
            .filter((item) => Number(item.number) > 0 || rawList.length === 1)
            .sort((a, b) => Number(a.number) - Number(b.number));

          const epMap = new Map<number, (typeof episodesRes.data)[0]>();
          for (const ep of validEpisodes) {
            const num = Number(ep.number) > 0 ? Number(ep.number) : 1;
            const existing = epMap.get(num);
            if (!existing || (!existing.img && ep.img)) {
              epMap.set(num, { ...ep, number: num });
            }
          }

          const sortedList = Array.from(epMap.values()).sort((a, b) => Number(a.number) - Number(b.number));

          if (!inline.length) {
            inline = sortedList.map((item, idx) => ({
              number: Number(item.number ?? idx + 1),
              slug: String(item.number ?? idx + 1),
              title: item.title || `Episode ${item.number ?? idx + 1}`,
              description: item.description,
              thumbnail: item.img || info.image,
              ids: "",
              sub: true,
              dub: true,
            }));
          } else {
            inline = inline.map((ep) => {
              const meta = epMap.get(ep.number);
              return {
                ...ep,
                title: meta?.title || ep.title,
                thumbnail: meta?.img || ep.thumbnail || info.image,
                description: meta?.description || ep.description,
              };
            });
          }
        }

        // Enrich or replace with full catalog episode dataset if catalog has more episodes
        try {
          const { fetchCatalogEpisodes } = await import("./catalog");
          const catalogEps = await fetchCatalogEpisodes(targetEpisodeId);
          if (catalogEps && catalogEps.length > 0) {
            if (!inline.length || catalogEps.length > inline.length) {
              inline = catalogEps.map((item, idx) => ({
                number: Number(item.ep ?? idx + 1),
                slug: String(item.ep ?? idx + 1),
                title: item.title || `Episode ${item.ep ?? idx + 1}`,
                description: undefined,
                thumbnail: item.thumbnail || info.image,
                ids: "",
                sub: true,
                dub: true,
              }));
            } else {
              const catMap = new Map<number, (typeof catalogEps)[0]>();
              for (const ce of catalogEps) {
                if (typeof ce.ep === "number") catMap.set(ce.ep, ce);
              }
              inline = inline.map((ep) => {
                const cat = catMap.get(ep.number);
                return {
                  ...ep,
                  title: (ep.title?.startsWith("Episode ") && cat?.title ? cat.title : (ep.title || cat?.title)) || `Episode ${ep.number}`,
                  thumbnail: cat?.thumbnail || ep.thumbnail || info.image,
                };
              });
            }
          }
        } catch {
          // Ignore catalog fallback error
        }

        if (seasonsRes && seasonsRes.ok && Array.isArray(seasonsRes.data) && seasonsRes.data.length > 0) {
          info.seasons = seasonsRes.data.map((s, idx) => ({
            id: s.id ?? s.data_id ?? idx + 1,
            data_number: s.data_number,
            data_id: s.data_id,
            season: s.season,
            title: s.title || s.season || `Season ${idx + 1}`,
            seasonYear: s.seasonYear,
            format: s.format,
            episodes: s.episodes,
            season_poster: s.season_poster,
          }));
        }
      } catch {
        // Ignore network failure and return usable episodes
      }
    }

    return { ok: true, info, episodes: inline };
  })();

  inFlightTitles.set(key, fetchPromise);
  try {
    const result = await fetchPromise;
    if (result.ok) {
      setCachedTitle(
        [
          slug,
          result.info.slug,
          result.info.id,
          result.info.anilistId,
          result.info.malId,
        ],
        result,
      );
    }
    return result;
  } finally {
    inFlightTitles.delete(key);
  }
}

/** Drop invalid episodes and sort by number. */
function usable(list?: ZoroEpisode[]): ZoroEpisode[] {
  return (list ?? [])
    .filter((e) => e && Number.isFinite(e.number))
    .sort((a, b) => a.number - b.number);
}

/**
 * The scrapers write "Unknown", "?", "N/A" and empty strings interchangeably
 * for a missing field. Everything the UI prints goes through here first.
 */
export function present(value: unknown): string | undefined {
  if (value == null) return undefined;
  const cleaned = String(value)
    // Raw entities leak out of the scraper: premiered comes back as "&NBSP ?".
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    // "WINTER ?" and friends: keep the part that is real, drop the placeholder.
    .replace(/\s*\?+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return undefined;
  if (/^(unknown|n\/?a|null|undefined|-+|\?)$/i.test(cleaned)) return undefined;
  return cleaned;
}
