export const runtime = "edge";
import type { Metadata } from "next";
import { MANGA_SHELVES, mangaHome, mangaSearch, type MangaCard } from "@/lib/manga";
import { YouTubeMangaCard } from "@/components/YouTubeMangaCard";
import { YouTubeFilterBar } from "@/components/YouTubeFilterBar";
import { Footer } from "@/components/Footer";
import { Notice } from "@/components/Notice";
import { MangaSearchDock } from "@/components/MangaSearchDock";

export const metadata: Metadata = {
  title: "Manga · AniHost",
  description: "Read trending manga, manhwa, and manhua in YouTube-style video feed.",
};

export const revalidate = 600;

interface MangaPageProps {
  searchParams?: Promise<{
    genre?: string;
    sort?: string;
    shelf?: string;
    type?: string;
    q?: string;
  }>;
}

export default async function MangaPage({ searchParams }: MangaPageProps) {
  const params = searchParams ? await searchParams : {};
  const { genre, sort, shelf, type, q } = params;

  let shelves: Record<string, MangaCard[]> = {};
  try {
    shelves = await mangaHome();
  } catch (err: any) {
    return (
      <div className="wrap page">
        <Notice
          title="The manga shelves are not answering"
          body={err?.message || "Could not load manga feed"}
          action={{ href: "/manga", label: "Try again" }}
        />
        <Footer />
      </div>
    );
  }

  const populated = MANGA_SHELVES.filter((s) => (shelves[s.key] ?? []).length);

  if (!populated.length) {
    return (
      <div className="wrap page">
        <Notice
          title="The manga shelves are not answering"
          body="The provider did not return anything this time. It is usually brief."
          action={{ href: "/manga", label: "Try again" }}
        />
        <Footer />
      </div>
    );
  }

  // Handle filtering
  let filteredTitle: string | null = null;
  let filteredItems: MangaCard[] | null = null;

  if (q?.trim()) {
    const query = q.trim();
    filteredTitle = `Search results for “${query}”`;
    try {
      filteredItems = await mangaSearch(query);
    } catch {
      filteredItems = [];
    }
  } else if (genre) {
    filteredTitle = `${genre} Manga`;
    try {
      filteredItems = await mangaSearch(genre);
    } catch {
      // fallback: collect from loaded shelves matching title or type
      filteredItems = [];
    }
  } else if (type) {
    filteredTitle = `${type} Collection`;
    const seen = new Set<string>();
    const list: MangaCard[] = [];
    for (const s of populated) {
      for (const item of shelves[s.key] ?? []) {
        if (!seen.has(item.id) && item.type?.toLowerCase() === type.toLowerCase()) {
          seen.add(item.id);
          list.push(item);
        }
      }
    }
    filteredItems = list;
  } else if (shelf) {
    const targetKey =
      shelf === "trending" ? "trending-carousel" : shelf;
    const match = populated.find(
      (s) => s.key === targetKey || s.title.toLowerCase().replace(/\s+/g, "-") === shelf
    );
    if (match) {
      filteredTitle = match.title;
      filteredItems = shelves[match.key] ?? [];
    }
  } else if (sort === "top-rated") {
    const match = populated.find((s) => s.key === "top-rated");
    if (match) {
      filteredTitle = "Top Rated Manga";
      filteredItems = shelves[match.key] ?? [];
    }
  }

  return (
    <div>
      <YouTubeFilterBar basePath="/manga" />

      <div className="yt-grid-container yt-manga-grid-container">
        {filteredItems && filteredTitle ? (
          <section className="yt-home-section">
            <h2 className="yt-section-title">{filteredTitle}</h2>
            {filteredItems.length > 0 ? (
              <div className="yt-grid yt-grid--rec yt-grid--manga">
                {filteredItems.map((item) => (
                  <YouTubeMangaCard key={`filter-${item.id}`} item={item} />
                ))}
              </div>
            ) : (
              <div className="yt-empty-state" style={{ padding: "48px 0" }}>
                <p>No titles found for this category.</p>
              </div>
            )}
          </section>
        ) : (
          /* Default YouTube Sections for all Populated Manga Shelves */
          <>
            {populated.map((shelfItem) => {
              const items = shelves[shelfItem.key] ?? [];
              if (!items.length) return null;

              return (
                <section key={shelfItem.key} className="yt-home-section">
                  <h2 className="yt-section-title">{shelfItem.title}</h2>
                  <div className="yt-grid yt-grid--rec yt-grid--manga">
                    {items.map((item) => (
                      <YouTubeMangaCard
                        key={`${shelfItem.key}-${item.id}`}
                        item={item}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}

        <div style={{ marginTop: "48px" }}>
          <Footer />
        </div>
      </div>

      <MangaSearchDock initialQuery={q || ""} initialType={type || "manga"} />
    </div>
  );
}
