export const runtime = "edge";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mangaChapters, mangaDetail, mangaPages } from "@/lib/manga";
import { Notice } from "@/components/Notice";
import { MangaReaderView } from "@/components/MangaReaderView";

/** Pages are immutable once posted, so this caches for a day. */
export const revalidate = 86_400;

type Params = { id: string; chapter: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id, chapter } = await params;
  const [detail, chapters] = await Promise.all([mangaDetail(id), mangaChapters(id)]);
  const current = chapters.find((c) => c.id === chapter);
  const name = detail?.title ?? "Manga";
  return {
    title: current ? `${name} · Chapter ${current.number}` : name,
    robots: { index: false },
  };
}

export default async function ReaderPage({ params }: { params: Promise<Params> }) {
  const { id, chapter } = await params;

  const [detail, chapters] = await Promise.all([mangaDetail(id), mangaChapters(id)]);
  if (!detail || detail.isAdult) notFound();

  const index = chapters.findIndex((c) => c.id === chapter);
  if (index === -1) notFound();

  const current = chapters[index];
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const pages = await mangaPages(id, chapter);

  if (!pages.length) {
    return (
      <main className="wrap page">
        <Notice
          title="This chapter would not load"
          body="The provider returned no pages for it. Another chapter may still work."
          action={{ href: `/manga/${encodeURIComponent(id)}`, label: "Back to chapters" }}
        />
      </main>
    );
  }

  return (
    <MangaReaderView
      id={id}
      detail={detail}
      current={current}
      prev={prev}
      next={next}
      pages={pages}
    />
  );
}
