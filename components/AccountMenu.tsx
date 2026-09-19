"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthDialog } from "./AuthDialog";
import { Avatar } from "./Avatar";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { onPrefsChange, readPrefs } from "@/lib/prefs";
import styles from "./AccountMenu.module.css";

export function AccountMenu() {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [character, setCharacter] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  useEffect(() => {
    setCharacter(readPrefs().character);
    return onPrefsChange((prefs) => setCharacter(prefs.character));
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let active = true;

    client.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const open = () => setAuthOpen(true);
    window.addEventListener("anighost:open-auth", open);
    return () => window.removeEventListener("anighost:open-auth", open);
  }, []);

  useEffect(() => {
    detailsRef.current?.removeAttribute("open");
  }, [pathname]);

  async function signOut() {
    const client = getSupabaseBrowserClient();
    detailsRef.current?.removeAttribute("open");
    if (client) await client.auth.signOut();
  }

  const name = user ? displayName(user) : "";

  return (
    <>
      {user ? (
        <details className={styles.account} ref={detailsRef}>
          <summary aria-label={`Account menu for ${name}`}>
            <Avatar index={character} size="lg" />
            <span className={styles.name}>{name}</span>
          </summary>
          <div className={styles.menu}>
            <div className={styles.identity}>
              <Avatar index={character} size="lg" />
              <span>
                <b>{name}</b>
                <small>{user.email}</small>
              </span>
            </div>
            <Link href="/saves">Watch Later &amp; Saves</Link>
            <Link href="/settings">Profile &amp; settings</Link>
            <button type="button" onClick={signOut}>Sign out</button>
          </div>
        </details>
      ) : (
        <button className={styles.signIn} type="button" onClick={() => setAuthOpen(true)}>
          Sign in
        </button>
      )}

      <AuthDialog
        open={authOpen}
        onClose={closeAuth}
        onSignedIn={setUser}
      />
    </>
  );
}

function displayName(user: User): string {
  const custom = readPrefs().username?.trim();
  if (custom) return custom.slice(0, 48);
  const candidate = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 48);
  return (user.email?.split("@")[0] || "Anime fan").slice(0, 48);
}
