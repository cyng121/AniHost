"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import type { ZoroEpisode, ZoroInfo } from "@/lib/types";
import type { AnimeSeason, AnimeCharacter, AnimeRecommendation } from "@/lib/relations";
import { SaveButton } from "./SaveButton";
import { useAnimeTVEpisodes } from "@/hooks/useAnimeTVEpisodes";

export interface YouTubeWatchViewProps {
  slug: string;
  info: ZoroInfo;
  episodeNumber: number;
  episodeTitle: string;
  audio: "sub" | "dub";
  availableSub: boolean;
  availableDub: boolean;
  servers?: string[];
  currentServer?: string;
  provider?: string;
  providers?: string[];
  episodes: ZoroEpisode[];
  seasons?: AnimeSeason[];
  characters?: AnimeCharacter[];
  recommendations?: AnimeRecommendation[];
  playerNode: React.ReactNode;
  prevHref?: string;
  nextHref?: string;
  prevNumber?: number;
  nextNumber?: number;
  baseInfoPath?: string;
  baseWatchPath?: string;
  extraOverviewNode?: React.ReactNode;
}

const RANGE_SIZE = 30;

type PrimaryWatchTab = "overview" | "seasons" | "characters" | "recommended";

export function YouTubeWatchView({
  slug: initialSlug,
  info: initialInfo,
  episodeNumber,
  episodeTitle,
  audio,
  availableSub,
  availableDub,
  servers = [],
  currentServer,
  provider = "zoro",
  providers = ["zoro", "aniwave", "anidao", "watchanimeworld"],
  episodes: initialEpisodes,
  seasons = [],
  characters = [],
  recommendations = [],
  playerNode,
  prevHref,
  nextHref,
  prevNumber,
  nextNumber,
  baseInfoPath = "/anime",
  baseWatchPath = "/watch",
  extraOverviewNode,
}: YouTubeWatchViewProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [primaryTab, setPrimaryTab] = useState<PrimaryWatchTab>("overview");
  const [showAllChars, setShowAllChars] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const visibleCharacters = useMemo(() => {
    return showAllChars ? characters : characters.slice(0, 12);
  }, [characters, showAllChars]);

  // Active Season state for "Up Next" sidebar
  const [sidebarSlug, setSidebarSlug] = useState(initialSlug);
  const [sidebarEpisodes, setSidebarEpisodes] = useState<ZoroEpisode[]>(initialEpisodes);
  const [loadingSeason, setLoadingSeason] = useState(false);

  // Client-side cache for fetched season episodes to make switching instant
  const seasonCacheRef = useRef<Map<string, ZoroEpisode[]>>(new Map());

  useEffect(() => {
    if (initialSlug && initialEpisodes.length > 0) {
      seasonCacheRef.current.set(initialSlug, initialEpisodes);
    }
  }, [initialSlug, initialEpisodes]);

  // Crunchyroll episode thumbnails directly from AniMeTVPlus API
  const { episodesMap: crEpMap } = useAnimeTVEpisodes(initialInfo.malId || initialInfo.anilistId);

  // Effective seasons computed from props, initialInfo.seasons, or current anime as Season 1
  const effectiveSeasons = useMemo<AnimeSeason[]>(() => {
    if (seasons && seasons.length > 0) {
      return seasons;
    }
    const infoSeasons = initialInfo.seasons;
    if (infoSeasons && infoSeasons.length > 0) {
      return infoSeasons.map((s, idx) => {
        const parsedNum = s.season ? parseInt(s.season.replace(/\D/g, ""), 10) : NaN;
        const seasonNumber = Number.isFinite(parsedNum) && parsedNum > 0 ? parsedNum : (s.data_number ?? idx) + 1;
        const sTitle = s.title || s.season || `Season ${seasonNumber}`;
        const seasonId = String(s.id ?? s.data_id ?? idx + 1);
        return {
          id: Number(seasonId),
          seasonNumber,
          title: sTitle,
          slug: seasonId,
          cover: s.season_poster ?? initialInfo.image ?? null,
          banner: s.season_poster ?? initialInfo.image ?? null,
          format: s.format,
          episodes: s.episodes,
          year: s.seasonYear,
          href: `/watch/${seasonId}/1`,
        };
      });
    }
    return [
      {
        id: 1,
        seasonNumber: 1,
        title: initialInfo.title || "Season 1",
        slug: initialSlug,
        cover: initialInfo.image ?? null,
        banner: initialInfo.image ?? null,
        format: initialInfo.type,
        episodes: sidebarEpisodes.length || initialInfo.totalEpisodes,
        year: null,
        href: `/watch/${encodeURIComponent(initialSlug)}/1`,
      },
    ];
  }, [seasons, initialInfo, initialSlug, sidebarEpisodes.length]);

  const currentSeasonIndex = useMemo(() => {
    if (!sidebarSlug || effectiveSeasons.length === 0) return 0;
    const targetSlug = decodeURIComponent(sidebarSlug).toLowerCase();

    // 1. Try exact match by ID, slug, or href
    const idx = effectiveSeasons.findIndex(
      (s) =>
        String(s.id) === sidebarSlug ||
        s.slug === sidebarSlug ||
        (s.slug && targetSlug.includes(s.slug.toLowerCase())) ||
        (s.href && (s.href === sidebarSlug || s.href.includes(sidebarSlug)))
    );
    if (idx >= 0) return idx;

    // 2. Fallback: match title only if exact slug match failed
    const fallbackIdx = effectiveSeasons.findIndex(
      (s) => s.title && initialInfo.title && s.title.toLowerCase() === initialInfo.title.toLowerCase()
    );
    return fallbackIdx >= 0 ? fallbackIdx : 0;
  }, [effectiveSeasons, sidebarSlug, initialInfo.title]);

  const currentSeason = effectiveSeasons[currentSeasonIndex] || effectiveSeasons[0];

  // Range chunking for episodes
  const rangeChunks = useMemo(() => {
    if (sidebarEpisodes.length <= RANGE_SIZE) return [];
    const chunks: Array<{ start: number; end: number; label: string }> = [];
    const total = sidebarEpisodes.length;
    for (let i = 0; i < total; i += RANGE_SIZE) {
      const start = i + 1;
      const end = Math.min(i + RANGE_SIZE, total);
      chunks.push({
        start,
        end,
        label: `${start}–${end}`,
      });
    }
    return chunks;
  }, [sidebarEpisodes.length]);

  // Find initial range containing the current episode
  const initialRangeIndex = useMemo(() => {
    if (rangeChunks.length === 0) return 0;
    const idx = rangeChunks.findIndex(
      (c) => episodeNumber >= c.start && episodeNumber <= c.end
    );
    return idx >= 0 ? idx : 0;
  }, [rangeChunks, episodeNumber]);

  const [activeRangeIndex, setActiveRangeIndex] = useState(initialRangeIndex);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const activeCardRef = useRef<HTMLAnchorElement | null>(null);

  // When episode changes, keep active range in sync
  useEffect(() => {
    if (rangeChunks.length > 0) {
      const idx = rangeChunks.findIndex(
        (c) => episodeNumber >= c.start && episodeNumber <= c.end
      );
      if (idx >= 0) setActiveRangeIndex(idx);
    }
  }, [episodeNumber, rangeChunks]);

  // Filter episodes based on search query or active range chunk
  const filteredEpisodes = useMemo(() => {
    const q = episodeSearch.trim().toLowerCase();
    if (!q) {
      if (rangeChunks.length === 0) return sidebarEpisodes;
      const chunk = rangeChunks[activeRangeIndex] || rangeChunks[0];
      const startIndex = chunk.start - 1;
      const endIndex = chunk.end;
      return sidebarEpisodes.slice(startIndex, endIndex);
    }
    return sidebarEpisodes.filter((ep) => {
      const epNumStr = String(ep.number);
      const epNumPadded = ep.number < 10 ? `0${ep.number}` : epNumStr;
      const epTitle = (ep.title ?? "").toLowerCase();
      return epNumStr === q || epNumPadded === q || epTitle.includes(q) || `episode ${epNumStr}`.includes(q);
    });
  }, [episodeSearch, sidebarEpisodes, rangeChunks, activeRangeIndex]);

  // Smooth scroll active episode card into view
  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [episodeNumber, sidebarSlug]);


  const avatarSrc = initialInfo.image || "/avatar-fallback.jpg";
  const studioName = Array.isArray(initialInfo.studios)
    ? initialInfo.studios.join(", ")
    : initialInfo.studios || "Animation Studio";
  const subscriberCount = `${((initialSlug.length * 9) % 80 + 3.2).toFixed(1)}K subscribers`;
  const views = `${((episodeNumber * 4.3 + 12.1) % 90 + 5.4).toFixed(1)}M views`;
  const releaseYear = initialInfo.premiered || initialInfo.year || "2024";
  const ratingScore = initialInfo.rating || initialInfo.malScore || "8.4";

  // Switch sidebar season when clicking a Season Box on the right
  async function handleSeasonBoxClick(season: AnimeSeason) {
    const targetSlug = season.slug || String(season.id);
    if (targetSlug === sidebarSlug && sidebarEpisodes.length > 0) return;

    setSidebarSlug(targetSlug);

    // Instant return if season episodes are already cached locally
    const cached = seasonCacheRef.current.get(targetSlug);
    if (cached && cached.length > 0) {
      setSidebarEpisodes(cached);
      setActiveRangeIndex(0);
      return;
    }

    setLoadingSeason(true);
    try {
      const apiUrl =
        baseWatchPath === "/cartoon/watch"
          ? `/api/cartoon/season?slug=${encodeURIComponent(initialSlug)}&season=${season.seasonNumber}`
          : `/api/season?slug=${encodeURIComponent(targetSlug || season.href.replace("/anime/", ""))}`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      if (data.ok) {
        setSidebarSlug(data.slug || targetSlug);
        const eps = data.episodes || [];
        setSidebarEpisodes(eps);
        if (eps.length > 0) {
          seasonCacheRef.current.set(targetSlug, eps);
          if (data.slug && data.slug !== targetSlug) {
            seasonCacheRef.current.set(data.slug, eps);
          }
        }
        setActiveRangeIndex(0);
      } else {
        // Fallback: full browser navigation if API couldn't resolve
        const fallbackHref =
          baseWatchPath === "/cartoon/watch"
            ? `${baseWatchPath}/${encodeURIComponent(targetSlug)}`
            : `/watch/${encodeURIComponent(targetSlug)}/1?audio=${audio}`;
        window.location.href = fallbackHref;
      }
    } catch {
      const fallbackHref =
        baseWatchPath === "/cartoon/watch"
          ? `${baseWatchPath}/${encodeURIComponent(targetSlug)}`
          : `/watch/${encodeURIComponent(targetSlug)}/1?audio=${audio}`;
      window.location.href = fallbackHref;
    } finally {
      setLoadingSeason(false);
    }
  }

  function toggleLike() {
    setLiked((prev) => !prev);
    if (disliked) setDisliked(false);
  }

  function toggleDislike() {
    setDisliked((prev) => !prev);
    if (liked) setLiked(false);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: `${initialInfo.title} - Episode ${episodeNumber}`, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2400);
    }
  }

  const link = (ep: number, aud: "sub" | "dub", srv?: string, prov?: string) => {
    const q = new URLSearchParams({ audio: aud });
    if (srv) q.set("server", srv);
    const activeProv = prov ?? provider;
    if (activeProv) q.set("provider", activeProv);
    return `/watch/${encodeURIComponent(initialSlug)}/${ep}?${q.toString()}`;
  };

  const primaryGenre = Array.isArray(initialInfo.genres) && initialInfo.genres[0] ? initialInfo.genres[0].replace(/\s+/g, "") : "Anime";
  const secondaryGenre = Array.isArray(initialInfo.genres) && initialInfo.genres[1] ? initialInfo.genres[1].replace(/\s+/g, "") : "Series";

  return (
    <div className="yt-watch-layout">
      {/* ── Main Column (Player, Title, Actions, Desc, Comments) ── */}
      <div className="yt-watch-primary">
        {/* Video Player Box */}
        <div className="yt-watch-player-box">
          {playerNode}
        </div>

        {/* Video Title */}
        <h1 className="yt-watch-title">
          {initialInfo.title} — Episode {episodeNumber}{episodeTitle && episodeTitle !== `Episode ${episodeNumber}` ? `: ${episodeTitle}` : ""}
        </h1>

        {/* Channel & Actions Row */}
        <div className="yt-watch-owner-row">
          {/* Channel Info */}
          <div className="yt-watch-owner">
            <Link href={`${baseInfoPath}/${encodeURIComponent(initialSlug)}`}>
              <img src={avatarSrc} alt={initialInfo.title} className="yt-watch-avatar" />
            </Link>
            <span className="yt-watch-channel-name">{initialInfo.title}</span>
          </div>

          {/* Action Buttons */}
          <div className="yt-watch-actions">
            {/* Segmented Like / Dislike */}
            <div className="yt-segmented-pill">
              <button
                type="button"
                className="yt-seg-btn"
                onClick={toggleLike}
                style={{ color: liked ? "#3ea6ff" : "inherit" }}
                title="I like this"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
                <span>{liked ? "36.8K" : "36.7K"}</span>
              </button>
              <span className="yt-seg-divider" />
              <button
                type="button"
                className="yt-seg-btn"
                onClick={toggleDislike}
                style={{ color: disliked ? "#ff4444" : "inherit" }}
                title="I dislike this"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={disliked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                </svg>
              </button>
            </div>

            {/* Share */}
            <button type="button" className="yt-pill-btn" onClick={handleShare} title="Share episode">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>{copyToast ? "Link Copied!" : "Share"}</span>
            </button>


            {/* Prev Episode Navigation */}
            {prevHref && prevNumber !== undefined ? (
              <Link href={prevHref} className="yt-pill-btn" title={`Previous Episode (${prevNumber})`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span>Ep {prevNumber}</span>
              </Link>
            ) : null}

            {/* Next Episode Navigation */}
            {nextHref && nextNumber !== undefined ? (
              <Link href={nextHref} className="yt-pill-btn" title={`Next Episode (${nextNumber})`}>
                <span>Ep {nextNumber}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ) : null}

            {/* Save */}
            <SaveButton
              slug={initialSlug}
              title={initialInfo.title}
              image={initialInfo.image}
              type="anime"
              quality={initialInfo.quality}
            />
          </div>
        </div>

        {/* Underline Channel-Themed Navigation Tabs below player */}
        <nav className="yt-channel-tabs yt-watch-channel-tabs" role="tablist">
          <button
            type="button"
            className={`yt-channel-tab ${primaryTab === "overview" ? "is-active" : ""}`}
            onClick={() => setPrimaryTab("overview")}
            role="tab"
            aria-selected={primaryTab === "overview"}
          >
            Overview
          </button>

          {effectiveSeasons.length > 1 ? (
            <button
              type="button"
              className={`yt-channel-tab ${primaryTab === "seasons" ? "is-active" : ""}`}
              onClick={() => setPrimaryTab("seasons")}
              role="tab"
              aria-selected={primaryTab === "seasons"}
            >
              Seasons ({effectiveSeasons.length})
            </button>
          ) : null}

          {characters.length > 0 ? (
            <button
              type="button"
              className={`yt-channel-tab ${primaryTab === "characters" ? "is-active" : ""}`}
              onClick={() => setPrimaryTab("characters")}
              role="tab"
              aria-selected={primaryTab === "characters"}
            >
              Characters ({characters.length})
            </button>
          ) : null}

          {recommendations.length > 0 || (initialInfo.recommended && initialInfo.recommended.length > 0) ? (
            <button
              type="button"
              className={`yt-channel-tab ${primaryTab === "recommended" ? "is-active" : ""}`}
              onClick={() => setPrimaryTab("recommended")}
              role="tab"
              aria-selected={primaryTab === "recommended"}
            >
              Recommended
            </button>
          ) : null}
        </nav>

        {/* Tab 1: OVERVIEW */}
        {primaryTab === "overview" ? (
          <div className="yt-about-container" style={{ maxWidth: "100%", gap: "16px" }}>
            {extraOverviewNode}

            {/* Description & Server Switcher Card */}
            <div className="yt-about-card">
              <h3 className="yt-characters-title" style={{ marginBottom: "12px", fontSize: "12px" }}>
                SYNOPSIS &amp; DESCRIPTION
              </h3>
              <p className="yt-about-desc">
                {descExpanded
                  ? initialInfo.description || initialInfo.synopsis || "No description available."
                  : (initialInfo.description || initialInfo.synopsis || "").slice(0, 340) + ((initialInfo.description || initialInfo.synopsis || "").length > 340 ? "..." : "")}
              </p>
              {(initialInfo.description || initialInfo.synopsis || "").length > 340 ? (
                <button
                  type="button"
                  onClick={() => setDescExpanded((prev) => !prev)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--yt-text-primary)",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "12px",
                    fontWeight: 700,
                    marginTop: "8px",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {descExpanded ? "Show less" : "...more"}
                </button>
              ) : null}

            </div>

            {/* Anime Details Grid Card */}
            <div className="yt-about-card">
              <h3 className="yt-characters-title" style={{ marginBottom: "14px", fontSize: "12px" }}>
                DETAILS
              </h3>
              <div className="yt-about-details" style={{ gridTemplateColumns: "140px 1fr", gap: "12px 20px" }}>
                <div className="yt-about-label">Studios</div>
                <div className="yt-about-value">{studioName || "Unknown"}</div>
                <div className="yt-about-label">Status</div>
                <div className="yt-about-value">{initialInfo.status || "Finished Airing"}</div>
                <div className="yt-about-label">Type</div>
                <div className="yt-about-value">{initialInfo.type || "TV Series"}</div>
                <div className="yt-about-label">Rating</div>
                <div className="yt-about-value">{initialInfo.rating || initialInfo.malScore || "N/A"}</div>
                <div className="yt-about-label">Release</div>
                <div className="yt-about-value">{releaseYear}</div>
                <div className="yt-about-label">Genres</div>
                <div className="yt-about-value">{initialInfo.genres?.join(", ") || "Action, Adventure"}</div>
                {initialInfo.synonyms && initialInfo.synonyms.length > 0 ? (
                  <>
                    <div className="yt-about-label">Synonyms</div>
                    <div className="yt-about-value">{initialInfo.synonyms.join(" • ")}</div>
                  </>
                ) : null}
                {effectiveSeasons.length > 1 ? (
                  <>
                    <div className="yt-about-label">Seasons</div>
                    <div className="yt-about-value" style={{ color: "#fff" }}>
                      {effectiveSeasons.length} Seasons in Franchise
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Tab 2: SEASONS */}
        {primaryTab === "seasons" ? (
          <div className="yt-seasons-section">
            <h2 className="yt-seasons-header-title">S E A S O N S</h2>
            <div className="yt-seasons-row yt-seasons-row--wrap" style={{ gap: "14px" }}>
              {effectiveSeasons.map((s, idx) => {
                const isSelected = idx === currentSeasonIndex;
                const label = `Season ${s.seasonNumber}`;
                const bg = s.banner || s.cover || initialInfo.image;

                return (
                  <button
                    key={`tab-season-${s.id}`}
                    type="button"
                    className={`yt-season-pill ${isSelected ? "is-selected" : ""}`}
                    onClick={() => handleSeasonBoxClick(s)}
                    title={s.title}
                    style={{ width: "220px", height: "64px", justifyContent: "flex-start", padding: "0 18px" }}
                  >
                    <div
                      className="yt-season-pill__bg"
                      style={{ backgroundImage: `url(${bg})` }}
                    />
                    <div className="yt-season-pill__overlay" />
                    <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span className="yt-season-pill__label">{label}</span>
                      <span style={{ fontSize: "11px", color: "#ccc", marginTop: "2px", fontFamily: "ui-monospace, monospace" }}>
                        {s.episodes ? `${s.episodes} episodes` : s.title}
                      </span>
                    </div>
                    {isSelected ? <span className="yt-season-pill__dot" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Tab 3: CHARACTERS */}
        {primaryTab === "characters" ? (
          <div>
            <div className="yt-characters-header">
              <h2 className="yt-characters-title">CHARACTERS &amp; VOICE ACTORS</h2>
              {characters.length > 12 ? (
                <button
                  type="button"
                  className="yt-characters-viewall-btn"
                  onClick={() => setShowAllChars((prev) => !prev)}
                >
                  {showAllChars ? "Show less" : "View all >"}
                </button>
              ) : null}
            </div>

            <div className="yt-characters-grid">
              {visibleCharacters.map((char) => (
                <div key={char.id} className="yt-char-card">
                  {/* Left: Character */}
                  <div className="yt-char-side">
                    <img
                      src={char.image || avatarSrc}
                      alt={char.name}
                      className="yt-char-avatar"
                      loading="lazy"
                    />
                    <div className="yt-char-info">
                      <div className="yt-char-name" title={char.name}>
                        {char.name}
                      </div>
                      <div className="yt-char-role">
                        {char.role || "Supporting"}
                      </div>
                    </div>
                  </div>

                  {/* Vertical Divider */}
                  <div className="yt-char-divider" />

                  {/* Right: Voice Actor */}
                  <div className="yt-va-side">
                    {char.voiceActor?.name ? (
                      <>
                        <div className="yt-va-info">
                          <div className="yt-va-name" title={char.voiceActor.name}>
                            {char.voiceActor.name}
                          </div>
                          <div className="yt-va-lang">
                            {char.voiceActor.language || "Japanese"}
                          </div>
                        </div>
                        {char.voiceActor.image ? (
                          <img
                            src={char.voiceActor.image}
                            alt={char.voiceActor.name}
                            className="yt-va-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <div className="yt-va-avatar yt-va-avatar--placeholder">
                            {char.voiceActor.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="yt-va-empty" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Tab 4: RECOMMENDED */}
        {primaryTab === "recommended" ? (
          <div>
            <div style={{ marginBottom: "16px" }}>
              <h2 className="yt-characters-title">RECOMMENDED ANIME</h2>
            </div>
            <div className="yt-grid yt-grid--rec">
              {(recommendations.length > 0 ? recommendations : (initialInfo.recommended ?? [])).map((rec: any) => {
                const id = rec.id || rec.slug;
                const title = rec.title;
                const cover = rec.cover || rec.image || avatarSrc;
                const href = rec.href || `/anime/${encodeURIComponent(rec.slug || id)}`;
                const badge = rec.format || rec.quality || rec.type || "Anime";
                const subText = rec.episodes
                  ? `${rec.episodes} eps`
                  : rec.genres && rec.genres.length > 0
                    ? rec.genres.slice(0, 2).join(", ")
                    : rec.type || "Recommended";

                return (
                  <Link
                    key={`rec-${id}`}
                    href={href}
                    className="yt-rec-card"
                    title={title}
                  >
                    <div className="yt-rec-card__thumb-box">
                      <img
                        src={cover}
                        alt={title}
                        className="yt-rec-card__thumb"
                        loading="lazy"
                      />
                      <span className="yt-rec-card__badge">
                        {badge}
                      </span>
                    </div>
                    <div className="yt-rec-card__meta">
                      <h3 className="yt-rec-card__title" title={title}>{title}</h3>
                      <div className="yt-rec-card__sub">{subText}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Secondary Column (Dedicated Episode Playlist) ── */}
      <aside className="yt-watch-secondary">
        {/* Header with Title and Count */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <h3 className="yt-characters-title" style={{ fontSize: "13px" }}>
            VIDEOS &amp; EPISODES
          </h3>
          <span style={{ fontSize: "11px", color: "var(--yt-text-secondary)", fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
            {sidebarEpisodes.length} Episodes
          </span>
        </div>

        {/* Episode Search Bar */}
        <div className="yt-ep-search-wrap">
          <input
            type="text"
            className="yt-ep-search-input"
            placeholder="Search episode by number or title..."
            value={episodeSearch}
            onChange={(e) => setEpisodeSearch(e.target.value)}
          />
          {episodeSearch ? (
            <button
              type="button"
              className="yt-ep-search-clear"
              onClick={() => setEpisodeSearch("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Quick Season Selector Pill Row if multiple seasons exist */}
        {effectiveSeasons.length > 1 && !episodeSearch ? (
          <div style={{ marginBottom: "12px" }}>
            <div className="yt-seasons-row" style={{ padding: "0 0 4px 0", gap: "8px" }}>
              {effectiveSeasons.map((s, idx) => {
                const isSelected = idx === currentSeasonIndex;
                const label = `Season ${s.seasonNumber}`;
                const bg = s.banner || s.cover || initialInfo.image;

                return (
                  <button
                    key={`quick-season-${s.id}`}
                    type="button"
                    className={`yt-season-pill ${isSelected ? "is-selected" : ""}`}
                    onClick={() => handleSeasonBoxClick(s)}
                    title={s.title}
                    style={{ width: "110px", height: "42px", borderRadius: "10px", padding: "0 10px" }}
                  >
                    <div
                      className="yt-season-pill__bg"
                      style={{ backgroundImage: `url(${bg})` }}
                    />
                    <div className="yt-season-pill__overlay" />
                    <span className="yt-season-pill__label" style={{ fontSize: "12px" }}>{label}</span>
                    {isSelected ? <span className="yt-season-pill__dot" style={{ top: "4px", right: "6px", width: "6px", height: "6px" }} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Episode Range Grouping Chips */}
        {rangeChunks.length > 1 && !episodeSearch ? (
          <div className="yt-episode-ranges-row" style={{ marginBottom: "14px" }}>
            <span style={{ fontSize: "11px", color: "var(--yt-text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>
              Range:
            </span>
            {rangeChunks.map((chunk, idx) => {
              const isSelected = idx === activeRangeIndex;
              return (
                <button
                  key={chunk.label}
                  type="button"
                  className={`yt-episode-range-chip ${isSelected ? "is-active" : ""}`}
                  onClick={() => setActiveRangeIndex(idx)}
                >
                  {chunk.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Episode Cards List */}
        <div className="yt-watch-episodes-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {loadingSeason ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={`skel-ep-${i}`} className="yt-up-next-card" style={{ pointerEvents: "none", opacity: 0.7 }}>
                <div className="yt-up-next-thumb-box" style={{ background: "rgba(255, 255, 255, 0.08)", borderRadius: "8px" }} />
                <div className="yt-up-next-info" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ height: "13px", width: "80%", background: "rgba(255, 255, 255, 0.1)", borderRadius: "4px" }} />
                  <div style={{ height: "10px", width: "40%", background: "rgba(255, 255, 255, 0.06)", borderRadius: "4px" }} />
                </div>
              </div>
            ))
          ) : filteredEpisodes.length ? (
            filteredEpisodes.map((ep, epIdx) => {
              const isCurrent =
                (ep.number === episodeNumber || (ep.ids && ep.ids === initialSlug) || (ep.slug && ep.slug === initialSlug)) &&
                (sidebarSlug === initialSlug || effectiveSeasons.length <= 1);
              const crEpData = crEpMap[ep.number];
              const epThumb = crEpData?.thumbnail || ep.thumbnail || currentSeason?.cover || currentSeason?.banner || initialInfo.image || "/fallback-backdrop.jpg";
              const rawTitle = crEpData?.title || ep.title;
              const epName = rawTitle && !new RegExp(`^(episode\\s*)?${ep.number}$`, "i").test(rawTitle.trim())
                ? `Episode ${ep.number} · ${rawTitle.trim()}`
                : `Episode ${ep.number}`;
              const epNumPadded = ep.number < 10 ? `0${ep.number}` : String(ep.number);

              const epHref =
                baseWatchPath === "/cartoon/watch"
                  ? `${baseWatchPath}/${encodeURIComponent(ep.ids || ep.slug || `${sidebarSlug}-${ep.number}`)}`
                  : `/watch/${encodeURIComponent(sidebarSlug)}/${ep.number}?audio=${audio}${provider ? `&provider=${encodeURIComponent(provider)}` : ""}`;

              return (
                <Link
                  key={ep.ids ? `watch-ep-${ep.ids}-${ep.number}-${epIdx}` : `watch-ep-${ep.number}-${ep.slug || ""}-${epIdx}`}
                  ref={isCurrent ? activeCardRef : undefined}
                  href={epHref}
                  className={`yt-up-next-card ${isCurrent ? "is-active" : ""}`}
                >
                  <div className="yt-up-next-thumb-box">
                    <img src={epThumb} alt={epName} className="yt-up-next-thumb" loading="eager" decoding="async" />
                    <span
                      className="yt-up-next-badge"
                      style={isCurrent ? { backgroundColor: "var(--yt-red)", color: "#fff", fontWeight: 700 } : {}}
                    >
                      {isCurrent ? "▶ PLAYING" : "24:00"}
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        top: "4px",
                        left: "4px",
                        backgroundColor: "rgba(0, 0, 0, 0.82)",
                        color: "#fff",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: "3px",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                      }}
                    >
                      EP {epNumPadded}
                    </span>
                  </div>

                  <div className="yt-up-next-info">
                    <h4 className="yt-up-next-title" title={epName}>
                      {epName}
                    </h4>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                      {ep.sub !== false ? <span className="yt-ep-tag">SUB</span> : null}
                      {ep.dub ? <span className="yt-ep-tag yt-ep-tag--dub">DUB</span> : null}
                      <span style={{ fontSize: "11px", color: "#888", fontFamily: "ui-monospace, monospace" }}>
                        {initialInfo.title}
                      </span>
                    </div>
                    {ep.description ? (
                      <p
                        style={{
                          fontSize: "11.5px",
                          color: "#777",
                          lineHeight: "1.3",
                          margin: "4px 0 0",
                          display: "-webkit-box",
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {ep.description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })
          ) : (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#888", fontSize: "13px", fontFamily: "ui-monospace, monospace" }}>
              No episode found matching &ldquo;{episodeSearch}&rdquo;
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
