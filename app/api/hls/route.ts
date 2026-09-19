import { NextRequest } from "next/server";
import { getCorsHeaders, handleHlsProxy } from "@/lib/hls-proxy-core";

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
  return handleHlsProxy(req, "HEAD");
}

// =========================================
// 🎬 GET HANDLER
// =========================================
export async function GET(req: NextRequest) {
  return handleHlsProxy(req, "GET");
}