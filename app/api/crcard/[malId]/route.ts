import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";


const UPSTREAM = "https://catalog.animetvplus.site/api/cr/card";

const EMPTY = NextResponse.json(
  { error: "No CR entry found" },
  {
    status: 404,
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
  }
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ malId: string }> }
) {
  const { malId } = await params;

  if (!malId || isNaN(Number(malId)) || Number(malId) <= 0) {
    return NextResponse.json({ error: "Invalid mal_id" }, { status: 400 });
  }

  try {
    const res = await fetch(`${UPSTREAM}/${malId}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; AniGhost/1.0)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return EMPTY;
    }

    // Guard: upstream sometimes returns an HTML error page — don't try to parse it as JSON
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return EMPTY;
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return EMPTY;
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "CR card fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
