"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { getProgress, isFinished, type Progress } from "@/lib/progress";
import { readPrefs } from "@/lib/prefs";
import type { CoverPalette } from "@/lib/cover-palette";

/**
 * One button, two states. Before mount it renders the "start" state rather
 * than a spinner, so the primary action is never missing from the page — if
 * there is saved progress it upgrades in place a frame later.
 */
export function WatchCta({
  slug,
  firstEpisode,
  lastEpisode,
  hasDub,
  palette,
}: {
  slug: string;
  firstEpisode: number;
  lastEpisode: number;
  hasDub: boolean;
  palette: CoverPalette;
}) {
  const [p, setP] = useState<Progress | null>(null);
  const [preferred, setPreferred] = useState<"sub" | "dub">("sub");

  useEffect(() => {
    setP(getProgress(slug));
    setPreferred(readPrefs().audio);
  }, [slug]);

  let episode = firstEpisode;
  let label = `Start watching · Episode ${firstEpisode}`;
  let seek = 0;
  // With no history, open on the track the viewer chose in settings.
  let audio: "sub" | "dub" = hasDub ? preferred : "sub";

  if (p) {
    audio = hasDub ? p.audio : "sub";
    if (isFinished(p) && p.episode < lastEpisode) {
      episode = p.episode + 1;
      label = `Next up · Episode ${episode}`;
    } else {
      episode = p.episode;
      seek = Math.floor(p.time);
      label = seek > 30 ? `Continue · Episode ${episode}` : `Watch · Episode ${episode}`;
    }
  }

  const href =
    `/watch/${encodeURIComponent(slug)}/${episode}?audio=${audio}` + (seek > 30 ? `&t=${seek}` : "");
  const coverStyle = {
    "--cover-accent": palette.accent,
    "--cover-hover": palette.hover,
  } as CSSProperties;

  return (
    <div className="cta" style={coverStyle}>
      <Link className="btn btn--cover btn--lg" href={href}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" />
        </svg>
        {label}
      </Link>
      {p && !isFinished(p) && p.duration > 0 ? (
        <span className="cta__bar" aria-hidden>
          <span style={{ width: `${Math.min(100, (p.time / p.duration) * 100)}%` }} />
        </span>
      ) : null}
    </div>
  );
}
