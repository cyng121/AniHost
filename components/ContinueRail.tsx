"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearProgress, isFinished, listProgress, onProgressChange, type Progress } from "@/lib/progress";

/**
 * Reads from localStorage and updates reactively as progress changes.
 */
export function ContinueRail() {
  const [items, setItems] = useState<Progress[] | null>(null);

  useEffect(() => {
    const update = () => setItems(listProgress().filter((p) => !isFinished(p)).slice(0, 12));
    update();
    return onProgressChange(update);
  }, []);

  if (!items?.length) return null;

  return (
    <section className="section" id="continue">
      <div className="section__head">
        <div>
          <h2>Continue watching</h2>
        </div>
      </div>
      <div className="rail">
        {items.map((p) => {
          const pct = p.duration ? Math.min(100, (p.time / p.duration) * 100) : 0;
          return (
            <div className="cont" key={p.slug}>
              <Link
                className="card"
                href={`/watch/${encodeURIComponent(p.slug)}/${p.episode}?audio=${p.audio}&t=${Math.floor(p.time)}`}
              >
                <span className="card__frame">
                  {p.image ? <img src={p.image} alt="" loading="lazy" decoding="async" /> : null}
                  <span className="cont__resume" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" />
                    </svg>
                  </span>
                  <span className="cont__bar" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <span className="card__t">{p.title}</span>
                <span className="card__m tnum">
                  Episode {p.episode} · {fmtLeft(p)}
                </span>
              </Link>
              <button
                type="button"
                className="cont__x"
                aria-label={`Remove ${p.title} from continue watching`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearProgress(p.slug);
                  setItems((cur) => (cur ?? []).filter((x) => x.slug !== p.slug));
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function fmtLeft(p: Progress): string {
  const left = Math.max(0, p.duration - p.time);
  if (!p.duration) return "in progress";
  const m = Math.round(left / 60);
  return m < 1 ? "almost done" : `${m} min left`;
}
