"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { onPrefsChange, readPrefs } from "@/lib/prefs";
import styles from "./AccountMenu.module.css";

export function AccountMenu() {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [character, setCharacter] = useState(0);
  const [name, setName] = useState("");

  useEffect(() => {
    const prefs = readPrefs();
    setCharacter(prefs.character);
    setName(prefs.username?.trim() || "Profile");

    return onPrefsChange((p) => {
      setCharacter(p.character);
      setName(p.username?.trim() || "Profile");
    });
  }, []);

  useEffect(() => {
    detailsRef.current?.removeAttribute("open");
  }, [pathname]);

  return (
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
          </span>
        </div>
        <Link href="/saves">Watch Later &amp; Saves</Link>
        <Link href="/settings">Profile &amp; settings</Link>
      </div>
    </details>
  );
}
