"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { SidebarEpisodeItem } from "./WatchEpisodesSidebar";
import styles from "./WatchEpisodeRail.module.css";

export function WatchEpisodeRail({
  slug,
  currentEpisode,
  audio,
  episodes,
}: {
  slug: string;
  currentEpisode: number;
  audio: "sub" | "dub";
  episodes: SidebarEpisodeItem[];
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activeCardRef = useRef<HTMLAnchorElement | null>(null);

  // Auto scroll the currently active episode into the center of the rail
  useEffect(() => {
    if (activeCardRef.current && trackRef.current) {
      const activeEl = activeCardRef.current;
      const track = trackRef.current;
      const targetScroll =
        activeEl.offsetLeft - track.clientWidth / 2 + activeEl.clientWidth / 2;
      track.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, [currentEpisode]);

  const scrollLeft = () => {
    if (trackRef.current) {
      trackRef.current.scrollBy({ left: -450, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (trackRef.current) {
      trackRef.current.scrollBy({ left: 450, behavior: "smooth" });
    }
  };

  return (
    <section className={styles.railSection} aria-label="Episodes Carousel">
      <div className={styles.railHeader}>
        <div className={styles.titleArea}>
          <h2 className={styles.railTitle}>Episodes</h2>
          <span className={styles.countBadge}>{episodes.length}</span>
        </div>

        <div className={styles.navArrows}>
          <button
            type="button"
            className={styles.arrowBtn}
            onClick={scrollLeft}
            aria-label="Scroll episodes left"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.arrowBtn}
            onClick={scrollRight}
            aria-label="Scroll episodes right"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div ref={trackRef} className={styles.railTrack}>
        {episodes.map((ep) => {
          const isPlaying = ep.number === currentEpisode;
          const epNumPadded = ep.number < 10 ? `0${ep.number}` : String(ep.number);
          const tagLabel = ep.dub ? (ep.sub ? "SUB · DUB" : "DUB") : "SUB";
          const duration = ep.duration || "24:10";

          return (
            <Link
              key={ep.number}
              ref={isPlaying ? activeCardRef : undefined}
              href={`/watch/${encodeURIComponent(slug)}/${ep.number}?audio=${audio}`}
              className={`${styles.card} ${isPlaying ? styles.cardActive : ""}`}
              aria-current={isPlaying ? "page" : undefined}
              tabIndex={0}
            >
              <div className={styles.thumbWrap}>
                {ep.thumbnail ? (
                  <img
                    src={ep.thumbnail}
                    alt=""
                    className={styles.thumbImg}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={styles.thumbPlaceholder}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" />
                    </svg>
                  </div>
                )}

                {isPlaying ? (
                  <div className={styles.playingOverlay} aria-hidden>
                    <div className={styles.playingBadge}>
                      <span className={styles.equalizerBar} />
                      <span className={styles.equalizerBar} />
                      <span className={styles.equalizerBar} />
                    </div>
                  </div>
                ) : null}

                <span className={styles.durationBadge}>{duration}</span>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.cardTopRow}>
                  <span className={`${styles.epNumber} ${isPlaying ? styles.epNumberActive : ""}`}>
                    EP {epNumPadded}
                  </span>
                  <span className={styles.tag}>{tagLabel}</span>
                </div>

                <h3 className={styles.epTitle}>{ep.title || `Episode ${ep.number}`}</h3>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
