import Link from "next/link";
import { mangaCover, type MangaCard as Card } from "@/lib/manga";
import { SaveButton } from "@/components/SaveButton";
import { RailScroller } from "./RailScroller";

/** Poster tile for a manga. Same silhouette as the anime card, on purpose. */
export function MangaCard({ item }: { item: Card }) {
  const cover = mangaCover(item);
  return (
    <Link className="card card--manga card--sharp" href={`/manga/${encodeURIComponent(item.id)}`} tabIndex={0}>
      <span className="card__frame card__frame--sharp">
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden style={{ position: "absolute", inset: 0, background: "var(--ink-150)", borderRadius: 0 }} />
        )}
        <SaveButton
          variant="icon"
          slug={item.id}
          title={item.title}
          image={cover}
          type="manga"
        />
        {item.type ? (
          <span className="card__tags">
            <span className="tag tag--q">{item.type}</span>
          </span>
        ) : null}
      </span>
      <span className="card__t">{item.title}</span>
    </Link>
  );
}

/** A horizontal shelf. Renders nothing when the provider gave us nothing. */
export function MangaRail({
  eyebrow,
  title,
  items,
}: {
  eyebrow?: string;
  title: string;
  items?: Card[];
}) {
  const list = (items ?? []).filter((i) => i?.id);
  if (!list.length) return null;

  return (
    <RailScroller eyebrow={eyebrow} title={title} totalCount={list.length}>
      {list.map((item) => (
        <MangaCard key={item.id} item={item} />
      ))}
    </RailScroller>
  );
}
