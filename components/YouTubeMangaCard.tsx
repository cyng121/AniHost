import Link from "next/link";
import { mangaCover, type MangaCard as MangaItem } from "@/lib/manga";
import { SaveButton } from "@/components/SaveButton";

interface YouTubeMangaCardProps {
  item: MangaItem;
  badge?: string;
  channelName?: string;
}

export function YouTubeMangaCard({
  item,
  badge,
  channelName,
}: YouTubeMangaCardProps) {
  const cover = mangaCover(item);

  const hasAuthor = Boolean(item.authors && item.authors.length > 0);
  const authorName = hasAuthor
    ? item.authors!.map((a) => a.author || a.name).filter(Boolean).join(", ")
    : null;
  const channelDisplay =
    channelName ||
    authorName ||
    (item.latestChapter ? `Ch. ${item.latestChapter}` : item.type ? `${item.type}` : "Manga");

  const badgeText =
    badge ||
    (item.rating
      ? `★ ${typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating}`
      : item.latestChapter
      ? item.latestChapter.startsWith("Ch")
        ? item.latestChapter
        : `Ch. ${item.latestChapter}`
      : item.type?.toUpperCase() || "MANGA");

  const href = `/manga/${encodeURIComponent(item.id)}`;

  return (
    <div className="yt-rec-card yt-manga-rec-card">
      <div className="yt-rec-card__thumb-box yt-manga-rec-card__thumb-box">
        <Link href={href} style={{ display: "block", width: "100%", height: "100%", position: "relative" }}>
          {cover ? (
            <img
              src={cover}
              alt=""
              className="yt-rec-card__thumb"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="yt-manga-rec-card__placeholder">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span className="yt-manga-rec-card__placeholder-label">{item.type || "Manga"}</span>
            </div>
          )}
        </Link>
        <span className="yt-rec-card__badge">{badgeText}</span>
        <div className="yt-rec-card__quick-save">
          <SaveButton
            variant="icon"
            slug={item.id}
            title={item.title}
            image={cover}
            type="manga"
          />
        </div>
      </div>

      <div className="yt-rec-card__meta">
        <Link href={href} style={{ textDecoration: "none" }}>
          <h3 className="yt-rec-card__title" title={item.title}>
            {item.title}
          </h3>
        </Link>
        <div className="yt-rec-card__sub" title={channelDisplay}>
          {channelDisplay}
        </div>
      </div>
    </div>
  );
}
