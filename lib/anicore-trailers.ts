import type { AnimeShortItem } from "@/components/ShortsPlayer";

const ANICORE_API = "https://anicore.dpdns.org/v1";

interface AnicoreTrailerItem {
  id?: number;
  name?: string | null;
  url?: string;
  youtubeId?: string | null;
  embedUrl?: string | null;
  thumbnail?: string | null;
  language?: string | null;
}

interface AnicoreAnime {
  id: number;
  slug?: string | null;
  title: string;
  titleEnglish?: string | null;
  titleNative?: string | null;
  synopsis?: string | null;
  description?: string | null;
  images?: {
    poster?: string | null;
    cover?: string | null;
    banner?: string | null;
  } | null;
  trailer?: {
    url?: string | null;
    youtubeId?: string | null;
    thumbnail?: string | null;
    embedUrl?: string | null;
  } | null;
  genres?: Array<{ name: string }>;
  scores?: {
    average?: number | null;
    anilist?: number | null;
    mal?: number | null;
  } | null;
}

/**
 * In-place Fisher-Yates shuffle to ensure 100% random, non-sequential order.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Fetch official trailer items for a specific anime slug from AniCore.
 */
export async function fetchAniCoreAnimeTrailers(slug: string): Promise<AnicoreTrailerItem[]> {
  try {
    const res = await fetch(`${ANICORE_API}/anime/${encodeURIComponent(slug)}/trailers`, {
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

/**
 * Fast check to verify if a YouTube trailer video is active, public, and playable (not private or deleted).
 */
export async function verifyYouTubeTrailer(youtubeId: string): Promise<boolean> {
  if (!youtubeId || typeof youtubeId !== "string") return false;
  const cleanId = youtubeId.trim();
  if (!cleanId) return false;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}&format=json`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Fetch a single official working YouTube trailer for a specific anime from AniCore,
 * with fast availability validation and fallback for private/unavailable YouTube videos.
 */
export async function fetchAniCoreTrailerForAnime(
  slugOrTitle: string,
  externalId?: number | null
): Promise<{ youtubeId: string; thumbnail?: string } | null> {
  try {
    const isNumeric = /^\d+$/.test(slugOrTitle.trim());
    const malId = externalId || (isNumeric ? Number(slugOrTitle) : null);
    const cleanSlug = !isNumeric
      ? slugOrTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      : "";

    // 1. Try direct slug endpoint on AniCore if non-numeric
    if (cleanSlug) {
      try {
        const res = await fetch(`${ANICORE_API}/anime/${encodeURIComponent(cleanSlug)}`, {
          signal: AbortSignal.timeout(3000),
          next: { revalidate: 3600 },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.trailer?.youtubeId) {
            const ytId = data.trailer.youtubeId;
            if (await verifyYouTubeTrailer(ytId)) {
              return {
                youtubeId: ytId,
                thumbnail: data.trailer.thumbnail || `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
              };
            }
          }
        }
      } catch {
        // Fallthrough
      }
    }

    // 2. Search AniCore using search= parameter
    const searchKeywords = Array.from(
      new Set([
        slugOrTitle.split(/[-:–]/)[0].trim(),
        slugOrTitle.replace(/[-_]+/g, " ").trim(),
      ])
    ).filter((s) => s.length > 1);

    let searchItems: any[] = [];

    for (const keyword of searchKeywords) {
      try {
        const res = await fetch(`${ANICORE_API}/anime?search=${encodeURIComponent(keyword)}&perPage=10`, {
          signal: AbortSignal.timeout(3000),
          next: { revalidate: 3600 },
        });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data?.items) ? data.items : [];
          if (items.length > 0) {
            searchItems = items;
            const targetLower = slugOrTitle.toLowerCase().trim();

            const match = items.find((item: any) => {
              if (malId && item.externalIds) {
                if (item.externalIds.mal === malId || item.externalIds.anilist === malId) {
                  return true;
                }
              }
              const t1 = (item.title || "").toLowerCase();
              const t2 = (item.titleEnglish || "").toLowerCase();
              return t1 === targetLower || t2 === targetLower || t1.includes(targetLower) || targetLower.includes(t1);
            });

            if (match?.trailer?.youtubeId) {
              const ytId = match.trailer.youtubeId;
              if (await verifyYouTubeTrailer(ytId)) {
                return {
                  youtubeId: ytId,
                  thumbnail: match.trailer.thumbnail || `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
                };
              }
            }
          }
        }
      } catch {
        // Try next keyword
      }
    }

    // 3. Fallback A: Jikan API by MAL ID (Fixes private YouTube videos like Re:ZERO 31240)
    if (malId) {
      try {
        const jRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (jRes.ok) {
          const jData = await jRes.json();
          const embedUrl = jData.data?.trailer?.embed_url;
          const ytMatch = embedUrl?.match(/(?:embed\/|v\/|watch\?v=)([\w-]{11})/);
          const jYtId = ytMatch ? ytMatch[1] : jData.data?.trailer?.youtube_id;
          if (jYtId && (await verifyYouTubeTrailer(jYtId))) {
            return {
              youtubeId: jYtId,
              thumbnail: jData.data?.trailer?.images?.maximum_image_url || `https://img.youtube.com/vi/${jYtId}/maxresdefault.jpg`,
            };
          }
        }
      } catch {
        // Fallthrough
      }
    }

    // 4. Fallback B: Other verified franchise items from AniCore search results
    for (const item of searchItems) {
      const ytId = item.trailer?.youtubeId;
      if (ytId && (await verifyYouTubeTrailer(ytId))) {
        return {
          youtubeId: ytId,
          thumbnail: item.trailer?.thumbnail || `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a massive pool of anime trailers exclusively from AniCore (32,000+ anime catalogue)
 * and randomly shuffle them.
 */
export async function fetchAniCoreShorts(options: { randomPages?: boolean } = {}): Promise<AnimeShortItem[]> {
  try {
    // Sample random pages across the catalogue
    const pageA = options.randomPages ? Math.floor(Math.random() * 30) + 1 : 1;
    const pageB = Math.floor(Math.random() * 50) + 2;
    const pageC = Math.floor(Math.random() * 120) + 20;

    const pageUrls = [
      `${ANICORE_API}/anime?hasTrailer=true&page=${pageA}&perPage=25`,
      `${ANICORE_API}/anime?hasTrailer=true&page=${pageB}&perPage=25`,
      `${ANICORE_API}/anime?hasTrailer=true&page=${pageC}&perPage=25`,
    ];

    const responses = await Promise.all(
      pageUrls.map(async (url) => {
        try {
          const res = await fetch(url, {
            signal: AbortSignal.timeout(4500),
            next: { revalidate: 300 },
          });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data?.items) ? (data.items as AnicoreAnime[]) : [];
        } catch {
          return [];
        }
      })
    );

    const items = responses.flat();
    if (items.length === 0) return [];

    const pool: AnimeShortItem[] = [];
    const seenYoutubeIds = new Set<string>();

    for (const item of items) {
      const ytId = item.trailer?.youtubeId?.trim();
      if (!ytId || seenYoutubeIds.has(ytId)) continue;
      seenYoutubeIds.add(ytId);

      const slug =
        item.slug ||
        item.title
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") ||
        String(item.id);

      const title = item.titleEnglish || item.title || "Anime";
      const avatar = item.images?.poster || item.images?.cover || "";
      const poster =
        item.trailer?.thumbnail ||
        `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` ||
        avatar;

      const tags = (item.genres || []).map((g) => g.name).slice(0, 3);
      if (tags.length === 0) tags.push("Anime", "Trailer");

      const score = item.scores?.average ?? Math.floor(Math.random() * 25 + 72);
      const likes = `${(score * 1.6 + Math.random() * 20).toFixed(1)}K`;
      const comments = `${((score / 6) * 1.2 + Math.random() * 5).toFixed(1)}K`;

      pool.push({
        id: `anicore-${item.id}-${ytId}`,
        slug,
        title: `${title} - Official Trailer`,
        handle: `@${slug.replace(/-/g, "").slice(0, 14)}`,
        avatar: avatar || poster,
        poster,
        trailerYoutubeId: ytId,
        likes,
        comments,
        tags,
        description: item.synopsis || item.description || `${title} (Official Trailer)`,
      });
    }

    return shuffleArray(pool);
  } catch (err) {
    console.error("[anicore] fetchAniCoreShorts error:", err);
    return [];
  }
}
