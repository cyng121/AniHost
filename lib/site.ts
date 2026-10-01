/**
 * The site's own public origin.
 *
 * One place, because it feeds three things that must agree: canonical URLs,
 * the sitemap, and Open Graph image resolution. When they disagree, search
 * engines index the wrong host and social previews break.
 *
 * Vercel injects VERCEL_PROJECT_PRODUCTION_URL for the production domain, so
 * a preview deployment reports the real site rather than its own throwaway
 * hostname — otherwise every preview would advertise itself as canonical.
 */
const FALLBACK = "https://anihosts.xyz";

export function siteOrigin(): string {
  const explicit = (process.env.ANIGHOST_SITE_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL)?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return FALLBACK;
}

/** Absolute URL for a path, for canonical tags and the sitemap. */
export function siteUrl(path = "/"): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
