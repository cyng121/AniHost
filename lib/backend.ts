import "server-only";

/**
 * Server-side client for the apiflix backend.
 *
 * Two things make this layer necessary rather than calling the API from the
 * browser:
 *
 *  1. apiflix/middleware.ts rejects any request whose `Origin` is not on its
 *     allowlist, and also rejects requests that carry neither Origin nor
 *     Referer ("Direct browser access denied"). A browser cannot forge those
 *     headers, so the call has to happen server-side.
 *  2. Keeping it server-side means the backend host is never exposed to the
 *     client, and we get one place to cache, time out and normalise errors.
 */

function getBaseUrl(): string {
  const envBase = process.env.ANIGHOST_API_BASE?.trim();
  if (envBase && !envBase.includes("vercel.app") && !envBase.includes("localhost")) {
    return envBase.replace(/\/+$/, "");
  }
  return "https://senpaiflix-backend.onrender.com";
}

const BASE = getBaseUrl();
const ORIGIN =
  process.env.ANIGHOST_API_ORIGIN?.trim() || "https://animextrons.co.in";
const CACHE_SECONDS = Number(process.env.ANIGHOST_CACHE_SECONDS ?? 300);

/** Upstream scrapers are slow and occasionally hang; never wait forever. */
const TIMEOUT_MS = 25_000;

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const backendCache = new Map<string, CacheEntry<any>>();
const inFlightBackend = new Map<string, Promise<Result<any>>>();

/**
 * GET a path on the backend. `path` is everything after the host, e.g.
 * "/zoro/info/some-slug". Values are NOT encoded here — callers encode their
 * own segments, because several ids are base64 and must survive verbatim.
 */
export async function backendGet<T>(
  path: string,
  opts: { revalidate?: number; signal?: AbortSignal; bypassCache?: boolean } = {},
): Promise<Result<T>> {
  const cacheTtlSec = opts.revalidate ?? CACHE_SECONDS;
  const now = Date.now();

  // Return from in-memory cache if available and fresh
  if (!opts.bypassCache && cacheTtlSec > 0) {
    const cached = backendCache.get(path);
    if (cached && cached.expiresAt > now) {
      return { ok: true, data: cached.data as T };
    }
  }

  // Deduplicate concurrent requests for the exact same path
  if (!opts.bypassCache && inFlightBackend.has(path)) {
    return inFlightBackend.get(path)! as Promise<Result<T>>;
  }

  const fetchPromise = (async (): Promise<Result<T>> => {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const primaryUrl = `${BASE}${cleanPath}`;
    const urlsToTry = [primaryUrl];

    let lastResult: Result<T> = {
      ok: false,
      status: 502,
      error: "Could not reach upstream API",
    };

    for (const url of urlsToTry) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      // Caller-supplied signals compose with our timeout.
      if (opts.signal) {
        if (opts.signal.aborted) controller.abort();
        else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }

      try {
        const res = await fetch(url, {
          headers: {
            Origin: ORIGIN,
            Referer: `${ORIGIN}/`,
            Accept: "application/json",
            "User-Agent": "AniGhost/1.0",
          },
          signal: controller.signal,
          next: { revalidate: cacheTtlSec },
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          lastResult = {
            ok: false,
            status: res.status,
            error: shortenUpstreamError(body) || `Upstream returned ${res.status}`,
          };
          if (res.status === 402 || res.status === 403 || res.status === 429 || res.status >= 500) {
            continue;
          }
          return lastResult;
        }

        const text = await res.text();
        if (!text.trim()) {
          lastResult = { ok: false, status: 502, error: "Upstream returned an empty body" };
          continue;
        }

        try {
          return { ok: true, data: JSON.parse(text) as T };
        } catch {
          lastResult = { ok: false, status: 502, error: "Upstream returned a non-JSON body" };
          continue;
        }
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        lastResult = {
          ok: false,
          status: aborted ? 504 : 502,
          error: aborted ? "Upstream timed out" : "Could not reach the upstream API",
        };
        continue;
      } finally {
        clearTimeout(timer);
      }
    }

    return lastResult;
  })();

  if (!opts.bypassCache && cacheTtlSec > 0) {
    inFlightBackend.set(path, fetchPromise);
  }

  try {
    const result = await fetchPromise;
    if (result.ok && cacheTtlSec > 0) {
      backendCache.set(path, {
        data: result.data,
        expiresAt: Date.now() + cacheTtlSec * 1000,
      });
    }
    return result;
  } finally {
    inFlightBackend.delete(path);
  }
}

