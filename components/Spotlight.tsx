"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ZoroCard } from "@/lib/types";
import { TMDB_IMAGE } from "@/lib/logo";
import type { CoverPalette } from "@/lib/cover-palette";
import { SaveButton } from "./SaveButton";
import { ArtworkImage } from "./ArtworkImage";

import { TitleLogo } from "./TitleLogo";
import type { TitleLogo as Logo } from "@/lib/logo";

interface Backdrop {
  path: string;
  width?: number;
  height?: number;
  lang?: string | null;
}

/** A deliberate reading interval before advancing to the next feature. */
const DWELL_MS = 6500;

export function Spotlight({
  items,
  logos = [],
  backdrops = [],
  palettes = [],
}: {
  items: ZoroCard[];
  logos?: Array<Logo | null>;
  /** Wide TMDB plates. Fall back to the provider poster when absent. */
  backdrops?: Array<Backdrop | null>;
  palettes?: CoverPalette[];
}) {
  const list = items.filter((i) => i?.slug).slice(0, 8);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const timer = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => {
      setI(((next % list.length) + list.length) % list.length);
    },
    [list.length],
  );

  // Pause for readers, keyboard users, and people who prefer reduced motion.
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
  const rank = item.number ?? item.rank;
  const defaultAudio = item.subCount || !item.dubCount ? "sub" : "dub";
  const meta = [
    item.type,
    item.studio,
    item.score ? `★ ${item.score}%` : undefined,
    item.status === "RELEASING" ? "Airing" : item.status,
    item.quality,
  ].filter(
    (v): v is string => Boolean(v) && v !== "?",
  );
  const titleLength = item.title.trim().length;
  const titleClass = titleLength > 58 ? "is-very-long" : titleLength > 34 ? "is-long" : "";

  return (
    <section
      className={held ? "hero is-held" : "hero"}
      aria-label="Spotlight"
      aria-roledescription="carousel"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      }}
      style={coverStyle}
    >
      <div className="hero__art" aria-hidden>
        {list.map((s, n) => {
          const plate = backdrops[n];
          const src = plate?.path
            ? plate.path.startsWith("http")
              ? plate.path
              : `${TMDB_IMAGE}/original${plate.path}`
            : s.bannerImage || s.image;

          if (!src) return null;

          return (
            <ArtworkImage
              key={s.slug}
              src={src}
              fallbackSrc={s.image}
              alt=""
              className={n === i ? "is-on" : undefined}
              sizes="100vw"
              priority={n === 0}
            />
          );
        })}
      </div>
      <div className="hero__veil" aria-hidden />

      <div className="hero__in wrap">
        <div className="hero__copy" key={item.slug}>
          <h1 className={`hero__t ${titleClass}`}>
            <TitleLogo
              logo={logos[i] ?? null}
              title={item.title}
              size={780}
              cap={168}
              priority={i === 0}
            />
          </h1>
          {meta.length ? (
            <p className="hero__meta tnum">
              {meta.map((m, n) => (
                <span key={`${m}-${n}`}>{m}</span>
              ))}
              {item.totalEpisodes ? <span>{item.totalEpisodes} eps</span> : item.subCount ? <span>{item.subCount} sub</span> : null}
            </p>
          ) : null}
          {item.genres && item.genres.length > 0 ? (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "6px 0 10px" }}>
              {item.genres.slice(0, 4).map((g) => (
                <span key={g} className="tag tag--q" style={{ fontSize: "11px", padding: "2px 8px" }}>
                  {g}
                </span>
              ))}
            </div>
          ) : null}
          {item.description ? <p className="hero__d">{item.description}</p> : null}
          <div className="hero__act">
            <Link
              className="btn btn--cover hero__watch"
              href={`/watch/${encodeURIComponent(item.slug)}/1`}
              aria-label={`Watch ${item.title}, episode 1`}
              tabIndex={0}
              data-tv-autofocus
            >
              <span className="hero__watchPlay" aria-hidden>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" />
                </svg>
              </span>
              <span>Watch now</span>
              <span className="hero__watchEp">EP 01</span>
            </Link>
            <SaveButton
              slug={item.slug}
              title={item.title}
              image={item.image}
              type="anime"
              quality={item.quality}
            />
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
