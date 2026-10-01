"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface YouTubeSidebarProps {
  isExpanded: boolean;
}

export function YouTubeSidebar({ isExpanded }: YouTubeSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`yt-sidebar ${isExpanded ? "" : "yt-sidebar--mini"}`} aria-label="Sidebar">
      {/* Primary Section */}
      <div className="yt-sidebar-section">
        <Link
          href="/"
          className={`yt-nav-item ${pathname === "/" ? "is-active" : ""}`}
        >
          <span className="yt-nav-item__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </span>
          <span className="yt-nav-item__label">Home</span>
        </Link>

        <Link
          href="/shorts"
          className={`yt-nav-item ${pathname === "/shorts" ? "is-active" : ""}`}
        >
          <span className="yt-nav-item__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="m10 14.65 5-2.85-5-2.85v5.7zM18 7c0-.55-.45-1-1-1h-2.5l-1.32-2.12c-.2-.31-.54-.5-.9-.5H11.7c-.36 0-.7.19-.9.5L9.5 6H7c-.55 0-1 .45-1 1v1h12V7zm-1 3H7c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-7c0-1.1-.9-2-2-2z" />
            </svg>
          </span>
          <span className="yt-nav-item__label">Shorts</span>
        </Link>

        <Link
          href="/manga"
          className={`yt-nav-item ${pathname.startsWith("/manga") ? "is-active" : ""}`}
        >
          <span className="yt-nav-item__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </span>
          <span className="yt-nav-item__label">Manga</span>
        </Link>

        <Link
          href="/cartoon"
          className={`yt-nav-item ${pathname.startsWith("/cartoon") ? "is-active" : ""}`}
        >
          <span className="yt-nav-item__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
              <polyline points="17 2 12 7 7 2" />
            </svg>
          </span>
          <span className="yt-nav-item__label">Cartoons</span>
        </Link>
      </div>

      {isExpanded ? (
        <>
          {/* You Section */}
          <div className="yt-sidebar-section">
            <div className="yt-sidebar-heading">You</div>

            <Link
              href="/?sort=trending"
              className={`yt-nav-item ${pathname === "/" && typeof window !== "undefined" && window.location.search.includes("trending") ? "is-active" : ""}`}
            >
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
              </span>
              <span className="yt-nav-item__label">Trending</span>
            </Link>

            <Link
              href="/?sort=top-rated"
              className={`yt-nav-item ${pathname === "/" && typeof window !== "undefined" && window.location.search.includes("top-rated") ? "is-active" : ""}`}
            >
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </span>
              <span className="yt-nav-item__label">Top rated</span>
            </Link>

            <Link
              href="/?sort=new-releases"
              className={`yt-nav-item ${pathname === "/" && typeof window !== "undefined" && window.location.search.includes("new-releases") ? "is-active" : ""}`}
            >
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                </svg>
              </span>
              <span className="yt-nav-item__label">New releases</span>
            </Link>

            <Link
              href="/?sort=history"
              className={`yt-nav-item ${pathname === "/" && typeof window !== "undefined" && window.location.search.includes("history") ? "is-active" : ""}`}
            >
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              <span className="yt-nav-item__label">History</span>
            </Link>

            <Link
              href="/saves"
              className={`yt-nav-item ${pathname === "/saves" ? "is-active" : ""}`}
            >
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              </span>
              <span className="yt-nav-item__label">Liked</span>
            </Link>
          </div>

          {/* Explore Section */}
          <div className="yt-sidebar-section">
            <div className="yt-sidebar-heading">Explore</div>

            <Link href="/?genre=Action" className="yt-nav-item">
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
              </span>
              <span className="yt-nav-item__label">Action</span>
            </Link>

            <Link href="/?genre=Music" className="yt-nav-item">
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </span>
              <span className="yt-nav-item__label">Music</span>
            </Link>

            <Link href="/?genre=Sports" className="yt-nav-item">
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
                  <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              </span>
              <span className="yt-nav-item__label">Sports</span>
            </Link>

            <Link href="/?genre=Comedy" className="yt-nav-item">
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" x2="10" y1="12" y2="12" />
                  <line x1="8" x2="8" y1="10" y2="14" />
                  <line x1="15" x2="15.01" y1="13" y2="13" />
                  <line x1="18" x2="18.01" y1="11" y2="11" />
                  <rect width="20" height="12" x="2" y="6" rx="2" />
                </svg>
              </span>
              <span className="yt-nav-item__label">Comedy</span>
            </Link>

            <Link href="/?genre=Drama" className="yt-nav-item">
              <span className="yt-nav-item__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M7 3v18" />
                  <path d="M3 7.5h4" />
                  <path d="M3 12h18" />
                  <path d="M3 16.5h4" />
                  <path d="M17 3v18" />
                  <path d="M17 7.5h4" />
                  <path d="M17 16.5h4" />
                </svg>
              </span>
              <span className="yt-nav-item__label">Drama</span>
            </Link>
          </div>
        </>
      ) : null}
    </aside>
  );
}
