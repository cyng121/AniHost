"use client";

import { useEffect } from "react";

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __anighostInstallPrompt?: InstallPromptEvent;
  }
}

/** Registers the app shell once and keeps browser install UI in one place. */
export function PwaRuntime() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      } else {
        // A development worker can hold HMR chunks and make the preview look
        // older than the source. Keep local testing network-native.
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch(() => undefined);
      }
    }

    if (isStandalone()) document.documentElement.setAttribute("data-standalone", "true");

    const rememberPrompt = (event: Event) => {
      event.preventDefault();
      window.__anighostInstallPrompt = event as InstallPromptEvent;
      window.dispatchEvent(new Event("anighost:install-ready"));
    };
    const markInstalled = () => {
      delete window.__anighostInstallPrompt;
      document.documentElement.setAttribute("data-standalone", "true");
      window.dispatchEvent(new Event("anighost:installed"));
    };

    window.addEventListener("beforeinstallprompt", rememberPrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", rememberPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  return null;
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
