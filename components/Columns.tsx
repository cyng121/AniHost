import Link from "next/link";
import type { ZoroSidebarColumn } from "@/lib/types";

/** The four narrow lists the provider ships alongside the home page. */
export function Columns({ columns }: { columns: Record<string, ZoroSidebarColumn> }) {
  const cols = Object.entries(columns).filter(([, c]) => c?.items?.length);
  if (!cols.length) return null;

  return (
    <section className="section" id="lists">
      <div className="section__head">
        <div>
          <span className="cap">At a glance</span>
          <h2>Where everyone is</h2>
        </div>
      </div>
      <div className="cols">
        {cols.map(([key, col]) => (
          <div className="col" key={key}>
            <h3 className="col__h">{col.title || key}</h3>
            <ol className="col__list">
              {(col.items ?? []).slice(0, 5).map((item, n) => (
                <li key={item.slug}>
                  <Link className="col__row" href={`/anime/${encodeURIComponent(item.slug)}`} tabIndex={0}>
                    <span className="col__n tnum">{n + 1}</span>
                    <span className="col__art">
                      {item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : null}
                    </span>
                    <span className="col__body">
                      <span className="col__t">{item.title}</span>
                      <span className="col__m tnum">
                        {[item.type, item.subCount ? `${item.subCount} sub` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
