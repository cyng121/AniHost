import Link from "next/link";
import { ExpandableSynopsis } from "@/components/ExpandableSynopsis";
import { TitleLogo } from "@/components/TitleLogo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findMangaArt, findMangaLogo, mangaChapters, mangaCover, mangaDetail, mangaRecommendations } from "@/lib/manga";
import { YouTubeMangaCard } from "@/components/YouTubeMangaCard";
import { SaveButton } from "@/components/SaveButton";
import { Footer } from "@/components/Footer";
import { Notice } from "@/components/Notice";
import { MangaChaptersList } from "@/components/MangaChaptersList";

export const revalidate = 1800;

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await mangaDetail(id);
  if (!detail) return { title: "Manga · Ani Ghost" };
  return {
    title: `${detail.title} — Manga · Ani Ghost`,
    description: (detail.synopsis ?? "").replace(/\s+/g, " ").slice(0, 180),
  };
}

export default async function MangaDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [detail, chapters] = await Promise.all([mangaDetail(id), mangaChapters(id)]);

  if (!detail) notFound();
  // The catalogue is general-audience; adult titles are not served here.
  if (detail.isAdult) notFound();

  const [anilistArt, titleLogo, recommendations] = await Promise.all([
    findMangaArt(detail.title).catch(() => null),
    findMangaLogo(detail.title).catch(() => null),
    mangaRecommendations(id, detail.genres, detail.type).catch(() => []),
  ]);
  const cover = mangaCover(detail) || anilistArt?.cover || undefined;
  const banner = detail.banner || anilistArt?.banner || cover || undefined;

  const authors = (detail.authors ?? [])
    .map((a) => a.author ?? a.name)
    .filter(Boolean)
    .join(", ");
  const first = chapters[0];
  const latest = chapters[chapters.length - 1];

  const formattedRating =
    detail.rating != null
      ? (() => {
          const num =
            typeof detail.rating === "number"
              ? detail.rating
              : parseFloat(String(detail.rating));
          return isNaN(num) ? String(detail.rating) : num.toFixed(1);
        })()
      : undefined;

  const facts: Array<[string, string]> = (
    [
      ["Status", detail.status],
      ["Type", detail.type],
      ["Chapters", chapters.length ? String(chapters.length) : undefined],
      ["Author", authors || undefined],
      ["Rating", formattedRating ? `★ ${formattedRating}` : undefined],
      ["Views", typeof detail.views === "number" ? detail.views.toLocaleString() : undefined],
    ] as Array<[string, string | undefined]>
  ).filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <main className="title title--manga">
      <div className="title__wash" aria-hidden>
        {banner ? <img src={banner} alt="" /> : null}
      </div>

      <div className="wrap title__in">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/manga">Manga</Link>
          <span aria-hidden>/</span>
          <span>{detail.title}</span>
        </nav>

        <div className="title__grid">
          <div className="title__art title__art--sharp">
            {cover ? <img src={cover} alt={`Cover of ${detail.title}`} fetchPriority="high" /> : null}
          </div>

          <div className="title__lead">
            {titleLogo ? (
              <>
                <h1 className="sr-only">{detail.title}</h1>
                <div className="title__h">
                  <TitleLogo logo={titleLogo} title={detail.title} cap={54} size={300} priority />
                </div>
              </>
            ) : (
              <h1 className="title__h">{detail.title}</h1>
            )}
            {detail.englishTitle && detail.englishTitle !== detail.title ? (
              <p className="title__jp">{detail.englishTitle}</p>
            ) : null}

            <div className="title__pills">
              {detail.status ? <span className="pill">{detail.status}</span> : null}
              {chapters.length ? <span className="pill">{chapters.length} chapters</span> : null}
              {formattedRating ? <span className="pill pill--accent">★ {formattedRating}</span> : null}
            </div>
          </div>

          <div className="title__actions">
            <div className="title__ctaRow">
              {first ? (
                <div className="cta">
                  <Link
                    className="btn btn--accent btn--lg"
                    href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(first.id)}`}
                  >
                    Start reading · Ch. {first.number}
                  </Link>
                  {latest && latest.id !== first.id ? (
                    <Link
                      className="btn btn--ghost"
                      href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(latest.id)}`}
                    >
                      Latest · Ch. {latest.number}
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="title__nope">No chapters have been posted for this title yet.</p>
              )}

              <SaveButton
                slug={id}
                title={detail.title}
                image={cover}
                type="manga"
                rating={formattedRating}
              />
            </div>
          </div>

          <div className="title__details">
            {detail.synopsis ? <ExpandableSynopsis text={detail.synopsis} /> : null}

            {detail.genres?.length ? (
              <div className="chipwrap chipwrap--tight">
                {detail.genres.map((g: any) => {
                  const name = typeof g === "string" ? g : g?.genre || g?.name || String(g);
                  const key = typeof g === "string" ? g : g?.slug || g?.genre || String(g);
                  return (
                    <Link
                      key={key}
                      href={`/manga?genre=${encodeURIComponent(name)}`}
                      className="chip"
                      style={{ textDecoration: "none" }}
                    >
                      {name}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {facts.length ? (
          <dl className="facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className={k === "Chapters" || k === "Views" ? "tnum" : undefined}>{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {chapters.length ? (
          <MangaChaptersList mangaId={id} chapters={chapters} />
        ) : (
          <Notice title="Nothing to read yet" body="No chapters have been posted for this title." />
        )}

        {recommendations.length ? (
          <section className="section manga-rec-section" style={{ marginTop: 44 }}>
            <div className="section__head">
              <div>
                <span className="cap">Readers also enjoyed</span>
                <h2>Recommended Manga</h2>
              </div>
            </div>
            <div className="yt-grid yt-grid--rec yt-grid--manga">
              {recommendations.map((rec) => (
                <YouTubeMangaCard key={`rec-${rec.id}`} item={rec} />
              ))}
            </div>
          </section>
        ) : null}

        <Footer />
      </div>
    </main>
  );
}
