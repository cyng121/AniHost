import { NextRequest, NextResponse } from "next/server";
import { getCategory, normalizeAnime } from "@/lib/anilist";

export const runtime = "edge";


export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") || "category";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("perPage") || "24", 10);
  const genre = searchParams.get("genre") || undefined;
  const sort = searchParams.get("sort") || undefined;
  const format = searchParams.get("format") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;

  try {
    if (type === "category") {
      const data = await getCategory({
        page,
        perPage,
        genre,
        sort,
        format,
        status,
        search,
      });

      const media = data?.Page?.media || [];
      const pageInfo = data?.Page?.pageInfo || {
        currentPage: page,
        hasNextPage: false,
      };

      const items = media.map(normalizeAnime);

      return NextResponse.json({
        items,
        pageInfo,
      });
    }

    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch from AniList" },
      { status: 500 }
    );
  }
}
