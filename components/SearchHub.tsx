"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SearchScope } from "@/lib/search-scope";

const GENRES = [
  {
    name: "Action",
    slug: "action",
    bg: "linear-gradient(135deg, #E50914, #7a080d)",
    image: "https://cdn.myanimelist.net/images/anime/1066/141018l.jpg", // Solo Leveling
  },
  {
    name: "Shounen",
    slug: "shounen",
    bg: "linear-gradient(135deg, #FF6F00, #a83800)",
    image: "https://cdn.myanimelist.net/images/anime/1286/99889l.jpg", // Demon Slayer
  },
  {
    name: "Romance",
    slug: "romance",
    bg: "linear-gradient(135deg, #E91E63, #880e4f)",
    image: "https://cdn.myanimelist.net/images/anime/5/87048l.jpg", // Your Name
  },
  {
    name: "Isekai",
    slug: "isekai",
    bg: "linear-gradient(135deg, #7C4DFF, #3700b3)",
    image: "https://cdn.myanimelist.net/images/anime/1444/108005l.jpg", // Re:Zero
  },
  {
    name: "Fantasy",
    slug: "fantasy",
    bg: "linear-gradient(135deg, #1E88E5, #0d47a1)",
    image: "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg", // Frieren
  },
  {
    name: "Sci-Fi",
    slug: "sci-fi",
    bg: "linear-gradient(135deg, #00ACC1, #004d40)",
    image: "https://cdn.myanimelist.net/images/anime/1860/126425l.jpg", // Cyberpunk Edgerunners
  },
  {
    name: "Supernatural",
    slug: "supernatural",
    bg: "linear-gradient(135deg, #5E35B1, #1a237e)",
    image: "https://cdn.myanimelist.net/images/anime/1171/109222l.jpg", // Jujutsu Kaisen
  },
  {
    name: "Mystery",
    slug: "mystery",
    bg: "linear-gradient(135deg, #FB8C00, #b23c00)",
    image: "https://cdn.myanimelist.net/images/anime/9/9453l.jpg", // Death Note
  },
  {
    name: "Slice of Life",
    slug: "slice-of-life",
    bg: "linear-gradient(135deg, #43A047, #1b5e20)",
    image: "https://cdn.myanimelist.net/images/anime/1441/122795l.jpg", // Spy x Family
  },
  {
    name: "Comedy",
    slug: "comedy",
    bg: "linear-gradient(135deg, #FDD835, #c67c00)",
    image: "https://cdn.myanimelist.net/images/anime/8/77831l.jpg", // Konosuba
  },
  {
    name: "Sports",
    slug: "sports",
    bg: "linear-gradient(135deg, #7CB342, #33691e)",
    image: "https://cdn.myanimelist.net/images/anime/1258/126926l.jpg", // Blue Lock
  },
  {
    name: "Psychological",
    slug: "psychological",
    bg: "linear-gradient(135deg, #AB47BC, #4a148c)",
    image: "https://cdn.myanimelist.net/images/anime/10/47347l.jpg", // Attack on Titan
  },
  {
    name: "Horror",
    slug: "horror",
    bg: "linear-gradient(135deg, #424242, #181818)",
    image: "https://cdn.myanimelist.net/images/anime/5/64449l.jpg", // Tokyo Ghoul
  },
  {
    name: "Adventure",
    slug: "adventure",
    bg: "linear-gradient(135deg, #00897B, #004d40)",
    image: "https://cdn.myanimelist.net/images/anime/6/73245l.jpg", // One Piece
  },
  {
    name: "Drama",
    slug: "drama",
    bg: "linear-gradient(135deg, #D81B60, #880e4f)",
    image: "https://cdn.myanimelist.net/images/anime/1500/103006l.jpg", // Vinland Saga
  },
  {
    name: "Thriller",
    slug: "thriller",
    bg: "linear-gradient(135deg, #F4511E, #bf360c)",
    image: "https://cdn.myanimelist.net/images/anime/1935/127974l.jpg", // Steins;Gate
  },
];

const TRENDING_SEARCHES = [
  "Jujutsu Kaisen",
  "Demon Slayer",
  "Solo Leveling",
  "One Piece",
  "Chainsaw Man",
  "Bleach",
  "Attack on Titan",
  "Hunter x Hunter",
];

export function SearchHub({
  initialQuery = "",
}: {
  initialQuery?: string;
  initialScope?: SearchScope;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="search-hub">
      {/* ── Floating Search Header ── */}
      <form className="search-hub__bar" onSubmit={onSubmit}>
        <div className="search-hub__inputWrap">
          <svg className="search-hub__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="search-hub__input"
            placeholder="Search anime..."
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="search-hub__clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              &times;
            </button>
          ) : null}
        </div>
      </form>

      {/* ── Trending Chips ── */}
      <div className="search-hub__trending">
        <span className="search-hub__subLabel">Trending searches</span>
        <div className="search-hub__chips">
          {TRENDING_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              className="search-hub__chip"
              onClick={() => {
                setQuery(term);
                router.push(`/search?q=${encodeURIComponent(term)}`);
              }}
            >
              <span className="search-hub__chipFire" aria-hidden>🔥</span>
              <span>{term}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Spotify-Style Browse All Categories Grid with Angled Background Art ── */}
      <div className="search-hub__genres">
        <h2 className="search-hub__sectionTitle">Browse all genres</h2>
        <div className="spotify-grid">
          {GENRES.map((g) => (
            <button
              key={g.slug}
              type="button"
              className="spotify-tile"
              style={{ background: g.bg }}
              onClick={() => {
                setQuery(g.name);
                router.push(`/search?q=${encodeURIComponent(g.name)}`);
              }}
            >
              <span className="spotify-tile__title">{g.name}</span>
              <span className="spotify-tile__art">
                <img
                  src={g.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