/** The backend answers errors as {error} or {message}; surface just that. */
function shortenUpstreamError(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    const msg = parsed?.error ?? parsed?.message;
    return typeof msg === "string" ? msg : null;
  } catch {
    return null;
  }
}

/**
 * Try providers in order and take the first that yields a usable result.
 * A single provider going down should degrade the page, not break it.
 */
export async function firstOk<T>(
  attempts: Array<() => Promise<Result<T>>>,
  usable: (data: T) => boolean = () => true,
): Promise<Result<T>> {
  let last: Result<T> = { ok: false, status: 502, error: "No providers were tried" };
  for (const attempt of attempts) {
    const res = await attempt();
    if (res.ok && usable(res.data)) return res;
    last = res.ok ? { ok: false, status: 404, error: "No results from provider" } : res;
  }
  return last;
}

export const api = {
  /** Episode list and metadata (titles, descriptions, screencaps) from AnimeTV */
  anilistEpisodes: (anilistId: number | string) =>
    backendGet<
      Array<{
        id?: string | number;
        number?: number;
        title?: string;
        description?: string;
        img?: string;
        released?: boolean;
      }>
    >(`/api/animetv?type=episodes&id=${anilistId}`, { revalidate: 21_600 }),

  /** Franchise seasons from AniList */
  anilistSeasons: (anilistId: number | string) =>
    backendGet<
      Array<{
        id?: number | string;
        data_number?: number;
        data_id?: number | string;
        season?: string;
        title?: string;
        seasonYear?: number;
        format?: string;
        episodes?: number;
        season_poster?: string;
      }>
    >(`/api/mal?type=seasons&id=${anilistId}`, { revalidate: 21_600 }),

  /** Zoro provider episode & servers by AniList ID and episode number */
  zoroAnilist: (anilistId: number | string, epNum: number | string) =>
    backendGet<import("./types").ZoroAnilistEpisodeResponse>(
      `/zoro/mal/${anilistId}/${epNum}`,
      { revalidate: 600 },
    ),

  /** Anidao provider episode & servers by AniList ID and episode number */
  anidaoAnilist: (anilistId: number | string, epNum: number | string) =>
    backendGet<import("./types").AnidaoEpisodeResponse>(
      `/anidao/mal/${anilistId}/${epNum}`,
      { revalidate: 600 },
    ),

  /** Aniwave provider episode & servers by AniList ID and episode number */
  aniwaveAnilist: (anilistId: number | string, epNum: number | string) =>
    backendGet<import("./types").AniwaveEpisodeResponse>(
      `/aniwave/mal/${anilistId}/${epNum}`,
      { revalidate: 600 },
    ),

  /** Aniwave source by server link/id */
  aniwaveSources: (linkId: string) =>
    backendGet<import("./types").AniwaveSourcesResponse>(
      `/aniwave/sources/${linkId}`,
      { revalidate: 60 },
    ),

  /** AnimeSalt Hindi provider episode stream */
  animesaltAnilist: (anilistId: number | string, epNum: number | string) =>
    backendGet<import("./types").HindiProviderResponse>(
      `/animesalt/mal/${anilistId}/${epNum}`,
      { revalidate: 600 },
    ),

  /** AnimeSalt sources by episode slug */
  animesaltSources: (episodeSlug: string) =>
    backendGet<any>(`/animesalt/sources/${encodeURIComponent(episodeSlug)}`, { revalidate: 300 }),

  /** AnimeSalt abyss multi-lang decryption by abyss id */
  animesaltAbyss: (id: string) =>
    backendGet<any>(`/animesalt/abyss/${encodeURIComponent(id)}`, { revalidate: 3600 }),

  /** WatchAnimeWorld Hindi provider episode stream */
  watchanimeworldAnilist: (anilistId: number | string, epNum: number | string) =>
    backendGet<import("./types").HindiProviderResponse>(
      `/watchanimeworld/mal/${anilistId}/${epNum}`,
      { revalidate: 600 },
    ),

  /** ToonStream Hindi provider episode stream */
  toonsAnilist: (anilistId: number | string, epNum: number | string) =>
    backendGet<import("./types").HindiProviderResponse>(
      `/toons/mal/${anilistId}/${epNum}`,
      { revalidate: 600 },
    ),

  /** `ids` is the opaque base64 blob from an episode — do not re-encode it. */
  servers: (ids: string) =>
    backendGet<import("./types").ZoroServers>(`/zoro/servers/${ids}`, { revalidate: 300 }),

  /** `linkId` is likewise opaque base64. Streams expire, so cache briefly. */
  sources: (linkId: string) =>
    backendGet<import("./types").ZoroSources>(`/zoro/sources/${linkId}`, { revalidate: 60 }),
};

