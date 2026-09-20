export const runtime = "edge";
import { NextRequest } from "next/server";
import { backendGet } from "@/lib/backend";

/**
 * Thin server-side passthrough to the apiflix backend.
 *
 * Server components call `lib/backend` directly and never touch this route.
 * It exists for the client: the episode picker and server switcher need to
 * fetch on demand, and the browser cannot call the backend itself because
 * apiflix/middleware.ts rejects any origin outside its allowlist.
 *
 * Only GET is forwarded, and only to paths that begin with a known provider
 * prefix, so this cannot be used as a general-purpose relay.
 */
const ALLOWED_PREFIXES = [
  "zoro",
  "anidao",
  "aniwave",
  "animesalt",
  "watchanimeworld",
  "toons",
  "atsu",
  "anikoto",
  "sources",
  "anilist",
  "mal",
  "kitsu",
];
const memoryCache = new Map<string, { data: unknown; expires: number }>();
const MAX_CACHE_ENTRIES = 500;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  if (!path?.length || !ALLOWED_PREFIXES.includes(path[0])) {
    return Response.json({ error: "Unknown endpoint" }, { status: 404 });
  }

  // Re-join verbatim: several ids are base64 and must not be re-encoded.
  const search = request.nextUrl.search;
  const fullPath = `/${path.join("/")}${search}`;
  const now = Date.now();

  const cached = memoryCache.get(fullPath);
  if (cached && cached.expires > now) {
    return Response.json(cached.data, {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=600",
        "x-fast-cache": "HIT",
      },
    });
  }

  const result = await backendGet<unknown>(fullPath);

  if (!result.ok) {
    if (cached) {
      return Response.json(cached.data, {
        headers: { "x-fast-cache": "STALE" },
      });
    }
    return Response.json({ error: result.error }, { status: result.status });
  }

  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(fullPath, { data: result.data, expires: now + CACHE_TTL_MS });

  return Response.json(result.data, {
    headers: {
      "cache-control": "public, max-age=300, stale-while-revalidate=600",
      "x-fast-cache": "MISS",
    },
  });
}
