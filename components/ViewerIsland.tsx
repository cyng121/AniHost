"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, CHARACTERS } from "./Avatar";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { onPrefsChange, readPrefs } from "@/lib/prefs";
import styles from "./ViewerIsland.module.css";

type Viewer = {
  sessionId: string;
  character: number;
  name: string;
  path: string;
  onlineAt: string;
};

const PRESENCE_PATHS = new Set([
  "Watching an episode",
  "Searching the catalogue",
  "Browsing anime",
]);

export function ViewerIsland() {
  const pathname = usePathname();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [open, setOpen] = useState(false);
  const [character, setCharacter] = useState(0);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [connected, setConnected] = useState(false);

  const visible = pathname === "/browse" || pathname.startsWith("/search") || pathname.startsWith("/watch/");

  useEffect(() => {
    setCharacter(normaliseCharacter(readPrefs().character));
    return onPrefsChange((prefs) => setCharacter(normaliseCharacter(prefs.character)));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const sessionId = presenceKey();
    const self: Viewer = {
      sessionId,
      character,
      name: presenceName(character, sessionId),
      path: presencePath(pathname),
      onlineAt: new Date().toISOString(),
    };

    if (!client) {
      setViewers([self]);
      setConnected(false);
      return;
    }

    let active = true;
    const channel = client.channel("site:lobby", {
      config: { presence: { key: sessionId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      if (!active) return;
      const states = Object.values(channel.presenceState()).flat();
      const unique = new Map<string, Viewer>();
      for (const rawState of states) {
        const state = sanitiseViewer(rawState);
        if (state) unique.set(state.sessionId, state);
      }
      setViewers(Array.from(unique.values()));
      setConnected(true);
    });

    channel.subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        void channel.track(self);
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setConnected(false);
        setViewers([self]);
      }
    });

    return () => {
      active = false;
      setConnected(false);
      void client.removeChannel(channel);
    };
  }, [character, client, pathname, visible]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  if (!visible) return null;

  const activeViewers = viewers.length ? viewers : [{
    sessionId: "local",
    character,
    name: "You",
    path: presencePath(pathname),
    onlineAt: new Date().toISOString(),
  }];
  const onlineByCharacter = new Map<number, number>();
  for (const viewer of activeViewers) {
    const index = normaliseCharacter(viewer.character);
    onlineByCharacter.set(index, (onlineByCharacter.get(index) ?? 0) + 1);
  }

  return (
    <aside className={styles.island} aria-label="People on Ani Ghost">
      {open ? (
        <section className={styles.panel} id="viewer-island-panel">
          <header className={styles.panelHead}>
            <div>
              <span className={styles.liveLine}>
                <i className={connected ? styles.liveDot : styles.localDot} aria-hidden />
                {connected ? "Live on Ani Ghost" : "This screen"}
              </span>
              <h2>{activeViewers.length} here now</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close viewer island">×</button>
          </header>

          <div className={styles.people}>
            {activeViewers.slice(0, 4).map((viewer) => (
              <span key={viewer.sessionId}>
                <Avatar index={normaliseCharacter(viewer.character)} size="sm" />
                <span><b>{viewer.name}</b><small>{viewer.path}</small></span>
              </span>
            ))}
            {activeViewers.length > 4 ? <small>+{activeViewers.length - 4} more watching</small> : null}
          </div>

          <div className={styles.rosterHead}>
            <b>Top 20 character profiles</b>
            <span>MyAnimeList ranking</span>
          </div>
          <div className={styles.roster}>
            {CHARACTERS.map((profile, index) => {
              const online = onlineByCharacter.get(index) ?? 0;
              return (
                <div className={online ? styles.onlineProfile : styles.profile} key={profile.id}>
                  <span className={styles.rank}>#{profile.rank}</span>
                  <Avatar index={index} size="lg" />
                  <span className={styles.profileName}>
                    <b>{profile.name}</b>
                    <small>{profile.series}</small>
                  </span>
                  {online ? <span className={styles.onlineCount}>{online}</span> : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <button
        className={styles.trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="viewer-island-panel"
      >
        <span className={styles.stack} aria-hidden>
          {activeViewers.slice(0, 4).map((viewer, index) => (
            <span key={viewer.sessionId} style={{ zIndex: 5 - index }}>
              <Avatar index={normaliseCharacter(viewer.character)} size="sm" />
            </span>
          ))}
        </span>
        <span className={styles.triggerCopy}>
          <b>{activeViewers.length} here now</b>
          <small>See the character island</small>
        </span>
        <span className={styles.chevron} aria-hidden>⌃</span>
      </button>
    </aside>
  );
}

function normaliseCharacter(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const integer = Math.trunc(value);
  return ((integer % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
}

function sanitiseViewer(value: unknown): Viewer | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Record<keyof Viewer, unknown>>;
  if (
    typeof candidate.sessionId !== "string" ||
    !/^[a-z0-9-]{1,80}$/i.test(candidate.sessionId) ||
    typeof candidate.character !== "number" ||
    !Number.isFinite(candidate.character) ||
    typeof candidate.name !== "string" ||
    typeof candidate.path !== "string" ||
    !PRESENCE_PATHS.has(candidate.path) ||
    typeof candidate.onlineAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.onlineAt))
  ) {
    return null;
  }

  const name = candidate.name.trim().slice(0, 48);
  if (!name) return null;
  return {
    sessionId: candidate.sessionId,
    character: normaliseCharacter(candidate.character),
    name,
    path: candidate.path,
    onlineAt: candidate.onlineAt,
  };
}

function presenceKey(): string {
  const key = "anighost-presence-key";
  const saved = window.sessionStorage.getItem(key);
  if (saved) return saved;
  const value = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(key, value);
  return value;
}

function presenceName(character: number, sessionId: string): string {
  const profile = CHARACTERS[normaliseCharacter(character)];
  return `${profile.name} fan · ${sessionId.slice(-3).toUpperCase()}`;
}

function presencePath(pathname: string): string {
  if (pathname.startsWith("/watch/")) return "Watching an episode";
  if (pathname.startsWith("/search")) return "Searching the catalogue";
  return "Browsing anime";
}
