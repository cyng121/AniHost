"use client";

import { useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// TV shelves contain desktop conveniences that would otherwise create two or
// three remote stops for one title. Keep one clear entry point per card.
const TV_SKIP = ".hero__dot, .card__textLink, .card .save-icon-btn";

type Direction = "left" | "right" | "up" | "down";

/**
 * Remote-first navigation for Smart TVs. Directional keys choose the nearest
 * visible control in that direction, so focus follows the screen's geometry
 * instead of fragile DOM-order assumptions.
 */
export function TVNavigationManager() {
  useEffect(() => {
    const isTv = detectTv();
    if (!isTv) return;

    document.documentElement.setAttribute("data-tv", "true");

    const focusInitial = window.setTimeout(() => {
      const preferred = document.querySelector<HTMLElement>("[data-tv-autofocus]");
      (preferred ?? visibleFocusables()[0])?.focus({ preventScroll: true });
    }, 500);

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches(FOCUSABLE)) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.requestAnimationFrame(() => {
        target.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: reduceMotion ? "auto" : "smooth",
        });
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const isInput =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active?.isContentEditable;
      const key = event.key.toLowerCase();

      const direction = directionForKey(key);
      if (direction && !isInput) {
        const next = findDirectionalTarget(active, direction);
        if (next) {
          event.preventDefault();
          next.focus();
        }
        return;
      }

      if (key === "backspace" || key === "browserback" || key === "escape" || event.keyCode === 10009) {
        if (document.fullscreenElement) {
          event.preventDefault();
          void document.exitFullscreen?.();
          return;
        }
        if (!isInput && window.location.pathname !== "/browse" && window.location.pathname !== "/") {
          event.preventDefault();
          window.history.back();
        }
        return;
      }

      const video = document.querySelector("video");
      if (!video) return;

      if (key === "mediaplay" || key === "mediapause" || key === "mediaplaypause") {
        event.preventDefault();
        if (video.paused) void video.play();
        else video.pause();
      } else if (key === "mediafastforward" || key === "mediatracknext") {
        event.preventDefault();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
      } else if (key === "mediarewind" || key === "mediatrackprevious") {
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusInitial);
      document.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}

function detectTv(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  return (
    new URLSearchParams(window.location.search).get("mode") === "tv" ||
    /smart-tv|smarttv|appletv|googletv|android.*tv|tizen|webos|hbbtv|roku|firetv|aft\w*|viera|bravia|netcast|crkey/i.test(ua) ||
    (window.innerWidth >= 1000 && window.matchMedia("(hover: none) and (pointer: coarse)").matches)
  );
}

function directionForKey(key: string): Direction | null {
  if (key === "arrowleft") return "left";
  if (key === "arrowright") return "right";
  if (key === "arrowup") return "up";
  if (key === "arrowdown") return "down";
  return null;
}

function visibleFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      !element.closest("[inert], [aria-hidden='true']")
      && !element.matches(TV_SKIP)
    );
  });
}

function findDirectionalTarget(current: HTMLElement | null, direction: Direction): HTMLElement | null {
  const candidates = visibleFocusables();
  if (!candidates.length) return null;
  if (!current || !candidates.includes(current)) return candidates[0];

  const origin = current.getBoundingClientRect();
  const originX = origin.left + origin.width / 2;
  const originY = origin.top + origin.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate === current) continue;
    const rect = candidate.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - originX;
    const dy = rect.top + rect.height / 2 - originY;
    const forward = direction === "right" ? dx : direction === "left" ? -dx : direction === "down" ? dy : -dy;
    if (forward <= 6) continue;

    const crossAxis = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = forward + crossAxis * 4.5 + Math.hypot(dx, dy) * 0.15;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}
