"use client";

import Link from "next/link";
import styles from "./GenreMarquee.module.css";

const FALLBACK_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Isekai",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
  "Psychological",
  "Shounen",
  "Seinen",
  "Mecha",
  "Music",
  "Cyberpunk",
  "Martial Arts",
  "Magic",
  "Demons",
  "Super Power",
];

function slugifyGenre(g: string): string {
  return g
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface GenreMarqueeProps {
  genres?: string[];
}

export function GenreMarquee({ genres }: GenreMarqueeProps) {
  const rawGenres = genres && genres.length > 0 ? genres : FALLBACK_GENRES;

  // Deduplicate and filter out empty strings / invalid items like "unknown"
  const cleanGenres = Array.from(
    new Set(
      rawGenres.filter(
        (g) =>
          Boolean(g && g.trim()) &&
          !["unknown", "null", "undefined"].includes(g.trim().toLowerCase()),
      ),
    ),
  );

  if (!cleanGenres.length) return null;

  return (
    <section
      id="genres"
      className={styles.genreSection}
      aria-label="Browse Genres"
    >
      <div className={styles.marqueeFade}>
        <div className={styles.marqueeTrack}>
          {/* First set */}
          <div className={styles.chipGroup}>
            {cleanGenres.map((genre, idx) => (
              <span key={`g1-${genre}-${idx}`} className={styles.genreItem}>
                <Link
                  className={styles.genreLink}
                  href={`/genre/${encodeURIComponent(slugifyGenre(genre))}`}
                  tabIndex={0}
                >
                  {genre}
                </Link>
                <span className={styles.genreSep} aria-hidden="true" />
              </span>
            ))}
          </div>

          {/* Duplicate set for seamless continuous marquee loop */}
          <div className={styles.chipGroup} aria-hidden="true">
            {cleanGenres.map((genre, idx) => (
              <span key={`g2-${genre}-${idx}`} className={styles.genreItem}>
                <Link
                  className={styles.genreLink}
                  href={`/genre/${encodeURIComponent(slugifyGenre(genre))}`}
                  tabIndex={-1}
                >
                  {genre}
                </Link>
                <span className={styles.genreSep} aria-hidden="true" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
