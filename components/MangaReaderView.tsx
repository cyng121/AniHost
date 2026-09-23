"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MangaChapter, MangaDetail, MangaPage } from "@/lib/manga";

export function MangaReaderView({
  id,
  detail,
  current,
  prev,
  next,
  pages,
}: {
  id: string;
  detail: MangaDetail;
  current: MangaChapter;
  prev?: MangaChapter;
  next?: MangaChapter;
  pages: MangaPage[];
}) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const hideTimer = useRef<number | null>(null);
  const isInteracting = useRef(false);

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!isInteracting.current) {
        setControlsVisible(false);
      }
    }, 3500);
  }, []);

  const toggleControls = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // If clicking a link or button, don't toggle
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input")) return;

    setControlsVisible((prev) => {
      const nextState = !prev;
      if (nextState) resetHideTimer();
      return nextState;
    });
  }, [resetHideTimer]);

  useEffect(() => {
    resetHideTimer();

    const handleScroll = () => {
      // Find current page in viewport
      const images = document.querySelectorAll(".reader__page");
      const scrollY = window.scrollY + window.innerHeight / 2;
      for (let i = 0; i < images.length; i++) {
        const img = images[i] as HTMLElement;
        if (img.offsetTop <= scrollY && img.offsetTop + img.offsetHeight > scrollY) {
          setCurrentPage(i + 1);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [resetHideTimer]);

  const label = current.title || `Chapter ${current.number}`;

  return (
    <main className="reader" onClick={toggleControls}>
      {/* ── Top Bar (Slides in/out) ── */}
      <header className={`reader__bar ${controlsVisible ? "is-visible" : "is-hidden"}`}>
        <div className="reader__lead">
          <Link className="reader__back" href={`/manga/${encodeURIComponent(id)}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>{detail.title}</span>
          </Link>
          <h1 className="reader__h">{label}</h1>
        </div>

        <nav className="reader__jump" aria-label="Chapters">
          {prev ? (
            <Link className="btn btn--ghost btn--sm" href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(prev.id)}`}>
              ← Ch. {prev.number}
            </Link>
          ) : null}
          {next ? (
            <Link className="btn btn--accent btn--sm" href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(next.id)}`}>
              Ch. {next.number} →
            </Link>
          ) : null}
        </nav>
      </header>

      {/* ── Manga Pages Stream ── */}
      <div className="reader__pages">
        {pages.map((p, n) => {
          const proxiedUrl = p.img?.startsWith("http")
            ? `/api/manga/image?url=${encodeURIComponent(p.img)}`
            : p.img;
          return (
            <img
              key={`${p.page}-${n}`}
              className="reader__page"
              src={proxiedUrl}
              alt={`Page ${p.page + 1}`}
              loading={n < 2 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={n === 0 ? "high" : "auto"}
              onError={(e) => {
                // If proxy fails, try loading directly from source
                const target = e.currentTarget;
                if (target.src !== p.img) {
                  target.src = p.img;
                }
              }}
            />
          );
        })}
      </div>

      {/* ── End of Chapter Card ── */}
      <footer className="reader__end">
        <p className="tnum">
          {label} &middot; {pages.length} pages
        </p>
        <div className="reader__jump">
          {prev ? (
            <Link className="btn btn--ghost" href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(prev.id)}`}>
              ← Ch. {prev.number}
            </Link>
          ) : null}
          {next ? (
            <Link className="btn btn--accent" href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(next.id)}`}>
              Next · Ch. {next.number}
            </Link>
          ) : (
            <Link className="btn btn--ghost" href={`/manga/${encodeURIComponent(id)}`}>
              Back to chapters
            </Link>
          )}
        </div>
      </footer>

      {/* ── Mobile Floating Island (Toggles on Tap, Hides when Inactive) ── */}
      <div
        className={`reader__island ${controlsVisible ? "is-visible" : "is-hidden"}`}
        onMouseEnter={() => { isInteracting.current = true; }}
        onMouseLeave={() => { isInteracting.current = false; resetHideTimer(); }}
      >
        <div className="reader__islandContent">
          {prev ? (
            <Link
              className="reader__islandBtn"
              href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(prev.id)}`}
              title="Previous chapter"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
          ) : (
            <span className="reader__islandBtn is-disabled" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </span>
          )}

          <div className="reader__islandMeta">
            <span className="reader__islandCh">Ch. {current.number}</span>
            <span className="reader__islandPg tnum">
              {currentPage} / {pages.length}
            </span>
          </div>

          {next ? (
            <Link
              className="reader__islandBtn reader__islandBtn--accent"
              href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(next.id)}`}
              title="Next chapter"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ) : (
            <Link
              className="reader__islandBtn"
              href={`/manga/${encodeURIComponent(id)}`}
              title="All chapters"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
