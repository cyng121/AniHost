import Link from "next/link";
import type { ZoroCard } from "@/lib/types";

interface YouTubeVideoCardProps {
  item: ZoroCard;
  backdrop?: string | null;
  channelName?: string;
  badge?: string;
}

export function YouTubeVideoCard({
  item,
  backdrop,
  channelName,
  badge,
}: YouTubeVideoCardProps) {
  const thumbSrc = backdrop || item.bannerImage || item.image || "/fallback-backdrop.jpg";
  const avatarSrc = item.image || "/avatar-fallback.jpg";
  const epBadge =
    badge ||
    (item.score ? `${item.score}% ★` : item.episodeNumber ? `${item.episodeNumber} eps` : item.totalEpisodes ? `${item.totalEpisodes} eps` : "HD");
  const channel = channelName || item.studio || item.type || "Anime Studio";

  return (
    <div className="yt-card">
      <Link href={`/anime/${encodeURIComponent(item.slug)}`} className="yt-card__thumb-box">
        <img
          src={thumbSrc}
          alt={item.title}
          className="yt-card__thumb"
          loading="lazy"
          decoding="async"
        />
        <span className="yt-card__badge">{epBadge}</span>
      </Link>

      <div className="yt-card__meta-row">
        <Link href={`/anime/${encodeURIComponent(item.slug)}`} aria-hidden="true" tabIndex={-1}>
          <img
            src={avatarSrc}
            alt=""
            className="yt-card__avatar"
            loading="lazy"
          />
        </Link>

        <div className="yt-card__info">
          <Link href={`/anime/${encodeURIComponent(item.slug)}`} style={{ textDecoration: "none" }}>
            <h3 className="yt-card__title" title={item.title}>
              {item.title}
            </h3>
          </Link>

          <Link href={`/anime/${encodeURIComponent(item.slug)}`} className="yt-card__channel">
            {channel}
          </Link>
        </div>
      </div>
    </div>
  );
}
