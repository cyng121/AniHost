"use client";

/**
 * useAnimeTVSearch / searchAnimeTVPlus
 *
 * Direct client search against catalog.animetvplus.site/api/search
 */

import { useState, useEffect } from "react";

export interface AnimeTVSearchItem {
  mal_id: string;
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
  current_episodes?: number;
  m3u8_episode_count?: number;
}

const SEARCH_API = "https://catalog.animetvplus.site/api/search";

export async function searchAnimeTVPlus(
  query: string,
  limit = 20,
  page = 1
): Promise<AnimeTVSearchItem[]> {
  if (!query || !query.trim()) return [];

  try {
    const url = `${SEARCH_API}?q=${encodeURIComponent(query.trim())}&limit=${limit}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export function useAnimeTVSearch(query?: string | null, limit = 20): {
  results: AnimeTVSearchItem[];
  loading: boolean;
} {
  const [results, setResults] = useState<AnimeTVSearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || !query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    searchAnimeTVPlus(query, limit).then((items) => {
      if (!cancelled) {
        setResults(items);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [query, limit]);

  return { results, loading };
}
