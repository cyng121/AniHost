"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  SEARCH_SCOPES,
  resultHref,
  scopeLabel,
  searchHref,
  suggestEndpoint,
  type SearchScope,
} from "@/lib/search-scope";
import { ArtworkImage } from "./ArtworkImage";

/**
 * Suggestions under the search box.
 *
 * A layer, not a page: it floats over whatever you were reading and never
 * replaces it, so glancing at a few matches costs nothing. It scrolls inside
 * itself — `overscroll-behavior: contain` in the stylesheet stops a flick at
 * the end of the list from dragging the page behind it.
 *
 * Results come through /api/ag, which is the only way the browser can reach
 * the catalogue: apiflix rejects any request whose Origin is not allowlisted.
 *
 * Anime and manga come from different providers with different response
 * shapes. Both are normalised here into one `Suggestion`, so the panel below
 * renders a row the same way regardless of which one answered.
 */

export interface Suggestion {
  /** Provider id — a slug for anime, an opaque id for manga. */
  id: string;
  title: string;
  image?: string;
  /** The line under the title: episode counts for anime, format for manga. */
  meta?: string;
}

const DEBOUNCE_MS = 80;
const MAX = 6;
const suggestCache = new Map<string, Suggestion[]>();

interface ZoroItem {
  slug?: string;
  title?: string;
  image?: string;
  type?: string;
  subCount?: number | null;
  dubCount?: number | null;
}

interface AtsuItem {
  id?: string;
  title?: string;
  thumbnail?: string;
  images?: { small?: string; medium?: string; large?: string };
  type?: string;
  isAdult?: boolean;
}

function normalise(data: unknown, scope: SearchScope): Suggestion[] {
  if (scope === "manga") {
    const rows = (data as { data?: unknown })?.data ?? data;
    if (!Array.isArray(rows)) return [];
    return (rows as AtsuItem[])
      .filter((m) => m?.id && m?.title && !m.isAdult)
      .map((m) => ({
        id: String(m.id),
        title: String(m.title),
        image: m.images?.medium ?? m.images?.large ?? m.images?.small ?? m.thumbnail,
        meta: m.type,
      }));
  }

  if (!data || typeof data !== "object") return [];

  // /zoro/search/suggest returns { items: ZoroItem[] } or { results: ZoroItem[] }
  const rawList =
    "items" in data && Array.isArray((data as { items: unknown }).items)
      ? ((data as { items: unknown[] }).items as ZoroItem[])
      : "results" in data && Array.isArray((data as { results: unknown }).results)
        ? ((data as { results: unknown[] }).results as ZoroItem[])
        : Array.isArray(data)
          ? (data as ZoroItem[])
          : [];

  return rawList
    .filter((item): item is ZoroItem & { title: string } => Boolean(item && item.title))
    .map((item) => ({
      id: item.slug || "",
      title: item.title,
      image: item.image,
      meta: [
        item.type,
        item.subCount ? `${item.subCount} sub` : null,
        item.dubCount ? `${item.dubCount} dub` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}

export function useSuggestions(query: string, enabled: boolean, scope: SearchScope) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (!enabled || term.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${scope}:${term.toLowerCase()}`;
    const cached = suggestCache.get(cacheKey);

    // Instant 0ms cache hit
    if (cached) {
      setItems(cached);
      setLoading(false);
      return;
    }

    // Check if we have a shorter prefix cached to display immediately while fetching
    for (let len = term.length - 1; len >= 2; len--) {
      const prefixKey = `${scope}:${term.slice(0, len).toLowerCase()}`;
      const prefixCached = suggestCache.get(prefixKey);
      if (prefixCached?.length) {
        const filtered = prefixCached.filter((it: Suggestion) =>
          it.title.toLowerCase().includes(term.toLowerCase())
        );
        if (filtered.length) {
          setItems(filtered.slice(0, MAX));
          break;
        }
      }
    }

    const mine = ++seq.current;
    const controller = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(suggestEndpoint(term, scope), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(String(res.status));
        const data: unknown = await res.json();
        if (seq.current !== mine) return;
        const normalised = normalise(data, scope).slice(0, MAX);
        suggestCache.set(cacheKey, normalised);
        setItems(normalised);
      } catch {
        // An aborted or failed lookup simply retains prefix or clears
        if (seq.current === mine && !suggestCache.has(cacheKey)) {
          // retain any existing matches or empty
        }
      } finally {
        if (seq.current === mine) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled, scope]);

  return { items, loading };
}

/** Anime | Manga, at the top of the layer. */
function ScopeSwitch({
  scope,
  onScope,
}: {
  scope: SearchScope;
  onScope: (next: SearchScope) => void;
}) {
  return (
    <div className="suggest__scope" role="group" aria-label="Search in">
      {SEARCH_SCOPES.map((option) => (
        <button
          key={option}
          type="button"
          className={option === scope ? "suggest__scopeBtn is-on" : "suggest__scopeBtn"}
          aria-pressed={option === scope}
          onClick={() => onScope(option)}
        >
          {scopeLabel(option)}
        </button>
      ))}
    </div>
  );
}

export function SuggestPanel({
  items,
  loading,
  query,
  scope,
  onScope,
  active,
  onHover,
  onPick,
  hideScope = false,
}: {
  items: Suggestion[];
  loading: boolean;
  query: string;
  scope: SearchScope;
  onScope: (next: SearchScope) => void;
  active: number;
  onHover: (index: number) => void;
  onPick: () => void;
  hideScope?: boolean;
}) {
  const term = query.trim();
  const noun = scope === "manga" ? "manga" : "anime";
  if (term.length < 2) return null;

  if (!loading && !items.length) {
    return (
      <div className="suggest" aria-label="Suggestions">
        {!hideScope && <ScopeSwitch scope={scope} onScope={onScope} />}
        <p className="suggest__empty">
          No {noun} matches “{term}”.
        </p>
      </div>
    );
  }

  return (
    <div className="suggest" aria-label="Suggestions">
      {!hideScope && <ScopeSwitch scope={scope} onScope={onScope} />}

      {loading && !items.length ? (
        <div className="suggest__loading" aria-hidden>
          {[0, 1, 2].map((n) => (
            <span className="suggest__ghost" key={n}>
              <i className="skeleton" />
              <b className="skeleton" />
            </span>
          ))}
        </div>
      ) : null}

      <div id="search-suggest" role="listbox" aria-label={`${scopeLabel(scope)} suggestions`}>
        {items.map((item, n) => (
        <Link
          key={item.id}
          className={n === active ? "suggest__row is-active" : "suggest__row"}
          href={resultHref(item.id, scope)}
          role="option"
          aria-selected={n === active}
          onMouseEnter={() => onHover(n)}
          onClick={onPick}
        >
          <span className="suggest__art">
            <ArtworkImage src={item.image} alt="" sizes="40px" />
          </span>
          <span className="suggest__body">
            <span className="suggest__t">{item.title}</span>
            {item.meta ? <span className="suggest__m tnum">{item.meta}</span> : null}
          </span>
        </Link>
      ))}
      </div>

      {items.length ? (
        <Link className="suggest__all" href={searchHref(term, scope)} onClick={onPick}>
          See every {noun} for “{term}”
        </Link>
      ) : null}
    </div>
  );
}
