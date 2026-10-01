import { backendGet, type Result } from "./backend";

export interface CartoonItem {
  id: string;
  postId?: string;
  title: string;
  image: string;
  url?: string;
  type: "series" | "movie" | string;
  status?: string;
  genres?: string[];
  languages?: string[];
  networks?: string[];
  duration?: string;
  year?: string;
}

export interface CartoonCategoryResponse {
  success: boolean;
  category: string;
  catId?: string;
  page: number;
  perPage: number;
  hasMore: boolean;
  maxPages: number;
  postType: "series" | "movies" | string;
  items: CartoonItem[];
}

export interface CartoonSeason {
  season: number;
  title: string;
  episodesCount?: number;
  isSubOnly?: boolean;
}

export interface CartoonEpisode {
  id: string;
  episodeNumber: number;
  season?: number;
  title?: string;
  image?: string;
}

export interface MultiLangItem {
  id: string;
  abyssId?: string;
  language: string;
  link?: string;
}

export interface AbyssSourceItem {
  url: string;
  size?: number;
  type?: string;
  codec?: string;
  status?: boolean;
}

export interface AbyssResponse {
  success: boolean;
  contentId?: string;
  url?: string;
  referer?: string;
  sources?: AbyssSourceItem[];
}

export interface CartoonServer {
  id: string;
  name: string;
  server: string;
  iframe?: string;
  link?: string;
  multiLangData?: MultiLangItem[];
}

export interface CartoonDetail {
  success: boolean;
  id: string;
  postId?: string;
  title: string;
  url?: string;
  type: "series" | "movie";
  poster?: string;
  banner?: string;
  duration?: string;
  year?: string;
  overview?: string;
  genres?: Array<{ id: string; name: string; url?: string }>;
  languages?: Array<{ id: string; name: string; url?: string }>;
  networks?: Array<{ id: string; title: string; image?: string; url?: string }>;
  servers?: CartoonServer[];
  seasons?: CartoonSeason[];
  episodes?: CartoonEpisode[];
}

export interface CartoonSource {
  success: boolean;
  id: string;
  title?: string;
  episodeTitle?: string;
  season?: number;
  episode?: number;
  image?: string;
  iframe?: string;
  m3u8?: string;
  stream?: {
    hls?: boolean;
    videoImage?: string;
    videoSource?: string;
  };
  servers?: CartoonServer[];
  multiLangData?: MultiLangItem[];
}

/**
 * Fetch cartoon series by page number from AnimeSalt
 */
export async function getCartoonSeries(page: number = 1): Promise<Result<CartoonCategoryResponse>> {
  return backendGet<CartoonCategoryResponse>(
    `/animesalt/category/type/cartoon?type=series&page=${page}`,
    { revalidate: 300 }
  );
}

/**
 * Fetch cartoon movies by page number from AnimeSalt
 */
export async function getCartoonMovies(page: number = 1): Promise<Result<CartoonCategoryResponse>> {
  return backendGet<CartoonCategoryResponse>(
    `/animesalt/category/type/cartoon?type=movies&page=${page}`,
    { revalidate: 300 }
  );
}

/**
 * Fetch details for a cartoon series or movie by slug
 */
export async function getCartoonInfo(slug: string): Promise<Result<CartoonDetail>> {
  return backendGet<CartoonDetail>(
    `/animesalt/info/${encodeURIComponent(slug)}`,
    { revalidate: 600 }
  );
}

/**
 * Fetch stream sources for an episode or movie
 */
export async function getCartoonSource(episodeSlug: string): Promise<Result<CartoonSource>> {
  return backendGet<CartoonSource>(
    `/animesalt/sources/${encodeURIComponent(episodeSlug)}`,
    { revalidate: 300 }
  );
}

/**
 * Decrypt Abyss multi-language source by Abyss ID
 */
export async function getAnimeSaltAbyss(id: string): Promise<Result<AbyssResponse>> {
  return backendGet<AbyssResponse>(
    `/animesalt/abyss/${encodeURIComponent(id)}`,
    { revalidate: 3600 }
  );
}

/**
 * Build MP4 proxy URL for playback
 */
export function buildMp4ProxyUrl(url: string, referer: string = "https://playhydrax.com/"): string {
  return `/api/mp4?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
}

/**
 * Build m3u8 proxy URL for HLS playback
 */
export function buildM3u8ProxyUrl(url: string, referer: string = "https://as-cdn26.top/"): string {
  return `/m3u8?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
}
