"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./WatchEpisodesSidebar.module.css";

export interface SidebarEpisodeItem {
  number: number;
  title: string;
  thumbnail?: string;
  sub?: boolean;
  dub?: boolean;
  duration?: string;
}

const BUCKET_SIZE = 100;

export function WatchEpisodesSidebar({
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
  const [search, setSearch] = useState("");
  const activeCardRef = useRef<HTMLAnchorElement | null>(null);

  // Divide into buckets of 100 (1-100, 101-200, 201-300...)
  const buckets = useMemo(() => {
    const list: SidebarEpisodeItem[][] = [];
    for (let i = 0; i < episodes.length; i += BUCKET_SIZE) {
      list.push(episodes.slice(i, i + BUCKET_SIZE));
    }
    return list;
  }, [episodes]);

  // Find initial bucket index based on the currently watched episode
  const initialBucket = useMemo(() => {
    const idx = buckets.findIndex((b) => b.some((e) => e.number === currentEpisode));
    return idx >= 0 ? idx : 0;
  }, [buckets, currentEpisode]);

  const [activeBucket, setActiveBucket] = useState(initialBucket);

  // Keep active bucket in sync if currentEpisode changes
  useEffect(() => {
    const idx = buckets.findIndex((b) => b.some((e) => e.number === currentEpisode));
    if (idx >= 0) setActiveBucket(idx);
  }, [buckets, currentEpisode]);

  // Smooth scroll active episode into view
  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [currentEpisode, activeBucket]);

  // Filter episodes
  const visibleEpisodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return buckets[activeBucket] ?? [];
    }
    return episodes.filter((ep) => {
      const matchNum = String(ep.number) === q || String(ep.number).padStart(2, "0") === q;
      const matchTitle = (ep.title ?? "").toLowerCase().includes(q);
      return matchNum || matchTitle;
    });
  }, [search, buckets, activeBucket, episodes]);

  return (
    <aside className={styles.sidebar} aria-label="Episodes">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Episodes</h2>
          <span className={styles.countBadge}>{episodes.length}</span>
        </div>

        <div className={styles.searchBox}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search episodes"
          />
          {search ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      {/* Multi-row wrapped range selector (1-100, 101-200...) */}
      {buckets.length > 1 && !search.trim() ? (
        <div className={styles.bucketBar} role="tablist" aria-label="Episode ranges">
          {buckets.map((bucket, idx) => {
            const start = bucket[0].number;
            const end = bucket[bucket.length - 1].number;
            const isSelected = idx === activeBucket;
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`${styles.bucketTab} ${isSelected ? styles.bucketTabActive : ""}`}
                onClick={() => setActiveBucket(idx)}
              >
                {start}–{end}
              </button>
            );
          })}
        </div>
      ) : null}

      <ol className={styles.list}>
        {visibleEpisodes.length ? (
          visibleEpisodes.map((ep) => {
            const isPlaying = ep.number === currentEpisode;
            const epNumPadded = ep.number < 10 ? `0${ep.number}` : String(ep.number);
            const tagLabel = ep.dub ? (ep.sub ? "SUB · DUB" : "DUB") : "SUB";
            const duration = ep.duration || "24:10";

            return (
              <li key={ep.number}>
                <Link
                  ref={isPlaying ? activeCardRef : undefined}
                  href={`/watch/${encodeURIComponent(slug)}/${ep.number}?audio=${audio}`}
                  className={`${styles.card} ${isPlaying ? styles.cardActive : ""}`}
                  aria-current={isPlaying ? "page" : undefined}
                >
                  <div className={styles.thumbWrap}>
                    {ep.thumbnail ? (
                      <img
                        src={ep.thumbnail}
                        alt=""
                        className={styles.thumbImg}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className={styles.thumbPlaceholder}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
                      {isPlaying ? (
                        <span className={styles.playingLabel}>
                          ♪ Playing
                        </span>
                      ) : null}
                    </div>

                    <h3 className={styles.epTitle}>{ep.title || `Episode ${ep.number}`}</h3>

                    <div className={styles.tagGroup}>
                      <span className={styles.tag}>{tagLabel}</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })
        ) : (
          <li className={styles.emptyState}>
            No episodes found matching &quot;{search}&quot;
          </li>
        )}
      </ol>
    </aside>
  );
}
