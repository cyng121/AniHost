/**
 * Stable phone dock contract. Downloads remain an episode/playback action and
 * must not become a sixth primary destination. Search is rendered here once;
 * Home must not add a duplicate mobile search field.
 */
export const PHONE_PRIMARY_NAV = [
  { id: "home", label: "Home", route: "/" },
  { id: "search", label: "Search", route: "/search" },
  { id: "movies", label: "Movies", route: "/movies" },
  { id: "manga", label: "Manga", route: "/manga" },
  { id: "profile", label: "Profile", route: "/profile" },
] as const;

export type PhonePrimaryDestination = (typeof PHONE_PRIMARY_NAV)[number]["id"];
