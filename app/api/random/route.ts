export const runtime = "edge";
import { NextResponse } from "next/server";
import { getHomeData } from "@/lib/anilist";

/**
 * "Surprise me" — redirect to a random title from AniList.
 */
export const dynamic = "force-dynamic";


export async function GET(request: Request) {
  let home: any = null;
  try {
    home = await getHomeData();
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const pool = [
    ...(home?.spotlight?.media ?? []),
    ...(home?.topTodayTrending?.media ?? []),
    ...(home?.topWeekPopular?.media ?? []),
    ...(home?.popularAnime?.media ?? []),
    ...(home?.allTimeBest?.media ?? []),
  ]
    .map((m) => m?.id)
    .filter((id) => id != null);

  const unique = [...new Set(pool)];
  if (!unique.length) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const slug = unique[Math.floor(Math.random() * unique.length)];
  const target = new URL(`/anime/${encodeURIComponent(slug)}`, request.url);
  return NextResponse.redirect(target, { status: 302 });
}
