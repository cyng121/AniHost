export const runtime = "edge";
import type { Metadata } from "next";
import { searchAnime, normalizeAnime } from "@/lib/anilist";
import { YouTubeSearchResults } from "@/components/YouTubeSearchResults";
import { SearchHub } from "@/components/SearchHub";
import { Footer } from "@/components/Footer";
import { Notice } from "@/components/Notice";

export const revalidate = 300;

type Search = { q?: string; page?: string; type?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { q, type } = await searchParams;
  const query = (q ?? "").trim();
  const isManga = type === "manga";
  return {
    title: query ? `“${query}” — ${isManga ? "Search Manga" : "Search Anime"}` : isManga ? "Search Manga" : "Search Anime",
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { q, page, type } = await searchParams;
  const query = (q ?? "").trim();
  const pageNo = Math.max(1, Number(page) || 1);
  const isManga = type === "manga";

  if (!query) {
    return (
      <main className="wrap page search-page">
        <header className="page__head" style={{ maxWidth: "800px", margin: "0 auto 24px" }}>
          <h1>Search &amp; Explore</h1>
          <p className="page__sub">
            Discover your favorite anime and manga, browse genres, or search by title.
          </p>
        </header>
        <SearchHub />
        <Footer />
      </main>
    );
  }

  if (isManga) {
    let mangaItems: any[] = [];
    try {
      const { mangaSearch, mangaCover } = await import("@/lib/manga");
      const list = await mangaSearch(query);
      mangaItems = list.map((m) => {
        const cover = mangaCover(m) || "";
        const author =
          m.authors && m.authors.length > 0
            ? m.authors.map((a) => a.author || a.name).filter(Boolean).join(", ")
            : m.type || "Manga";
        return {
          slug: m.id,
          title: m.title,
          image: cover,
          bannerImage: m.banner || cover,
          type: m.type || "Manga",
          totalEpisodes: m.latestChapter ? parseInt(m.latestChapter.replace(/\D/g, ""), 10) : undefined,
          score: m.rating ? Number(m.rating) : undefined,
          studio: author,
        };
      });
    } catch (err: any) {
      return (
        <main className="wrap page" style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 16px" }}>
          <Notice
            title="Search is not answering"
            body={err?.message || "Could not execute manga search"}
            action={{ href: `/search?q=${encodeURIComponent(query)}&type=manga`, label: "Try again" }}
          />
          <Footer />
        </main>
      );
    }

    return (
      <main style={{ minHeight: "80vh" }}>
        <YouTubeSearchResults
          query={query}
          items={mangaItems}
          total={mangaItems.length}
          pageNo={pageNo}
          totalPages={1}
          type="manga"
        />
        <Footer />
      </main>
    );
  }

  let res: any = null;
  try {
    res = await searchAnime(query, pageNo, 24);
  } catch (err: any) {
    return (
      <main className="wrap page" style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 16px" }}>
        <Notice
          title="Search is not answering"
          body={err?.message || "Could not execute anime search"}
          action={{ href: `/search?q=${encodeURIComponent(query)}`, label: "Try again" }}
        />
        <Footer />
      </main>
    );
  }

  const rawMedia = res?.results ?? res?.Page?.media ?? [];
  const items = rawMedia.map(normalizeAnime).filter((i: any) => i?.slug);
  const total = res?.pageInfo?.total ?? res?.Page?.pageInfo?.total ?? items.length;
  const hasNextPage = res?.pageInfo?.hasNextPage ?? res?.Page?.pageInfo?.hasNextPage ?? (items.length >= 24);
  const totalPages = res?.pageInfo?.lastPage ?? res?.Page?.pageInfo?.lastPage ?? (hasNextPage ? pageNo + 1 : pageNo);

  return (
    <main style={{ minHeight: "80vh" }}>
      <YouTubeSearchResults
        query={query}
        items={items}
        total={total}
        pageNo={pageNo}
        totalPages={totalPages}
        type="anime"
      />
      <Footer />
    </main>
  );
}
