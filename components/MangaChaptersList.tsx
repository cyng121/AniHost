"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { MangaChapter } from "@/lib/manga";

interface MangaChaptersListProps {
  mangaId: string;
  chapters: MangaChapter[];
}

export function MangaChaptersList({ mangaId, chapters }: MangaChaptersListProps) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);

  // Normalize chapters sorted ascending by chapter number
  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => a.number - b.number);
  }, [chapters]);

  // Determine range chunk size based on chapter volume
  // Small (<50): 10 chapters per chunk (e.g. 1-10, 11-20)
  // Medium/Large (>=50): 20 chapters per chunk (e.g. 1-20, 21-40, 41-60)
  const rangeSize = useMemo(() => {
    if (sortedChapters.length <= 50) return 10;
    return 20;
  }, [sortedChapters.length]);

  // Build range chunks
  const rangeChunks = useMemo(() => {
    if (sortedChapters.length <= 15) return [];

    const chunks: Array<{
      label: string;
      startNum: number;
      endNum: number;
      chapters: MangaChapter[];
    }> = [];

    for (let i = 0; i < sortedChapters.length; i += rangeSize) {
      const slice = sortedChapters.slice(i, i + rangeSize);
      if (!slice.length) continue;
      const startNum = slice[0].number;
      const endNum = slice[slice.length - 1].number;
      chunks.push({
        label: `${startNum}–${endNum}`,
        startNum,
        endNum,
        chapters: slice,
      });
    }

    return chunks;
  }, [sortedChapters, rangeSize]);

  // Order of range chunks based on sortOrder
  const orderedChunks = useMemo(() => {
    if (sortOrder === "desc") {
      return [...rangeChunks].reverse();
    }
    return rangeChunks;
  }, [rangeChunks, sortOrder]);

  // Displayed chapters
  const displayedChapters = useMemo(() => {
    // 1. If user typed a search query, filter across all chapters
    const q = search.trim().toLowerCase();
    if (q) {
      const matched = sortedChapters.filter((c) => {
        const numStr = String(c.number);
        const titleStr = (c.title || "").toLowerCase();
        return numStr.includes(q) || titleStr.includes(q);
      });
      return sortOrder === "desc" ? [...matched].reverse() : matched;
    }

    // 2. If range chunks exist, display the active chunk
    if (orderedChunks.length > 0) {
      const chunk = orderedChunks[activeRangeIndex] || orderedChunks[0];
      const list = chunk ? chunk.chapters : sortedChapters;
      return sortOrder === "desc" ? [...list].reverse() : list;
    }

    // 3. Fallback: all chapters
    return sortOrder === "desc" ? [...sortedChapters].reverse() : sortedChapters;
  }, [search, sortedChapters, orderedChunks, activeRangeIndex, sortOrder]);

  return (
    <section className="section manga-chapters-section" id="chapters" style={{ marginTop: 36 }}>
      {/* Header with Title, Count, Search & Sort */}
      <div className="section__head manga-chapters__head">
        <div>
          <span className="cap">{chapters.length} available</span>
          <h2>Chapters</h2>
        </div>

        <div className="manga-chapters__tools">
          {/* Quick Search */}
          <div className="manga-chapters__search-box">
            <svg
              className="manga-chapters__search-icon"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="manga-chapters__search-input"
              placeholder="Filter ch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter chapters"
            />
            {search ? (
              <button
                type="button"
                className="manga-chapters__search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear filter"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Sort Toggle Button */}
          <button
            type="button"
            className="manga-chapters__sort-btn"
            onClick={() => {
              setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
              setActiveRangeIndex(0);
            }}
            title={`Currently sorted ${sortOrder === "asc" ? "Oldest to Newest" : "Newest to Oldest"}. Click to toggle.`}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            >
              {sortOrder === "asc" ? (
                <>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </>
              ) : (
                <>
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </>
              )}
            </svg>
            <span>{sortOrder === "asc" ? "1 → Latest" : "Latest → 1"}</span>
          </button>
        </div>
      </div>

      {/* Range Chunking Bar (e.g. 1–10, 11–20 or 1–20, 21–40) */}
      {orderedChunks.length > 1 && !search.trim() ? (
        <div className="manga-chapters__ranges-wrap">
          <div className="yt-episode-ranges-row">
            <span className="manga-chapters__range-label">Range:</span>
            {orderedChunks.map((chunk, idx) => {
              const isSelected = idx === activeRangeIndex;
              return (
                <button
                  key={chunk.label}
                  type="button"
                  className={`yt-episode-range-chip ${isSelected ? "is-active" : ""}`}
                  onClick={() => setActiveRangeIndex(idx)}
                  aria-selected={isSelected}
                  role="tab"
                >
                  {chunk.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Search result indicator */}
      {search.trim() ? (
        <div className="manga-chapters__search-count">
          Showing {displayedChapters.length} {displayedChapters.length === 1 ? "chapter" : "chapters"} matching &ldquo;{search}&rdquo;
        </div>
      ) : null}

      {/* Chapters Grid */}
      {displayedChapters.length > 0 ? (
        <div className="eps eps--manga">
          {displayedChapters.map((c) => (
            <Link
              key={c.id}
              className="ep ep--manga"
              href={`/manga/${encodeURIComponent(mangaId)}/${encodeURIComponent(c.id)}`}
            >
              <span className="ep__n tnum">{c.number}</span>
              <span className="ep__t">{c.title || `Chapter ${c.number}`}</span>
              {c.pages ? <span className="ep__tag tnum">{c.pages}p</span> : null}
            </Link>
          ))}
        </div>
      ) : (
        <div className="manga-chapters__empty">
          No chapters found matching &ldquo;{search}&rdquo;.
        </div>
      )}
    </section>
  );
}
