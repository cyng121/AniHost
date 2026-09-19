"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Player, type AudioOption } from "./Player";
import { saveProgress } from "@/lib/progress";
import { DEFAULTS, onPrefsChange, readPrefs, writePrefs, type Prefs } from "@/lib/prefs";

/**
 * Bridges the server-resolved stream to the player: persists position, and
 * when a source dies mid-episode it rotates to the next server by re-running
 * the server component with a different `server` param — no stale client state.
 */
export function WatchStage({
  slug,
  title,
  image,
  episode,
  episodeTitle,
  audio,
  src,
  subtitles,
  intro,
  outro,
  nextHref,
  nextLabel,
  audioOptions,
  startAt,
  autoStart,
  fallbackServer,
  servers = [],
  currentServer,
  provider = "zoro",
  providers = ["zoro", "aniwave", "anidao", "watchanimeworld"],
}: {
  slug: string;
  title: string;
  image?: string;
  episode: number;
  episodeTitle: string;
  audio: "sub" | "dub";
  src: string;
  subtitles: Array<{ src: string; label: string; default: boolean }>;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  nextHref?: string;
  nextLabel?: string;
  audioOptions: AudioOption[];
  startAt: number;
  autoStart?: boolean;
  /** The next server to try if this one dies, or null if this was the last. */
  fallbackServer: string | null;
  servers?: string[];
  currentServer?: string;
  provider?: string;
  providers?: string[];
}) {
  const router = useRouter();
  const rotated = useRef(false);
  const [rotating, setRotating] = useState(false);
  const [rotatingMessage, setRotatingMessage] = useState<string | null>(null);
  const [switchingProvider, setSwitchingProvider] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  // Preferences are read after mount, so the first render matches the server.
  useEffect(() => {
    setPrefs(readPrefs());
    return onPrefsChange(setPrefs);
  }, []);

  const onNextEpisode = useCallback(() => {
    if (!nextHref) return;
    const url = new URL(nextHref, window.location.origin);
    url.searchParams.set("play", "1");
    router.push(`${url.pathname}${url.search}`);
  }, [nextHref, router]);

  const onAudioChange = useCallback(
    (option: AudioOption, time: number) => {
      writePrefs({ audio: option.value });
      const url = new URL(option.href, window.location.origin);
      if (time > 5) url.searchParams.set("t", String(Math.floor(time)));
      url.searchParams.set("play", "1");
      router.push(`${url.pathname}${url.search}`);
    },
    [router],
  );

  const onServerChange = useCallback(
    (newServer: string, time: number) => {
      const url = new URL(window.location.href);
      url.searchParams.set("server", newServer);
      if (time > 5) url.searchParams.set("t", String(Math.floor(time)));
      url.searchParams.set("play", "1");
      router.push(`${url.pathname}${url.search}`);
    },
    [router],
  );

  const onProviderChange = useCallback(
    (newProvider: string, time: number) => {
      setSwitchingProvider(newProvider);
      const url = new URL(window.location.href);
      url.searchParams.set("provider", newProvider);
      url.searchParams.delete("server"); // Let the new provider resolve to its best default server
      if (time > 5) url.searchParams.set("t", String(Math.floor(time)));
      url.searchParams.set("play", "1");
      router.push(`${url.pathname}${url.search}`);
    },
    [router],
  );

  const onVolumeChange = useCallback((volume: number, muted: boolean) => {
    writePrefs({ volume, muted });
  }, []);

  const onCaptionChange = useCallback((captions: boolean, subtitle?: string) => {
    writePrefs({ captions, ...(subtitle ? { subtitle } : {}) });
  }, []);

  // Immediately record the current episode so navigating to profile/home never loses track
  useEffect(() => {
    saveProgress({
      slug,
      title,
      image,
      episode,
      time: startAt || 0,
      duration: 0,
      audio,
    });
  }, [slug, title, image, episode, startAt, audio]);

  const onProgress = useCallback(
    (time: number, duration: number) => {
      saveProgress({ slug, title, image, episode, time, duration, audio });
    },
    [slug, title, image, episode, audio],
  );

  const onFatal = useCallback(
    (message: string, time: number) => {
      if (rotated.current) return;
      rotated.current = true;

      const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      const cur = currentServer ? norm(currentServer) : "";
      const at = cur
        ? servers.findIndex((s) => {
            const cs = norm(s);
            return cs === cur || cs.includes(cur) || cur.includes(cs);
          })
        : -1;

      // Determine next fallback server in server list for this provider
      let nextServer: string | null = null;
      if (at >= 0 && at + 1 < servers.length) {
        nextServer = servers[at + 1];
      } else if (fallbackServer && norm(fallbackServer) !== cur) {
        nextServer = fallbackServer;
      } else if (servers.length > 1) {
        nextServer = servers.find((s) => norm(s) !== cur) || null;
      }

      const url = new URL(window.location.href);
      if (time > 5) url.searchParams.set("t", String(Math.floor(time)));
      url.searchParams.set("play", "1");

      if (nextServer && norm(nextServer) !== cur) {
        setRotatingMessage(`Server "${currentServer || "current"}" dropped — auto-switching to "${nextServer}"…`);
        setRotating(true);
        url.searchParams.set("server", nextServer);
      } else {
        // All servers in this provider exhausted; auto-switch provider!
        const allProviders = providers && providers.length > 0 ? providers : ["zoro", "aniwave", "anidao", "watchanimeworld"];
        const curIdx = allProviders.indexOf(provider);
        const nextProvider = curIdx >= 0 && curIdx + 1 < allProviders.length ? allProviders[curIdx + 1] : allProviders[0];
        setRotatingMessage(`All servers on ${provider.toUpperCase()} dropped — auto-switching to ${nextProvider.toUpperCase()}…`);
        setRotating(true);
        setSwitchingProvider(nextProvider);
        url.searchParams.set("provider", nextProvider);
        url.searchParams.delete("server");
      }

      router.replace(`${url.pathname}${url.search}`);
      router.refresh();
    },
    [currentServer, servers, fallbackServer, provider, providers, router],
  );

  // A fresh src or provider update clears rotating and switching states
  useEffect(() => {
    rotated.current = false;
    setRotating(false);
    setRotatingMessage(null);
    setSwitchingProvider(null);
  }, [src, provider, currentServer]);

  // Safety timer to ensure beat loader doesn't linger indefinitely
  useEffect(() => {
    if (!switchingProvider) return;
    const timer = setTimeout(() => {
      setSwitchingProvider(null);
    }, 12000);
    return () => clearTimeout(timer);
  }, [switchingProvider]);

  return (
    <>
      <Player
        switchingProvider={switchingProvider}
        src={src}
        subtitles={subtitles}
        intro={intro}
        outro={outro}
        title={title}
        episodeLabel={episodeTitle}
        nextHref={nextHref}
        nextLabel={nextLabel}
        audio={audio}
        audioOptions={audioOptions}
        servers={servers}
        currentServer={currentServer}
        onServerChange={onServerChange}
        provider={provider}
        providers={providers}
        onProviderChange={onProviderChange}
        rotating={rotating}
        rotatingMessage={rotatingMessage}
        startAt={startAt}
        autoStart={autoStart}
        autoplayNext={prefs.autoplay}
        skipMode={prefs.skipMode}
        preferredVolume={prefs.volume}
        preferredMuted={prefs.muted}
        captionsEnabled={prefs.captions}
        preferredSubtitle={prefs.subtitle}
        onProgress={onProgress}
        preferredQuality={prefs.quality}
        onVolumeChange={onVolumeChange}
        onCaptionChange={onCaptionChange}
        onAudioChange={onAudioChange}
        onNextEpisode={onNextEpisode}
        onFatal={onFatal}
      />
      {rotating && rotatingMessage ? (
        <p className="watch__rotating" role="status">
          {rotatingMessage}
        </p>
      ) : null}
    </>
  );
}
