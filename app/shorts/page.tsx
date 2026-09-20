export const runtime = "edge";
import type { Metadata } from "next";
import { ShortsPlayer, type AnimeShortItem } from "@/components/ShortsPlayer";
import { fetchAniCoreShorts } from "@/lib/anicore-trailers";

export const metadata: Metadata = {
  title: "Shorts",
  description: "Watch official anime trailers in vertical shorts format.",
};

export default async function ShortsPage() {
  // Fetch live official anime trailers exclusively from AniCore
  let shorts: AnimeShortItem[] = [];
  try {
    shorts = await fetchAniCoreShorts({ randomPages: true });
    // Retry once with page 1 if initial random batch returned empty
    if (shorts.length === 0) {
      shorts = await fetchAniCoreShorts({ randomPages: false });
    }
  } catch (err) {
    console.warn("[shorts] AniCore trailers fetch failed:", err);
    shorts = [];
  }

  return <ShortsPlayer shorts={shorts} />;
}
