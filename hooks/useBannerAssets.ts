"use client";

/**
 * useBannerAssets
 */

import { useState, useEffect } from "react";

const API = "https://movexa0r5-api.vercel.app/api/tmdb";
const TMDB_IMG = "https://image.tmdb.org/t/p/original";

// Patterns that indicate sequel/season suffix
const SEASON_PATTERNS = [
  /\s+(season\s*\d+|part\s*\d+|cour\s*\d+|\d+(?:st|nd|rd|th)\s+season)/i,
  /\s+(final\s+season|final\s+part|the\s+final)/i,
  /\s+(arc|saga|chapter|volume|series)\b.*/i,
  /\s*:\s*.+$/i,
  /\s+\d{4}$/i,
];

function stripSeasonSuffix(title: string): string | null {
  let t = title.trim();

  for (const re of SEASON_PATTERNS) {
    const stripped = t.replace(re, "").trim();

    if (stripped && stripped !== t) {
      return stripped;
    }
  }

  return null;
}

// Cache
const CACHE_KEY_PREFIX = "banner_assets_";
const _cache = new Map<string, { logo: string | null; backdrop: string | null }>();

// Initialize memory cache from localStorage on startup (client-only)
if (typeof window !== "undefined") {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        const realKey = key.replace(CACHE_KEY_PREFIX, "");
        try {
          const item = JSON.parse(localStorage.getItem(key) || "{}");
          _cache.set(realKey, item);
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Ignore
  }
}

/**
 * Fetch clearlogo and backdrop from TMDB
 */
async function fetchLogo(title: string): Promise<{ logo: string | null; backdrop: string | null } | null> {
  try {
    // Search TV
    const searchRes = await fetch(
      `${API}/search/tv?query=${encodeURIComponent(title)}&page=1`
    );

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const results: Array<{
      id: number;
      genre_ids?: number[];
      origin_country?: string[];
    }> = searchData.results || [];

    // Anime / JP filter
    const match = results.find((r) => {
      const isAnimated = (r.genre_ids || []).includes(16);
      const isJapanese = (r.origin_country || []).includes("JP");
      return isAnimated || isJapanese;
    });

    if (!match) return null;

    // Images
    const imgRes = await fetch(
      `${API}/tv/${match.id}/images?include_image_language=en,null`
    );

    if (!imgRes.ok) return null;

    const imgData = await imgRes.json();

    const logos: Array<{
      file_path: string;
      iso_639_1: string | null;
      vote_average?: number;
    }> = (imgData.logos || [])
      .filter((l: any) => l.iso_639_1 === "en" || l.iso_639_1 === null)
      .sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0));

    const bestLogo = logos[0] ?? null;

    // Also fetch all valid backdrops
    const backdrops: Array<{
      file_path: string;
      iso_639_1: string | null;
      vote_average?: number;
    }> = (imgData.backdrops || [])
      .filter((b: any) => b.iso_639_1 === null || b.iso_639_1 === "en")
      .sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0));

    const backdropUrls = backdrops.map((b) => `${TMDB_IMG}${b.file_path}`);

    return {
      logo: bestLogo ? `${TMDB_IMG}${bestLogo.file_path}` : null,
      backdrop: backdropUrls[0] || null, // Pick highest rated / first backdrop
    };
  } catch {
    return null;
  }
}

export function useBannerAssets(
  title?: string | null,
  anilistId?: string | number | null
): { logo: string | null; backdrop: string | null } {
  const [logo, setLogo] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<string | null>(null);

  useEffect(() => {
    if (!title) return;

    const key = anilistId ? String(anilistId) : title;

    // Cache hit
    if (_cache.has(key)) {
      const cached = _cache.get(key);
      setLogo(cached?.logo ?? null);
      setBackdrop(cached?.backdrop ?? null);
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const hasAssets = (res: { logo: string | null; backdrop: string | null } | null) =>
          res && (res.logo || res.backdrop);

        // Exact title
        let result = await fetchLogo(title!);

        // Strip season suffix
        if (!hasAssets(result)) {
          const rootTitle = stripSeasonSuffix(title!);

          if (rootTitle) {
            result = await fetchLogo(rootTitle);
          }
        }

        // Progressive fallback
        if (!hasAssets(result)) {
          let t = title!;

          while (!hasAssets(result)) {
            const next = stripSeasonSuffix(t);

            if (!next || next === t) break;

            result = await fetchLogo(next);

            t = next;
          }
        }

        const logoUrl = result?.logo ?? null;
        const backdropUrl = result?.backdrop ?? null;

        const cacheData = { logo: logoUrl, backdrop: backdropUrl };
        _cache.set(key, cacheData);

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              CACHE_KEY_PREFIX + key,
              JSON.stringify(cacheData)
            );
          } catch {
            // Ignore storage errors
          }
        }

        if (!cancelled) {
          setLogo(logoUrl);
          setBackdrop(backdropUrl);
        }
      } catch (err) {
        console.error("Banner asset fetch failed:", err);

        const cacheData = { logo: null, backdrop: null };
        _cache.set(key, cacheData);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [title, anilistId]);

  return {
    logo,
    backdrop,
  };
}
