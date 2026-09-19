"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clearSaves, listSaves, onSavesChange, removeSave, type SavedItem } from "@/lib/saves";
import { Footer } from "@/components/Footer";

function relativeDate(iso?: number | string): string {
  if (!iso) return "recently";
  const time = typeof iso === "number" ? iso : new Date(iso).getTime();
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SavesPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [filter, setFilter] = useState<"all" | "anime" | "manga">("all");
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(listSaves());
    setReady(true);
    return onSavesChange(setItems);
  }, []);

  const filtered = useMemo(() => {
    let result = items;
    if (filter !== "all") {
      result = result.filter((item) => item.type === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((item) => item.title.toLowerCase().includes(q));
    }
    return result;
  }, [items, filter, search]);

  const animeCount = items.filter((x) => x.type === "anime").length;
  const mangaCount = items.filter((x) => x.type === "manga").length;

  return (
    <main className="wrap page saves-page">
      <header className="page__head">
        <div className="saves-head__row">
          <div>
            <h1>Saved Collections</h1>
            <p className="page__sub">
              {ready
                ? `${items.length} saved title${items.length === 1 ? "" : "s"} &middot; Stored on this device`
                : "Loading saves…"}
            </p>
          </div>
          {items.length > 0 ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                if (window.confirm("Clear all saved titles from your library?")) {
                  clearSaves();
                  setItems([]);
                }
              }}
            >
              Clear all
            </button>
          ) : null}
        </div>
      </header>

      {/* ── Pinterest Board Filter Tabs & Search ── */}
      {items.length > 0 ? (
        <div className="saves__controls">
          <div className="pinterest-tabs" role="tablist" aria-label="Filter board">
            <button
              type="button"
              className={`pinterest-tab ${filter === "all" ? "is-active" : ""}`}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All Pins ({items.length})
            </button>
            <button
              type="button"
              className={`pinterest-tab ${filter === "anime" ? "is-active" : ""}`}
              aria-pressed={filter === "anime"}
              onClick={() => setFilter("anime")}
            >
              Anime Board ({animeCount})
            </button>
            <button
              type="button"
              className={`pinterest-tab ${filter === "manga" ? "is-active" : ""}`}
              aria-pressed={filter === "manga"}
              onClick={() => setFilter("manga")}
            >
              Manga Board ({mangaCount})
            </button>
          </div>

          <label className="epfilter saves__search">
            <span className="vh">Search pins</span>
            <input
              type="search"
              placeholder="Search pins…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      {/* ── Pinterest-Style Masonry Grid ── */}
      {ready && filtered.length > 0 ? (
        <div className="pinterest-masonry">
          {filtered.map((item) => {
            const href = item.type === "manga" ? `/manga/${encodeURIComponent(item.slug)}` : `/anime/${encodeURIComponent(item.slug)}`;
            return (
              <div className="pinterest-pin" key={`${item.type}:${item.slug}`}>
                <div className="pinterest-pin__frame">
                  <Link href={href} className="pinterest-pin__link" aria-label={item.title}>
                    {item.image ? (
                      <img src={item.image} alt={item.title} loading="lazy" decoding="async" className="pinterest-pin__img" />
                    ) : (
                      <div className="pinterest-pin__placeholder" />
                    )}

                    <div className="pinterest-pin__scrim" />

                    {/* Quick Watch/Read button overlay */}
                    <div className="pinterest-pin__cta">
                      <span className="pinterest-pin__playIcon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" />
                        </svg>
                      </span>
                      <span>{item.type === "manga" ? "Read" : "Watch"}</span>
                    </div>

                    {/* Type badge */}
                    <span className="pinterest-pin__typeTag">
                      {item.type === "manga" ? "MANGA" : "ANIME"}
                    </span>

                    {/* Quality / Score badge */}
                    {item.quality || item.rating ? (
                      <span className="pinterest-pin__metaBadge">
                        {item.quality ? <span>{item.quality}</span> : null}
                        {item.rating ? <span>★ {item.rating}</span> : null}
                      </span>
                    ) : null}
                  </Link>

                  {/* Remove Pin Button */}
                  <button
                    type="button"
                    className="pinterest-pin__removeBtn"
                    aria-label={`Remove ${item.title} from pins`}
                    title="Remove from board"
                    onClick={() => removeSave(item.slug, item.type)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="pinterest-pin__info">
                  <Link href={href} className="pinterest-pin__title">
                    {item.title}
                  </Link>
                  <span className="pinterest-pin__savedAt tnum">
                    Saved {relativeDate(item.savedAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Empty State ── */}
      {ready && items.length === 0 ? (
        <div className="saves__empty">
          <div className="saves__emptyIcon" aria-hidden>
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
          </div>
          <h2>Your Saves Board is empty</h2>
          <p>
            Pin any anime or manga while browsing to collect titles you want to watch or read later.
          </p>
          <div className="saves__emptyActions">
            <Link className="btn btn--accent" href="/">
              Browse anime
            </Link>
            <Link className="btn btn--ghost" href="/search">
              Explore genres
            </Link>
          </div>
        </div>
      ) : null}

      <Footer />
    </main>
  );
}
