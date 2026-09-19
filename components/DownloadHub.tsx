"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type PlatformId = "windows" | "mac" | "linux" | "android" | "android-tv";

export interface AppOption {
  id: PlatformId;
  name: string;
  format: string;
  architecture: string;
  url: string | null;
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_GUIDES: Record<PlatformId, string> = {
  windows: "In Chrome or Edge, use the install icon in the address bar.",
  mac: "In Safari, choose File → Add to Dock. Chrome and Edge also show an install icon.",
  linux: "In Chrome or Edge, choose Install Ani Ghost from the browser menu.",
  android: "Open the browser menu, then choose Install app or Add to Home screen.",
  "android-tv": "Open the browser menu and choose Install app for a TV-friendly fullscreen view.",
};

export function DownloadHub({ apps }: { apps: AppOption[] }) {
  const [detected, setDetected] = useState<PlatformId | null>(null);
  const [download, setDownload] = useState<{ id: PlatformId; phase: "starting" | "ready" } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [guideFor, setGuideFor] = useState<PlatformId | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setDetected(detectPlatform());
    setInstalled(isStandalone());

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const installedApp = () => {
      setInstalled(true);
      setInstalling(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installedApp);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installedApp);
    };
  }, []);

  function markDownload(id: PlatformId) {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setDownload({ id, phase: "starting" });
    timers.current = [
      window.setTimeout(() => setDownload({ id, phase: "ready" }), 520),
      window.setTimeout(() => setDownload(null), 1800),
    ];
  }

  async function installFromBrowser(id: PlatformId) {
    const isCurrentDevice = id === detected;
    if (!isCurrentDevice || !installPrompt) {
      setGuideFor((current) => (current === id ? null : id));
      return;
    }

    setGuideFor(null);
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } finally {
      setInstalling(false);
      setInstallPrompt(null);
    }
  }

  return (
    <>
      <div className="appgrid" aria-label="Ani Ghost apps by device">
        {apps.map((app) => {
          const recommended = app.id === detected;
          const phase = download?.id === app.id ? download.phase : "idle";
          const hasGuide = guideFor === app.id;
          const appIsInstalled = installed && recommended;
          const installPhase = installing && recommended ? "starting" : appIsInstalled ? "ready" : "idle";
          return (
            <article
              key={app.id}
              className={recommended ? "appcard is-recommended" : "appcard"}
              aria-label={`${app.name}${recommended ? ", recommended for this device" : ""}`}
            >
              <div className="appcard__top">
                <h2>{app.name}</h2>
                {recommended ? <span className="pill pill--accent">Best match</span> : null}
              </div>
              <p className="appcard__detail">
                {app.format} <span aria-hidden>·</span> {app.architecture}
              </p>
              {app.url ? (
                <a
                  className="btn btn--primary appcard__action"
                  href={app.url}
                  download
                  onClick={() => markDownload(app.id)}
                  aria-label={`Download Ani Ghost for ${app.name}, ${app.format}`}
                >
                  <span className={`download-icon is-${phase}`} aria-hidden>
                    <svg className="download-icon__download" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3.8v10.4m0 0 4-4m-4 4-4-4M5 19.5h14" />
                    </svg>
                    <span className="download-icon__spinner" />
                    <svg className="download-icon__check" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5.5 12.5 4.2 4.2L18.8 7.6" />
                    </svg>
                  </span>
                  <span aria-live="polite">
                    {phase === "starting" ? "Starting…" : phase === "ready" ? "Download ready" : `Download ${app.format}`}
                  </span>
                </a>
              ) : (
                <>
                  <button
                    className="btn btn--primary appcard__action"
                    type="button"
                    onClick={() => void installFromBrowser(app.id)}
                    aria-expanded={hasGuide}
                    aria-controls={hasGuide ? `install-guide-${app.id}` : undefined}
                  >
                    <span className={`download-icon is-${installPhase}`} aria-hidden>
                      <svg className="download-icon__download" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3.8v10.4m0 0 4-4m-4 4-4-4M5 19.5h14" />
                      </svg>
                      <span className="download-icon__spinner" />
                      <svg className="download-icon__check" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5.5 12.5 4.2 4.2L18.8 7.6" />
                      </svg>
                    </span>
                    <span aria-live="polite">
                      {appIsInstalled
                        ? "Installed on this device"
                        : installing && recommended
                          ? "Opening install…"
                          : recommended && installPrompt
                            ? "Install app"
                            : "Install in browser"}
                    </span>
                  </button>
                  <p className="appcard__fallback">Browser install is ready now.</p>
                  {hasGuide ? (
                    <p id={`install-guide-${app.id}`} className="appcard__guide" role="status">
                      {installGuide(app.id)}
                    </p>
                  ) : null}
                </>
              )}
            </article>
          );
        })}
      </div>

      <div className="apps__web">
        <div>
          <h2>Watch in your browser</h2>
          <p>No install needed.</p>
        </div>
        <Link className="btn btn--accent btn--lg" href="/">
          Start watching
        </Link>
      </div>
    </>
  );
}

function detectPlatform(): PlatformId | null {
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  if (/android/.test(ua)) {
    return /(android tv|smart-tv|smarttv|aft\w*|bravia|googletv|shield)/.test(ua)
      ? "android-tv"
      : "android";
  }
  if (/win/.test(platform) || /windows/.test(ua)) return "windows";
  if (/mac/.test(platform) || /macintosh/.test(ua)) return "mac";
  if (/linux|x11/.test(platform) || /linux/.test(ua)) return "linux";
  return null;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function installGuide(platform: PlatformId) {
  return INSTALL_GUIDES[platform];
}
