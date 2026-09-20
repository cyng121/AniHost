export const runtime = "edge";
import Link from "next/link";
import type { Metadata } from "next";
import { getCategory, normalizeAnime } from "@/lib/anilist";
import { Card } from "@/components/Card";
import { Footer } from "@/components/Footer";
import { Notice } from "@/components/Notice";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Anime Movies · Ani Ghost",
  description: "Watch high quality anime movies subbed and dubbed with no ads.",
};

type Search = { page?: string };

export default async function MoviesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { page } = await searchParams;
  const pageNo = Math.max(1, Number(page) || 1);

  let res: any = null;
  try {
    res = await getCategory({ format: "MOVIE", page: pageNo, perPage: 24, sort: "POPULARITY_DESC" });
  } catch (err: any) {
    return (
      <main className="wrap page">
        <Notice
          title="Anime movies would not load"
          body={err?.message || "Could not fetch movies from AniList"}
          action={{ href: "/movies", label: "Try again" }}
        />
        <Footer />
      </main>
    );
  }

  const rawMedia = res?.Page?.media ?? [];
  const items = rawMedia.map(normalizeAnime).filter((i: any) => i?.slug);
  const totalPages = res?.Page?.pageInfo?.lastPage ?? (res?.Page?.pageInfo?.hasNextPage ? pageNo + 1 : pageNo);
  const totalResults = res?.Page?.pageInfo?.total ?? items.length;

  if (!items.length) {
    return (
      <main className="wrap page">
        <Notice
          title="No anime movies found"
          body="The catalogue might still be indexing new releases."
          action={{ href: "/", label: "Back to Home" }}
        />
        <Footer />
      </main>
    );
  }

  return (
    <main className="wrap page">
      <header className="page__head">
        <h1>
          <span
            style={{
              filter: "grayscale(100%) contrast(140%) brightness(1.2)",
              fontSize: "28px",
              opacity: 0.9,
            }}
            aria-hidden
          >
            🎬
          </span>
          <span>Anime Movies</span>
        </h1>
        <p className="page__sub tnum">
          {totalResults > 0 ? `${totalResults} titles · ` : ""}Page {pageNo} of {totalPages}
        </p>
      </header>

      <div className="grid">
        {items.map((item: any) => (
          <Card key={item.slug} item={item} />
        ))}
      </div>

      {totalPages > 1 ? (
        <nav className="pager" aria-label="Movies pages">
          {pageNo > 1 ? (
            <Link className="btn btn--ghost" href={href(pageNo - 1)}>
              ← Previous
            </Link>
          ) : (
            <span className="btn btn--ghost" aria-disabled="true">
              ← Previous
            </span>
          )}
          <span className="pager__at tnum">
            {pageNo} / {totalPages}
          </span>
          {pageNo < totalPages ? (
            <Link className="btn btn--ghost" href={href(pageNo + 1)}>
              Next →
            </Link>
          ) : (
            <span className="btn btn--ghost" aria-disabled="true">
              Next →
            </span>
          )}
        </nav>
      ) : null}

      <Footer />
    </main>
  );
}

function href(page: number): string {
  return `/movies${page > 1 ? `?page=${page}` : ""}`;
}
