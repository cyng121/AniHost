import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory, normalizeAnime } from "@/lib/anilist";
import { Card } from "@/components/Card";
import { Footer } from "@/components/Footer";
import { Notice } from "@/components/Notice";

export const revalidate = 900;

type Params = { genre: string };
type Search = { page?: string };

const GENRE_EMOJI_MAP: Record<string, string> = {
  action: "🔥",
  adventure: "🧭",
  "boys-love": "🤍",
  cars: "🏎️",
  comedy: "😂",
  dementia: "🌀",
  demons: "👹",
  drama: "🎭",
  ecchi: "💋",
  erotica: "🔞",
  fantasy: "🪄",
  game: "🎮",
  "girls-love": "🤍",
  gourmet: "🍜",
  harem: "👑",
  historical: "📜",
  horror: "👻",
  isekai: "🚪",
  josei: "✨",
  kids: "🧸",
  magic: "🔮",
  "mahou-shoujo": "⭐",
  "martial-arts": "🥋",
  mecha: "🤖",
  military: "🎖️",
  music: "🎵",
  mystery: "🔍",
  parody: "🃏",
  police: "🚔",
  psychological: "🧠",
  romance: "💖",
  samurai: "⚔️",
  school: "🏫",
  "sci-fi": "🚀",
  seinen: "⚡",
  shoujo: "🌸",
  "shoujo-ai": "🌸",
  shounen: "💥",
  "shounen-ai": "💥",
  "slice-of-life": "☕",
  space: "🪐",
  sports: "⚽",
  "super-power": "⚡",
  supernatural: "👁️",
  suspense: "⏱️",
  thriller: "🔪",
  vampire: "🧛",
  cyberpunk: "🏙️",
};

function getGenreEmoji(slug: string): string {
  const clean = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return GENRE_EMOJI_MAP[clean] ?? "🏷️";
}

const pretty = (g: string) => decodeURIComponent(g).replace(/-/g, " ");

function toAnilistGenre(raw: string): string {
  const map: Record<string, string> = {
    "sci-fi": "Sci-Fi",
    "slice-of-life": "Slice of Life",
    "mahou-shoujo": "Mahou Shoujo",
  };
  const lower = raw.trim().toLowerCase();
  if (map[lower]) return map[lower];
  return raw
    .split(/[-_ ]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { genre } = await params;
  const name = pretty(genre);
  const emoji = getGenreEmoji(genre);
  return {
    title: `${emoji} ${name[0]?.toUpperCase()}${name.slice(1)} Anime`,
    description: `Every ${name} anime in the catalogue, sub and dub.`,
  };
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { genre } = await params;
  const { page } = await searchParams;
  const pageNo = Math.max(1, Number(page) || 1);
  const name = pretty(genre);
  const emoji = getGenreEmoji(genre);
  const anilistGenre = toAnilistGenre(genre);

  let res: any = null;
  try {
    res = await getCategory({
      genre: anilistGenre,
      page: pageNo,
      perPage: 24,
      sort: "POPULARITY_DESC",
    });
  } catch (err: any) {
    return (
      <main className="wrap page">
        <Notice
          title="That genre would not load"
          body={err?.message || "Could not fetch genre catalogue"}
          action={{ href: "/browse#genres", label: "All genres" }}
        />
        <Footer />
      </main>
    );
  }

  const rawMedia = res?.Page?.media ?? [];
  const items = rawMedia.map(normalizeAnime).filter((i: any) => i?.slug);
  const totalPages = res?.Page?.pageInfo?.lastPage ?? (res?.Page?.pageInfo?.hasNextPage ? pageNo + 1 : pageNo);

  if (!items.length) {
    return (
      <main className="wrap page">
        <Notice
          title={`Nothing is listed under ${name}`}
          body="The catalogue may not have reached this page yet."
          action={{ href: "/browse#genres", label: "All genres" }}
        />
        <Footer />
      </main>
    );
  }

  return (
    <main className="wrap page">
      <header className="page__head">
        <h1 style={{ textTransform: "capitalize", display: "inline-flex", alignItems: "center", gap: "12px" }}>
          <span style={{ filter: "grayscale(100%) contrast(140%) brightness(1.2)", opacity: 0.9 }} aria-hidden>
            {emoji}
          </span>
          <span>{name}</span>
        </h1>
        <p className="page__sub tnum">
          Page {pageNo} of {totalPages}
        </p>
      </header>

      <div className="grid">
        {items.map((item: any) => (
          <Card key={item.slug} item={item} />
        ))}
      </div>

      {totalPages > 1 ? (
        <nav className="pager" aria-label="Genre pages">
          {pageNo > 1 ? (
            <Link className="btn btn--ghost" href={href(genre, pageNo - 1)}>
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
            <Link className="btn btn--ghost" href={href(genre, pageNo + 1)}>
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

function href(genre: string, page: number): string {
  return `/genre/${encodeURIComponent(genre)}${page > 1 ? `?page=${page}` : ""}`;
}
