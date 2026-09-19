interface Env {
  ANIGHOST_PROXY_SECRET: string;
  ALLOWED_ORIGIN: string;
}

type CloudflareRequestInit = RequestInit & {
  cf?: { cacheEverything: boolean; cacheTtl: number };
};

const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"]);
const URI_TAG = /^#EXT-X-(KEY|MEDIA|I-FRAME-STREAM-INF|MAP|PART|PRELOAD-HINT|RENDITION-REPORT)/i;
const MEDIA_PATH = /\/seg[-_]|\/fragment|\/chunk|\/video|\/segment|\.(ts|m4s|mp4|m4v|m4a|aac|jpg|jpeg|png|webp|html|htm|bin|image)(\?|$)/i;

function targetUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || PRIVATE_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return null;
    const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ip) {
      const a = Number(ip[1]);
      const b = Number(ip[2]);
      if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return null;
    }
    return url;
  } catch {
    return null;
  }
}

function hash(target: string, referer: string, secret: string): string {
  let h = 0x811c9dc5;
  const value = `${target}\n${referer}${secret}`;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function proxyUrl(requestUrl: URL, target: string, referer: string, secret: string): string {
  const url = new URL("/api/hls", requestUrl.origin);
  url.searchParams.set("u", target);
  url.searchParams.set("r", referer);
  url.searchParams.set("s", hash(target, referer, secret));
  return url.toString();
}

function resolveUri(value: string, playlist: URL): string {
  return new URL(value, playlist).toString();
}

function rewritePlaylist(body: string, playlist: URL, referer: string, requestUrl: URL, secret: string): string {
  return body.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith("#")) {
      if (!URI_TAG.test(trimmed)) return line;
      return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => `URI="${proxyUrl(requestUrl, resolveUri(uri, playlist), referer, secret)}"`);
    }
    return proxyUrl(requestUrl, resolveUri(trimmed, playlist), referer, secret);
  }).join("\n");
}

function cors(origin: string, contentType: string, cacheControl: string): Headers {
  return new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "range, accept-encoding",
    "access-control-expose-headers": "content-length, content-range, accept-ranges",
    "cache-control": cacheControl,
    "content-type": contentType,
    vary: "Origin",
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://anighost.com";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(allowedOrigin, "text/plain", "no-store") });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

    const rawTarget = requestUrl.searchParams.get("u") ?? "";
    const rawReferer = requestUrl.searchParams.get("r") ?? "";
    const target = targetUrl(rawTarget);
    const referer = targetUrl(rawReferer);
    const signature = requestUrl.searchParams.get("s") ?? "";
    if (!target || !referer) return Response.json({ error: "Missing or unsafe target" }, { status: 400 });
    if (!env.ANIGHOST_PROXY_SECRET || !equal(hash(rawTarget, rawReferer, env.ANIGHOST_PROXY_SECRET), signature)) {
      return Response.json({ error: "Bad or missing signature" }, { status: 403 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const range = request.headers.get("range");
      const upstream = await fetch(target, {
        headers: {
          Accept: "*/*",
          Origin: referer.origin,
          Referer: referer.toString(),
          "User-Agent": "Mozilla/5.0 (Linux; Android TV) AppleWebKit/537.36 Chrome/122 Safari/537.36",
          ...(range ? { Range: range } : {}),
        },
        redirect: "follow",
        signal: controller.signal,
        cf: MEDIA_PATH.test(target.pathname) ? { cacheEverything: true, cacheTtl: 86_400 } : undefined,
      } as CloudflareRequestInit);
      if (!upstream.ok && upstream.status !== 206) {
        return Response.json({ error: `Upstream responded ${upstream.status}` }, { status: upstream.status === 403 ? 502 : upstream.status, headers: cors(allowedOrigin, "application/json", "no-store") });
      }

      const upstreamType = upstream.headers.get("content-type") ?? "application/octet-stream";
      const type = /\.vtt$/i.test(target.pathname) ? "text/vtt; charset=utf-8" : upstreamType;
      const playlist = /mpegurl/i.test(type) || /\.m3u8$/i.test(target.pathname);
      if (playlist) {
        const body = await upstream.text();
        const finalUrl = targetUrl(upstream.url) ?? target;
        return new Response(rewritePlaylist(body, finalUrl, referer.toString(), requestUrl, env.ANIGHOST_PROXY_SECRET), {
          headers: cors(allowedOrigin, "application/vnd.apple.mpegurl", body.includes("#EXT-X-PLAYLIST-TYPE:VOD") ? "public, max-age=60" : "no-store"),
        });
      }

      const headers = cors(allowedOrigin, type, "public, max-age=86400, stale-while-revalidate=86400");
      for (const name of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (error) {
      const timeout = error instanceof Error && error.name === "AbortError";
      return Response.json({ error: timeout ? "Upstream timed out" : "Upstream fetch failed" }, { status: timeout ? 504 : 502, headers: cors(allowedOrigin, "application/json", "no-store") });
    } finally {
      clearTimeout(timer);
    }
  },
};
