/**
 * What a search is currently looking through.
 *
 * Anime and manga come from different providers with different shapes, and a
 * result from one is meaningless in the other's grid. Rather than blending
 * them, the search carries a scope and stays inside it — so the manga section
 * searches manga, and the rest of the site searches anime.
 *
 * The scope follows the section you are standing in, because that is almost
 * always what you meant. It stays switchable, because sometimes it isn't.
 *
 * No `server-only` import here: the header and the suggest layer are client
 * components and need these same rules.
 */

export type SearchScope = "anime" | "manga";

export const SEARCH_SCOPES: readonly SearchScope[] = ["anime", "manga"];

/** The section you are in decides what the search box means by default. */
export function scopeFromPath(pathname: string | null | undefined): SearchScope {
  return pathname?.startsWith("/manga") ? "manga" : "anime";
}

/** Reading the scope back off a URL, tolerating anything unexpected. */
export function scopeFromParam(value: string | null | undefined): SearchScope | null {
  return value === "manga" ? "manga" : value === "anime" ? "anime" : null;
}

export function scopeLabel(scope: SearchScope): string {
  return scope === "manga" ? "Manga" : "Anime";
}

export function scopePlaceholder(scope: SearchScope): string {
  return scope === "manga"
    ? "Search manga by title or author"
    : "Search anime, or a character";
}

/**
 * Where a search lands. The scope is only pinned in the URL for manga: anime
 * is the default, so spelling it out would add a parameter that changes
 * nothing and follows the viewer around.
 */
export function searchHref(query: string, scope: SearchScope): string {
  const q = encodeURIComponent(query.trim());
  return scope === "manga" ? `/search?q=${q}&type=manga` : `/search?q=${q}`;
}

/** The page a single result opens. */
export function resultHref(id: string, scope: SearchScope): string {
  return scope === "manga"
    ? `/manga/${encodeURIComponent(id)}`
    : `/anime/${encodeURIComponent(id)}`;
}

/**
 * The browser can only reach the catalogue through /api/ag — apiflix rejects
 * any request whose Origin is not on its allowlist. The two providers take
 * their query differently: zoro in the path, atsu in a parameter.
 */
export function suggestEndpoint(term: string, scope: SearchScope): string {
  return scope === "manga"
    ? `/api/ag/atsu/search?q=${encodeURIComponent(term)}`
    : `/api/ag/zoro/search/${encodeURIComponent(term)}`;
}
