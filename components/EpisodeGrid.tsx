"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ZoroEpisode } from "@/lib/types";

export interface EpisodeMeta {
  episode?: number;
  title?: string;
  thumbnail?: string;
  description?: string;
  sub?: boolean;
  dub?: boolean;
}

/**
 * Long-running shows have hundreds of episodes. Rather than paginate them
 * behind a click, they are bucketed into ranges of 100 with the current range
 * open, and a filter for people who know the number they want.
 */
const BUCKET = 100;

export function EpisodeGrid({
  slug,
  episodes,
  audio,
  meta,
}: {
  slug: string;
  episodes: ZoroEpisode[];
  audio: "sub" | "dub";
  /** Real titles, stills and synopses keyed by episode number. */
  meta?: Map<number, EpisodeMeta>;
}) {
  const buckets = useMemo(() => {
    const out: ZoroEpisode[][] = [];
    for (let i = 0; i < episodes.length; i += BUCKET) out.push(episodes.slice(i, i + BUCKET));
    return out;
  }, [episodes]);

  const [b, setB] = useState(0);
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return buckets[b] ?? [];
    return episodes.filter(
      (e) => String(e.number) === term || (e.title ?? "").toLowerCase().includes(term),
    );
  }, [q, b, buckets, episodes]);

  if (!episodes.length) return null;

  return (
    <section className="section" id="episodes">
      <div className="section__head">
        <div>
          <span className="cap">{episodes.length} available</span>
          <h2>Episodes</h2>
        </div>
        <div className="section__act">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
          >
            {collapsed ? "Show episodes" : "Hide episodes"}
          </button>
          {!collapsed ? (
            <label className="epfilter">
              <span className="vh">Filter episodes</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Episode number or title"
              />
            </label>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
        <>
          {buckets.length > 1 && !q.trim() ? (
            <div className="chipwrap chipwrap--tight">
              {buckets.map((bucket, n) => (
                <button
                  key={n}
                  className="chip"
                  aria-pressed={n === b}
                  onClick={() => setB(n)}
                >
                  {bucket[0].number}–{bucket[bucket.length - 1].number}
                </button>
              ))}
            </div>
          ) : null}

          <div className="eps">
        {shown.map((e) => {
          const extra = meta?.get(e.number);
          // The provider often ships a bare "Episode 7"; the mapping has the
          // real one. Prefer whichever is actually a name.
          const provider = (e.title ?? "").trim();
          const generic =
            !provider || new RegExp(`^(episode\\s*)?${e.number}$`, "i").test(provider);
          const name = (generic ? extra?.title : provider) || provider || `Episode ${e.number}`;
          const still = extra?.thumbnail || e.thumbnail;
          const blurb = extra?.description || e.description;
          return (
          <Link
            key={e.number}
            className={still ? "ep ep--rich" : "ep"}
            href={`/watch/${encodeURIComponent(slug)}/${e.number}?audio=${audio}`}
          >
            {still ? (
              <span className="ep__still">
                <img src={still} alt="" loading="lazy" decoding="async" />
                <span className="ep__play" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" />
                  </svg>
                </span>
              </span>
            ) : null}
            <span className="ep__n tnum">{e.number}</span>
            <span className="ep__body">
              <span className="ep__t">{name}</span>
              {blurb ? <span className="ep__d">{blurb}</span> : null}
            </span>
            <span className="ep__tags">
              {e.sub ? <span className="tag tag--sub">SUB</span> : null}
              {e.dub ? <span className="tag tag--dub">DUB</span> : null}
            </span>
          </Link>
          );
        })}
      </div>

      {q.trim() && !shown.length ? (
        <p className="eps__none">No episode matches “{q.trim()}”.</p>
      ) : null}
        </>
      ) : null}
    </section>
  );
}
