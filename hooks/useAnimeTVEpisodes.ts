"use client";

/**
 * useAnimeTVEpisodes
 *
 * Fetches episode metadata (including 1080p Crunchyroll episode thumbnails and titles)
 * directly from: https://catalog.animetvplus.site/api/episodes/{id}?v=v2-cache-guard
 */

import { useState, useEffect } from "react";

export interface AnimeTVEpisodeItem {
  ep: number;
  title?: string;
  thumbnail?: string;
  has_stream?: boolean;
}

const API_BASE = "https://catalog.animetvplus.site/api/episodes";

// Module-level memory cache keyed by anime ID string
const _epCache = new Map<string, Record<number, AnimeTVEpisodeItem>>();

export function useAnimeTVEpisodes(id?: number | string | null): {
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

    const key = String(id);

    if (_epCache.has(key)) {
      setEpisodesMap(_epCache.get(key)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchEpisodes() {
      try {
        const res = await fetch(`${API_BASE}/${key}?v=v2-cache-guard`);
        if (!res.ok) {
          _epCache.set(key, {});
          if (!cancelled) {
            setEpisodesMap({});
            setLoading(false);
          }
          return;
        }

        const data = await res.json();
        const items: AnimeTVEpisodeItem[] = Array.isArray(data)
          ? data
          : data.items || data.episodes || [];

        const map: Record<number, AnimeTVEpisodeItem> = {};
        for (const item of items) {
          if (item && typeof item.ep === "number") {
            map[item.ep] = item;
          }
        }

        _epCache.set(key, map);

        if (!cancelled) {
          setEpisodesMap(map);
          setLoading(false);
        }
      } catch {
        _epCache.set(key, {});
        if (!cancelled) {
          setEpisodesMap({});
          setLoading(false);
        }
      }
    }

    fetchEpisodes();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { episodesMap, loading };
}
