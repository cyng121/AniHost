export const runtime = "edge";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/browse",
    name: "Ani Ghost",
    short_name: "Ani Ghost",
    description: "Pick up your anime anywhere — on desktop, mobile, or TV.",
    start_url: "/browse",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#0a0912",
    theme_color: "#0a0912",
    categories: ["entertainment", "video"],
    shortcuts: [
      { name: "Search", short_name: "Search", url: "/search" },
      { name: "Saved", short_name: "Saved", url: "/saves" },
      { name: "Schedule", short_name: "Schedule", url: "/schedule" },
      { name: "TV mode", short_name: "TV", url: "/browse?mode=tv" },
    ],
    icons: [
      {
        src: "/brand/ani-ghost-compact.png",
        sizes: "2048x2048",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/ani-ghost-compact.png",
        sizes: "2048x2048",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
