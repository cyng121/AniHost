"use client";

/**
 * useAnimeTVSearch / searchAnimeTVPlus
 *
 * Direct client search against catalog.animetvplus.site/api/search
 */

import { useState, useEffect } from "react";
import { fetchCatalogSearch, CatalogAnimeItem } from "@/lib/catalog";

export type AnimeTVSearchItem = CatalogAnimeItem;

export async function searchAnimeTVPlus(
  query: string,
  limit = 20,
  page = 1
): Promise<AnimeTVSearchItem[]> {
  return fetchCatalogSearch(query, { limit, page });
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
