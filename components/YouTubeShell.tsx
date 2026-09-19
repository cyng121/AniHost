"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { YouTubeHeader } from "./YouTubeHeader";
import { YouTubeSidebar } from "./YouTubeSidebar";

export function YouTubeShell({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const pathname = usePathname();

  const showSidebar = true;

  function toggleSidebar() {
    setSidebarExpanded((prev) => !prev);
  }

  return (
    <div className="yt-shell">
      <YouTubeHeader onToggleSidebar={toggleSidebar} />

      <div className="yt-body">
        {showSidebar ? (
          <YouTubeSidebar isExpanded={sidebarExpanded} />
        ) : null}

        <main
          className={`yt-main ${
            showSidebar
              ? sidebarExpanded
                ? "yt-main--with-sidebar"
                : "yt-main--with-mini-sidebar"
              : ""
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
