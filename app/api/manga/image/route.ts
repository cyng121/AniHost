export const runtime = "edge";

import { NextRequest } from "next/server";

const ALLOWED_HOSTS = new Set(["atsu.moe", "www.atsu.moe"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response("Invalid target URL", { status: 400 });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return new Response("Invalid protocol", { status: 400 });
  }

  const host = parsed.hostname.toLowerCase();
  const isAllowed = ALLOWED_HOSTS.has(host) || host.endsWith(".atsu.moe");
  if (!isAllowed) {
    return new Response("Forbidden host", { status: 403 });
  }

  try {
    const upstreamRes = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: `${parsed.origin}/`,
      },
    });

    if (!upstreamRes.ok) {
      return new Response(`Upstream returned ${upstreamRes.status}`, {
        status: upstreamRes.status,
      });
    }

    const contentType = upstreamRes.headers.get("content-type") || "image/jpeg";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400, immutable");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

    return new Response(upstreamRes.body, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new Response(err?.message || "Failed to fetch image", { status: 502 });
  }
}
