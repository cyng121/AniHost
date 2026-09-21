"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { YouTubeVideoCard } from "./YouTubeVideoCard";
import type { ZoroCard } from "@/lib/types";

interface InfiniteVideoGridProps {
  initialItems: ZoroCard[];
  initialHasNextPage: boolean;
  initialPage?: number;
  genre?: string;
  sort?: string;
  format?: string;
  status?: string;
  search?: string;
  title?: string;
}

function YouTubeCardSkeleton() {
  return (
    <div className="yt-card yt-card--skeleton" aria-hidden="true">
      <div className="yt-card__thumbnail-wrapper yt-skeleton-box" />
      <div className="yt-card__details" style={{ marginTop: 8 }}>
        <div className="yt-skeleton-circle" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="yt-skeleton-line" style={{ width: "80%", height: 14 }} />
          <div className="yt-skeleton-line" style={{ width: "50%", height: 11 }} />
        </div>
      </div>
    </div>
  );
}

export function InfiniteVideoGrid({
  initialItems,
  initialHasNextPage,
  initialPage,
  genre,
  sort,
  format,
  status,
  search,
  title,
}: InfiniteVideoGridProps) {
  const defaultStartingPage = initialPage ?? (initialItems.length > 0 ? 1 : 0);
  const [items, setItems] = useState<ZoroCard[]>(initialItems);
  const [page, setPage] = useState(defaultStartingPage);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if filters change
  useEffect(() => {
    const startingPage = initialPage ?? (initialItems.length > 0 ? 1 : 0);
    setItems(initialItems);
    setPage(startingPage);
    setHasNextPage(initialHasNextPage);
    setIsLoading(false);
    setError(null);
  }, [initialItems, initialHasNextPage, initialPage, genre, sort, format, status, search]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasNextPage) return;
    setIsLoading(true);
    setError(null);

    const nextPage = page + 1;
    try {
      const params = new URLSearchParams({
        type: "category",
        page: String(nextPage),
        perPage: "24",
      });
      if (genre) params.set("genre", genre);
      if (sort) params.set("sort", sort);
      if (format) params.set("format", format);
      if (status) params.set("status", status);
      if (search) params.set("search", search);

      const res = await fetch(`/api/anilist?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load page ${nextPage}`);
      }
      const data = await res.json();
      const newItems: ZoroCard[] = data.items || [];
      const hasMore: boolean = Boolean(data.pageInfo?.hasNextPage);

      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.slug));
        const filtered = newItems.filter((i) => !seen.has(i.slug));
        return [...prev, ...filtered];
      });
      setPage(nextPage);
      setHasNextPage(hasMore);
    } catch (err: any) {
      setError(err?.message || "Failed to load more anime");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasNextPage, page, genre, sort, format, status, search]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && !isLoading && hasNextPage) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, isLoading, hasNextPage]);

  return (
    <div className="yt-infinite-container">
      {title && <h2 className="yt-section-title">{title}</h2>}

      <div className="yt-grid">
        {items.map((item) => (
          <YouTubeVideoCard key={item.slug} item={item} />
        ))}

        {isLoading && (
          <>
            <YouTubeCardSkeleton />
            <YouTubeCardSkeleton />
            <YouTubeCardSkeleton />
            <YouTubeCardSkeleton />
            <YouTubeCardSkeleton />
            <YouTubeCardSkeleton />
          </>
        )}
      </div>

      {/* Sentinel for IntersectionObserver */}
      <div ref={sentinelRef} style={{ height: "1px", width: "100%" }} />

      {error && (
        <div className="yt-infinite-status">
          <p className="yt-infinite-msg">{error}</p>
          <button
            type="button"
            onClick={() => loadMore()}
            className="btn btn--ghost btn--sm"
          >
            Retry
          </button>
        </div>
      )}

      {!hasNextPage && items.length > 0 && (
        <div className="yt-infinite-status">
          <span className="yt-infinite-msg">You&apos;ve reached the end</span>
        </div>
      )}
    </div>
  );
}
