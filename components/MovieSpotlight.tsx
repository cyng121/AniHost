"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ZoroCard } from "@/lib/types";
import type { TitleLogo as Logo } from "@/lib/logo";
import type { CoverPalette } from "@/lib/cover-palette";
import { TitleLogo } from "./TitleLogo";
import { TMDB_IMAGE } from "@/lib/logo";

interface TitleBackdrop {
  path: string;
  width?: number;
  height?: number;
  lang?: string | null;
}

const DWELL_MS = 3000;

export function MovieSpotlight({
  items,
  logos = [],
  backdrops = [],
  palettes = [],
}: {
  items: ZoroCard[];
  logos?: Array<Logo | null>;
  backdrops?: Array<TitleBackdrop | null>;
  palettes?: CoverPalette[];
}) {
  const list = items.filter((i) => i?.slug).slice(0, 6);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const timer = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => {
      setI(((next % list.length) + list.length) % list.length);
    },
    [list.length],
  );

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

  const duration = item.duration
    ? String(item.duration).includes("m")
      ? String(item.duration)
      : `${item.duration}m`
    : null;
  const meta = ["Movie", duration, item.quality].filter(
    (v): v is string => Boolean(v) && v !== "?" && v !== "?m",
  );

  return (
    <section
      className="hero hero--movie"
      aria-roledescription="carousel"
      aria-label="Movie Spotlight"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      style={coverStyle}
    >
      <div className="hero__art hero__art--movie" aria-hidden>
        {list.map((s, n) => {
          const plate = backdrops[n];
          const src = plate?.path
            ? plate.path.startsWith("http")
              ? plate.path
              : `${TMDB_IMAGE}/original${plate.path}`
            : s.image;

          if (!src) return null;

          return (
            <img
              key={s.slug}
              src={src}
              alt=""
              className={n === i ? "is-on" : undefined}
              loading={n <= 1 ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
              fetchPriority={n === 0 ? "high" : "low"}
            />
          );
        })}
      </div>
      <div className="hero__veil" aria-hidden />

      <div className="hero__in wrap">
        <div className="hero__copy hero__copy--movie" key={item.slug}>
          <h1 className="hero__t hero__t--movie">
            <TitleLogo
              logo={logos[i] ?? null}
              title={item.title}
              size={500}
              cap={120}
              priority={i === 0}
            />
          </h1>

          {meta.length ? (
            <p className="hero__meta tnum">
              {meta.map((m, n) => (
                <span key={`${m}-${n}`}>{m}</span>
              ))}
              {item.subCount ? <span>{item.subCount} sub</span> : null}
              {item.dubCount ? <span>{item.dubCount} dub</span> : null}
            </p>
          ) : null}

          {item.description ? (
            <p className="hero__d hero__d--movie">{item.description}</p>
          ) : null}

          <div className="hero__act">
            <Link
              className="btn btn--cover hero__watch"
              href={`/watch/${encodeURIComponent(item.slug)}/1`}
              aria-label={`Watch ${item.title}`}
              tabIndex={0}
            >
              <span className="hero__watchPlay" aria-hidden>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" />
                </svg>
              </span>
              <span>Watch movie</span>
            </Link>
            <Link
              className="btn btn--ghost hero__details"
              href={`/anime/${encodeURIComponent(item.slug)}`}
              tabIndex={0}
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
