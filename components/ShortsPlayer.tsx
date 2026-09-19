"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

export interface AnimeShortItem {
  id: string;
  slug: string;
  title: string;
  handle: string;
  avatar: string;
  trailerYoutubeId?: string;
  videoSrc?: string;
  poster: string;
  likes: string;
  dislikes?: string;
  comments: string;
  tags: string[];
  description: string;
}

interface ShortsPlayerProps {
  shorts: AnimeShortItem[];
}

export function ShortsPlayer({ shorts: initialShorts }: ShortsPlayerProps) {
  const [shortList, setShortList] = useState<AnimeShortItem[]>(initialShorts);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [disliked, setDisliked] = useState<Record<string, boolean>>({});
  const [subscribed, setSubscribed] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeIframeRef = useRef<HTMLIFrameElement>(null);

  // Sync if initialShorts changes
  useEffect(() => {
    if (initialShorts?.length > 0 && shortList.length === 0) {
      setShortList(initialShorts);
    }
  }, [initialShorts, shortList.length]);

  // Infinite Scroll: fetch more random trailers when within 4 items of the end
  useEffect(() => {
    if (activeIndex >= shortList.length - 4 && !loadingMore && shortList.length > 0) {
      setLoadingMore(true);
      fetch("/api/shorts")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data?.shorts) && data.shorts.length > 0) {
            setShortList((prev) => {
              const existingYtIds = new Set(prev.map((s) => s.trailerYoutubeId));
              const newTrailers = data.shorts.filter(
                (s: AnimeShortItem) => s.trailerYoutubeId && !existingYtIds.has(s.trailerYoutubeId)
              );
              return [...prev, ...newTrailers];
            });
          }
        })
        .catch((err) => console.warn("[shorts] error fetching more trailers:", err))
        .finally(() => setLoadingMore(false));
    }
  }, [activeIndex, shortList.length, loadingMore]);

  // Snap Scroll Tracker using IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll(".yt-short-item");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(idx)) {
              setActiveIndex(idx);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.55,
      }
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [shortList.length]);

  // Smooth scroll to a specific index
  const scrollToShort = useCallback(
    (targetIndex: number) => {
      if (!containerRef.current) return;
      const clamped = Math.max(0, Math.min(targetIndex, shortList.length - 1));
      const targetEl = containerRef.current.querySelector(
        `[data-index="${clamped}"]`
      ) as HTMLElement | null;

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [shortList.length]
  );

  const nextShort = useCallback(() => {
    scrollToShort(activeIndex + 1);
  }, [activeIndex, scrollToShort]);

  const prevShort = useCallback(() => {
    scrollToShort(activeIndex - 1);
  }, [activeIndex, scrollToShort]);

  // Toggle audio mute via postMessage without reloading iframe
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (activeIframeRef.current?.contentWindow) {
        activeIframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: nextMuted ? "mute" : "unMute",
            args: [],
          }),
          "*"
        );
      }
      return nextMuted;
    });
  }, []);

  // Keyboard navigation (ArrowDown / ArrowUp / J / K / M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault();
        nextShort();
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
        e.preventDefault();
        prevShort();
      } else if (e.key === "m") {
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextShort, prevShort, toggleMute]);

  function toggleLike(id: string) {
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
    if (disliked[id]) setDisliked((prev) => ({ ...prev, [id]: false }));
  }

  function toggleDislike(id: string) {
    setDisliked((prev) => ({ ...prev, [id]: !prev[id] }));
    if (liked[id]) setLiked((prev) => ({ ...prev, [id]: false }));
  }

  function toggleSubscribe(id: string) {
    setSubscribed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!shortList.length) {
    return (
      <div className="yt-shorts-container" style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa" }}>
        <p>Loading random anime trailers...</p>
      </div>
    );
  }

  return (
    <div className="yt-shorts-container" ref={containerRef}>
      {shortList.map((short, idx) => {
        const isActive = idx === activeIndex;
        const isNear = Math.abs(idx - activeIndex) <= 1;
        const isLiked = liked[short.id];
        const isDisliked = disliked[short.id];
        const isSubbed = subscribed[short.id];

        const originParam = typeof window !== "undefined" ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
        const iframeSrc = short.trailerYoutubeId
          ? `https://www.youtube-nocookie.com/embed/${short.trailerYoutubeId}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${short.trailerYoutubeId}&rel=0&playsinline=1&enablejsapi=1${originParam}`
          : "";

        return (
          <section
            key={short.id}
            data-index={idx}
            className={`yt-short-item ${isActive ? "is-active" : ""}`}
            aria-label={short.title}
          >
            <div className="yt-short-wrapper">
              {/* Vertical Video Card */}
              <div className="yt-short-card">
                {/* Mute/Unmute audio button */}
                <button
                  type="button"
                  className="yt-short-mute-btn"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute sound" : "Mute sound"}
                  title={isMuted ? "Click to unmute (or press M)" : "Mute (or press M)"}
                >
                  {isMuted ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  )}
                </button>

                {isActive && short.trailerYoutubeId ? (
                  <iframe
                    ref={activeIframeRef}
                    className="yt-short-video"
                    src={iframeSrc}
                    title={short.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  /* High performance poster when not currently active */
                  <div className="yt-short-poster-wrap">
                    <img
                      src={short.poster}
                      alt={short.title}
                      className="yt-short-poster"
                      loading={isNear ? "eager" : "lazy"}
                    />
                    <div className="yt-short-poster-play">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Bottom Info Overlay */}
                <div className="yt-short-overlay">
                  <div className="yt-short-channel">
                    <Link href={`/anime/${encodeURIComponent(short.slug)}`}>
                      <img src={short.avatar} alt="" className="yt-short-channel__avatar" />
                    </Link>
                    <span className="yt-short-channel__name">{short.handle}</span>
                    <button
                      type="button"
                      className="yt-short-sub-btn"
                      onClick={() => toggleSubscribe(short.id)}
                      style={{
                        backgroundColor: isSubbed ? "rgba(255,255,255,0.2)" : "#fff",
                        color: isSubbed ? "#fff" : "#000",
                      }}
                    >
                      {isSubbed ? "Subscribed" : "Subscribe"}
                    </button>
                  </div>
                  <p className="yt-short-title">{short.description || short.title}</p>
                  <div className="yt-short-tags">
                    {short.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Action Rail */}
              <div className="yt-short-actions">
                <div className="yt-short-action-item">
                  <button
                    type="button"
                    className="yt-short-action-btn"
                    onClick={() => toggleLike(short.id)}
                    aria-label="Like"
                    style={{ color: isLiked ? "#3ea6ff" : "#fff" }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                  </button>
                  <span className="yt-short-action-label">{isLiked ? "Liked" : short.likes}</span>
                </div>

                <div className="yt-short-action-item">
                  <button
                    type="button"
                    className="yt-short-action-btn"
                    onClick={() => toggleDislike(short.id)}
                    aria-label="Dislike"
                    style={{ color: isDisliked ? "#ff4444" : "#fff" }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={isDisliked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                    </svg>
                  </button>
                  <span className="yt-short-action-label">Dislike</span>
                </div>

                <div className="yt-short-action-item">
                  <button type="button" className="yt-short-action-btn" aria-label="Comments">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                  <span className="yt-short-action-label">{short.comments}</span>
                </div>

                <div className="yt-short-action-item">
                  <button
                    type="button"
                    className="yt-short-action-btn"
                    aria-label="Share"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: short.title, url: window.location.href });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Short link copied!");
                      }
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  </button>
                  <span className="yt-short-action-label">Share</span>
                </div>

                <div className="yt-short-action-item">
                  <button type="button" className="yt-short-action-btn" aria-label="More actions">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                </div>

                <div className="yt-short-sound-disc">
                  <img src={short.avatar} alt="Soundtrack" />
                </div>
              </div>

              {/* Dedicated Desktop Up/Down Navigation Buttons (Separated column, never overlaps!) */}
              <div className="yt-shorts-nav">
                <button
                  type="button"
                  onClick={prevShort}
                  className="yt-shorts-nav-btn"
                  disabled={idx === 0}
                  aria-label="Previous short"
                  title="Previous (↑ / k)"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={nextShort}
                  className="yt-shorts-nav-btn"
                  disabled={idx === shortList.length - 1}
                  aria-label="Next short"
                  title="Next (↓ / j)"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}


