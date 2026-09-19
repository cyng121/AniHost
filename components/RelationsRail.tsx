"use client";

import Link from "next/link";
import type { AnimeSeason } from "@/lib/relations";

export function RelationsRail({ relations }: { relations?: AnimeSeason[] }) {
  if (!relations || !relations.length) return null;

  return (
    <section className="section relations-section" id="relations">
      <div className="section__head">
        <div>
          <span className="cap">Franchise Universe</span>
          <h2>All Seasons</h2>
        </div>
      </div>

      <div className="relations__grid">
        {relations.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="relations__card card--sharp"
          >
            <div className="relations__art">
              {item.cover ? (
                <img
                  src={item.cover}
                  alt={`Cover for ${item.title}`}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="relations__artEmpty" />
              )}

              {item.score ? (
                <span className="relations__scoreBadge tnum">
                  ★ {item.score}
                </span>
              ) : null}
            </div>

            <div className="relations__body">
              <h4 className="relations__title">{item.title}</h4>
              <div className="relations__meta tnum">
                {item.format ? <span>{item.format}</span> : null}
                {item.episodes ? <span>{item.episodes} eps</span> : null}
                {item.year ? <span>{item.year}</span> : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
