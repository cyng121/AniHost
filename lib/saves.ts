"use client";

/**
 * Watch Later & Saves manager.
 * Stores saved anime and manga bookmarks device-locally in localStorage,
 * and emits events for real-time reactivity across components and tabs.
 */

const KEY = "anighost-saves";
const MAX_ENTRIES = 500;

export interface SavedItem {
  id: string; // slug or id
  slug: string;
  title: string;
  image?: string;
  type: "anime" | "manga";
  rating?: string;
  quality?: string;
  totalEpisodesOrChapters?: string;
  savedAt: number;
}

type Store = Record<string, SavedItem>;

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
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(store)
      .sort((a, b) => b[1].savedAt - a[1].savedAt)
      .slice(0, MAX_ENTRIES);
    const obj = Object.fromEntries(entries);
    window.localStorage.setItem(KEY, JSON.stringify(obj));
    window.dispatchEvent(new CustomEvent("anighost-saves", { detail: Object.values(obj) }));
  } catch {
    /* quota or private mode */
  }
}

export function listSaves(): SavedItem[] {
  return Object.values(read()).sort((a, b) => b.savedAt - a.savedAt);
}

export function isSaved(slug: string, type: "anime" | "manga" = "anime"): boolean {
  const store = read();
  const key = `${type}:${slug}`;
  return Boolean(store[key] || store[slug]);
}

export function toggleSave(item: Omit<SavedItem, "savedAt">): boolean {
  const store = read();
  const key = `${item.type}:${item.slug}`;
  if (store[key] || store[item.slug]) {
    delete store[key];
    delete store[item.slug];
    write(store);
    return false;
  } else {
    store[key] = {
      ...item,
      id: item.slug,
      savedAt: Date.now(),
    };
    write(store);
    return true;
  }
}

export function removeSave(slug: string, type: "anime" | "manga" = "anime") {
  const store = read();
  const key = `${type}:${slug}`;
  delete store[key];
  delete store[slug];
  write(store);
}

export function clearSaves() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("anighost-saves", { detail: [] }));
  } catch {
    /* ignore */
  }
}

export function onSavesChange(fn: (saves: SavedItem[]) => void): () => void {
  const local = (e: Event) => fn((e as CustomEvent<SavedItem[]>).detail ?? listSaves());
  const cross = (e: StorageEvent) => {
    if (e.key === KEY) fn(listSaves());
  };
  window.addEventListener("anighost-saves", local);
  window.addEventListener("storage", cross);
  return () => {
    window.removeEventListener("anighost-saves", local);
    window.removeEventListener("storage", cross);
  };
}
