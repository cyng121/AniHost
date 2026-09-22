"use client";

/**
 * hooks/useCatalogSeasons.ts
 *
 * React hooks to fetch Crunchyroll season trees, per-season episodes,
 * and seasonal collections from catalog.animetvplus.site directly.
 */

import { useState, useEffect } from "react";
import {
  fetchCrCard,
  fetchCrSeasonEpisodes,
  fetchSeasonalAnime,
  CatalogCrCard,
  CatalogCrSeason,
  CatalogEpisode,
  CatalogAnimeItem,
} from "@/lib/catalog";

const _seasonTreeCache = new Map<string, CatalogCrCard>();

export interface UseCatalogSeasonsResult {
  card: CatalogCrCard | null;
  seasons: CatalogCrSeason[];
  selectedSeason: number;
  setSelectedSeason: (seasonNum: number) => void;
  episodes: CatalogEpisode[];
  loadingCard: boolean;
  loadingEpisodes: boolean;
}

export function useCatalogSeasons(malId?: number | string | null): UseCatalogSeasonsResult {
  const [card, setCard] = useState<CatalogCrCard | null>(null);
  const [seasons, setSeasons] = useState<CatalogCrSeason[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<CatalogEpisode[]>([]);
  const [loadingCard, setLoadingCard] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // 1. Fetch CR Card & Season Tree
  useEffect(() => {
    if (!malId || String(malId) === "0") {
      setCard(null);
      setSeasons([]);
      setEpisodes([]);
      setLoadingCard(false);
      return;
    }

    const key = String(malId);
    if (_seasonTreeCache.has(key)) {
      const cached = _seasonTreeCache.get(key)!;
      setCard(cached);
      const seasonList = cached.seasons || [];
      setSeasons(seasonList);
      if (seasonList.length > 0 && seasonList[0].season_number) {
        setSelectedSeason(seasonList[0].season_number);
      }
      setLoadingCard(false);
      return;
    }

    let cancelled = false;
    setLoadingCard(true);

    fetchCrCard(malId, true).then((data) => {
      if (cancelled) return;
      if (data) {
        _seasonTreeCache.set(key, data);
        setCard(data);
        const seasonList = data.seasons || [];
        setSeasons(seasonList);
        if (seasonList.length > 0 && seasonList[0].season_number) {
          setSelectedSeason(seasonList[0].season_number);
        }
      } else {
        setCard(null);
        setSeasons([]);
      }
      setLoadingCard(false);
    });

    return () => {
      cancelled = true;
    };
  }, [malId]);

  // 2. Fetch Episodes when selected Season changes
  useEffect(() => {
    if (!malId || String(malId) === "0" || !selectedSeason) {
      return;
    }

    // Check if episodes are already in card payload
    if (card?.seasons) {
      const matched = card.seasons.find((s) => s.season_number === selectedSeason);
      if (matched?.episodes && matched.episodes.length > 0) {
        setEpisodes(matched.episodes);
        return;
      }
    }

    let cancelled = false;
    setLoadingEpisodes(true);

    fetchCrSeasonEpisodes(malId, selectedSeason).then((eps) => {
      if (!cancelled) {
        setEpisodes(eps);
        setLoadingEpisodes(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [malId, selectedSeason, card]);

  return {
    card,
    seasons,
    selectedSeason,
    setSelectedSeason,
    episodes,
    loadingCard,
    loadingEpisodes,
  };
}

/**
 * Hook to fetch anime items by release year and seasonal quarter.
 */
export function useSeasonalCollection(
  year?: number | string | null,
  season?: string | null
): { items: CatalogAnimeItem[]; loading: boolean } {
  const [items, setItems] = useState<CatalogAnimeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!year || !season) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchSeasonalAnime(year, season).then((data) => {
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [year, season]);

  return { items, loading };
}
