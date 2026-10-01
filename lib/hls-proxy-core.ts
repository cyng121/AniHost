import { NextRequest, NextResponse } from "next/server";

// =========================================
// 🔒 ALLOWED ORIGINS
// =========================================
export const ALLOWED_ORIGINS = [
  "https://anihosts.xyz",
  "https://www.anihosts.xyz",
  "https://anighost.com",
  "https://www.anighost.com",
  "https://animextrons.co.in",
  "https://senpaiflix.fun",
  "https://senpaiflixs.pages.dev",
  "https://www.senpaiflix.fun",
  "http://localhost:3000",
];

export function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Allow requests without Origin and Referer (direct server / mobile / internal requests)
  if (!origin && !referer) {
    return true;
  }

  const host = req.headers.get("host") || req.nextUrl.host;

  // Check Origin header
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) return true;
    try {
      if (new URL(origin).host === host) return true;
    } catch {}
  }

  // Check Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      if (ALLOWED_ORIGINS.includes(refererOrigin)) return true;
      if (refererOrigin.includes("localhost") || refererOrigin.includes("127.0.0.1")) return true;
      if (refererUrl.host === host) return true;
    } catch {}
  }

  // Allow same-origin/same-site requests
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
    return true;
  }

  return false;
}

// =========================================
// 🌍 CORS HEADERS HELPER
// =========================================
export function getCorsHeaders(req: NextRequest): Record<string, string> {
  const requestOrigin = req.headers.get("origin") || "";
  const allowedOrigin = requestOrigin || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function withCors(response: Response, req: NextRequest): Response {
  const headers = new Headers(response.headers);
  Object.entries(getCorsHeaders(req)).forEach(([k, v]) => {
    headers.set(k, v);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// =========================================
// 🌐 RECENT CDN TRACKER
// =========================================
export interface CdnContext {
  origin: string; // e.g. "https://ru-ri-cdn3.echovideo.to"
  referer: string; // e.g. "https://play.echovideo.ru/"
  lastSeen: number;
}

const recentCdns: CdnContext[] = [
  {
    origin: "https://ru-ri-cdn3.echovideo.to",
    referer: "https://play.echovideo.ru/",
    lastSeen: Date.now(),
  },
  {
    origin: "https://px.dpopdrop89.store",
    referer: "https://play.echovideo.ru/",
    lastSeen: Date.now(),
  },
];

export function recordCdnContext(targetUrl: string, referer?: string | null) {
  try {
    const parsed = new URL(targetUrl);
    const origin = parsed.origin;
    let ref = referer;
    if (!ref) {
      if (origin.includes("echovideo") || origin.includes("dpopdrop")) {
        ref = "https://play.echovideo.ru/";
      } else {
        ref = `${origin}/`;
      }
    }

    const existingIdx = recentCdns.findIndex((c) => c.origin === origin);
    if (existingIdx >= 0) {
      recentCdns[existingIdx].lastSeen = Date.now();
      if (ref) recentCdns[existingIdx].referer = ref;
      const item = recentCdns.splice(existingIdx, 1)[0];
      recentCdns.unshift(item);
    } else {
      recentCdns.unshift({
        origin,
        referer: ref,
        lastSeen: Date.now(),
      });
      if (recentCdns.length > 20) recentCdns.pop();
    }
  } catch {}
}

export function getLatestCdnContext(): CdnContext {
  if (recentCdns.length > 0) {
    return recentCdns[0];
  }
  return {
    origin: "https://ru-ri-cdn3.echovideo.to",
    referer: "https://play.echovideo.ru/",
    lastSeen: Date.now(),
  };
}

export function getAllRecentCdns(): CdnContext[] {
  return [...recentCdns];
}

// =========================================
// 📦 IN-MEMORY RESPONSE CACHE
// =========================================
interface CachedResponse {
  body: Uint8Array | string;
  status: number;
  contentType: string;
  cacheControl: string;
  headers: Record<string, string>;
  expiresAt: number;
}

class SimpleMemoryCache {
  private cache = new Map<string, CachedResponse>();
  private maxItems = 500;

  get(key: string): CachedResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, entry: CachedResponse) {
    if (this.cache.size >= this.maxItems) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
  }
}

export const memoryCache = new SimpleMemoryCache();

// =========================================
// 🔄 FETCH WITH MULTI-STAGE FALLBACK
// =========================================
export async function fetchWithFallback(
  target: string,
  method: string,
  headers: Headers
): Promise<Response> {
  // Stage 1: Primary computed headers
  let res = await fetch(target, {
    method,
    headers,
    redirect: "follow",
  });

  if (res.ok || (res.status !== 403 && res.status !== 401 && res.status !== 400)) {
    return res;
  }

  // Stage 2: Toggle Origin
  const fallbackHeaders1 = new Headers(headers);
  if (fallbackHeaders1.has("Origin")) {
    fallbackHeaders1.delete("Origin");
    res = await fetch(target, {
      method,
      headers: fallbackHeaders1,
      redirect: "follow",
    });
    if (res.ok || (res.status !== 403 && res.status !== 401 && res.status !== 400)) {
      return res;
    }
  } else if (fallbackHeaders1.has("Referer")) {
    try {
      const refOrigin = new URL(fallbackHeaders1.get("Referer")!).origin;
      fallbackHeaders1.set("Origin", refOrigin);
      res = await fetch(target, {
        method,
        headers: fallbackHeaders1,
        redirect: "follow",
      });
      if (res.ok || (res.status !== 403 && res.status !== 401 && res.status !== 400)) {
        return res;
      }
    } catch {}
  }

  // Stage 3: Retry with target's own domain as origin/referer
  try {
    const targetUrl = new URL(target);
    const fallbackHeaders2 = new Headers(headers);
    fallbackHeaders2.set("Referer", `${targetUrl.origin}/`);
    fallbackHeaders2.set("Origin", targetUrl.origin);

    res = await fetch(target, {
      method,
      headers: fallbackHeaders2,
      redirect: "follow",
    });
    if (res.ok || (res.status !== 403 && res.status !== 401 && res.status !== 400)) {
      return res;
    }
  } catch {}

  // Stage 4: Retry with Google Referer
  const fallbackHeaders3 = new Headers(headers);
  fallbackHeaders3.set("Referer", "https://google.com/");
  fallbackHeaders3.delete("Origin");

  res = await fetch(target, {
    method,
    headers: fallbackHeaders3,
    redirect: "follow",
  });

  return res;
}

// =========================================
// 🔁 PLAYLIST REWRITING HELPER
// =========================================
export function rewritePlaylist(
  text: string,
  baseUrl: string,
  referer: string | null,
  origin: string | null,
  proxyEndpoint: string
): string {
  const proxify = (url: string) => {
    const params = new URLSearchParams();
    params.set("url", url);
    if (referer) params.set("referer", referer);
    if (origin) params.set("origin", origin);
    return `${proxyEndpoint}?${params.toString()}`;
  };

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Handle tags (e.g. #EXT-X-KEY:METHOD=AES-128,URI="...")
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => {
          try {
            const absolute = new URL(uri, baseUrl).href;
            return `URI="${proxify(absolute)}"`;
          } catch {
            return _;
          }
        });
      }

      // Handle segment / playlist line
      try {
        const absolute = new URL(trimmed, baseUrl).href;
        return proxify(absolute);
      } catch {
        return line;
      }
    })
    .join("\n");
}

