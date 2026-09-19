"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";

type Status = "idle" | "loading" | "done";

/**
 * Top bar horizontal loader for all on-page changes.
 *
 * Catches link clicks, programmatic router.push / router.replace,
 * browser back/forward history navigation, and search parameter transitions.
 * Provides a smooth, realistic trickle animation with an ultra-high z-index
 * and glowing leading edge peg.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);

  const trickleTimer = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);
  const safetyTimer = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  const clearAllTimers = useCallback(() => {
    if (trickleTimer.current) {
      window.clearInterval(trickleTimer.current);
      trickleTimer.current = null;
    }
    if (resetTimer.current) {
      window.clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    if (safetyTimer.current) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    // Defer state update so it never executes synchronously inside React 19's useInsertionEffect
    setTimeout(() => {
      clearAllTimers();
      setStatus("loading");
      setProgress((prev) => (prev > 0 && prev < 90 ? prev : 15));

      trickleTimer.current = window.setInterval(() => {
        setProgress((cur) => {
          if (cur >= 92) return cur;
          const remaining = 92 - cur;
          // Natural decelerating trickle: larger steps at start, smaller as it approaches 92%
          const step = Math.max(0.6, remaining * 0.12);
          return Math.min(92, cur + step);
        });
      }, 200);

      // Safety timeout in case navigation is cancelled or stalls
      safetyTimer.current = window.setTimeout(() => {
        clearAllTimers();
        setProgress(100);
        setStatus("done");
        resetTimer.current = window.setTimeout(() => {
          setStatus("idle");
          setProgress(0);
        }, 450);
      }, 9000);
    }, 0);
  }, [clearAllTimers]);

  const done = useCallback(() => {
    setTimeout(() => {
      clearAllTimers();
      setProgress(100);
      setStatus("done");

      resetTimer.current = window.setTimeout(() => {
        setStatus("idle");
        setProgress(0);
      }, 450);
    }, 0);
  }, [clearAllTimers]);

  // When pathname or search params update, the transition has arrived
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    done();
  }, [pathname, searchParams, done]);

  // Intercept all user interactions and history navigations
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("javascript:") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return;
      }

      try {
        const dest = new URL(anchor.href, window.location.href);
        const cur = new URL(window.location.href);
        if (dest.origin !== cur.origin) return;
        // Same route and query, differing only by hash anchor
        if (dest.pathname === cur.pathname && dest.search === cur.search && dest.hash !== cur.hash) {
          return;
        }
        if (dest.href === cur.href) return;

        start();
      } catch {
        // Ignore invalid URLs
      }
    };

    // Monitor programmatic pushState & replaceState (router.push / router.replace)
    const checkStateUrl = (url?: string | URL | null) => {
      if (!url) return;
      try {
        const dest = new URL(String(url), window.location.href);
        const cur = new URL(window.location.href);
        if (dest.origin !== cur.origin) return;
        if (dest.pathname === cur.pathname && dest.search === cur.search && dest.hash === cur.hash) {
          return;
        }
        setTimeout(() => start(), 0);
      } catch {
        setTimeout(() => start(), 0);
      }
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function (...args: Parameters<typeof window.history.pushState>) {
      checkStateUrl(args[2]);
      return originalPushState(...args);
    };

    window.history.replaceState = function (...args: Parameters<typeof window.history.replaceState>) {
      checkStateUrl(args[2]);
      return originalReplaceState(...args);
    };

    const onPopState = () => {
      start();
    };

    const onCustomStart = () => start();
    const onCustomDone = () => done();

    document.addEventListener("click", handleAnchorClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("anighost:nav-start", onCustomStart);
    window.addEventListener("anighost:nav-done", onCustomDone);

    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("anighost:route-start", onCustomStart);
      window.removeEventListener("anighost:route-done", onCustomDone);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      clearAllTimers();
    };
  }, [start, done, clearAllTimers]);

  if (status === "idle" && progress === 0) return null;

  return (
    <div
      className={`routebar ${status === "loading" ? "is-loading" : ""} ${status === "done" ? "is-done" : ""}`}
      role="progressbar"
      aria-label="Loading page"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="routebar__fill"
        style={{
          transform: `scaleX(${progress / 100})`,
        }}
      >
        <div className="routebar__peg" />
      </div>
    </div>
  );
}
