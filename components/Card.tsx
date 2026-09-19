import Link from "next/link";
import type { ZoroCard } from "@/lib/types";
import { SaveButton } from "@/components/SaveButton";
import { ArtworkImage } from "@/components/ArtworkImage";

/**
 * Poster tile.
 *
 * Two corners carry information, and only when it is actually known:
 *
 *   top-right     how many episodes exist
 *   bottom-left   which tracks the release ships (SUB / DUB) and its quality
 *
 * Nothing here is inferred. The providers name the episode count three
 * different ways depending on which shelf a card came from, and one of them
 * (`totalEpisodes` on new-episode cards) is reported as 0 while the show
 * plainly has 21 — so a value is only shown once it survives episodeCount().
 * Card payloads carry no rating at all, which is why no star appears here.
 */
export function Card({ item }: { item: ZoroCard }) {
  const sub = item.subCount ?? null;
  const dub = item.dubCount ?? null;
  const episodes = episodeCount(item);
  const quality = item.quality && item.quality !== "?" ? item.quality : null;
  const meta = [item.type, item.duration].filter((v) => v && v !== "?" && v !== "").join(" · ");
  const href = `/anime/${encodeURIComponent(item.slug)}`;

  return (
    <article className="card">
      <span className="card__frame">
        <Link className="card__artLink" href={href} aria-label={item.title}>
          <ArtworkImage
            src={item.image}
            alt={item.title}
            sizes="(max-width: 760px) 150px, (min-width: 1400px) 210px, 168px"
          />

          {episodes ? (
            <span className="card__eps tnum" title={`${episodes} episodes`}>
              {episodes}
              <i>ep</i>
            </span>
          ) : null}

          <span className="card__tags">
            {sub ? <span className="tag tag--sub">SUB</span> : null}
            {dub ? <span className="tag tag--dub">DUB</span> : null}
            {quality ? <span className="tag tag--q">{quality}</span> : null}
          </span>
        </Link>

        <SaveButton
          variant="icon"
          slug={item.slug}
          title={item.title}
          image={item.image}
          type="anime"
          quality={quality ?? undefined}
        />
      </span>
      <Link className="card__textLink" href={href}>
        <span className="card__t">{item.title}</span>
        {meta ? <span className="card__m">{meta}</span> : null}
      </Link>
    </article>
  );
}

/**
 * The largest count the provider actually vouches for, or null.
 *
 * `episodes` appears on ranked shelves, `totalEpisodes` on recently-added,
 * and neither on trending. Zero means "not reported", never "no episodes",
 * so it is discarded rather than displayed.
 */
function episodeCount(item: ZoroCard): number | null {
  const candidates = [item.episodes, item.totalEpisodes, item.subCount, item.dubCount];
  const known = candidates
    .map((v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0))
    .filter((v) => v > 0);
  return known.length ? Math.max(...known) : null;
}
