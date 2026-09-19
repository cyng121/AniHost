"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ZoroTopRated } from "@/lib/types";

const WINDOWS: Array<{ key: keyof ZoroTopRated; label: string }> = [
  { key: "day", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

const GENRE_COLOR_MAP: Record<string, string> = {
  Action: "#a3e635",
  Adventure: "#38bdf8",
  "Boys Love": "#f97316",
  Cars: "#fb923c",
  Comedy: "#c084fc",
  Dementia: "#4ade80",
  Demons: "#f1f5f9",
  Drama: "#60a5fa",
  Ecchi: "#f87171",
  Erotica: "#facc15",
  Fantasy: "#fde047",
  Game: "#fb923c",
  "Girls Love": "#fb923c",
  Gourmet: "#c084fc",
  Harem: "#e879f9",
  Historical: "#f1f5f9",
  Horror: "#84cc16",
  Isekai: "#38bdf8",
  Josei: "#2dd4bf",
  Kids: "#f1f5f9",
  Magic: "#fb923c",
  "Mahou Shoujo": "#f43f5e",
  "Martial Arts": "#38bdf8",
  Mecha: "#f1f5f9",
  Military: "#4ade80",
  Music: "#a3e635",
  Mystery: "#38bdf8",
  Parody: "#facc15",
  Police: "#60a5fa",
  Psychological: "#c084fc",
  Romance: "#f43f5e",
  Samurai: "#fb923c",
  School: "#38bdf8",
  "Sci-Fi": "#2dd4bf",
  Seinen: "#a3e635",
  Shoujo: "#f472b6",
  "Shoujo Ai": "#f472b6",
  Shounen: "#fb923c",
  "Shounen Ai": "#fb923c",
  "Slice of Life": "#fde047",
  Space: "#818cf8",
  Sports: "#38bdf8",
  "Super Power": "#f43f5e",
  Supernatural: "#c084fc",
  Suspense: "#f87171",
  Thriller: "#f87171",
  Vampire: "#e11d48",
  Cyberpunk: "#22d3ee",
};

const GENRE_EMOJI_MAP: Record<string, string> = {
  Action: "🔥",
  Adventure: "🧭",
  "Boys Love": "🤍",
  Cars: "🏎️",
  Comedy: "😂",
  Dementia: "🌀",
  Demons: "👹",
  Drama: "🎭",
  Ecchi: "💋",
  Erotica: "🔞",
  Fantasy: "🪄",
  Game: "🎮",
  "Girls Love": "🤍",
  Gourmet: "🍜",
  Harem: "👑",
  Historical: "📜",
  Horror: "👻",
  Isekai: "🚪",
  Josei: "✨",
  Kids: "🧸",
  Magic: "🔮",
  "Mahou Shoujo": "⭐",
  "Martial Arts": "🥋",
  Mecha: "🤖",
  Military: "🎖️",
  Music: "🎵",
  Mystery: "🔍",
  Parody: "🃏",
  Police: "🚔",
  Psychological: "🧠",
  Romance: "💖",
  Samurai: "⚔️",
  School: "🏫",
  "Sci-Fi": "🚀",
  Seinen: "⚡",
  Shoujo: "🌸",
  "Shoujo Ai": "🌸",
  Shounen: "💥",
  "Shounen Ai": "💥",
  "Slice of Life": "☕",
  Space: "🪐",
  Sports: "⚽",
  "Super Power": "⚡",
  Supernatural: "👁️",
  Suspense: "⏱️",
  Thriller: "🔪",
  Vampire: "🧛",
  Cyberpunk: "🏙️",
};

const DEFAULT_GENRES = [
  "Action", "Adventure", "Boys Love",
  "Cars", "Comedy", "Dementia",
  "Demons", "Drama", "Ecchi",
  "Erotica", "Fantasy", "Game",
  "Girls Love", "Gourmet", "Harem",
  "Historical", "Horror", "Isekai",
  "Josei", "Kids", "Magic",
  "Mahou Shoujo", "Martial Arts", "Mecha",
  "Military", "Music", "Mystery",
  "Parody", "Psychological", "Romance",
  "Samurai", "School", "Sci-Fi",
  "Seinen", "Shoujo", "Shounen",
  "Slice of Life", "Sports", "Supernatural"
];

function getGenreColor(name: string, index: number): string {
  if (GENRE_COLOR_MAP[name]) return GENRE_COLOR_MAP[name];
  const PALETTE = ["#a3e635", "#38bdf8", "#fb923c", "#c084fc", "#4ade80", "#60a5fa", "#f87171", "#facc15", "#e879f9", "#2dd4bf"];
  return PALETTE[index % PALETTE.length];
}

function getGenreEmoji(name: string): string {
  return GENRE_EMOJI_MAP[name] ?? "🏷️";
}

function slugifyGenre(g: string): string {
  return g.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function TopRated({
  data,
  genres = [],
}: {
  data: ZoroTopRated;
  genres?: string[];
}) {
  const available = WINDOWS.filter((w) => (data[w.key] ?? []).length);
  const [win, setWin] = useState<keyof ZoroTopRated>(available[0]?.key ?? "day");
  const [isHovered, setIsHovered] = useState(false);
  const [isGenreHovered, setIsGenreHovered] = useState(false);
  const genreScrollRef = useRef<HTMLDivElement>(null);

  // Auto-switch ranking time periods every 4 seconds unless hovered
  useEffect(() => {
    if (isHovered || available.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setWin((current) => {
        const currentIdx = available.findIndex((w) => w.key === current);
        const nextIdx = (currentIdx + 1) % available.length;
        return available[nextIdx].key;
      });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [isHovered, available]);

  // Auto-scroll genres list every 2 seconds unless hovered
  useEffect(() => {
    if (isGenreHovered) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      const el = genreScrollRef.current;
      if (!el) return;

      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return;

      if (el.scrollTop >= maxScroll - 6) {
        el.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ top: 54, behavior: "smooth" });
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [isGenreHovered]);

  const list = data[win] ?? [];
  const displayGenres = genres.length > 0 ? genres : DEFAULT_GENRES;

  return (
    <div className="space-y-6">
      {/* Top Rated Section */}
      <div 
        className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🔥</span> Top Rated
          </h3>
          <div className="flex bg-zinc-800/80 p-1 rounded-lg text-xs font-medium">
            {available.map((w) => (
              <button
                key={w.key}
                onClick={() => setWin(w.key)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  win === w.key
                    ? "bg-rose-600 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {list.slice(0, 5).map((anime, idx) => (
            <Link
              key={anime.id}
              href={`/anime/${anime.id}`}
              className="flex items-center gap-3 group p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
            >
              <span className={`w-6 text-center font-bold text-sm ${
                idx === 0 ? "text-amber-400" : idx === 1 ? "text-zinc-300" : idx === 2 ? "text-amber-600" : "text-zinc-500"
              }`}>
                0{idx + 1}
              </span>
              <div className="relative w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-zinc-800">
                {anime.poster ? (
                  <img
                    src={anime.poster}
                    alt={anime.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-zinc-200 group-hover:text-rose-500 truncate transition-colors">
                  {anime.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                  <span>{anime.type || "TV"}</span>
                  {anime.duration && (
                    <>
                      <span>•</span>
                      <span>{anime.duration}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Genres Section */}
      <div 
        className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm"
        onMouseEnter={() => setIsGenreHovered(true)}
        onMouseLeave={() => setIsGenreHovered(false)}
      >
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <span>🏷️</span> Genres
        </h3>
        <div 
          ref={genreScrollRef}
          className="max-h-[280px] overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-zinc-700"
        >
          <div className="grid grid-cols-2 gap-2">
            {displayGenres.map((genre, idx) => {
              const slug = slugifyGenre(genre);
              const color = getGenreColor(genre, idx);
              const emoji = getGenreEmoji(genre);
              return (
                <Link
                  key={genre}
                  href={`/genre/${slug}`}
                  className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800/60 transition-all group"
                  style={{ borderLeftColor: color, borderLeftWidth: "3px" }}
                >
                  <span className="text-base">{emoji}</span>
                  <span className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">
                    {genre}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
