"use client";

/**
 * useCrunchyrollBanner
 *
 * Fetches the `detail_banner` (and optionally `title_logo`) from:
 *   https://catalog.animetvplus.site/api/cr/card/{mal_id}
 *
 * The `detail_banner` is a 1920-px wide keyart backdrop — perfect for the
 * `.yt-channel-banner` container which uses object-fit: cover.
 *
 * Returns null values while loading or when no mal_id is available.
 */

import { useState, useEffect } from "react";
import { fetchCrCard, CatalogCrCard } from "@/lib/catalog";

const PROXY_API = "/api/crcard";

// Module-level memory cache keyed by mal_id string
const _cache = new Map<string, {
  detailBanner: string | null;
  heroBanner: string | null;
  titleLogo: string | null;
  poster: string | null;
}>();

async function getCrCardAssets(
  malId: number | string
): Promise<{ detailBanner: string | null; heroBanner: string | null; titleLogo: string | null; poster: string | null }> {
  const key = String(malId);

  if (_cache.has(key)) {
    return _cache.get(key)!;
  }

  const NULL_RESULT = { detailBanner: null, heroBanner: null, titleLogo: null, poster: null };

  try {
    let data: CatalogCrCard | null = await fetchCrCard(malId, false);

    // Fallback to local proxy if direct response was null
    if (!data) {
      try {
        const res = await fetch(`${PROXY_API}/${key}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // Ignore
      }
    }

    if (!data) {
      _cache.set(key, NULL_RESULT);
      return NULL_RESULT;
    }

    const result = {
      detailBanner: data.detail_banner || null,
      heroBanner: data.hero_banner || null,
      titleLogo: data.title_logo || null,
      poster: data.poster || null,
    };

    _cache.set(key, result);
    return result;
  } catch {
    _cache.set(key, NULL_RESULT);
    return NULL_RESULT;
  }
}

export interface CrBannerAssets {
  /** Wide 1920-px keyart backdrop from Crunchyroll */
  detailBanner: string | null;
  /** Cinematic hero banner (fallback to detail_banner) */
  heroBanner: string | null;
  /** Localized title logo from Crunchyroll */
  titleLogo: string | null;
  /** Crunchyroll poster/thumbnail (480×720) */
  poster: string | null;
  /**
   * True once the fetch has settled (success or failure).
   * Use this to avoid falling back to a lower-priority source while still loading.
   */
  loaded: boolean;
}

export function useCrunchyrollBanner(malId?: number | string | null): CrBannerAssets {
  const [detailBanner, setDetailBanner] = useState<string | null>(null);
  const [heroBanner, setHeroBanner] = useState<string | null>(null);
  const [titleLogo, setTitleLogo] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (malId == null || malId === "" || Number(malId) <= 0) {
      // No valid mal_id — treat as settled with no data
      setLoaded(true);
      return;
    }

    const key = String(malId);

    // Sync hit — populate immediately from cache, already settled
    if (_cache.has(key)) {
      const cached = _cache.get(key)!;
      setDetailBanner(cached.detailBanner);
      setHeroBanner(cached.heroBanner);
      setTitleLogo(cached.titleLogo);
      setPoster(cached.poster);
      setLoaded(true);
      return;
    }

    // Reset while a new fetch is in-flight
    setLoaded(false);
    setDetailBanner(null);
    setHeroBanner(null);
    setTitleLogo(null);
    setPoster(null);

    let cancelled = false;

    getCrCardAssets(malId).then((result) => {
      if (!cancelled) {
        setDetailBanner(result.detailBanner);
        setHeroBanner(result.heroBanner);
        setTitleLogo(result.titleLogo);
        setPoster(result.poster);
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [malId]);

  return { detailBanner, heroBanner, titleLogo, poster, loaded };
}
