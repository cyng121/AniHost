"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { ZoroCard } from "@/lib/types";

interface YouTubeSearchResultsProps {
  query: string;
  items: ZoroCard[];
  total: number;
  pageNo: number;
  totalPages: number;
  type?: "anime" | "manga";
}

const ANIME_FILTER_CHIPS = [
  "All",
  "TV",
  "Movie",
  "Top Rated",
  "Action",
  "Adventure",
  "Fantasy",
  "Comedy",
  "Supernatural",
  "Shounen",
];

const MANGA_FILTER_CHIPS = [
  "All",
  "Manga",
  "Manwha",
  "Manhua",
  "Top Rated",
  "Action",
  "Fantasy",
  "Romance",
  "Comedy",
  "Drama",
];

export function YouTubeSearchResults({
  query,
  items,
  total,
  pageNo,
  totalPages,
  type = "anime",
}: YouTubeSearchResultsProps) {
  const [activeFilter, setActiveFilter] = useState("All");
  const isManga = type === "manga";
  const chips = isManga ? MANGA_FILTER_CHIPS : ANIME_FILTER_CHIPS;

  const filteredItems = useMemo(() => {
    if (activeFilter === "All") return items;
    if (activeFilter === "TV") return items.filter((i) => (i.type || "").toUpperCase() === "TV");
    if (activeFilter === "Movie") return items.filter((i) => (i.type || "").toUpperCase().includes("MOVIE"));
    if (activeFilter === "Top Rated") return [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    // Genre filter
    return items.filter((i) =>
      (i.genres || []).some((g) => g.toLowerCase() === activeFilter.toLowerCase())
    );
  }, [items, activeFilter]);

  function makePageHref(p: number) {
    const typeParam = isManga ? "&type=manga" : "";
    return `/search?q=${encodeURIComponent(query)}${typeParam}&page=${p}`;
  }

  return (
    <div className="yt-search-container">
      {/* ── YouTube-style Filter Chips ── */}
      <div className="yt-search-filters">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`yt-search-chip ${activeFilter === chip ? "is-active" : ""}`}
            onClick={() => setActiveFilter(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* ── Results Count ── */}
      <div className="yt-search-header-meta">
        <span>About {total} {isManga ? "manga" : "anime"} result{total === 1 ? "" : "s"} for <strong>&ldquo;{query}&rdquo;</strong></span>
      </div>

      {/* ── Search Results List (YouTube horizontal style) ── */}
      {filteredItems.length > 0 ? (
        <div className="yt-search-list">
          {filteredItems.map((item) => {
            const thumbSrc = item.bannerImage || item.image || "/fallback-banner.jpg";
            const avatarSrc = item.image || "/avatar-fallback.jpg";
            const episodesBadge = item.totalEpisodes
              ? `${item.totalEpisodes} ${isManga ? "chs" : "eps"}`
              : item.episodeNumber
                ? `${item.episodeNumber} ${isManga ? "chs" : "eps"}`
                : item.type || (isManga ? "MANGA" : "HD");
            const scoreText = item.score
              ? typeof item.score === "number" && item.score > 10
                ? `${item.score}%`
                : `${item.score} ★`
              : null;
            const studioName = item.studio || (item.type ? `${item.type} Series` : isManga ? "Manga" : "Official Studio");
            const itemHref = isManga
              ? `/manga/${encodeURIComponent(item.slug)}`
              : `/anime/${encodeURIComponent(item.slug)}`;

            return (
              <Link
                key={item.slug}
                href={itemHref}
                className="yt-search-card"
              >
                {/* 16:9 Video Thumbnail */}
                <div className="yt-search-card__thumb-box">
                  <img
                    src={thumbSrc}
                    alt={item.title}
                    className="yt-search-card__thumb"
                    loading="lazy"
                    onError={(e) => {
                      if (item.image && (e.currentTarget as HTMLImageElement).src !== item.image) {
                        (e.currentTarget as HTMLImageElement).src = item.image;
                      }
                    }}
                  />
                  <span className="yt-search-card__badge">{episodesBadge}</span>
                </div>

                {/* Video Info Details */}
                <div className="yt-search-card__info">
                  <h2 className="yt-search-card__title" title={item.title}>
                    {item.title}
                  </h2>

                  {/* Channel / Studio Line */}
                  <div className="yt-search-card__channel-row">
                    <img
                      src={avatarSrc}
                      alt=""
                      className="yt-search-card__channel-avatar"
                      loading="lazy"
                    />
                    <span className="yt-search-card__channel-name">{studioName}</span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="yt-search-card__verified"
                      aria-label="Verified"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>

                  {/* Stats & Meta: Score, Format, Year, Status */}
                  <div className="yt-search-card__meta-line">
                    {scoreText ? (
                      <span className="yt-search-card__score">{scoreText}</span>
                    ) : null}
                    {item.type ? <span>{item.type}</span> : null}
                    {item.status ? (
                      <>
                        <span>•</span>
                        <span>{item.status}</span>
                      </>
                    ) : null}
                  </div>

                  {/* Synopsis snippet */}
                  {item.description ? (
                    <p className="yt-search-card__desc">{item.description}</p>
                  ) : null}

                  {/* Badges / Genres Chips */}
                  <div className="yt-search-card__tags">
                    <span className="yt-search-pill yt-search-pill--sub">SUB</span>
                    <span className="yt-search-pill yt-search-pill--dub">DUB</span>
                    {(item.genres || []).slice(0, 3).map((genre) => (
                      <span key={genre} className="yt-search-pill">
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="yt-search-empty">
          <div className="yt-search-empty__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3>No anime found for &ldquo;{query}&rdquo;</h3>
          <p>Try searching for a different title, spelling, or remove active filters.</p>
        </div>
      )}

      {/* ── YouTube-style Pagination ── */}
      {totalPages > 1 ? (
        <nav className="yt-search-pager" aria-label="Search pages">
          {pageNo > 1 ? (
            <Link className="yt-search-pager__btn" href={makePageHref(pageNo - 1)}>
              ← Previous
            </Link>
          ) : (
            <span className="yt-search-pager__btn is-disabled">← Previous</span>
          )}
          <span className="yt-search-pager__page">
            Page {pageNo} of {totalPages}
          </span>
          {pageNo < totalPages ? (
            <Link className="yt-search-pager__btn" href={makePageHref(pageNo + 1)}>
              Next →
            </Link>
          ) : (
            <span className="yt-search-pager__btn is-disabled">Next →</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
