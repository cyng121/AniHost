"use client";

import { useEffect, useState, type ReactNode } from "react";

export function WatchLayout({
  main,
  sidebar,
  episodeRail,
  totalEpisodes,
}: {
  main: ReactNode;
  sidebar: ReactNode;
  episodeRail?: ReactNode;
  totalEpisodes: number;
}) {
  const [hidden, setHidden] = useState(false);
  const [isTv, setIsTv] = useState(false);
  const [cinemaMode, setCinemaMode] = useState(false);

  useEffect(() => {
    try {
      // 1. Detect Smart TV browsers
      const ua = window.navigator.userAgent.toLowerCase();
      const isTvDetected =
        /smart-tv|smarttv|appletv|googletv|android.*tv|tizen|webos|hbbtv|roku|firetv|viera|bravia|netcast|crkey/i.test(
          ua,
        );

      if (isTvDetected) {
        setIsTv(true);
        setCinemaMode(true);
      } else {
        const savedCinema = window.localStorage.getItem("anighost-cinema-mode");
        if (savedCinema === "1") setCinemaMode(true);
      }

      const savedHide = window.localStorage.getItem("anighost-hide-episodes");
      if (savedHide === "1") setHidden(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = () => {
    setHidden((prev) => {
      const next = !prev;
      try {
        if (next) window.localStorage.setItem("anighost-hide-episodes", "1");
        else window.localStorage.removeItem("anighost-hide-episodes");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleCinemaMode = () => {
    setCinemaMode((prev) => {
      const next = !prev;
      try {
        if (next) window.localStorage.setItem("anighost-cinema-mode", "1");
        else window.localStorage.removeItem("anighost-cinema-mode");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isCinema = isTv || cinemaMode;

  return (
    <div
      className={`watch ${hidden ? "is-episodes-hidden" : ""} ${
        isCinema ? "watch--cinema watch--tv" : ""
      }`}
    >
      {/* Top Mode Bar */}
      <div className="watch__modeBar">
        <button
          type="button"
          className={`watch__modeBtn ${isCinema ? "is-active" : ""}`}
          onClick={toggleCinemaMode}
          title={isCinema ? "Switch to standard desktop layout" : "Switch to Apple TV / Netflix cinematic theater layout"}
          aria-label="Toggle TV Cinema Mode"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
            <polyline points="17 2 12 7 7 2" />
          </svg>
          <span>{isCinema ? "Cinema Mode (TV / Theater)" : "TV / Cinema Mode"}</span>
        </button>
      </div>

      <div className="watch__main">
        {main}
        {isCinema && episodeRail ? episodeRail : null}
      </div>

      {!isCinema ? (
        <div className="watch__side" aria-label="Episodes panel">
          {sidebar}
        </div>
      ) : null}

      {!isCinema && hidden ? (
        <button
          type="button"
          className="watch__expandEpisodesBtn"
          onClick={toggleSidebar}
          aria-label="Show episodes list"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span>Episodes ({totalEpisodes})</span>
        </button>
      ) : null}
    </div>
  );
}