// =========================================
// 🚀 SHARED HLS PROXY HANDLER
// =========================================
export async function handleHlsProxy(req: NextRequest, method: "GET" | "HEAD") {
  // Check authorization / allowed origins
  if (!isAllowedOrigin(req)) {
    return new Response("Access Denied: Unauthorized origin", {
      status: 403,
      headers: {
        "Content-Type": "text/plain",
        ...getCorsHeaders(req),
      },
    });
  }

  const reqUrl = req.nextUrl;
  const range = req.headers.get("range");

  // Server-side cache lookup for GET requests without Range header
  if (method === "GET" && !range) {
    const cached = memoryCache.get(req.url);
    if (cached) {
      return new Response(cached.body as BodyInit, {
        status: cached.status,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": cached.contentType,
          "Cache-Control": cached.cacheControl,
          "X-Proxy-Cache": "HIT",
          ...cached.headers,
        },
      });
    }
  }

  // Extract target URL from query parameter 'url' or 'u' or base64 'b64'
  let target = reqUrl.searchParams.get("url") || reqUrl.searchParams.get("u");
  const b64 = reqUrl.searchParams.get("b64");

  if (!target && b64) {
    try {
      target = atob(b64);
    } catch {
      target = null;
    }
  }

  // Prevent double proxying if already an /api/hls or /m3u8 URL
  if (
    target &&
    (target.startsWith("/api/hls") ||
      target.includes("/api/hls?") ||
      target.startsWith("/m3u8") ||
      target.includes("/m3u8?"))
  ) {
    try {
      const parsed = new URL(target, reqUrl.origin);
      target = parsed.searchParams.get("url") || parsed.searchParams.get("u") || target;
    } catch {}
  }

  if (!target) {
    return withCors(
      NextResponse.json({ error: "Missing url or b64 parameter" }, { status: 400 }),
      req
    );
  }

  // Resolve relative /cdn/... paths against the latest known CDN origin
  if (target.startsWith("/")) {
    const latestCdn = getLatestCdnContext();
    target = `${latestCdn.origin}${target}`;
  }

  // =========================================
  // 🔥 REFERER & ORIGIN DETERMINATION
  // =========================================
  let refererHeader =
    reqUrl.searchParams.get("referer") ||
    reqUrl.searchParams.get("ref") ||
    reqUrl.searchParams.get("r");

  // Auto referer mapping based on target domain
  if (!refererHeader) {
    if (target.includes("ninstream")) {
      refererHeader = "https://senshi.live/";
    } else if (target.includes("kwik") || target.includes("owocdn")) {
      refererHeader = "https://kwik.cx/";
    } else if (target.includes("megaplay")) {
      refererHeader = "https://megaplay.buzz/";
    } else if (
      target.includes("echovideo") ||
      target.includes("dpopdrop") ||
      target.includes("px.dpopdrop")
    ) {
      refererHeader = "https://play.echovideo.ru/";
    } else if (target.includes("senshi.live")) {
      refererHeader = "https://senshi.live/";
    } else if (target.includes("as-cdn")) {
      refererHeader = "https://as-cdn26.top/";
    } else if (
      target.includes("krussdomi") ||
      target.includes("advancedairesearchlab") ||
      target.includes("habibikun") ||
      target.includes("babybayw") ||
      target.includes("narutokun")
    ) {
      refererHeader = "https://krussdomi.com/";
    }
  }

  if (target.includes("as-cdn") && refererHeader?.includes("animesalt.cx")) {
    refererHeader = "https://as-cdn26.top/";
  }

  let originHeader = reqUrl.searchParams.get("origin");
  if (!originHeader && refererHeader) {
    try {
      originHeader = new URL(refererHeader).origin;
    } catch {
      originHeader = null;
    }
  }

  // Record CDN domain for subsequent segment resolution and /cdn fallback proxying
  recordCdnContext(target, refererHeader);

  // =========================================
  // 🎬 FILE TYPE & SIGNED DETECTION
  // =========================================
  const isPlaylistHint = /\.m3u8(\?|$)/i.test(target);
  const isKey = /\.key(\?|$)/i.test(target);
  const isSegmentHint = /\.(ts|m4s|mp4|mkv|webm|jpg|jpeg|png|webp|vtt)(\?|$)/i.test(target);
  const isMasterPlaylistHint = target.includes("master.m3u8") || target.includes("t.m3u8");
  const hasToken = /token=|expires=|signature=|sig=/i.test(target);

  // =========================================
  // 📡 PREPARE UPSTREAM HEADERS
  // =========================================
  const upstreamHeaders = new Headers();
  upstreamHeaders.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
  );
  upstreamHeaders.set("Accept", "*/*");
  upstreamHeaders.set("Accept-Language", "en-US,en;q=0.9");
  upstreamHeaders.set("Accept-Encoding", "identity");
  upstreamHeaders.set("Sec-Fetch-Site", "cross-site");
  upstreamHeaders.set("Sec-Fetch-Mode", "cors");
  upstreamHeaders.set("Sec-Fetch-Dest", "empty");
  upstreamHeaders.set("Connection", "keep-alive");

  if (refererHeader) {
    upstreamHeaders.set("Referer", refererHeader);
  }

  if (originHeader) {
    upstreamHeaders.set("Origin", originHeader);
  }

  if (range) {
    upstreamHeaders.set("Range", range);
  }

  // =========================================
  // 🚀 FETCH UPSTREAM WITH FALLBACK
  // =========================================
  let upstream: Response;
  try {
    upstream = await fetchWithFallback(target, method, upstreamHeaders);
  } catch (err: any) {
    return withCors(
      new Response(`Upstream Fetch Error: ${err.message || err.toString()}`, {
        status: 500,
      }),
      req
    );
  }

  if (!upstream.ok) {
    return withCors(
      new Response(`Upstream Error ${upstream.status}`, {
        status: upstream.status,
      }),
      req
    );
  }

  const contentType = upstream.headers.get("content-type") || "";

  // Read response bytes to inspect content regardless of upstream Content-Type header
  const arrayBuffer = await upstream.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Check if payload is an M3U8 playlist
  const sampleLen = Math.min(buffer.length, 512);
  const sample = new TextDecoder("utf-8", { fatal: false }).decode(
    buffer.subarray(0, sampleLen)
  );
  const isM3U8Content =
    sample.trimStart().startsWith("#EXTM3U") ||
    sample.includes("#EXT-X-") ||
    sample.includes("#EXTINF") ||
    isPlaylistHint ||
    contentType.includes("mpegurl") ||
    contentType.includes("vnd.apple.mpegurl") ||
    contentType.includes("application/x-mpegURL");

  // =========================================
  // 🎬 M3U8 PLAYLIST PROCESSING & REWRITING
  // =========================================
  if (isM3U8Content) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const baseUrl = new URL(target).href;
    const workerOrigin = req.nextUrl.pathname || "/api/hls";

    const rewritten = rewritePlaylist(
      text,
      baseUrl,
      refererHeader,
      originHeader,
      workerOrigin
    );

    const isMaster = isMasterPlaylistHint || text.includes("#EXT-X-STREAM-INF");
    const cacheTTL = hasToken ? 0 : isMaster ? 86400 : 60;
    const cacheControl = hasToken
      ? "no-store"
      : isMaster
        ? "public, max-age=86400"
        : `public, max-age=${cacheTTL}, stale-while-revalidate=600`;

    const responseHeaders = new Headers(getCorsHeaders(req));
    responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
    responseHeaders.set("Cache-Control", cacheControl);
    responseHeaders.set("X-Proxy-Cache", "MISS");

    // Save to memory cache
    if (method === "GET" && cacheTTL > 0 && !range && upstream.ok) {
      memoryCache.set(req.url, {
        body: rewritten,
        status: upstream.status,
        contentType: "application/vnd.apple.mpegurl",
        cacheControl,
        headers: {},
        expiresAt: Date.now() + cacheTTL * 1000,
      });
    }

    return new Response(rewritten, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  // =========================================
  // 📦 STREAM BINARY / SEGMENT FILES
  // =========================================
  let finalType = contentType || "application/octet-stream";

  // If payload begins with 0x47 (MPEG-TS sync byte), ensure video/mp2t MIME type
  const isMpegTs = buffer.length > 0 && buffer[0] === 0x47;
  const isMp4 =
    buffer.length > 8 &&
    (sample.includes("ftyp") || sample.includes("moof") || sample.includes("isom"));

  if (isMpegTs) {
    finalType = "video/mp2t";
  } else if (isMp4) {
    finalType = "video/mp4";
  } else if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(target) && isSegmentHint) {
    finalType = "video/mp2t";
  } else if (isKey) {
    finalType = "application/octet-stream";
  }

  const isSegment = isMpegTs || isMp4 || isSegmentHint;
  const cacheTTL = hasToken ? 0 : isSegment ? 604800 : 300;
  const cacheControlValue = hasToken
    ? "no-store"
    : isSegment
      ? "public, max-age=604800, immutable"
      : `public, max-age=${cacheTTL}`;

  const resHeaders = new Headers(getCorsHeaders(req));
  resHeaders.set("Content-Type", finalType);
  resHeaders.set("Accept-Ranges", "bytes");
  resHeaders.set("X-Content-Type-Options", "nosniff");
  resHeaders.set("X-Proxy-Cache", "MISS");
  resHeaders.set("Cache-Control", cacheControlValue);

  // Forward useful stream headers
  ["Content-Length", "Content-Range", "ETag", "Last-Modified"].forEach((header) => {
    const val = upstream.headers.get(header);
    if (val) {
      resHeaders.set(header, val);
    }
  });

  // Save binary response to memory cache
  if (method === "GET" && cacheTTL > 0 && !range && upstream.ok && upstream.status === 200) {
    memoryCache.set(req.url, {
      body: buffer,
      status: upstream.status,
      contentType: finalType,
      cacheControl: cacheControlValue,
      headers: {
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
        ...(resHeaders.get("Content-Length") ? { "Content-Length": resHeaders.get("Content-Length")! } : {}),
      },
      expiresAt: Date.now() + cacheTTL * 1000,
    });
  }

  return new Response(buffer, {
    status: upstream.status,
    headers: resHeaders,
  });
}
