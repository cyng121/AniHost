"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

type RailNavigation = {
  hasOverflow: boolean;
  canGoBackward: boolean;
  canGoForward: boolean;
};

const EDGE_TOLERANCE = 2;

/**
 * Keeps media shelves native-scrollable while adding an intentional desktop
 * paging affordance. The cards themselves remain server-rendered children.
 */
export function RailScroller({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  totalCount?: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const headingId = useId();
  const railId = useId();
  const [navigation, setNavigation] = useState<RailNavigation>({
    hasOverflow: false,
    canGoBackward: false,
    canGoForward: false,
  });

  const syncNavigation = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const maxScrollLeft = Math.max(rail.scrollWidth - rail.clientWidth, 0);
    const next = {
      hasOverflow: maxScrollLeft > EDGE_TOLERANCE,
      canGoBackward: rail.scrollLeft > EDGE_TOLERANCE,
      canGoForward: rail.scrollLeft < maxScrollLeft - EDGE_TOLERANCE,
    };

    setNavigation((current) => (
      current.hasOverflow === next.hasOverflow
      && current.canGoBackward === next.canGoBackward
      && current.canGoForward === next.canGoForward
        ? current
        : next
    ));
  }, []);

  const scheduleNavigationSync = useCallback(() => {
    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      syncNavigation();
    });
  }, [syncNavigation]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    syncNavigation();

    const handleScroll = () => {
      scheduleNavigationSync();
    };

    const handleResize = () => {
      syncNavigation();
    };

    rail.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
        syncNavigation();
      })
      : null;

    resizeObserver?.observe(rail);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      rail.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [scheduleNavigationSync, syncNavigation]);

  const [isInteracting, setIsInteracting] = useState(false);

  const moveRail = useCallback((direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;

    const maxScrollLeft = Math.max(rail.scrollWidth - rail.clientWidth, 0);
    if (maxScrollLeft <= 0) return;

    // If at the end and moving forward, loop smoothly back to start
    if (direction === 1 && rail.scrollLeft >= maxScrollLeft - EDGE_TOLERANCE - 8) {
      rail.scrollTo({
        left: 0,
        behavior: "smooth",
      });
      return;
    }

    const firstCard = rail.firstElementChild;
    const cardWidth = firstCard instanceof HTMLElement ? firstCard.getBoundingClientRect().width : 0;
    const gap = Number.parseFloat(window.getComputedStyle(rail).gap) || 0;
    const cardStep = cardWidth + gap;
    const viewportStep = rail.clientWidth * 0.72;
    const distance = cardStep > 0
      ? Math.max(cardStep, Math.min(viewportStep, cardStep * 3))
      : viewportStep;
    const prefersReducedMotion = document.documentElement.hasAttribute("data-reduce-motion")
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    rail.scrollBy({
      left: direction * distance,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, []);

  // Auto-scroll forward every 3.5 seconds unless user is interacting/hovering
  useEffect(() => {
    if (isInteracting || !navigation.hasOverflow) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      moveRail(1);
    }, 3500);

    return () => window.clearInterval(interval);
  }, [isInteracting, navigation.hasOverflow, moveRail]);

  return (
    <section
      className="section"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={() => setIsInteracting(false)}
      onTouchStart={() => setIsInteracting(true)}
      onTouchEnd={() => setIsInteracting(false)}
    >
      <div className="section__head">
        <div>
          <span className="cap">{eyebrow}</span>
          <h2 id={headingId}>{title}</h2>
        </div>

        {navigation.hasOverflow ? (
          <div className="section__act rail__controls" role="group" aria-label={`${title} navigation`}>
            <button
              className="icon-btn rail__control"
              type="button"
              aria-label={`Scroll ${title} backward`}
              aria-controls={railId}
              disabled={!navigation.canGoBackward}
              onClick={() => moveRail(-1)}
            >
              <Chevron direction="left" />
            </button>
            <button
              className="icon-btn rail__control"
              type="button"
              aria-label={`Scroll ${title} forward`}
              aria-controls={railId}
              disabled={!navigation.canGoForward}
              onClick={() => moveRail(1)}
            >
              <Chevron direction="right" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={railRef}
        id={railId}
        className="rail rail--controlled"
        role="region"
        aria-labelledby={headingId}
      >
        {children}
      </div>
    </section>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "m14.5 4.5-7.5 7.5 7.5 7.5" : "m9.5 4.5 7.5 7.5-7.5 7.5";

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
