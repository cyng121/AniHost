"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { CoverPalette } from "@/lib/cover-palette";

const DWELL_MS = 3000;

export interface MangaSpotlightItem {
  id: string;
  title: string;
  cover?: string;
  banner?: string;
  synopsis?: string;
  type?: string;
  status?: string;
  rating?: number | string;
  totalChapters?: number;
  genres?: string[];
}

export function MangaSpotlight({
  items,
  palettes = [],
}: {
  items: MangaSpotlightItem[];
  palettes?: CoverPalette[];
}) {
  const list = items.filter((i) => i?.id).slice(0, 8);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const timer = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => {
      setI(((next % list.length) + list.length) % list.length);
    },
    [list.length],
  );

  // Auto-slide every 4 seconds
  useEffect(() => {
    if (held || list.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = window.setTimeout(() => go(i + 1), DWELL_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [i, held, list.length, go]);

  if (!list.length) return null;
  const item = list[i];
  const palette = palettes[i];
  const coverStyle = palette
    ? ({
        "--cover-accent": palette.accent,
        "--cover-hover": palette.hover,
      } as CSSProperties)
    : undefined;

  const formattedRating = (() => {
    if (!item.rating) return null;
    const num = typeof item.rating === "number" ? item.rating : parseFloat(String(item.rating));
    return isNaN(num) ? String(item.rating) : `★ ${num.toFixed(1)}`;
  })();

  const meta = [
    item.type,
    item.status,
    formattedRating,
    item.totalChapters ? `${item.totalChapters} Chapters` : null,
  ].filter(Boolean);

  return (
    <section
      className="hero hero--manga"
      aria-label="Manga Spotlight"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      style={coverStyle}
    >
      <div className="hero__art hero__art--manga" aria-hidden>
        {list.map((s, n) => {
          const src = s.banner || s.cover;
          return src ? (
            <img
              key={s.id}
              src={src}
              alt=""
              className={n === i ? "is-on" : undefined}
              loading={n <= 1 ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
              fetchPriority={n === 0 ? "high" : "low"}
            />
          ) : null;
        })}
      </div>
      <div className="hero__veil" aria-hidden />

      <div className="hero__in wrap">
        <div className="hero__copy" key={item.id}>
          <h1 className="hero__t hero__t--manga">{item.title}</h1>

          {meta.length ? (
            <p className="hero__meta tnum">
              {meta.map((m, n) => (
                <span key={`${m}-${n}`}>{m}</span>
              ))}
            </p>
          ) : null}

          {item.synopsis ? (
            <p className="hero__d hero__d--manga">
              {item.synopsis.replace(/<[^>]*>?/gm, "").slice(0, 200)}
              {item.synopsis.length > 200 ? "..." : ""}
            </p>
          ) : null}

          <div className="hero__act">
            <Link className="btn btn--accent hero__details" href={`/manga/${encodeURIComponent(item.id)}`}>
              Details
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
