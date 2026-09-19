"use client";

/**
 * Watch progress lives in localStorage and stays synced across tabs & components.
 */

const KEY = "anighost-progress";
const EVENT = "anighost-progress";
const MAX_ENTRIES = 400;

export interface Progress {
  slug: string;
  title: string;
  image?: string;
  episode: number;
  /** Seconds into the episode. */
  time: number;
  duration: number;
  audio: "sub" | "dub";
  updated: number;
}

type Store = Record<string, Progress>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    const entries = Object.entries(store)
      .sort((a, b) => b[1].updated - a[1].updated)
      .slice(0, MAX_ENTRIES);
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* quota or private mode fallback */
  }
}

export function getProgress(slug: string): Progress | null {
  return read()[slug] ?? null;
}

export function listProgress(): Progress[] {
  return Object.values(read()).sort((a, b) => b.updated - a.updated);
}

export function saveProgress(p: Omit<Progress, "updated">) {
  if (!p.slug) return;
  const store = read();
  const existing = store[p.slug];

  let time = p.time;
  let duration = p.duration;

  // Protect against resetting saved progress on initial page mount when startAt is 0
  if (existing && existing.episode === p.episode) {
    if ((!Number.isFinite(time) || time === 0) && existing.time > 0) {
      time = existing.time;
    }
    if ((!Number.isFinite(duration) || duration === 0) && existing.duration > 0) {
      duration = existing.duration;
    }
  }

  store[p.slug] = {
    slug: p.slug,
    title: p.title || existing?.title || "",
    image: p.image || existing?.image,
    episode: p.episode,
    time: Number.isFinite(time) ? Math.max(0, time) : 0,
    duration: Number.isFinite(duration) ? Math.max(0, duration) : 0,
    audio: p.audio,
    updated: Date.now(),
  };
  write(store);
}

export function clearProgress(slug: string) {
  const store = read();
  delete store[slug];
  write(store);
}

/** An episode counts as finished once you are within 45s of the end. */
export function isFinished(p: Progress): boolean {
  return p.duration > 0 && p.time >= p.duration - 45;
}

/** Reactively listen for progress updates */
export function onProgressChange(callback: (list: Progress[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback(listProgress());
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
