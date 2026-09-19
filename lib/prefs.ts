"use client";

/**
 * Viewer preferences stay device-local, even when an account is connected.
 * Authentication currently protects community actions; it does not sync
 * playback settings between devices.
 */

const KEY = "anighost-prefs";

export interface Prefs {
  /** Custom display name. */
  username: string;
  /** Index into CHARACTERS in components/Avatar.tsx. */
  character: number;
  /** Which track to open an episode on. */
  audio: "sub" | "dub";
  /** Roll into the next episode when one ends. */
  autoplay: boolean;
  /** Whether openings and credits are offered ("button") or jumped ("auto"). */
  skipMode: "button" | "auto";
  /** Starting quality; "auto" lets the player choose by bandwidth. */
  quality: "auto" | "1080p" | "720p" | "480p";
  /** Device-local player volume, kept between episodes. */
  volume: number;
  /** Keep mute across an automatic episode handoff. */
  muted: boolean;
  /** Whether the player should show a supplied subtitle track. */
  captions: boolean;
  /** Last subtitle label selected on this device. */
  subtitle: string;
  /** Honour the OS reduce-motion setting even when it is off. */
  reduceMotion: boolean;
}

export const DEFAULTS: Prefs = {
  username: "",
  character: 0,
  audio: "sub",
  autoplay: true,
  skipMode: "button",
  quality: "auto",
  volume: 0.85,
  muted: false,
  captions: true,
  subtitle: "English",
  reduceMotion: false,
};

export function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    // Merge rather than trust: a stored blob from an older build may be partial.
    const merged = { ...DEFAULTS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
    return {
      ...merged,
      username: typeof merged.username === "string" ? merged.username.trim().slice(0, 32) : "",
      volume:
        typeof merged.volume === "number" && Number.isFinite(merged.volume)
          ? Math.max(0, Math.min(1, merged.volume))
          : DEFAULTS.volume,
      muted: Boolean(merged.muted),
      captions: Boolean(merged.captions),
      subtitle: typeof merged.subtitle === "string" ? merged.subtitle : DEFAULTS.subtitle,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writePrefs(next: Partial<Prefs>): Prefs {
  const merged = { ...readPrefs(), ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
    // Same-tab listeners; the storage event only fires in *other* tabs.
    window.dispatchEvent(new CustomEvent("anighost-prefs", { detail: merged }));
  } catch {
    /* private mode — preferences just do not persist */
  }
  return merged;
}

/** Subscribe to preference changes from this tab or any other. */
export function onPrefsChange(fn: (p: Prefs) => void): () => void {
  const local = (e: Event) => fn((e as CustomEvent<Prefs>).detail);
  const cross = (e: StorageEvent) => {
    if (e.key === KEY) fn(readPrefs());
  };
  window.addEventListener("anighost-prefs", local);
  window.addEventListener("storage", cross);
  return () => {
    window.removeEventListener("anighost-prefs", local);
    window.removeEventListener("storage", cross);
  };
}
