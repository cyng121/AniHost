"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./MobileDock.module.css";

/* ─── YouTube Style Icons ─────────────────────────────────────────────────── */

const HOME_ICON_OUTLINE = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconOutline}>
    <path d="M4 21V10.08l8-6 8 6V21h-5v-6h-6v6H4Zm2-2h2v-6h8v6h2v-8.15L12 6.13 6 10.85V19Z" fill="currentColor" />
  </svg>
);

const HOME_ICON_FILLED = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconFilled}>
    <path d="M4 21V10.08l8-6 8 6V21h-5v-6h-6v6H4Z" fill="currentColor" />
  </svg>
);

const SHORTS_ICON_OUTLINE = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconOutline}>
    <path d="M10 14.65 15 11.8 10 8.95v5.7ZM17.77 10.32l-1.2-0.7 1.1-0.63a3.9 3.9 0 0 0 1.51-5.32 4 4 0 0 0-5.4-1.48L5.7 6.75a3.9 3.9 0 0 0-1.5 5.33l1.2.7-1.1.63a3.9 3.9 0 0 0-1.51 5.32 4 4 0 0 0 5.4 1.48l8.08-4.57a3.9 3.9 0 0 0 1.5-5.32Zm-1.02 4.45-8.08 4.57a2 2 0 0 1-2.7-.74 1.9 1.9 0 0 1 .75-2.66l2.12-1.2-0.85-0.5a1.9 1.9 0 0 1-.74-2.66 2 2 0 0 1 2.7-.74l8.08-4.57a2 2 0 0 1 2.7.74 1.9 1.9 0 0 1-.75 2.66l-2.12 1.2.85.5a1.9 1.9 0 0 1 .74 2.66 2 2 0 0 1-2.7.74Z" fill="currentColor" />
  </svg>
);

const SHORTS_ICON_FILLED = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconFilled}>
    <path d="M17.77 10.32l-1.2-0.7 1.1-0.63a3.9 3.9 0 0 0 1.51-5.32 4 4 0 0 0-5.4-1.48L5.7 6.75a3.9 3.9 0 0 0-1.5 5.33l1.2.7-1.1.63a3.9 3.9 0 0 0-1.51 5.32 4 4 0 0 0 5.4 1.48l8.08-4.57a3.9 3.9 0 0 0 1.5-5.32ZM10 14.65V8.95L15 11.8l-5 2.85Z" fill="currentColor" />
  </svg>
);

const MANGA_ICON_OUTLINE = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconOutline}>
    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6Zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Zm0 14H8V4h12v12Z" fill="currentColor" />
  </svg>
);

const MANGA_ICON_FILLED = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconFilled}>
    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6Zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Zm-1 9H9V9h10v2Zm-4 4H9v-2h6v2Zm4-8H9V5h10v2Z" fill="currentColor" />
  </svg>
);

const SCHEDULE_ICON_OUTLINE = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconOutline}>
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Zm-7 5h5v5h-5v-5Z" fill="currentColor" />
  </svg>
);

const SCHEDULE_ICON_FILLED = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconFilled}>
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Zm0 16H5V9h14v11Zm-8-9H7v2h4v-2Zm6 0h-4v2h4v-2Zm-6 4H7v2h4v-2Zm6 0h-4v2h4v-2Z" fill="currentColor" />
  </svg>
);

const YOU_ICON_OUTLINE = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconOutline}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3Zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22Z" fill="currentColor" />
  </svg>
);

const YOU_ICON_FILLED = (
  <svg viewBox="0 0 24 24" aria-hidden className={styles.iconFilled}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3Zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22Z" fill="currentColor" />
    <circle cx="12" cy="8" r="3.2" fill="#0f0f0f" />
    <circle cx="12" cy="8" r="2.4" fill="currentColor" />
  </svg>
);

/* ─── Types ───────────────────────────────────────────────────────────────── */

type BottomNavItem = {
  href: string;
  label: string;
  iconOutline: ReactNode;
  iconFilled: ReactNode;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function MobileDock() {
  const pathname = usePathname();

  const items: BottomNavItem[] = [
    { href: "/",         label: "Home",     iconOutline: HOME_ICON_OUTLINE,     iconFilled: HOME_ICON_FILLED     },
    { href: "/shorts",   label: "Shorts",   iconOutline: SHORTS_ICON_OUTLINE,   iconFilled: SHORTS_ICON_FILLED   },
    { href: "/manga",    label: "Manga",    iconOutline: MANGA_ICON_OUTLINE,    iconFilled: MANGA_ICON_FILLED    },
    { href: "/schedule", label: "Schedule", iconOutline: SCHEDULE_ICON_OUTLINE, iconFilled: SCHEDULE_ICON_FILLED },
    { href: "/settings", label: "You",      iconOutline: YOU_ICON_OUTLINE,      iconFilled: YOU_ICON_FILLED      },
  ];

  /* Hide on full-screen player or manga reader pages */
  const isWatchOrReader =
    pathname.includes("/watch/") ||
    (pathname.startsWith("/manga/") && pathname.split("/").filter(Boolean).length >= 3);

  const getActiveIndex = () => {
    if (pathname.startsWith("/shorts")) return 1;
    if (pathname.startsWith("/manga")) return 2;
    if (pathname.startsWith("/schedule")) return 3;
    if (pathname.startsWith("/settings") || pathname.startsWith("/saves")) return 4;
    if (pathname === "/" || pathname.startsWith("/browse")) return 0;
    return -1;
  };

  const activeIndex = getActiveIndex();

  if (isWatchOrReader) return null;

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      <div className={styles.navInner}>
        {items.map((item, index) => {
          const isActive = activeIndex === index;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.isActive : ""}`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className={styles.iconWrap}>
                {isActive ? item.iconFilled : item.iconOutline}
              </div>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
