"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";

const ANIME_GENRES = [
  "All",
  "Action",
  "Romance",
  "Comedy",
  "Adventure",
  "Fantasy",
  "Sci-Fi",
  "Sports",
  "Drama",
  "Mystery",
  "Horror",
  "Music",
  "Top rated",
  "New releases",
];

const MANGA_CHIPS = [
  "All",
  "Trending",
  "Hot updates",
  "Top rated",
  "Popular",
  "Manwha",
  "Manhua",
  "Recently added",
  "Action",
  "Romance",
  "Fantasy",
  "Comedy",
  "Drama",
  "Sci-Fi",
];

interface YouTubeFilterBarProps {
  basePath?: string;
  chips?: string[];
}

export function YouTubeFilterBar({ basePath, chips }: YouTubeFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isManga = basePath === "/manga" || pathname?.startsWith("/manga");
  const resolvedBasePath = basePath || (isManga ? "/manga" : "/");
  const resolvedChips = chips || (isManga ? MANGA_CHIPS : ANIME_GENRES);

  const activeGenre = searchParams.get("genre");
  const activeSort = searchParams.get("sort");
  const activeShelf = searchParams.get("shelf");
  const activeType = searchParams.get("type");

  let currentChip = "All";
  if (activeGenre) currentChip = activeGenre;
  else if (activeSort === "top-rated") currentChip = "Top rated";
  else if (activeSort === "new-releases") currentChip = "New releases";
  else if (activeShelf === "trending" || activeShelf === "trending-carousel") currentChip = "Trending";
  else if (activeShelf === "hot-updates") currentChip = "Hot updates";
  else if (activeShelf === "top-rated") currentChip = "Top rated";
  else if (activeShelf === "popular") currentChip = "Popular";
  else if (activeShelf === "recently-added") currentChip = "Recently added";
  else if (activeType === "Manwha") currentChip = "Manwha";
  else if (activeType === "Manhua") currentChip = "Manhua";

  function onSelect(chip: string) {
    if (chip === "All") {
      router.push(resolvedBasePath);
      return;
    }

    if (isManga) {
      if (chip === "Trending") {
        router.push(`${resolvedBasePath}?shelf=trending`);
      } else if (chip === "Hot updates") {
        router.push(`${resolvedBasePath}?shelf=hot-updates`);
      } else if (chip === "Top rated") {
        router.push(`${resolvedBasePath}?shelf=top-rated`);
      } else if (chip === "Popular") {
        router.push(`${resolvedBasePath}?shelf=popular`);
      } else if (chip === "Recently added") {
        router.push(`${resolvedBasePath}?shelf=recently-added`);
      } else if (chip === "Manwha") {
        router.push(`${resolvedBasePath}?type=Manwha`);
      } else if (chip === "Manhua") {
        router.push(`${resolvedBasePath}?type=Manhua`);
      } else {
        router.push(`${resolvedBasePath}?genre=${encodeURIComponent(chip)}`);
      }
    } else {
      if (chip === "Top rated") {
        router.push("/?sort=top-rated");
      } else if (chip === "New releases") {
        router.push("/?sort=new-releases");
      } else {
        router.push(`/?genre=${encodeURIComponent(chip)}`);
      }
    }
  }

  return (
    <div className="yt-filter-bar" role="tablist" aria-label="Topic filters">
      {resolvedChips.map((chip) => {
        const isActive = currentChip.toLowerCase() === chip.toLowerCase();
        return (
          <button
            key={chip}
            type="button"
            className={`yt-pill ${isActive ? "is-active" : ""}`}
            onClick={() => onSelect(chip)}
            role="tab"
            aria-selected={isActive}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

