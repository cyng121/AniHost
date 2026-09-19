import { NextResponse } from "next/server";
import { mangaSearch, mangaCover } from "@/lib/manga";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const type = searchParams.get("type")?.trim().toLowerCase();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    let items = await mangaSearch(q);
    if (type && type !== "all") {
      items = items.filter((m) => m.type?.toLowerCase() === type);
    }
    const results = items.slice(0, 8).map((m) => {
      const cover = mangaCover(m) || "";
      const author =
        m.authors && m.authors.length > 0
          ? m.authors.map((a) => a.author || a.name).filter(Boolean).join(", ")
          : m.type || "Manga";

      return {
        id: m.id,
        title: m.title,
        cover,
        type: m.type || "Manga",
        author,
        rating: m.rating,
        latestChapter: m.latestChapter,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ results: [] });
  }
}
