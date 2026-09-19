/**
 * Client-safe title treatment types and URL builder.
 */

export const TMDB_IMAGE = "https://image.tmdb.org/t/p";

export interface TitleLogo {
  /** Path only — the caller picks a width off TMDB_IMAGE. */
  path: string;
  width: number;
  height: number;
  lang: string | null;
  /** SVG has no useful intrinsic size, so callers should not trust w/h. */
  vector: boolean;
}

/** Build a CDN URL. SVG has only an original rendition. */
export function logoUrl(logo: TitleLogo, width: 300 | 500 | 780 = 500): string {
  const size = logo.vector ? "original" : `w${width}`;
  return `${TMDB_IMAGE}/${size}${logo.path}`;
}
