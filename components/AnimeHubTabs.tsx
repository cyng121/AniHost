"use client";

import Link from "next/link";
import { useState } from "react";
import type { ZoroEpisode } from "@/lib/types";
import type { AnimeSeason, AnimeCharacter } from "@/lib/relations";
import { EpisodeGrid, type EpisodeMeta } from "@/components/EpisodeGrid";

type TabKey = "episodes" | "seasons" | "characters" | "story";

export function AnimeHubTabs({
  slug,
  episodes,
  audio,
  epMeta,
  seasons = [],
  characters = [],
  synopsis,
  genres,
  facts,
}: {
  slug: string;
  episodes: ZoroEpisode[];
  audio: "sub" | "dub";
  epMeta?: Map<number, EpisodeMeta>;
  seasons?: AnimeSeason[];
  characters?: AnimeCharacter[];
  synopsis?: string | null;
  genres?: string[];
  facts?: Array<[string, string]>;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("episodes");

  return (
    <div className="anime-hub">
      {/* ── Pill Tabs Navigation Bar ── */}
      <nav className="anime-hub__tabs" role="tablist" aria-label="Anime content navigation">
        {/* Episodes Tab */}
        <button
          type="button"
          className={`hub-pill ${activeTab === "episodes" ? "is-active" : ""}`}
          onClick={() => setActiveTab("episodes")}
          role="tab"
          aria-selected={activeTab === "episodes"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
            <polyline points="17 2 12 7 7 2" />
          </svg>
          <span>Episodes</span>
          {episodes.length ? <span className="hub-pill__count tnum">({episodes.length})</span> : null}
        </button>

        {/* Seasons Tab */}
        {seasons && seasons.length > 0 ? (
          <button
            type="button"
            className={`hub-pill ${activeTab === "seasons" ? "is-active" : ""}`}
            onClick={() => setActiveTab("seasons")}
            role="tab"
            aria-selected={activeTab === "seasons"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M10 4v4" />
              <path d="M2 8h20" />
              <path d="M6 4v4" />
            </svg>
            <span>Seasons</span>
            <span className="hub-pill__count tnum">({seasons.length})</span>
          </button>
        ) : null}

        {/* Characters Tab */}
        {characters && characters.length > 0 ? (
          <button
            type="button"
            className={`hub-pill ${activeTab === "characters" ? "is-active" : ""}`}
            onClick={() => setActiveTab("characters")}
            role="tab"
            aria-selected={activeTab === "characters"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Characters</span>
            <span className="hub-pill__count tnum">({characters.length})</span>
          </button>
        ) : null}

        {/* Story & Specs Tab */}
        <button
          type="button"
          className={`hub-pill ${activeTab === "story" ? "is-active" : ""}`}
          onClick={() => setActiveTab("story")}
          role="tab"
          aria-selected={activeTab === "story"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span>Story &amp; Insights</span>
        </button>
      </nav>

      {/* ── Tab Content Panes ── */}
      <div className="anime-hub__pane">
        {/* 1. Episodes Pane */}
        {activeTab === "episodes" && (
          <div className="hub-pane hub-pane--episodes">
            <EpisodeGrid slug={slug} episodes={episodes} audio={audio} meta={epMeta} />
          </div>
        )}

        {/* 2. Seasons Pane */}
        {activeTab === "seasons" && seasons.length > 0 && (
          <div className="hub-pane hub-pane--seasons">
            <div className="hub-pane__head">
              <div>
                <span className="cap">Main Timeline</span>
                <h3>All Seasons</h3>
              </div>
            </div>

            <div className="relations__grid">
              {seasons.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="relations__card card--sharp"
                >
                  <div className="relations__art">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={`Cover for ${item.title}`}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="relations__artEmpty" />
                    )}

                    {item.score ? (
                      <span className="relations__scoreBadge tnum">
                        ★ {item.score}
                      </span>
                    ) : null}
                  </div>

                  <div className="relations__body">
                    <h4 className="relations__title">{item.title}</h4>
                    <div className="relations__meta tnum">
                      {item.format ? <span>{item.format}</span> : null}
                      {item.episodes ? <span>{item.episodes} eps</span> : null}
                      {item.year ? <span>{item.year}</span> : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 3. Characters Pane */}
        {activeTab === "characters" && characters.length > 0 && (
          <div className="hub-pane hub-pane--characters">
            <div className="hub-pane__head">
              <div>
                <span className="cap">Voice Cast &amp; Roles</span>
                <h3>Main &amp; Supporting Characters</h3>
              </div>
            </div>

            <div className="char__grid">
              {characters.map((c) => (
                <div className="char__card" key={c.id}>
                  <div className="char__art">
                    {c.image ? (
                      <img src={c.image} alt={c.name} loading="lazy" decoding="async" />
                    ) : null}
                    <span className={`char__roleBadge ${c.role === "Main" ? "is-main" : ""}`}>
                      {c.role}
                    </span>
                  </div>
                  <div className="char__info">
                    <h4 className="char__name">{c.name}</h4>
                    {c.nativeName && c.nativeName !== c.name ? (
                      <p className="char__native">{c.nativeName}</p>
                    ) : null}
                    {c.voiceActor?.name ? (
                      <div className="char__va">
                        <span className="char__vaLabel">VA:</span>
                        <span className="char__vaName">{c.voiceActor.name}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Story & Insights Pane */}
        {activeTab === "story" && (
          <div className="hub-pane hub-pane--story">
            <div className="hub-pane__head">
              <div>
                <span className="cap">Overview</span>
                <h3>Story Synopsis &amp; Specifications</h3>
              </div>
            </div>

            {synopsis ? <p className="hub-story__syn">{synopsis}</p> : null}

            {genres?.length ? (
              <div className="chipwrap" style={{ marginTop: 20 }}>
                {genres.map((g) => (
                  <Link
                    key={g}
                    className="chip"
                    href={`/genre/${encodeURIComponent(g.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`}
                  >
                    {g}
                  </Link>
                ))}
              </div>
            ) : null}

            {facts?.length ? (
              <dl className="facts" style={{ marginTop: 28 }}>
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd className={k === "Score" || k === "Episodes" ? "tnum" : undefined}>{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
