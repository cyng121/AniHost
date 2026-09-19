/** Public response contracts for the Next.js `/api/native/*` gateway. */

export interface NativeApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface NativeCard {
  slug: string;
  title: string;
  japaneseTitle: string | null;
  /** HTTPS catalogue artwork selected and returned by the backend. */
  posterUrl: string | null;
  synopsis: string | null;
  type: string | null;
  duration: string | null;
  quality: string | null;
  episodeCount: number | null;
  latestEpisode: number | null;
  subCount: number | null;
  dubCount: number | null;
  rank: number | null;
}

export interface NativeHero extends NativeCard {
  /** Full-resolution hero artwork selected and returned by the backend. */
  backdropUrl: string | null;
  backdropWidth: number | null;
  backdropHeight: number | null;
  logoUrl: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
}

export interface NativeShelf {
  id: string;
  title: string;
  items: NativeCard[];
}

export interface NativeHomeResponse {
  hero: NativeHero | null;
  shelves: NativeShelf[];
  genres: string[];
}

export interface NativeSearchResponse {
  query: string;
  page: number;
  totalPages: number | null;
  hasNextPage: boolean | null;
  items: NativeCard[];
}

export interface NativeMoviesResponse {
  shelves: NativeShelf[];
}

export type NativeAudioTrack = "sub" | "dub";

export interface NativeEpisode {
  number: number;
  ids: string;
  title: string;
  japaneseTitle: string | null;
  thumbnailUrl: string | null;
  synopsis: string | null;
  sub: boolean;
  dub: boolean;
  timestamp: number | null;
}

export interface NativeTitle {
  catalogueId: string;
  slug: string;
  title: string;
  japaneseTitle: string | null;
  synonyms: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  backdropWidth: number | null;
  backdropHeight: number | null;
  logoUrl: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
  synopsis: string | null;
  type: string | null;
  duration: string | null;
  quality: string | null;
  status: string | null;
  year: string | null;
  premiered: string | null;
  score: string | null;
  studios: string[];
  producers: string[];
  genres: string[];
  anilistId: number | null;
  malId: number | null;
  subCount: number | null;
  dubCount: number | null;
  totalEpisodes: number | null;
  hasSub: boolean;
  hasDub: boolean;
  defaultAudio: NativeAudioTrack | null;
}

export interface NativeTitleResponse {
  title: NativeTitle;
  episodes: NativeEpisode[];
  related: NativeCard[];
  episodeError: string | null;
}

export interface NativeMangaCard {
  id: string;
  title: string;
  /** Best HTTPS cover exposed by the AniGhost manga backend. */
  posterUrl: string | null;
  type: string | null;
}

export interface NativeMangaHero extends NativeMangaCard {
  backdropUrl: string | null;
  synopsis: string | null;
  status: string | null;
  rating: number | string | null;
  totalChapters: number | null;
  genres: string[];
}

export interface NativeMangaShelf {
  id: string;
  title: string;
  items: NativeMangaCard[];
}

export interface NativeMangaHomeResponse {
  hero: NativeMangaHero | null;
  shelves: NativeMangaShelf[];
}

export interface NativeMangaSearchResponse {
  query: string;
  items: NativeMangaCard[];
}

export interface NativeMangaChapter {
  id: string;
  number: number;
  title: string | null;
  pageCount: number | null;
}

export interface NativeMangaTitle {
  id: string;
  title: string;
  englishTitle: string | null;
  synopsis: string | null;
  type: string | null;
  status: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | string | null;
  views: number | null;
  totalChapters: number | null;
  genres: string[];
  authors: string[];
}

export interface NativeMangaTitleResponse {
  title: NativeMangaTitle;
  chapters: NativeMangaChapter[];
}

export interface NativeMangaPage {
  page: number;
  imageUrl: string;
}

export interface NativeMangaChapterResponse {
  mangaId: string;
  chapterId: string;
  pages: NativeMangaPage[];
}

export interface NativeSubtitleTrack {
  url: string;
  label: string;
  default: boolean;
}

export interface NativePlaybackResponse {
  stream: {
    url: string;
    contentType: "hls";
    audio: NativeAudioTrack;
    serverName: string;
    subtitles: NativeSubtitleTrack[];
    intro: { start: number; end: number } | null;
    outro: { start: number; end: number } | null;
  };
  available: { sub: string[]; dub: string[] };
}
