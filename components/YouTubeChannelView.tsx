"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, BellRing, Share2, Layers, Play } from "lucide-react";
import type { ZoroEpisode, ZoroInfo } from "@/lib/types";
import type { AnimeSeason, AnimeCharacter, AnimeRecommendation, AnimeTrailer } from "@/lib/relations";
import { useBannerAssets } from "@/hooks/useBannerAssets";
import { useCrunchyrollBanner } from "@/hooks/useCrunchyrollBanner";
import { useAnimeTVEpisodes } from "@/hooks/useAnimeTVEpisodes";
import { SaveButton } from "./SaveButton";

import { fetchAniCoreTrailerForAnime } from "@/lib/anicore-trailers";

interface YouTubeChannelViewProps {
  slug: string;
  info: ZoroInfo;
  banner?: string | null;
  backdrop?: string | null;
  episodes: ZoroEpisode[];
  seasons?: AnimeSeason[];
  characters?: AnimeCharacter[];
  recommendations?: AnimeRecommendation[];
  trailer?: AnimeTrailer | null;
  audio?: "sub" | "dub";
  baseWatchPath?: string;
}

type Tab = "home" | "seasons" | "characters" | "recommended" | "about";

const RANGE_SIZE = 30;

export function YouTubeChannelView({
  slug: initialSlug,
  info: initialInfo,
  banner,
  backdrop,
  episodes: initialEpisodes,
  seasons = [],
  characters = [],
  recommendations = [],
  trailer: initialTrailer = null,
  audio = "sub",
  baseWatchPath,
}: YouTubeChannelViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [subscribed, setSubscribed] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [activeTrailer, setActiveTrailer] = useState<AnimeTrailer | null>(initialTrailer);

  // Active Season & Loaded Data state
  const [currentSlug, setCurrentSlug] = useState(initialSlug);
  const [currentInfo, setCurrentInfo] = useState<ZoroInfo>(initialInfo);
  const [currentEpisodes, setCurrentEpisodes] = useState<ZoroEpisode[]>(initialEpisodes);
  const [loadingSeason, setLoadingSeason] = useState(false);

  // Client-side cache for fetched season episodes to make switching instant
  const seasonCacheRef = useRef<Map<string, { info: ZoroInfo; episodes: ZoroEpisode[] }>>(new Map());

  useEffect(() => {
    if (initialSlug && initialEpisodes.length > 0) {
      seasonCacheRef.current.set(initialSlug, { info: initialInfo, episodes: initialEpisodes });
    }
  }, [initialSlug, initialInfo, initialEpisodes]);

  // Fetch official working trailer with strict title/ID verification & private video fallback
  useEffect(() => {
    let isMounted = true;
    const isNumericSlug = /^\d+$/.test(currentSlug);
    const targetTitle = (currentInfo.title || "").trim();
    const targetMalId = currentInfo.malId || (isNumericSlug ? Number(currentSlug) : null);

    const loadTrailer = async () => {
      const resolved = await fetchAniCoreTrailerForAnime(currentSlug || targetTitle, targetMalId);
      if (resolved?.youtubeId && isMounted) {
        setActiveTrailer({
          id: resolved.youtubeId,
          site: "youtube",
          thumbnail: resolved.thumbnail,
        });
      }
    };

    loadTrailer();

    return () => {
      isMounted = false;
    };
  }, [currentInfo.title, currentInfo.malId, currentInfo.anilistId, currentSlug]);

  // TMDB Banner & Clearlogo Assets
  const anilistIdVal = currentInfo.anilistId || (/^\d+$/.test(currentSlug) ? Number(currentSlug) : null);
  const { logo: tmdbLogo, backdrop: tmdbBackdrop } = useBannerAssets(currentInfo.title, anilistIdVal);

  // Crunchyroll card assets — all fields at highest priority
  const {
    detailBanner: crDetailBanner,
    heroBanner: crHeroBanner,
    titleLogo: crTitleLogo,
    poster: crPoster,
    loaded: crLoaded,
  } = useCrunchyrollBanner(currentInfo.malId);

  // Crunchyroll episode thumbnails directly from AniMeTVPlus API
  const { episodesMap: crEpMap } = useAnimeTVEpisodes(currentInfo.malId || anilistIdVal);

  // Range chunking for episodes
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);

  const isUrl = (s?: string | null) => typeof s === "string" && s.startsWith("http");
  const displayTitle = isUrl(currentInfo.title) ? (currentInfo.japaneseTitle || "Anime") : currentInfo.title;

  // Banner priority — CR detail_banner is the canonical wide keyart (1920px, Crunchyroll)
  // Filter out YouTube thumbnails / non-banner URLs that sometimes end up in bannerImage
  const isValidBanner = (s?: string | null) =>
    typeof s === "string" &&
    s.startsWith("http") &&
    !s.includes("youtube.com") &&
    !s.includes("ytimg.com") &&
    !s.includes("/thumbnail/") &&
    !s.includes("crunchyroll.com/imgsrv/display/thumbnail");

  const bannerSrc =
    crDetailBanner ||                                               // CR 1920px keyart — top priority
    crHeroBanner ||                                                // CR hero wide
    tmdbBackdrop ||                                                // TMDB backdrop
    (isValidBanner(currentInfo.bannerImage) ? currentInfo.bannerImage : null) || // AniList (skip YT)
    (isValidBanner(banner) ? banner : null) ||
    (isValidBanner(backdrop) ? backdrop : null) ||
    currentInfo.image ||
    undefined;
  // Avatar: CR poster → AniList cover image
  const avatarSrc = crPoster || currentInfo.image || undefined;
  // Logo: CR title_logo → TMDB logo (only after CR has settled)
  const clearLogo = crTitleLogo || (crLoaded ? tmdbLogo : null) || null;

  // Characters view toggle
  const [showAllChars, setShowAllChars] = useState(false);
  const visibleCharacters = useMemo(() => {
    if (showAllChars) return characters;
    return characters.slice(0, 12);
  }, [characters, showAllChars]);

  // Effective seasons computed from props, currentInfo.seasons, initialInfo.seasons, or current anime as Season 1
  const effectiveSeasons = useMemo<AnimeSeason[]>(() => {
    if (seasons && seasons.length > 0) {
      return seasons;
    }
    const infoSeasons = currentInfo.seasons || initialInfo.seasons;
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
          cover: s.season_poster ?? currentInfo.image ?? null,
          banner: s.season_poster ?? currentInfo.image ?? null,
          format: s.format,
          episodes: s.episodes,
          year: s.seasonYear,
          href: `/anime/${seasonId}/1`,
        };
      });
    }
    return [
      {
        id: 1,
        seasonNumber: 1,
        title: currentInfo.title || "Season 1",
        slug: currentSlug,
        cover: currentInfo.image ?? null,
        banner: bannerSrc ?? null,
        format: currentInfo.type,
        episodes: currentEpisodes.length || currentInfo.totalEpisodes,
        year: null,
        href: `/anime/${encodeURIComponent(currentSlug)}`,
      },
    ];
  }, [seasons, currentInfo, initialInfo, currentSlug, bannerSrc, currentEpisodes.length]);

  // Compute active season from effectiveSeasons list
  const currentSeasonIndex = useMemo(() => {
    if (!currentSlug || effectiveSeasons.length === 0) return 0;
    const targetSlug = decodeURIComponent(currentSlug).toLowerCase();

    // 1. Try exact match by ID, slug, or href
    const idx = effectiveSeasons.findIndex(
      (s) =>
        String(s.id) === currentSlug ||
        s.slug === currentSlug ||
        (s.slug && targetSlug.includes(s.slug.toLowerCase())) ||
        (s.href && (s.href === currentSlug || s.href.includes(currentSlug)))
    );
    if (idx >= 0) return idx;

    // 2. Fallback: match title only if exact slug match failed
    const fallbackIdx = effectiveSeasons.findIndex(
      (s) => s.title && currentInfo.title && s.title.toLowerCase() === currentInfo.title.toLowerCase()
    );
    return fallbackIdx >= 0 ? fallbackIdx : 0;
  }, [effectiveSeasons, currentSlug, currentInfo.title]);

  const currentSeason = effectiveSeasons[currentSeasonIndex] || effectiveSeasons[0];

  // Episode range chunks (e.g. 1–30, 31–60, 61–90)
  const rangeChunks = useMemo(() => {
    if (currentEpisodes.length <= RANGE_SIZE) return [];
    const chunks: Array<{ start: number; end: number; label: string }> = [];
    const total = currentEpisodes.length;
    for (let i = 0; i < total; i += RANGE_SIZE) {
      const start = i + 1;
      const end = Math.min(i + RANGE_SIZE, total);
      chunks.push({
        start,
        end,
        label: `Episodes ${start}–${end}`,
      });
    }
    return chunks;
  }, [currentEpisodes.length]);

  // Sliced episodes for active range
  const visibleEpisodes = useMemo(() => {
    if (rangeChunks.length === 0) return currentEpisodes;
    const chunk = rangeChunks[activeRangeIndex] || rangeChunks[0];
    const startIndex = (chunk.start - 1);
    const endIndex = chunk.end;
    return currentEpisodes.slice(startIndex, endIndex);
  }, [currentEpisodes, rangeChunks, activeRangeIndex]);

  // Switch season dynamically and load that season's episodes & description
  async function selectSeason(season: AnimeSeason) {
    const targetSlug = season.slug || String(season.id);
    if (targetSlug === currentSlug && currentEpisodes.length > 0) {
      return;
    }

    setCurrentSlug(targetSlug);

    // Instant return if season data is already cached locally
    const cached = seasonCacheRef.current.get(targetSlug);
    if (cached && cached.episodes.length > 0) {
      setCurrentInfo(cached.info);
      setCurrentEpisodes(cached.episodes);
      setActiveRangeIndex(0);
      window.history.pushState(null, "", `/anime/${encodeURIComponent(targetSlug)}`);
      return;
    }

    setLoadingSeason(true);
    setActiveRangeIndex(0);

    try {
      const res = await fetch(`/api/season?slug=${encodeURIComponent(targetSlug || season.href.replace("/anime/", ""))}`);
      const data = await res.json();

      if (data.ok) {
        setCurrentSlug(data.slug);
        setCurrentInfo(data.info);
        const eps = data.episodes || [];
        setCurrentEpisodes(eps);
        if (eps.length > 0) {
          seasonCacheRef.current.set(targetSlug, { info: data.info, episodes: eps });
          if (data.slug !== targetSlug) {
            seasonCacheRef.current.set(data.slug, { info: data.info, episodes: eps });
          }
        }
        window.history.pushState(null, "", `/anime/${encodeURIComponent(data.slug)}`);
      } else {
        // Fallback: full browser navigation if API couldn't resolve
        window.location.href = season.href;
      }
    } catch {
      window.location.href = season.href;
    } finally {
      setLoadingSeason(false);
    }
  }
  const handle = `@${currentSlug.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 18)}`;
  const studioName = (Array.isArray(currentInfo.studios)
    ? currentInfo.studios.filter(Boolean).join(", ")
    : typeof currentInfo.studios === "string" ? currentInfo.studios : "") || "Anime";
  const episodeCount = currentEpisodes.length || currentInfo.totalEpisodes || 0;
  const subscriberCount = `${((currentSlug.length * 9) % 80 + 3.2).toFixed(1)}K`;

  const descriptionText = currentInfo.description || currentInfo.synopsis || currentSeason?.description || "No description available for this season.";

  function toggleSubscribe() {
    setSubscribed((prev) => !prev);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: currentInfo.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Channel link copied to clipboard!");
    }
  }

  return (
    <div className="yt-channel">
      {/* 1. Channel Panorama Banner */}
      <div className="yt-channel-banner">
        {bannerSrc ? (
          <img
            src={bannerSrc}
            alt=""
            loading="eager"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1c1c1f, #0f0f11)" }} />
        )}
      </div>

      {/* 2. Channel Profile Header */}
      <div className="yt-channel-header">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={displayTitle}
            className="yt-channel-avatar"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="yt-channel-avatar" style={{ background: "#222" }} />
        )}

        <div className="yt-channel-details">
          {clearLogo ? (
            <div className="yt-channel-logo-wrap">
              <img
                src={clearLogo}
                alt={displayTitle}
                className="yt-channel-clearlogo"
              />
            </div>
          ) : (
            <h1 className="yt-channel-title">{displayTitle}</h1>
          )}

          <div className="yt-channel-meta">
            <span>{handle}</span>
            <span>•</span>
            <span>{subscriberCount} subscribers</span>
            <span>•</span>
            <span>{episodeCount} episodes</span>
            {effectiveSeasons.length > 1 ? (
              <>
                <span>•</span>
                <span style={{ color: "var(--yt-blue)", fontWeight: 600 }}>{effectiveSeasons.length} seasons</span>
              </>
            ) : null}
          </div>

          <p className="yt-channel-desc" style={descExpanded ? { display: "block" } : {}}>
            {descriptionText}
            {descriptionText.length > 180 && !descExpanded ? (
              <button
                type="button"
                onClick={() => setDescExpanded(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "0 4px",
                }}
              >
                more
              </button>
            ) : null}
          </p>

          {(studioName || (currentInfo.premiered || currentInfo.year)) ? (
            <div className="yt-channel-meta" style={{ marginTop: "-8px", marginBottom: "16px", textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.04em", color: "#aaa" }}>
              {studioName ? <span>{studioName}</span> : null}
              {studioName && (currentInfo.premiered || currentInfo.year) ? <span>•</span> : null}
              {currentInfo.premiered || currentInfo.year ? <span>{String(currentInfo.premiered || currentInfo.year).replace(/\s*\?\s*/g, "")}</span> : null}
            </div>
          ) : null}

          <div className="yt-channel-actions">
            <button
              type="button"
              className={`yt-action-btn yt-btn-subscribe ${subscribed ? "is-subscribed" : ""}`}
              onClick={toggleSubscribe}
            >
              {subscribed ? <BellRing size={15} /> : <Bell size={15} />}
              <span>{subscribed ? "Subscribed" : "Subscribe"}</span>
            </button>

            <button
              type="button"
              className="yt-action-btn yt-btn-share"
              onClick={handleShare}
              aria-label="Share channel"
            >
              <Share2 size={15} />
              <span>Share</span>
            </button>

            {effectiveSeasons.length > 1 ? (
              <button
                type="button"
                className="yt-action-btn yt-btn-seasons"
                onClick={() => setActiveTab("seasons")}
                title="View multiple seasons"
              >
                <Layers size={15} />
                <span>{effectiveSeasons.length} Seasons</span>
              </button>
            ) : null}

            {activeTrailer?.id ? (
              <button
                type="button"
                className="yt-action-btn yt-btn-trailer"
                onClick={() => setShowTrailerModal(true)}
                title="Watch official trailer"
              >
                <Play size={14} fill="currentColor" />
                <span>Trailer</span>
              </button>
            ) : null}

            <SaveButton
              slug={currentSlug}
              title={currentInfo.title}
              image={avatarSrc}
              type="anime"
              quality={currentInfo.quality}
              className="yt-action-btn yt-btn-save"
            />
          </div>
        </div>
      </div>

      {/* 3. Underline Channel Navigation Tabs */}
      <nav className="yt-channel-tabs" role="tablist">
        <button
          type="button"
          className={`yt-channel-tab ${activeTab === "home" ? "is-active" : ""}`}
          onClick={() => setActiveTab("home")}
          role="tab"
          aria-selected={activeTab === "home"}
        >
          Home
        </button>

        {effectiveSeasons.length > 0 ? (
          <button
            type="button"
            className={`yt-channel-tab ${activeTab === "seasons" ? "is-active" : ""}`}
            onClick={() => setActiveTab("seasons")}
            role="tab"
            aria-selected={activeTab === "seasons"}
          >
            Seasons ({effectiveSeasons.length})
          </button>
        ) : null}

        {characters.length > 0 ? (
          <button
            type="button"
            className={`yt-channel-tab ${activeTab === "characters" ? "is-active" : ""}`}
            onClick={() => setActiveTab("characters")}
            role="tab"
            aria-selected={activeTab === "characters"}
          >
            Characters ({characters.length})
          </button>
        ) : null}

        {recommendations.length > 0 || (currentInfo.recommended && currentInfo.recommended.length > 0) ? (
          <button
            type="button"
            className={`yt-channel-tab ${activeTab === "recommended" ? "is-active" : ""}`}
            onClick={() => setActiveTab("recommended")}
            role="tab"
            aria-selected={activeTab === "recommended"}
          >
            Recommended {recommendations.length > 0 ? `(${recommendations.length})` : ""}
          </button>
        ) : null}

        <button
          type="button"
          className={`yt-channel-tab ${activeTab === "about" ? "is-active" : ""}`}
          onClick={() => setActiveTab("about")}
          role="tab"
          aria-selected={activeTab === "about"}
        >
          About
        </button>
      </nav>

      {/* 4. Tab Content */}
      <div className="yt-grid-container">
        {/* Home Tab: Pure Episode List */}
        {activeTab === "home" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h2 className="yt-characters-title">
                  VIDEOS &amp; EPISODES
                </h2>
                {loadingSeason ? (
                  <span style={{ fontSize: "12px", color: "#888", fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>
                    Loading episodes...
                  </span>
                ) : null}
              </div>
            </div>

            {/* Episode Range Selector Chips (for 30+ episodes e.g. 1–30, 31–60, etc.) */}
            {rangeChunks.length > 1 ? (
              <div style={{ padding: "0 0 14px" }}>
                <div className="yt-episode-ranges-row">
                  <span style={{ fontSize: "12px", color: "var(--yt-text-secondary)", marginRight: "6px", fontWeight: 600 }}>
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
              </div>
            ) : null}

            {/* Episodes 16:9 Grid */}
            <div className="yt-grid yt-grid--episodes">
              {loadingSeason ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={`skel-grid-${i}`} className="yt-card yt-card--episode" style={{ pointerEvents: "none", opacity: 0.75 }}>
                    <div className="yt-card__thumb-box" style={{ background: "rgba(255, 255, 255, 0.08)", borderRadius: "10px" }} />
                    <div className="yt-card__meta-row" style={{ marginTop: "10px" }}>
                      <div className="yt-card__info" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ height: "14px", width: "85%", background: "rgba(255, 255, 255, 0.1)", borderRadius: "4px" }} />
                        <div style={{ height: "10px", width: "45%", background: "rgba(255, 255, 255, 0.06)", borderRadius: "4px" }} />
                      </div>
                    </div>
                  </div>
                ))
              ) : visibleEpisodes.map((ep, epIdx) => {
                const epThumb = crEpMap[ep.number]?.thumbnail || ep.thumbnail || currentSeason?.cover || currentSeason?.banner || bannerSrc;
                const epTitle = crEpMap[ep.number]?.title || ep.title || `Episode ${ep.number}`;

                return (
                  <Link
                    key={ep.ids ? `ep-${ep.ids}-${ep.number}-${epIdx}` : `ep-${ep.number}-${ep.slug || ""}-${epIdx}`}
                    href={
                      baseWatchPath
                        ? `${baseWatchPath}/${encodeURIComponent(ep.ids || ep.slug || `${currentSlug}-${ep.number}`)}`
                        : `/watch/${encodeURIComponent(currentSlug)}/${ep.number}`
                    }
                    className="yt-card yt-card--episode"
                  >
                    <div className="yt-card__thumb-box">
                      <img
                        src={epThumb}
                        alt={epTitle}
                        className="yt-card__thumb"
                        loading="eager"
                        decoding="async"
                      />
                      <span className="yt-card__badge">
                        EP {String(ep.number).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="yt-card__meta-row">
                      <div className="yt-card__info">
                        <h3 className="yt-card__title" title={epTitle}>{epTitle}</h3>
                        <div className="yt-card__stats">
                          Episode {ep.number} • 24:00
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Seasons Tab: Dedicated Multi-Season View (matching user reference UI) */}
        {activeTab === "seasons" ? (
          <div className="yt-seasons-section">
            <h2 className="yt-seasons-header-title">S E A S O N S</h2>
            <div className="yt-seasons-row yt-seasons-row--wrap">
              {effectiveSeasons.map((s, idx) => {
                const isSelected = idx === currentSeasonIndex;
                const label = `Season ${s.seasonNumber}`;
                const bg = s.banner || s.cover || bannerSrc;

                return (
                  <button
                    key={`tab-season-${s.id}`}
                    type="button"
                    className={`yt-season-pill ${isSelected ? "is-selected" : ""}`}
                    onClick={() => {
                      selectSeason(s);
                      setActiveTab("home");
                    }}
                    title={s.title}
                  >
                    <div
                      className="yt-season-pill__bg"
                      style={{ backgroundImage: `url(${bg})` }}
                    />
                    <div className="yt-season-pill__overlay" />
                    <span className="yt-season-pill__label">{label}</span>
                    {isSelected ? <span className="yt-season-pill__dot" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Characters Tab: Split Character & Voice Actor Cards */}
        {activeTab === "characters" ? (
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

        {/* Recommended Tab: AniList Recommendations & Suggestions */}
        {activeTab === "recommended" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 className="yt-characters-title">
                RECOMMENDED ANIME
              </h2>
            </div>
            <div className="yt-grid yt-grid--rec">
              {(recommendations.length > 0 ? recommendations : (currentInfo.recommended ?? [])).map((rec: any) => {
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

        {/* About Tab */}
        {activeTab === "about" ? (
          <div className="yt-about-container">
            <div className="yt-about-card">
              <h2 className="yt-characters-title" style={{ marginBottom: "14px" }}>DESCRIPTION</h2>
              <p className="yt-about-desc">
                {descriptionText}
              </p>
            </div>

            <div className="yt-about-card">
              <h2 className="yt-characters-title" style={{ marginBottom: "16px" }}>DETAILS</h2>
              <div className="yt-about-details">
                <div className="yt-about-label">Studios</div>
                <div className="yt-about-value">{studioName || "Unknown"}</div>
                <div className="yt-about-label">Status</div>
                <div className="yt-about-value">{currentInfo.status || "Finished Airing"}</div>
                <div className="yt-about-label">Type</div>
                <div className="yt-about-value">{currentInfo.type || "TV Series"}</div>
                <div className="yt-about-label">Rating</div>
                <div className="yt-about-value">{currentInfo.rating || currentInfo.malScore || "N/A"}</div>
                <div className="yt-about-label">Genres</div>
                <div className="yt-about-value">{currentInfo.genres?.join(", ") || "Action, Adventure"}</div>
                {currentInfo.synonyms && currentInfo.synonyms.length > 0 ? (
                  <>
                    <div className="yt-about-label">Synonyms</div>
                    <div className="yt-about-value">{currentInfo.synonyms.join(" • ")}</div>
                  </>
                ) : null}
                {effectiveSeasons.length > 1 ? (
                  <>
                    <div className="yt-about-label">Seasons</div>
                    <div className="yt-about-value" style={{ color: "#fff" }}>{effectiveSeasons.length} Seasons in Franchise</div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 5. Official Trailer Modal (Autoplay) */}
      {showTrailerModal && activeTrailer?.id ? (() => {
        const rawId = activeTrailer.id;
        const ytMatch = rawId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        const cleanId = ytMatch && ytMatch[1] ? ytMatch[1] : rawId.trim();
        const origin = typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";

        return (
          <div
            className="yt-modal-backdrop"
            onClick={() => setShowTrailerModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Anime Trailer"
          >
            <div className="yt-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="yt-modal-header">
                <h3 className="yt-modal-title">
                  <span style={{ color: "var(--yt-red)", marginRight: "8px" }}>▶</span>
                  {currentInfo.title} — Official Trailer
                </h3>
                <button
                  type="button"
                  className="yt-modal-close"
                  onClick={() => setShowTrailerModal(false)}
                  aria-label="Close trailer"
                >
                  ✕
                </button>
              </div>
              <div className="yt-modal-video-wrap">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${cleanId}?autoplay=1&rel=0&playsinline=1&enablejsapi=1${origin ? `&origin=${origin}` : ""}`}
                  title={`${currentInfo.title} Official Trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  className="yt-modal-iframe"
                />
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
