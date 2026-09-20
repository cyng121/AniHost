import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";


function getBaseUrl(): string {
  const envBase = process.env.ANIGHOST_API_BASE?.trim();
  if (
    envBase &&
    !envBase.includes("vercel.app") &&
    !envBase.includes("localhost") &&
    !envBase.includes("senpaiflix") &&
    !envBase.includes("onrender.com")
  ) {
    return envBase.replace(/\/+$/, "");
  }
  return "https://api.animextrons.co.in";
}

const UPSTREAM = getBaseUrl();
const ORIGIN = "https://animextrons.co.in";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = (path || []).join("/");
  const search = request.nextUrl.search;

  try {
    const upstreamUrl = `${UPSTREAM}/api/tmdb/${pathStr}${search}`;
    const res = await fetch(upstreamUrl, {
      headers: {
        Origin: ORIGIN,
        Referer: `${ORIGIN}/`,
        Accept: "application/json",
      },
      next: { revalidate: 86_400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal TMDB Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
