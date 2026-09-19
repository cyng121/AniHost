"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BookOpen, Share2, Search, ArrowDownUp, Check, BookMarked } from "lucide-react";
import type { MangaChapter, MangaDetail } from "@/lib/manga";
import type { TitleLogo as TitleLogoType } from "@/lib/logo";
import { TitleLogo } from "@/components/TitleLogo";
import { SaveButton } from "@/components/SaveButton";

interface YouTubeMangaChannelViewProps {
  id: string;
  detail: MangaDetail;
  chapters: MangaChapter[];
  cover?: string;
  banner?: string;
  titleLogo?: TitleLogoType | null;
}

type MangaTab = "chapters" | "about";

const RANGE_SIZE = 30;

export function YouTubeMangaChannelView({
  id,
  detail,
  chapters,
  cover,
  banner,
  titleLogo,
}: YouTubeMangaChannelViewProps) {
  const [activeTab, setActiveTab] = useState<MangaTab>("chapters");
  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chapter filtering & sorting state
  const [chapterSearch, setChapterSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc"); // default newest first like YouTube videos
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);

  const displayBanner = banner || cover || "/fallback-backdrop.jpg";
  const displayCover = cover || "/fallback-backdrop.jpg";

  const authors = (detail.authors ?? [])
    .map((a) => a.author ?? a.name)
    .filter(Boolean)
    .join(", ");

  const formattedRating =
    detail.rating != null
      ? (() => {
          const num =
            typeof detail.rating === "number"
              ? detail.rating
              : parseFloat(String(detail.rating));
          return isNaN(num) ? String(detail.rating) : num.toFixed(1);
        })()
      : undefined;

  const firstChapter = chapters[0];
  const latestChapter = chapters[chapters.length - 1];

  function copyShareLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Filtered & sorted chapters
  const filteredChapters = useMemo(() => {
    let list = [...chapters];
    if (sortOrder === "desc") {
      list.reverse();
    }
    if (chapterSearch.trim()) {
      const q = chapterSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          String(c.number).includes(q) ||
          (c.title && c.title.toLowerCase().includes(q))
      );
    }
    return list;
  }, [chapters, sortOrder, chapterSearch]);

  // Range chunking
  const rangeChunks = useMemo(() => {
    if (filteredChapters.length <= RANGE_SIZE) return [];
    const chunks: Array<{ label: string; start: number; end: number }> = [];
    for (let i = 0; i < filteredChapters.length; i += RANGE_SIZE) {
      const end = Math.min(i + RANGE_SIZE, filteredChapters.length);
      chunks.push({
        label: `${i + 1} - ${end}`,
        start: i,
        end,
      });
    }
    return chunks;
  }, [filteredChapters]);

  const displayedChapters = useMemo(() => {
    if (!rangeChunks.length || chapterSearch.trim()) {
      return filteredChapters;
    }
    const currentChunk = rangeChunks[activeRangeIndex] || rangeChunks[0];
    return filteredChapters.slice(currentChunk.start, currentChunk.end);
  }, [filteredChapters, rangeChunks, activeRangeIndex, chapterSearch]);

  return (
    <div className="yt-channel-view yt-manga-channel">
      {/* ── Channel Banner ── */}
      <div className="yt-channel-banner">
        <div
          className="yt-channel-banner__img"
          style={{ backgroundImage: `url(${displayBanner})` }}
        />
        <div className="yt-channel-banner__overlay" />
      </div>

      <div className="yt-channel-container">
        {/* ── Channel Header Profile ── */}
        <div className="yt-channel-header">
          <div className="yt-channel-header__left">
            <div className="yt-channel-avatar-box">
              <img
                src={displayCover}
                alt={detail.title}
                className="yt-channel-avatar"
              />
            </div>

            <div className="yt-channel-info">
              {titleLogo ? (
                <div className="yt-channel-logo-wrap">
                  <TitleLogo logo={titleLogo} title={detail.title} cap={65} size={300} priority />
                </div>
              ) : (
                <h1 className="yt-channel-title">{detail.title}</h1>
              )}

              {detail.englishTitle && detail.englishTitle !== detail.title ? (
                <div className="yt-manga-jp-title">{detail.englishTitle}</div>
              ) : null}

              {/* YouTube metadata row */}
              <div className="yt-channel-meta">
                <span className="yt-channel-handle">
                  {detail.type || "Manga"}
                </span>
                <span className="yt-channel-dot">•</span>
                <span>{chapters.length} chapters</span>
                {formattedRating ? (
                  <>
                    <span className="yt-channel-dot">•</span>
                    <span className="yt-manga-score">★ {formattedRating}</span>
                  </>
                ) : null}
                {detail.status ? (
                  <>
                    <span className="yt-channel-dot">•</span>
                    <span className="yt-manga-status-tag">{detail.status}</span>
                  </>
                ) : null}
              </div>

              {/* Action buttons row */}
              <div className="yt-channel-actions" style={{ marginTop: 16 }}>
                {firstChapter ? (
                  <Link
                    href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(firstChapter.id)}`}
                    className="yt-btn yt-btn--primary"
                  >
                    <BookOpen size={18} />
                    <span>Start Reading · Ch. {firstChapter.number}</span>
                  </Link>
                ) : null}

                {latestChapter && latestChapter.id !== firstChapter?.id ? (
                  <Link
                    href={`/manga/${encodeURIComponent(id)}/${encodeURIComponent(latestChapter.id)}`}
                    className="yt-btn yt-btn--secondary"
                  >
                    <span>Latest · Ch. {latestChapter.number}</span>
                  </Link>
                ) : null}

                <SaveButton
                  variant="button"
                  slug={id}
                  title={detail.title}
                  image={displayCover}
                  type="manga"
                  className="yt-subscribe-btn"
                />

                <button
                  type="button"
                  className="yt-action-icon-btn"
                  onClick={copyShareLink}
                  title="Share manga"
                  aria-label="Share manga"
                >
                  {copied ? <Check size={18} /> : <Share2 size={18} />}
                </button>
              </div>

              {/* Synopsis snippet */}
              {detail.synopsis ? (
                <div className="yt-channel-desc-box" style={{ marginTop: 16 }}>
                  <p className={`yt-channel-desc ${descExpanded ? "is-expanded" : ""}`}>
                    {detail.synopsis}
                  </p>
                  <button
                    type="button"
                    className="yt-desc-toggle"
                    onClick={() => setDescExpanded((prev) => !prev)}
                  >
                    {descExpanded ? "Show less" : "...more"}
                  </button>
                </div>
              ) : null}

              {/* Genre Chips */}
              {detail.genres && detail.genres.length > 0 ? (
                <div className="yt-manga-genres">
                  {detail.genres.map((g) => {
                    const gName = typeof g === "string" ? g : (g as any)?.genre || String(g);
                    const gKey = typeof g === "string" ? g : (g as any)?.slug || (g as any)?.genre || String(g);
                    return (
                      <Link
                        key={gKey}
                        href={`/manga?genre=${encodeURIComponent(gName)}`}
                        className="yt-pill"
                      >
                        {gName}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── YouTube Channel Navigation Tabs ── */}
        <div className="yt-channel-tabs" role="tablist">
          <button
            type="button"
            className={`yt-channel-tab ${activeTab === "chapters" ? "is-active" : ""}`}
            onClick={() => setActiveTab("chapters")}
            role="tab"
            aria-selected={activeTab === "chapters"}
          >
            Chapters ({chapters.length})
          </button>
          <button
            type="button"
            className={`yt-channel-tab ${activeTab === "about" ? "is-active" : ""}`}
            onClick={() => setActiveTab("about")}
            role="tab"
            aria-selected={activeTab === "about"}
          >
            About
          </button>
        </div>

        {/* ── Tab Content ── */}
        <div className="yt-channel-content">
          {activeTab === "chapters" ? (
            <div className="yt-manga-chapters-section">
              {/* Controls bar: Search & Sort */}
              <div className="yt-manga-controls">
                <div className="yt-manga-search-wrap">
                  <Search size={16} className="yt-search-icon" />
                  <input
                    type="text"
                    placeholder="Search chapter title or number..."
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    className="yt-manga-search-input"
                  />
                  {chapterSearch ? (
                    <button
                      type="button"
                      onClick={() => setChapterSearch("")}
                      className="yt-manga-clear-btn"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                <div className="yt-manga-controls-right">
                  <button
                    type="button"
                    className="yt-sort-btn"
                    onClick={() =>
                      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
                    }
                    title={sortOrder === "desc" ? "Sort: Newest First" : "Sort: Oldest First"}
                  >
                    <ArrowDownUp size={16} />
                    <span>{sortOrder === "desc" ? "Newest" : "Oldest"}</span>
                  </button>
                </div>
              </div>

              {/* Range Selector Bar */}
              {rangeChunks.length > 1 && !chapterSearch.trim() ? (
                <div className="yt-range-bar" role="tablist">
                  {rangeChunks.map((chunk, idx) => (
                    <button
                      key={chunk.label}
                      type="button"
                      className={`yt-pill ${activeRangeIndex === idx ? "is-active" : ""}`}
                      onClick={() => setActiveRangeIndex(idx)}
                      role="tab"
                      aria-selected={activeRangeIndex === idx}
                    >
                      Chapters {chunk.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* YouTube Video-Style Chapter Grid */}
              <div className="yt-grid yt-manga-chapter-grid">
                {displayedChapters.map((chapter) => {
                  const chHref = `/manga/${encodeURIComponent(id)}/${encodeURIComponent(chapter.id)}`;
                  const chTitle = chapter.title
                    ? chapter.title.startsWith("Chapter")
                      ? chapter.title
                      : `Chapter ${chapter.number}: ${chapter.title}`
                    : `Chapter ${chapter.number}`;

                  return (
                    <div key={chapter.id} className="yt-card yt-card--episode yt-card--manga-ch">
                      <Link href={chHref} className="yt-card__thumb-box">
                        <div
                          className="yt-card__thumb yt-card__thumb--chapter-bg"
                          style={{ backgroundImage: `url(${displayBanner})` }}
                        />
                        <div className="yt-chapter-thumb-overlay">
                          <span className="yt-chapter-num-badge">Ch. {chapter.number}</span>
                        </div>
                        {chapter.pages ? (
                          <span className="yt-card__badge">{chapter.pages}p</span>
                        ) : (
                          <span className="yt-card__badge">READ</span>
                        )}
                      </Link>

                      <div className="yt-card__meta-row">
                        <div className="yt-card__info">
                          <Link href={chHref} style={{ textDecoration: "none" }}>
                            <h3 className="yt-card__title" title={chTitle}>
                              {chTitle}
                            </h3>
                          </Link>

                          <div className="yt-card__stats">
                            <span>Chapter {chapter.number}</span>
                            {chapter.pages ? (
                              <>
                                <span>•</span>
                                <span>{chapter.pages} pages</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {displayedChapters.length === 0 ? (
                <div className="yt-empty-state">
                  <p>No chapters match your search.</p>
                </div>
              ) : null}
            </div>
          ) : (
            /* ── About Tab ── */
            <div className="yt-channel-about">
              <div className="yt-about-grid">
                <div className="yt-about-main">
                  <h3 className="yt-about-heading">Description</h3>
                  <p className="yt-about-text">
                    {detail.synopsis || "No description provided for this title."}
                  </p>

                  {detail.genres && detail.genres.length > 0 ? (
                    <div style={{ marginTop: 24 }}>
                      <h4 className="yt-about-subheading">Genres</h4>
                      <div className="yt-manga-genres" style={{ marginTop: 8 }}>
                        {detail.genres.map((g) => {
                          const gName = typeof g === "string" ? g : (g as any)?.genre || String(g);
                          const gKey = typeof g === "string" ? g : (g as any)?.slug || (g as any)?.genre || String(g);
                          return (
                            <Link
                              key={gKey}
                              href={`/manga?genre=${encodeURIComponent(gName)}`}
                              className="yt-pill"
                            >
                              {gName}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="yt-about-sidebar">
                  <h3 className="yt-about-heading">Details</h3>
                  <div className="yt-about-stats">
                    {detail.status ? (
                      <div className="yt-stat-item">
                        <span className="yt-stat-label">Status</span>
                        <span className="yt-stat-val">{detail.status}</span>
                      </div>
                    ) : null}

                    {detail.type ? (
                      <div className="yt-stat-item">
                        <span className="yt-stat-label">Format</span>
                        <span className="yt-stat-val">{detail.type}</span>
                      </div>
                    ) : null}

                    <div className="yt-stat-item">
                      <span className="yt-stat-label">Total Chapters</span>
                      <span className="yt-stat-val">{chapters.length}</span>
                    </div>

                    {authors ? (
                      <div className="yt-stat-item">
                        <span className="yt-stat-label">Author</span>
                        <span className="yt-stat-val">{authors}</span>
                      </div>
                    ) : null}

                    {formattedRating ? (
                      <div className="yt-stat-item">
                        <span className="yt-stat-label">Score</span>
                        <span className="yt-stat-val">★ {formattedRating}</span>
                      </div>
                    ) : null}

                    {typeof detail.views === "number" ? (
                      <div className="yt-stat-item">
                        <span className="yt-stat-label">Total Views</span>
                        <span className="yt-stat-val">{detail.views.toLocaleString()}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
