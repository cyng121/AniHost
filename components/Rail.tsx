import { Card } from "./Card";
import { RailScroller } from "./RailScroller";
import type { ZoroCard } from "@/lib/types";

/** A horizontal shelf. Renders nothing at all when the provider gave us nothing. */
export function Rail({
  eyebrow,
  title,
  items,
}: {
  eyebrow?: string;
  title: string;
  items?: ZoroCard[];
}) {
  const list = (items ?? []).filter((i) => i?.slug);
  if (!list.length) return null;

  return (
    <RailScroller eyebrow={eyebrow} title={title} totalCount={list.length}>
      {list.map((item) => (
        <Card key={`${item.slug}-${item.rank ?? item.number ?? ""}`} item={item} />
      ))}
    </RailScroller>
  );
}
