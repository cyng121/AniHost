"use client";

/**
 * useAnimeTVEpisodes
 *
 * Fetches episode metadata (including 1080p Crunchyroll episode thumbnails and titles)
 * directly from: https://catalog.animetvplus.site/api/episodes/{id}?v=v2-cache-guard
 */

import { useState, useEffect } from "react";
import { fetchCatalogEpisodes, CatalogEpisode } from "@/lib/catalog";

export interface AnimeTVEpisodeItem {
  ep: number;
  title?: string;
  thumbnail?: string;
  has_stream?: boolean;
}

// Module-level memory cache keyed by anime ID string & season
const _epCache = new Map<string, Record<number, AnimeTVEpisodeItem>>();

export function useAnimeTVEpisodes(
  id?: number | string | null,
  crSeasonId?: string
): {
  episodesMap: Record<number, AnimeTVEpisodeItem>;
  loading: boolean;
} {
  const [episodesMap, setEpisodesMap] = useState<Record<number, AnimeTVEpisodeItem>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || id === "" || Number(id) <= 0) {
      setEpisodesMap({});
      setLoading(false);
      return;
    }

    const cacheKey = crSeasonId ? `${id}:${crSeasonId}` : String(id);

    if (_epCache.has(cacheKey)) {
      setEpisodesMap(_epCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function loadEpisodes() {
      try {
        const items: CatalogEpisode[] = await fetchCatalogEpisodes(id!, {
          cr_season_id: crSeasonId,
        });

        const map: Record<number, AnimeTVEpisodeItem> = {};
        for (const item of items) {
          if (item && typeof item.ep === "number") {
            map[item.ep] = {
              ep: item.ep,
              title: item.title,
              thumbnail: item.thumbnail,
              has_stream: item.has_stream,
            };
          }
        }

        _epCache.set(cacheKey, map);

        if (!cancelled) {
          setEpisodesMap(map);
          setLoading(false);
        }
      } catch {
        _epCache.set(cacheKey, {});
        if (!cancelled) {
          setEpisodesMap({});
          setLoading(false);
        }
      }
    }

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [id, crSeasonId]);

  return { episodesMap, loading };
}
