export interface ZoroEpisode {
  number: number;
  slug: string;
  title: string;
  description?: string;
  thumbnail?: string;
  ids: string;
  sub?: boolean;
  dub?: boolean;
}

export interface ZoroCard {
  id: string | number;
  slug: string;
  title: string;
  japaneseTitle?: string;
  image?: string;
  poster?: string;
  banner?: string | null;
  bannerImage?: string | null;
  type?: string;
  status?: string;
  totalEpisodes?: number;
  episodeNumber?: number;
  number?: number;
  subCount?: number;
  dubCount?: number;
  duration?: string | number;
  description?: string;
  score?: number | null;
  studio?: string;
  nsfw?: boolean;
  genres?: string[];
  episodes?: number | { sub?: number; dub?: number };
  rank?: number;
  synopsis?: string;
  rating?: string;
  quality?: string;
  trailer?: { id?: string; site?: string; thumbnail?: string } | null;
}

export interface ZoroSeason {
  id?: string | number;
  data_id?: string | number;
  season?: string;
  title?: string;
  data_number?: number;
  season_poster?: string;
  format?: string;
  episodes?: number;
  seasonYear?: number;
  [key: string]: unknown;
}

export interface ZoroInfo {
  id: string;
  slug: string;
  title: string;
  japaneseTitle?: string;
  image?: string;
  bannerImage?: string;
  type?: string;
  status?: string;
  totalEpisodes?: number;
  subCount?: number;
  dubCount?: number;
  anilistId?: number;
  malId?: number | null;
  synonyms?: string[];
  description?: string;
  synopsis?: string;
  genres?: string[];
  score?: number | null;
  malScore?: number | null;
  rating?: string;
  quality?: string;
  premiered?: string;
  year?: number;
  isAdult?: boolean;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  studios?: string[];
  seasons?: ZoroSeason[];
  recommended?: ZoroCard[];
}

export interface ZoroScheduleEntry {
  id: string;
  slug: string;
  title: string;
  japaneseTitle?: string;
  englishTitle?: string;
  time?: string;
  episodeLabel?: string;
  episodeNumber?: number;
  image?: string;
  poster?: string;
  cover?: string;
  banner?: string;
  logo?: string;
  type?: string;
  airDate?: string;
  day?: string;
  score?: number | null;
  genres?: string[];
  studios?: string[];
  airingAt?: number;
}

export interface ZoroSidebarColumn {
  title?: string;
  items?: ZoroCard[];
}

export interface ZoroTopRated {
  day: ZoroCard[];
  week: ZoroCard[];
  month: ZoroCard[];
  [key: string]: ZoroCard[] | undefined;
}

export type BackendPayload = Record<string, unknown> | unknown[];
export type ZoroAnilistEpisodeResponse = BackendPayload;
export type AnidaoEpisodeResponse = BackendPayload;
export type AniwaveEpisodeResponse = BackendPayload;
export type AniwaveSourcesResponse = BackendPayload;
export type HindiProviderResponse = BackendPayload;
export type ZoroServers = BackendPayload;
export type ZoroSources = BackendPayload;