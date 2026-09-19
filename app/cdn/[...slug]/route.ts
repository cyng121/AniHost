import { NextRequest } from "next/server";
import {
  getCorsHeaders,
  getLatestCdnContext,
  getAllRecentCdns,
  handleHlsProxy,
} from "@/lib/hls-proxy-core";

// =========================================
// 🌍 OPTIONS HANDLER (CORS Preflight)
// =========================================
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

// =========================================
// 🎬 HEAD HANDLER
// =========================================
export async function HEAD(req: NextRequest) {
  return handleCdnProxy(req, "HEAD");
}

// =========================================
// 🎬 GET HANDLER
// =========================================
export async function GET(req: NextRequest) {
  return handleCdnProxy(req, "GET");
}

async function handleCdnProxy(req: NextRequest, method: "GET" | "HEAD") {
  const cdn = getLatestCdnContext();
  const targetPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const targetUrl = `${cdn.origin}${targetPath}`;

  const hlsUrl = new URL("/api/hls", req.nextUrl.origin);
  hlsUrl.searchParams.set("url", targetUrl);
  if (cdn.referer) {
    hlsUrl.searchParams.set("referer", cdn.referer);
  }

  const proxiedReq = new NextRequest(hlsUrl.toString(), {
    headers: req.headers,
    method,
  });

  const response = await handleHlsProxy(proxiedReq, method);

  // If failed with 404 or 500, try other recent CDN domains
  if (!response.ok && response.status !== 403) {
    const allCdns = getAllRecentCdns();
    for (const altCdn of allCdns) {
      if (altCdn.origin === cdn.origin) continue;
      const altTarget = `${altCdn.origin}${targetPath}`;
      const altHlsUrl = new URL("/api/hls", req.nextUrl.origin);
      altHlsUrl.searchParams.set("url", altTarget);
      if (altCdn.referer) {
        altHlsUrl.searchParams.set("referer", altCdn.referer);
      }
      const altReq = new NextRequest(altHlsUrl.toString(), {
        headers: req.headers,
        method,
      });
      const altRes = await handleHlsProxy(altReq, method);
      if (altRes.ok) {
        return altRes;
      }
    }
  }

  return response;
}
