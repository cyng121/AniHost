import type { Metadata } from "next";
import { getHomeData, getCategory, normalizeAnime } from "@/lib/anilist";
import { Notice } from "@/components/Notice";
import { Footer } from "@/components/Footer";
import { YouTubeFilterBar } from "@/components/YouTubeFilterBar";
import { YouTubeVideoCard } from "@/components/YouTubeVideoCard";
import { InfiniteVideoGrid } from "@/components/InfiniteVideoGrid";
import type { ZoroCard } from "@/lib/types";

export const metadata: Metadata = {
  title: "Home · Ani Ghost",
  description: "Explore trending anime, movies, and episodes in YouTube-style video feed.",
};

export const revalidate = 300;

interface HomePageProps {
  searchParams?: Promise<{ genre?: string; sort?: string; q?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const currentGenre = params.genre;
  const currentSort = params.sort;

  let home: any = null;
  try {
    home = await getHomeData();
  } catch (err: any) {
    return (
      <div className="wrap page">
        <Notice
          title="The catalogue is not answering"
          body={err?.message || "Could not load home feed"}
          action={{ href: "/", label: "Try again" }}
        />
        <Footer />
      </div>
    );
  }

  // 1. If filtered by genre, query AniList category endpoint
  let filteredItems: ZoroCard[] | null = null;
  let genreHasNextPage = false;
  if (currentGenre && currentGenre !== "All") {
    try {
      const categoryRes = await getCategory({ genre: currentGenre, perPage: 24, sort: "POPULARITY_DESC" });
      if (categoryRes?.Page?.media?.length) {
        filteredItems = categoryRes.Page.media.map(normalizeAnime);
        genreHasNextPage = Boolean(categoryRes.Page.pageInfo?.hasNextPage);
      }
    } catch {
      // Fallback if category call fails
    }
  }

  // 2. If filtered by sort (top-rated or new-releases)
  let sortedItems: ZoroCard[] | null = null;
  let sortHasNextPage = false;
  if (currentSort === "top-rated") {
    try {
      const sortRes = await getCategory({ sort: "SCORE_DESC", perPage: 24 });
      if (sortRes?.Page?.media?.length) {
        sortedItems = sortRes.Page.media.map(normalizeAnime);
        sortHasNextPage = Boolean(sortRes.Page.pageInfo?.hasNextPage);
      }
    } catch {}
  } else if (currentSort === "new-releases") {
    try {
      const sortRes = await getCategory({ sort: "START_DATE_DESC", perPage: 24 });
      if (sortRes?.Page?.media?.length) {
        sortedItems = sortRes.Page.media.map(normalizeAnime);
        sortHasNextPage = Boolean(sortRes.Page.pageInfo?.hasNextPage);
      }
    } catch {}
  }

  // All AniList home shelves (matching API response, excluding spotlight)
  const topToday: ZoroCard[] = (home?.topTodayTrending?.media ?? []).map(normalizeAnime);
  const topWeekPopular: ZoroCard[] = (home?.topWeekPopular?.media ?? []).map(normalizeAnime);
  const topMonthScore: ZoroCard[] = (home?.topMonthScore?.media ?? []).map(normalizeAnime);
  const popularAnime: ZoroCard[] = (home?.popularAnime?.media ?? []).map(normalizeAnime);
  const popularMovies: ZoroCard[] = (home?.popularMovies?.media ?? []).map(normalizeAnime);
  const allTimeBest: ZoroCard[] = (home?.allTimeBest?.media ?? []).map(normalizeAnime);
  const hiddenGems: ZoroCard[] = (home?.hiddenGems?.media ?? []).map(normalizeAnime);
  const upcomingAnime: ZoroCard[] = (home?.upcomingAnime?.media ?? []).map(normalizeAnime);

  return (
    <div>
      <YouTubeFilterBar />

      <div className="yt-grid-container">
        {/* If filtered by genre */}
        {filteredItems ? (
          <InfiniteVideoGrid
            key={`genre-${currentGenre}`}
            title={`${currentGenre} Anime`}
            genre={currentGenre}
            sort="POPULARITY_DESC"
            initialItems={filteredItems}
            initialHasNextPage={genreHasNextPage}
          />
        ) : currentSort === "top-rated" ? (
          <InfiniteVideoGrid
            key="sort-top-rated"
            title="Top Rated Anime"
            sort="SCORE_DESC"
            initialItems={sortedItems ?? [...topMonthScore, ...allTimeBest]}
            initialHasNextPage={sortHasNextPage}
          />
        ) : currentSort === "new-releases" ? (
          <InfiniteVideoGrid
            key="sort-new-releases"
            title="New & Trending Releases"
            sort="START_DATE_DESC"
            initialItems={sortedItems ?? [...topToday, ...upcomingAnime]}
            initialHasNextPage={sortHasNextPage}
          />
        ) : (
          /* Default Home Shelves from API response (Spotlight excluded) */
          <>
            {/* 1. Top Today */}
            {topToday.length > 0 ? (
              <section className="yt-home-section">
                <h2 className="yt-section-title">Top Today</h2>
                <div className="yt-grid">
                  {topToday.map((item) => (
                    <YouTubeVideoCard key={`today-${item.slug}`} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* 2. Top Week Popular */}
            {topWeekPopular.length > 0 ? (
              <section className="yt-home-section">
                <h2 className="yt-section-title">Top Week Popular</h2>
                <div className="yt-grid">
                  {topWeekPopular.map((item) => (
                    <YouTubeVideoCard key={`week-${item.slug}`} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* 3. Top Month Score */}
            {topMonthScore.length > 0 ? (
              <section className="yt-home-section">
                <h2 className="yt-section-title">Top Month Score</h2>
                <div className="yt-grid">
                  {topMonthScore.map((item) => (
                    <YouTubeVideoCard key={`month-${item.slug}`} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* 4. Popular Anime */}
            {popularAnime.length > 0 ? (
              <section className="yt-home-section">
                <h2 className="yt-section-title">Popular Anime</h2>
                <div className="yt-grid">
                  {popularAnime.map((item) => (
                    <YouTubeVideoCard key={`pop-${item.slug}`} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* 5. Popular Movies */}
            {popularMovies.length > 0 ? (
              <section className="yt-home-section">
                <h2 className="yt-section-title">Popular Movies</h2>
                <div className="yt-grid">
                  {popularMovies.map((item) => (
                    <YouTubeVideoCard key={`mov-${item.slug}`} item={item} badge="MOVIE" />
                  ))}
                </div>
              </section>
            ) : null}

            {/* 6. All-Time Best */}
            {allTimeBest.length > 0 ? (
              <section className="yt-home-section">
                <h2 className="yt-section-title">All-Time Best</h2>
                <div className="yt-grid">
                  {allTimeBest.map((item) => (
                    <YouTubeVideoCard key={`best-${item.slug}`} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* 7. Hidden Gems */}
            {hiddenGems.length > 0 ? (
              <section className="yt-home-section">
                <h2 className="yt-section-title">Hidden Gems</h2>
                <div className="yt-grid">
                  {hiddenGems.map((item) => (
                    <YouTubeVideoCard key={`gem-${item.slug}`} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* 8. Upcoming Anime */}
            {upcomingAnime.length > 0 ? (
              <section className="yt-home-section">
                <h2 className="yt-section-title">Upcoming Anime</h2>
                <div className="yt-grid">
                  {upcomingAnime.map((item) => (
                    <YouTubeVideoCard
                      key={`soon-${item.slug}`}
                      item={item}
                      badge="UPCOMING"
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

        <div style={{ marginTop: "48px" }}>
          <Footer />
        </div>
      </div>
    </div>
  );
}
