"use client";

import Link from "next/link";
import styles from "./WatchControls.module.css";

export interface WatchControlsProps {
  slug: string;
  animeTitle: string;
  episodeNumber: number;
  episodeTitle: string;
  audio: "sub" | "dub";
  streamAudio?: string;
  currentServer?: string;
  availableSub: boolean;
  availableDub: boolean;
  servers: string[];
  prevHref?: string;
  prevNumber?: number;
  nextHref?: string;
  nextNumber?: number;
}

export function WatchControls({
  slug,
  animeTitle,
  episodeNumber,
  episodeTitle,
  audio,
  streamAudio,
  currentServer,
  availableSub,
  availableDub,
  servers,
  prevHref,
  prevNumber,
  nextHref,
  nextNumber,
}: WatchControlsProps) {
  const link = (ep: number, aud: "sub" | "dub", srv?: string) => {
    const q = new URLSearchParams({ audio: aud });
    if (srv) q.set("server", srv);
    return `/watch/${encodeURIComponent(slug)}/${ep}?${q.toString()}`;
  };

  const showAudioSelector = availableSub || availableDub;
  const showServerSelector = servers.length > 0;

  return (
    <div className={styles.wrapper}>
      <div className={styles.head}>
        <div className={styles.titleArea}>
          <Link className={styles.seriesLink} href={`/anime/${encodeURIComponent(slug)}`}>
            <span>{animeTitle}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
          <h1 className={styles.episodeTitle}>{episodeTitle}</h1>
        </div>

        <div className={styles.navGroup}>
          {prevHref && prevNumber !== undefined ? (
            <Link className={styles.navBtn} href={prevHref} aria-label={`Previous episode (${prevNumber})`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Ep {prevNumber}</span>
            </Link>
          ) : null}

          {nextHref && nextNumber !== undefined ? (
            <Link className={styles.navBtn} href={nextHref} aria-label={`Next episode (${nextNumber})`}>
              <span>Ep {nextNumber}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ) : null}
        </div>
      </div>

      {(showAudioSelector || showServerSelector) ? (
        <div className={styles.controlsCard}>
          {showAudioSelector ? (
            <div className={styles.row} role="group" aria-label="Audio track">
              <span className={styles.rowLabel}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                Audio
              </span>

              <div className={styles.btnGroup}>
                {availableSub ? (
                  <Link
                    className={`${styles.chip} ${audio === "sub" ? styles.chipActive : ""}`}
                    href={link(episodeNumber, "sub")}
                    aria-pressed={audio === "sub"}
                  >
                    {audio === "sub" ? <span className={styles.activeDot} /> : null}
                    SUB (Subtitled)
                  </Link>
                ) : null}

                {availableDub ? (
                  <Link
                    className={`${styles.chip} ${audio === "dub" ? styles.chipActive : ""}`}
                    href={link(episodeNumber, "dub")}
                    aria-pressed={audio === "dub"}
                  >
                    {audio === "dub" ? <span className={styles.activeDot} /> : null}
                    DUB (English Dub)
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {showServerSelector ? (
            <div className={styles.row} role="group" aria-label="Server selection">
              <span className={styles.rowLabel}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                  <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
                Server
              </span>

              <div className={styles.btnGroup}>
                {servers.map((serverName) => {
                  const isActive = currentServer === serverName;
                  return (
                    <Link
                      key={serverName}
                      className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                      href={link(episodeNumber, audio, serverName)}
                      aria-pressed={isActive}
                    >
                      {isActive ? <span className={styles.activeDot} /> : null}
                      {serverName}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {streamAudio && streamAudio !== audio ? (
            <p className={styles.swappedNotice}>
              No {audio} stream was available on this server, so playback switched to {streamAudio}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
