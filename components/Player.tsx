"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { BeatLoader } from "./BeatLoader";

type HlsInstance = any;

export interface AudioOption {
  value: "sub" | "dub";
  label: string;
  href: string;
}

export type SettingsTab = "quality" | "speed" | "audio" | "subtitles" | "servers";

export function isHindiTrack(track: { name?: string; lang?: string }, isHindiProv?: boolean): boolean {
  const l = (track.lang || "").toLowerCase().trim();
  const n = (track.name || "").toLowerCase().trim();
  if (
    l === "hi" ||
    l === "hin" ||
    l.startsWith("hi-") ||
    l.startsWith("hin") ||
    n.includes("hindi") ||
    n.includes("hin")
  ) {
    return true;
  }
  if (isHindiProv && (n.includes("dub") || l.includes("dub"))) {
    return true;
  }
  return false;
}

export function formatAudioTrackLabel(name?: string, lang?: string, index?: number): string {
  const cleanLang = (lang || "").toLowerCase().trim();
  const cleanName = (name || "").trim();

  const langMap: Record<string, string> = {
    hin: "Hindi",
    hi: "Hindi",
    "hin-in": "Hindi",
    "hi-in": "Hindi",
    ja: "Japanese",
    jpn: "Japanese",
    "ja-jp": "Japanese",
    en: "English",
    eng: "English",
    "en-us": "English",
    ko: "Korean",
    kor: "Korean",
    zh: "Chinese",
    chi: "Chinese",
    zho: "Chinese",
    es: "Spanish",
    spa: "Spanish",
    fr: "French",
    fra: "French",
    fre: "French",
    de: "German",
    ger: "German",
    deu: "German",
    pt: "Portuguese",
    por: "Portuguese",
    ru: "Russian",
    rus: "Russian",
    it: "Italian",
    ita: "Italian",
  };

  if (
    cleanName &&
    !/^audio\s*\d*$/i.test(cleanName) &&
    cleanName.toLowerCase() !== "main" &&
    cleanName.toLowerCase() !== "und" &&
    cleanName.toLowerCase() !== "default"
  ) {
    return cleanName;
  }
  if (cleanLang && langMap[cleanLang]) {
    return langMap[cleanLang];
  }
  if (cleanName) {
    return cleanName;
  }
  return typeof index === "number" ? `Track ${index + 1}` : "Audio Track";
}

export interface PlayerProps {
  /** Already proxied through /api/hls. */
  src: string;
  subtitles: Array<{ src: string; label: string; default: boolean }>;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  /**
   * "button" offers a skip and waits to be asked — the default, because
   * cutting a viewer's content without consent is the wrong call.
   * "auto" jumps for them, and even then only after a beat has played.
   */
  skipMode?: "button" | "auto";
  title: string;
  episodeLabel: string;
  nextHref?: string;
  nextLabel?: string;
  audio: "sub" | "dub";
  audioOptions?: AudioOption[];
  /** Resume point in seconds, applied once the media reports a duration. */
  startAt?: number;
  /** Attempt playback after an automatic episode handoff. Browser policy still wins. */
  autoStart?: boolean;
  autoplayNext?: boolean;
  preferredVolume?: number;
  preferredMuted?: boolean;
  captionsEnabled?: boolean;
  preferredSubtitle?: string;
  /** Throttled position reporter, used to persist "continue watching". */
  onProgress?: (time: number, duration: number) => void;
  /** Starting quality from preferences; "auto" lets ABR choose. */
  preferredQuality?: "auto" | "1080p" | "720p" | "480p";
  onVolumeChange?: (volume: number, muted: boolean) => void;
  onCaptionChange?: (enabled: boolean, label?: string) => void;
  onAudioChange?: (option: AudioOption, time: number) => void;
  servers?: string[];
  currentServer?: string;
  onServerChange?: (server: string, time: number) => void;
  provider?: string;
  providers?: string[];
  onProviderChange?: (provider: string, time: number) => void;
  switchingProvider?: string | null;
  rotating?: boolean;
  rotatingMessage?: string | null;
  /** Fired once the episode finishes, after final progress is persisted. */
  onEnded?: () => void;
  /** Navigates to the next freshly resolved stream. */
  onNextEpisode?: () => void;
  /** Fired when every retry has failed, so the page can offer another server. */
  onFatal?: (message: string, time: number) => void;
}

const HIDE_AFTER_MS = 2200;
const HIDE_AFTER_MS_TOUCH = 3200;
const NEXT_COUNTDOWN_SECONDS = 5;
const DOUBLE_TAP_MS = 320;
const EMPTY_AUDIO_OPTIONS: AudioOption[] = [];

export function Player({
  src,
  subtitles,
  intro,
  outro,
  skipMode = "button",
  title,
  episodeLabel,
  nextHref,
  nextLabel = "Next episode",
  audio,
  audioOptions = EMPTY_AUDIO_OPTIONS,
  servers = [],
  currentServer,
  onServerChange,
  provider = "zoro",
  providers = ["zoro", "aniwave", "anidao", "watchanimeworld"],
  onProviderChange,
  switchingProvider = null,
  rotating = false,
  rotatingMessage = null,
  startAt = 0,
  autoStart = false,
  autoplayNext = true,
  preferredVolume = 0.85,
  preferredMuted = false,
  captionsEnabled = true,
  preferredSubtitle = "English",
  onProgress,
  preferredQuality = "auto",
  onVolumeChange,
  onCaptionChange,
  onAudioChange,
  onEnded,
  onNextEpisode,
  onFatal,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [localSwitching, setLocalSwitching] = useState<string | null>(null);

  useEffect(() => {
    setLocalSwitching(null);
  }, [src, provider]);

  const activeSwitchingProvider = switchingProvider || localSwitching;
  /** Kept so the quality selector can drive the running instance. */
  const hlsRef = useRef<HlsInstance | null>(null);
  /** Resume and autoplay are each attempted once per source. */
  const resumed = useRef(false);
  const autoStarted = useRef(false);
  /**
   * Each range is jumped once per episode. Without this a viewer who rewinds
   * into the opening would be yanked forward again on every tick, which is
   * worse than no auto-skip at all.
   */
  const skippedIntro = useRef(false);
  const skippedOutro = useRef(false);
  const lastReport = useRef(0);
  const lastCaption = useRef(0);
  const lastAudibleVolume = useRef(preferredVolume > 0 ? clamp01(preferredVolume) : 0.5);
  const isTouch = useRef(false);
  const lastTap = useRef<{ time: number; side: "left" | "right" | "mid"; count: number } | null>(null);

  /** Media listeners remain attached while these callbacks/preferences change. */
  const progressCb = useRef(onProgress);
  const endedCb = useRef(onEnded);
  const fatalCb = useRef(onFatal);
  const volumeCb = useRef(onVolumeChange);
  const nextCb = useRef(onNextEpisode);
  const wantQuality = useRef(preferredQuality);
  const wantAutoStart = useRef(autoStart !== false);
  const wantAutoplayNext = useRef(autoplayNext);
  const hasNext = useRef(Boolean(nextHref));
  progressCb.current = onProgress;
  endedCb.current = onEnded;
  fatalCb.current = onFatal;
  volumeCb.current = onVolumeChange;
  nextCb.current = onNextEpisode;
  wantQuality.current = preferredQuality;
  wantAutoStart.current = autoStart !== false;
  wantAutoplayNext.current = autoplayNext;
  hasNext.current = Boolean(nextHref);

  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [idle, setIdle] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(preferredMuted);
  const [volume, setVolumeState] = useState(clamp01(preferredVolume));
  const [captionIndex, setCaptionIndex] = useState(-1);
  const [levels, setLevels] = useState<string[]>([]);
  const [level, setLevel] = useState(-1);
  /** What the stream is actually playing, so "Auto" can say what it chose. */
  const [activeLevel, setActiveLevel] = useState(-1);
  const [hlsAudioTracks, setHlsAudioTracks] = useState<Array<{ id: number; label: string; language?: string; name?: string }>>([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState<number>(-1);
  const userSelectedAudioTrack = useRef<number | null>(null);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState(false);
  /** Brief confirmation after an automatic jump, with a way back. */
  const [skipNotice, setSkipNotice] = useState<{ kind: string; from: number } | null>(null);
  /**
   * Feedback for a jump. Tapping +10 used to wake the entire chrome, which
   * made a small action feel heavy and covered the picture. This shows only
   * the amount moved, on the side it moved toward, and gets out of the way.
   */
  const [nudge, setNudge] = useState<{ dir: 1 | -1; n: number } | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("quality");
  const settingsOpenRef = useRef(settingsOpen);
  settingsOpenRef.current = settingsOpen;
  const nudgeSeq = useRef(0);
  const [volumeHud, setVolumeHud] = useState<{ volume: number; muted: boolean } | null>(null);
  const volumeHudTimer = useRef<number | null>(null);
  const [bezel, setBezel] = useState<"play" | "pause" | null>(null);
  const bezelTimer = useRef<number | null>(null);

  const triggerBezel = useCallback((type: "play" | "pause") => {
    setBezel(type);
    if (bezelTimer.current) window.clearTimeout(bezelTimer.current);
    bezelTimer.current = window.setTimeout(() => setBezel(null), 550);
  }, []);

  const showVolumeHud = useCallback((vol: number, isMuted: boolean) => {
    setVolumeHud({ volume: clamp01(vol), muted: isMuted });
    if (volumeHudTimer.current) window.clearTimeout(volumeHudTimer.current);
    volumeHudTimer.current = window.setTimeout(() => {
      setVolumeHud(null);
    }, 900);
  }, []);

  const wake = useCallback(() => {
    setIdle(false);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(
      () => {
        if (!videoRef.current?.paused && !settingsOpenRef.current) setIdle(true);
      },
      isTouch.current ? HIDE_AFTER_MS_TOUCH : HIDE_AFTER_MS,
    );
  }, []);

  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (volumeHudTimer.current) window.clearTimeout(volumeHudTimer.current);
      if (bezelTimer.current) window.clearTimeout(bezelTimer.current);
    },
    [],
  );

  // ── load the stream ───────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let destroyed = false;
    let hls: HlsInstance | null = null;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;
    resumed.current = false;
    autoStarted.current = false;
    skippedIntro.current = false;
    skippedOutro.current = false;
    setSkipNotice(null);
    lastReport.current = 0;
    setReady(false);
    setBuffering(false);
    setError(null);
    setRetrying(false);
    setPlaying(false);
    setTime(0);
    setDuration(0);
    setBuffered(0);
    setLevels([]);
    setLevel(-1);
    setActiveLevel(-1);
    setHlsAudioTracks([]);
    setActiveAudioTrack(-1);
    userSelectedAudioTrack.current = null;
    setNextCountdown(null);
    setAdvancing(false);

    async function load() {
      const isMp4 = src.includes("/api/mp4") || /\.mp4(\?|$)/i.test(src);
      if (isMp4) {
        video!.src = src;
        setReady(true);
        if (wantAutoStart.current && !autoStarted.current) {
          autoStarted.current = true;
          video!.play().catch(() => {
            video!.muted = true;
            setMuted(true);
            video!.play().catch(() => setIdle(false));
          });
        }
        return;
      }

      const canNative = video!.canPlayType("application/vnd.apple.mpegurl");
      const HlsMod: any = await import("hls.js");
      if (destroyed) return;
      const HlsClass = HlsMod.default;

      // Safari plays HLS natively and does it better than MSE would.
      if (!HlsClass.isSupported() && canNative) {
        video!.src = src;
        setReady(true);

        const syncNativeAudioTracks = () => {
          if (destroyed || !video) return;
          const vTracks = (video as any).audioTracks;
          if (!vTracks || !vTracks.length) return;

          const mapped: Array<{ id: number; label: string; language?: string; name?: string }> = [];
          let activeId = 0;
          for (let i = 0; i < vTracks.length; i++) {
            const t = vTracks[i];
            mapped.push({
              id: i,
              label: formatAudioTrackLabel(t.label, t.language, i),
              language: t.language,
              name: t.label,
            });
            if (t.enabled) activeId = i;
          }
          setHlsAudioTracks(mapped);

          const isHindiProv =
            provider?.toLowerCase().includes("hindi") ||
            provider === "watchanimeworld";

          const hindiIdx = mapped.findIndex((t) => isHindiTrack(t, isHindiProv));

          if (userSelectedAudioTrack.current !== null) {
            const userChoice = userSelectedAudioTrack.current;
            for (let i = 0; i < vTracks.length; i++) {
              vTracks[i].enabled = i === userChoice;
            }
            setActiveAudioTrack(userChoice);
          } else if ((isHindiProv || audio === "dub") && hindiIdx >= 0) {
            for (let i = 0; i < vTracks.length; i++) {
              vTracks[i].enabled = i === hindiIdx;
            }
            setActiveAudioTrack(hindiIdx);
          } else {
            setActiveAudioTrack(activeId);
          }
        };

        const vTracks = (video as any).audioTracks;
        if (vTracks) {
          vTracks.addEventListener?.("change", syncNativeAudioTracks);
          vTracks.addEventListener?.("addtrack", syncNativeAudioTracks);
        }
        video!.addEventListener("loadedmetadata", syncNativeAudioTracks);

        if (wantAutoStart.current && !autoStarted.current) {
          autoStarted.current = true;
          video!.play().catch(() => {
            video!.muted = true;
            setMuted(true);
            video!.play().catch(() => setIdle(false));
          });
        }
        return;
      }

      if (!HlsClass.isSupported()) {
        setError("This browser cannot play HLS streams.");
        fatalCb.current?.("HLS unsupported", video?.currentTime ?? 0);
        return;
      }

      hls = new HlsClass({
        // Everything is same-origin through our proxy, so no credentials games.
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 4,
      });

      const applyAudioTracks = (tracksList?: Array<{ id?: number; name?: string; lang?: string }>) => {
        if (destroyed) return;
        const rawTracks = tracksList || (hls ? hls.audioTracks : []);
        if (!rawTracks || !rawTracks.length) return;

        const mapped = rawTracks.map((t: { id?: number; name?: string; lang?: string }, idx: number) => ({
          id: typeof t.id === "number" ? t.id : idx,
          label: formatAudioTrackLabel(t.name, t.lang, idx),
          language: t.lang,
          name: t.name,
        }));

        setHlsAudioTracks(mapped);

        const isHindiProv =
          provider?.toLowerCase().includes("hindi") ||
          provider === "watchanimeworld";

        const hindiIdx = mapped.findIndex((t: any) => isHindiTrack(t, isHindiProv));

        // If user already manually chose a track during this episode playback, respect it
        if (userSelectedAudioTrack.current !== null) {
          const userChoice = userSelectedAudioTrack.current;
          if (mapped.some((t: any) => t.id === userChoice)) {
            if (hls && hls.audioTrack !== userChoice) {
              hls.audioTrack = userChoice;
            }
            setActiveAudioTrack(userChoice);
            return;
          }
        }

        // Keep Hindi as default if on watchanimeworld / hindi provider or if hindi audio track is found
        if ((isHindiProv || audio === "dub") && hindiIdx >= 0) {
          const targetId = mapped[hindiIdx].id;
          if (hls && hls.audioTrack !== targetId) {
            hls.audioTrack = targetId;
          }
          setActiveAudioTrack(targetId);
        } else {
          const currentId = hls ? hls.audioTrack : -1;
          if (currentId >= 0 && mapped.some((t: any) => t.id === currentId)) {
            setActiveAudioTrack(currentId);
          } else {
            const fallbackId = mapped[0]?.id ?? 0;
            if (hls && hls.audioTrack < 0) {
              hls.audioTrack = fallbackId;
            }
            setActiveAudioTrack(fallbackId);
          }
        }
      };

      hls.on(HlsClass.Events.MANIFEST_PARSED, (_event: unknown, data: any) => {
        if (destroyed) return;
        setReady(true);
        if (data?.levels) {
          setLevels(
            data.levels.map((item: { height?: number; bitrate: number }) =>
              item.height ? `${item.height}p` : `${Math.round(item.bitrate / 1000)}k`,
            ),
          );
        }

        // Synchronize audio tracks from manifest and enforce Hindi default
        applyAudioTracks(data?.audioTracks || hls?.audioTracks);

        if (wantAutoStart.current && !autoStarted.current) {
          autoStarted.current = true;
          video?.play().catch(() => {
            if (video) {
              video.muted = true;
              setMuted(true);
              video.play().catch(() => setIdle(false));
            }
          });
        }

        // Honour the saved quality only when this manifest offers it.
        const wanted = wantQuality.current;
        if (wanted !== "auto" && hls && data?.levels) {
          const target = Number(wanted.replace("p", ""));
          const index = data.levels.findIndex((item: { height?: number }) => item.height === target);
          if (index >= 0) {
            hls.currentLevel = index;
            setLevel(index);
          }
        }
      });

      // Auto is a decision the player keeps making; showing the result turns
      // "Auto" from a black box into something the viewer can read.
      hls.on(HlsClass.Events.LEVEL_SWITCHED, (_event: unknown, data: { level: number }) => {
        if (!destroyed) setActiveLevel(data.level);
      });

      hls.on(HlsClass.Events.AUDIO_TRACKS_UPDATED, (_event: unknown, data: { audioTracks?: any[] }) => {
        if (destroyed) return;
        applyAudioTracks(data?.audioTracks || hls?.audioTracks);
      });

      hls.on(HlsClass.Events.AUDIO_TRACK_SWITCHED, (_event: unknown, data: { id: number }) => {
        if (!destroyed && typeof data?.id === "number") {
          setActiveAudioTrack(data.id);
        }
      });


      hls.on(HlsClass.Events.ERROR, (_event: unknown, data: { fatal: boolean; type: string; details?: string }) => {
        if (destroyed || !data.fatal) return;

        // Recover a small, bounded number of times. Repeating forever looks
        // like a frozen player and prevents the watch page rotating servers.
        if (data.type === HlsClass.ErrorTypes.NETWORK_ERROR && networkRecoveries < 2) {
          networkRecoveries += 1;
          hls?.startLoad();
          return;
        }
        if (data.type === HlsClass.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries += 1;
          hls?.recoverMediaError();
          return;
        }

        const message = data.details || "Playback failed";
        setError(`This source stopped responding (${message}).`);
        fatalCb.current?.(message, video?.currentTime ?? 0);
      });

      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video!);
    }

    void load();

    return () => {
      destroyed = true;
      hls?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
    // retryTick intentionally re-runs this whole effect so a failed source
    // gets a clean reconnect rather than reusing a dead hls.js instance.
    // audio/provider are real inputs: the manifest handler below picks the
    // default track from them, and changing either one re-resolves the stream
    // upstream, so this effect must not keep a stale copy.
  }, [src, retryTick, audio, provider]);

  const retry = useCallback(() => {
    setRetrying(true);
    setError(null);
    setRetryTick((tick) => tick + 1);
    window.setTimeout(() => setRetrying(false), 600);
  }, []);

  // ── media events ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const mediaDuration = () =>
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const onTime = () => {
      setTime(video.currentTime);
      if (video.buffered.length) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
      // Reporting every 2.5s keeps continue-watching accurate and fresh
      const now = Date.now();
      if (now - lastReport.current > 2500) {
        lastReport.current = now;
        progressCb.current?.(video.currentTime, mediaDuration());
      }
    };
    const onMeta = () => {
      const length = mediaDuration();
      setDuration(length);
      // Only resume when there is something left to watch.
      if (!resumed.current && startAt > 0 && length && startAt < length - 15) {
        resumed.current = true;
        video.currentTime = startAt;
      }
    };
    const onCanPlay = () => {
      setBuffering(false);
      if (wantAutoStart.current && !autoStarted.current) {
        autoStarted.current = true;
        void video.play().catch(() => {
          video.muted = true;
          setMuted(true);
          video.play().catch(() => {
            setIdle(false);
          });
        });
      }
    };
    const onPlay = () => {
      setPlaying(true);
      setBuffering(false);
      wake();
    };
    const onPause = () => {
      setPlaying(false);
      setIdle(false);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      progressCb.current?.(video.currentTime, mediaDuration());
    };
    const onWaiting = () => {
      if (!video.paused) setBuffering(true);
    };
    const onSeeked = () => {
      setBuffering(false);
      progressCb.current?.(video.currentTime, mediaDuration());
    };
    const onMediaError = () => {
      // hls.js owns its media recovery path. This listener covers native HLS,
      // where there is no engine event to rotate an expired source for us.
      if (hlsRef.current) return;
      const message = video.error?.message || "Native HLS playback failed";
      setError("This source could not be played.");
      fatalCb.current?.(message, video.currentTime);
    };
    const onVolume = () => {
      const nextVolume = clamp01(video.volume);
      if (nextVolume > 0) lastAudibleVolume.current = nextVolume;
      setVolumeState(nextVolume);
      setMuted(video.muted);
      volumeCb.current?.(nextVolume, video.muted);
    };
    // Persist the final position on the way out, whichever way the viewer leaves.
    const onLeave = () => progressCb.current?.(video.currentTime, mediaDuration());
    const onFinished = () => {
      setPlaying(false);
      setBuffering(false);
      progressCb.current?.(video.currentTime, mediaDuration());
      endedCb.current?.();
      if (hasNext.current) {
        setNextCountdown(wantAutoplayNext.current ? NEXT_COUNTDOWN_SECONDS : 0);
      }
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("play", onPlay);
    video.addEventListener("playing", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("seeking", onWaiting);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onMediaError);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("pause", onLeave);
    video.addEventListener("ended", onFinished);
    window.addEventListener("pagehide", onLeave);
    return () => {
      onLeave();
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("playing", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("seeking", onWaiting);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onMediaError);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("pause", onLeave);
      video.removeEventListener("ended", onFinished);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [src, startAt, wake]);

  // Apply device preferences to a fresh <video>. Mute is kept across an
  // autoplay handoff so the next episode never surprises the viewer with sound.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = clamp01(preferredVolume);
    video.muted = preferredMuted;
  }, [src, preferredVolume, preferredMuted]);

  const syncCaptionModes = useCallback((selected: number) => {
    const video = videoRef.current;
    if (!video) return;
    const selectedTrack = selected >= 0 ? video.querySelectorAll("track")[selected]?.track : undefined;
    Array.from(video.textTracks).forEach((track) => {
      track.mode = selectedTrack === track ? "showing" : "disabled";
    });
  }, []);

  // Browser defaults differ, so select exactly one supplied track ourselves.
  useEffect(() => {
    if (!subtitles.length || !captionsEnabled) {
      setCaptionIndex(-1);
      syncCaptionModes(-1);
      return;
    }

    // Providers label the same language a dozen ways — "Hindi", "Spanish
    // (- Latin American)", "Portuguese (- Brazilian (Dubtitle))". Match the
    // exact label first, then the language stem, so a saved preference of
    // "Spanish" still finds the only Spanish track a release happens to carry.
    const wanted = preferredSubtitle.trim().toLocaleLowerCase();
    const stem = (label: string) => label.toLocaleLowerCase().split(/[(\-–—]/)[0].trim();

    let selected = subtitles.findIndex((track) => track.label.toLocaleLowerCase() === wanted);
    if (selected < 0 && wanted) selected = subtitles.findIndex((track) => stem(track.label) === wanted);
    // Prefer a plain track over a dubtitle/SDH variant of the same language.
    if (selected < 0 && wanted) {
      selected = subtitles.findIndex(
        (track) => stem(track.label) === wanted && !/dubtitle|sdh/i.test(track.label),
      );
    }
    if (selected < 0 && wanted) {
      selected = subtitles.findIndex((track) => track.label.toLocaleLowerCase().includes(wanted));
    }
    if (selected < 0) selected = subtitles.findIndex((track) => track.default);
    if (selected < 0) selected = subtitles.findIndex((track) => /english|\ben\b/i.test(track.label));
    if (selected < 0) selected = 0;
    lastCaption.current = selected;
    setCaptionIndex(selected);
    const timer = window.setTimeout(() => syncCaptionModes(selected), 0);
    return () => window.clearTimeout(timer);
  }, [src, subtitles, captionsEnabled, preferredSubtitle, syncCaptionModes]);

  const chooseCaption = useCallback(
    (selected: number) => {
      if (selected >= 0) lastCaption.current = selected;
      setCaptionIndex(selected);
      syncCaptionModes(selected);
      onCaptionChange?.(selected >= 0, selected >= 0 ? subtitles[selected]?.label : undefined);
      wake();
    },
    [onCaptionChange, subtitles, syncCaptionModes, wake],
  );

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
      triggerBezel("play");
    } else {
      video.pause();
      triggerBezel("pause");
    }
    wake();
  }, [triggerBezel, wake]);

  const seek = useCallback(
    (to: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(to)) return;
      video.currentTime = Math.max(0, Math.min(to, mediaEnd(video, to)));
      wake();
    },
    [wake],
  );

  const changeVolume = useCallback(
    (next: number, showHud = true) => {
      const video = videoRef.current;
      if (!video) return;
      const target = clamp01(next);
      video.volume = target;
      if (target > 0) video.muted = false;
      if (showHud) showVolumeHud(target, false);
      wake();
    },
    [showVolumeHud, wake],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      if (video.volume === 0) video.volume = lastAudibleVolume.current;
      video.muted = false;
      showVolumeHud(video.volume, false);
    } else {
      video.muted = true;
      showVolumeHud(video.volume, true);
    }
    wake();
  }, [showVolumeHud, wake]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen().catch(() => undefined);
    wake();
  }, [wake]);

  const toggleTilt = useCallback(async () => {
    try {
      const isFs = Boolean(
        document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement,
      );

      const orientation = window.screen?.orientation;
      const isLandscape =
        orientation?.type?.includes("landscape") ||
        Math.abs(Number(window.orientation || 0)) === 90;

      if (!isFs) {
        if (wrapRef.current?.requestFullscreen) {
          await wrapRef.current.requestFullscreen();
        } else if (
          (wrapRef.current as unknown as { webkitRequestFullscreen?: () => Promise<void> })
            ?.webkitRequestFullscreen
        ) {
          await (
            wrapRef.current as unknown as { webkitRequestFullscreen: () => Promise<void> }
          ).webkitRequestFullscreen();
        }
        if (orientation && "lock" in orientation) {
          await (orientation as unknown as { lock: (mode: string) => Promise<void> })
            .lock("landscape")
            .catch(() => {});
        }
      } else {
        if (isLandscape && orientation && "lock" in orientation) {
          await (orientation as unknown as { lock: (mode: string) => Promise<void> })
            .lock("portrait")
            .catch(() => {
              orientation.unlock?.();
            });
        } else if (orientation?.unlock) {
          orientation.unlock();
        }
        if (document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        } else if (
          (document as unknown as { webkitExitFullscreen?: () => Promise<void> })
            ?.webkitExitFullscreen
        ) {
          await (
            document as unknown as { webkitExitFullscreen: () => Promise<void> }
          ).webkitExitFullscreen().catch(() => {});
        }
      }
    } catch {
      toggleFullscreen();
    }
    wake();
  }, [toggleFullscreen, wake]);

  // Phone tilt: automatically enter fullscreen in landscape on mobile
  useEffect(() => {
    const handleOrientation = () => {
      // Only trigger on mobile screen sizes
      if (window.innerWidth > 1024) return;
      const isLandscape =
        window.screen?.orientation?.type?.includes("landscape") ||
        Math.abs(Number(window.orientation || 0)) === 90 ||
        (window.innerWidth > window.innerHeight && window.innerWidth < 900);

      if (isLandscape && !document.fullscreenElement && wrapRef.current) {
        wrapRef.current.requestFullscreen?.().catch(() => {});
      } else if (!isLandscape && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };

    window.addEventListener("orientationchange", handleOrientation);
    window.screen?.orientation?.addEventListener?.("change", handleOrientation);
    return () => {
      window.removeEventListener("orientationchange", handleOrientation);
      window.screen?.orientation?.removeEventListener?.("change", handleOrientation);
    };
  }, []);

  const advanceNext = useCallback(() => {
    if (!nextHref || advancing) return;
    setAdvancing(true);
    setNextCountdown(null);
    if (nextCb.current) nextCb.current();
    else window.location.assign(nextHref);
  }, [nextHref, advancing]);

  const replay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setNextCountdown(null);
    setAdvancing(false);
    video.currentTime = 0;
    void video.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (nextCountdown === null || nextCountdown <= 0 || !autoplayNext) return;
    const timer = window.setTimeout(() => {
      setNextCountdown((current) => (current === null ? null : Math.max(0, current - 1)));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [nextCountdown, autoplayNext]);

  useEffect(() => {
    if (nextCountdown === 0 && autoplayNext && nextHref) advanceNext();
  }, [nextCountdown, autoplayNext, nextHref, advanceNext]);

  /**
   * Move by a number of seconds. Repeated taps accumulate into one readout
   * ("+30s") rather than three separate flashes, which is what makes holding
   * the button feel like scrubbing instead of stuttering.
   */
  const nudgeBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const dir: 1 | -1 = seconds > 0 ? 1 : -1;
    const targetTime = Math.max(
      0,
      Math.min(video.currentTime + seconds, mediaEnd(video, video.currentTime + seconds)),
    );
    video.currentTime = targetTime;
    setTime(targetTime);
    nudgeSeq.current += 1;
    const seq = nudgeSeq.current;
    setNudge((current) =>
      current && current.dir === dir
        ? { dir, n: current.n + Math.abs(seconds) }
        : { dir, n: Math.abs(seconds) },
    );
    wake();
    window.setTimeout(() => {
      // Only the last tap in a burst clears the readout.
      if (nudgeSeq.current === seq) setNudge(null);
    }, 750);
  }, [wake]);

  // The menu closes the way every menu should: click away, or press Escape.
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest?.(".player__settings")) setSettingsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  // An open menu must not be yanked away by the idle timer.
  useEffect(() => {
    if (settingsOpen) {
      setIdle(false);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    } else {
      wake();
    }
  }, [settingsOpen, wake]);

  // ── keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const active = document.activeElement;
      // Ignore if user is typing inside text inputs, textareas, search, or contenteditable
      if (
        (active instanceof HTMLInputElement && active.type !== "range" && active.type !== "checkbox") ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      const key = event.key.toLocaleLowerCase();
      switch (key) {
        case " ":
        case "enter":
        case "k":
        case "mediaplaypause":
        case "mediaplay":
        case "mediapause":
        case "select":
        case "ok":
          event.preventDefault();
          toggle();
          break;
        case "arrowright":
        case "l":
        case "mediafastforward":
          event.preventDefault();
          nudgeBy(10);
          break;
        case "arrowleft":
        case "j":
        case "mediarewind":
          event.preventDefault();
          nudgeBy(-10);
          break;
        case "arrowup":
          event.preventDefault();
          changeVolume(Math.min(1, Number((video.volume + 0.05).toFixed(2))));
          break;
        case "arrowdown":
          event.preventDefault();
          changeVolume(Math.max(0, Number((video.volume - 0.05).toFixed(2))));
          break;
        case "f":
        case "mediarecord":
          event.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          event.preventDefault();
          toggleMute();
          break;
        case "c":
          if (subtitles.length) {
            event.preventDefault();
            chooseCaption(captionIndex >= 0 ? -1 : Math.min(lastCaption.current, subtitles.length - 1));
          }
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle, nudgeBy, changeVolume, toggleFullscreen, toggleMute, subtitles, chooseCaption, captionIndex]);

  // Global activity listener for fullscreen and touch/mouse interaction
  useEffect(() => {
    const onGlobalActivity = (event: PointerEvent) => {
      if (event.pointerType === "touch") isTouch.current = true;
      const player = wrapRef.current;
      const isFs = Boolean(
        document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement,
      );
      if (isFs || player?.matches(":hover")) {
        wake();
      }
    };

    window.addEventListener("pointermove", onGlobalActivity, { passive: true });
    window.addEventListener("pointerdown", onGlobalActivity, { passive: true });
    document.addEventListener("fullscreenchange", wake);
    document.addEventListener("webkitfullscreenchange", wake);
    return () => {
      window.removeEventListener("pointermove", onGlobalActivity);
      window.removeEventListener("pointerdown", onGlobalActivity);
      document.removeEventListener("fullscreenchange", wake);
      document.removeEventListener("webkitfullscreenchange", wake);
    };
  }, [wake]);

  /**
   * Automatic intro/outro skipping.
   *
   * The point of the watch screen is that you press play and stop making
   * decisions, so the opening and the credits are jumped for you rather than
   * offered as a button to hunt for. A short confirmation appears with a way
   * back, because silently moving someone 90 seconds is disorienting the first
   * time it happens.
   */
  useEffect(() => {
    if (skipMode !== "auto" || !duration) return;

    // A short grace period before cutting. Providers put the last seconds of a
    // scene inside the reported opening range more often than not, so jumping
    // the instant the range opens loses content the viewer wanted.
    const GRACE = 2.5;

    if (intro && !skippedIntro.current && time >= intro.start + GRACE && time < intro.end - 1) {
      skippedIntro.current = true;
      setSkipNotice({ kind: "opening", from: intro.start });
      seek(intro.end);
      return;
    }

    if (outro && !skippedOutro.current && time >= outro.start + GRACE && time < outro.end - 1) {
      skippedOutro.current = true;
      if (nextHref && autoplayNext) {
        advanceNext();
      } else {
        setSkipNotice({ kind: "credits", from: outro.start });
        seek(outro.end);
      }
    }
  }, [skipMode, time, duration, intro, outro, nextHref, autoplayNext, seek, advanceNext]);

  // The confirmation is a glance, not a dialog.
  useEffect(() => {
    if (!skipNotice) return;
    const t = window.setTimeout(() => setSkipNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [skipNotice]);

  /**
   * Touch: single tap toggles the chrome, double tap on the left/right third
   * rewinds/fast-forwards — the gesture every mobile viewer already knows
   * from other apps, without covering the video with a permanent overlay.
   */
  const onVideoTap = useCallback(
    (event: React.TouchEvent<HTMLVideoElement>) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      const touch = event.changedTouches[0];
      if (!rect || !touch) return;
      isTouch.current = true;
      const ratio = (touch.clientX - rect.left) / rect.width;
      const side: "left" | "right" | "mid" = ratio < 0.35 ? "left" : ratio > 0.65 ? "right" : "mid";
      const now = Date.now();

      const prev = lastTap.current;
      const isQuickFollowUp = prev && prev.side === side && (
        (prev.count >= 2 && now - prev.time < 650) || (now - prev.time < 380)
      );

      if (isQuickFollowUp) {
        lastTap.current = { time: now, side, count: prev.count + 1 };
        if (side === "left") {
          nudgeBy(-10);
        } else if (side === "right") {
          nudgeBy(10);
        } else if (prev.count === 1) {
          toggleFullscreen();
        }
        return;
      }

      lastTap.current = { time: now, side, count: 1 };
      window.setTimeout(() => {
        if (lastTap.current && lastTap.current.time === now && lastTap.current.count === 1) {
          lastTap.current = null;
          if (side === "mid") {
            if (idle || !playing) wake();
            else setIdle(true);
          } else {
            wake();
          }
        }
      }, 300);
    },
    [idle, nudgeBy, playing, toggleFullscreen, wake],
  );

  const activeLevelLabel = activeLevel >= 0 ? levels[activeLevel] : undefined;
  const inIntro = intro && time >= intro.start && time < intro.end;
  const inOutro = outro && time >= outro.start && time < outro.end;
  const progress = duration ? clamp01(time / duration) : 0;
  const bufferedProgress = duration ? clamp01(buffered / duration) : 0;
  const volumePercent = Math.round(volume * 100);

  return (
    <div
      ref={wrapRef}
      className={`player${idle ? " player--idle" : ""}`}
      role="region"
      aria-label={`${title}, ${episodeLabel} video player`}
      tabIndex={0}
      onPointerMove={wake}
      onTouchStart={wake}
      onFocus={wake}
      onMouseLeave={() => {
        if (playing && !settingsOpenRef.current) {
          if (hideTimer.current) window.clearTimeout(hideTimer.current);
          hideTimer.current = window.setTimeout(() => {
            if (!videoRef.current?.paused && !settingsOpenRef.current) setIdle(true);
          }, 1200);
        }
      }}
    >
      <video
        ref={videoRef}
        className="player__video"
        playsInline
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onTouchEnd={onVideoTap}
        crossOrigin="anonymous"
      >
        {subtitles.map((track) => (
          <track
            key={track.src}
            kind="subtitles"
            src={track.src}
            label={track.label}
            srcLang={subtitleLang(track.label)}
            onLoad={() => syncCaptionModes(captionIndex)}
          />
        ))}
      </video>

      {!ready && !error ? (
        <div className="player__state" role="status">
          <span className="player__spinner" aria-hidden />
          <p>Loading stream…</p>
        </div>
      ) : null}

      {ready && buffering && !error ? (
        <div className="player__buffering" role="status" aria-label="Buffering">
          <span className="player__spinner" aria-hidden />
        </div>
      ) : null}

      {/* YouTube-style transient play / pause center bezel ripple */}
      {bezel ? (
        <div className="player__bezel" role="status" aria-hidden>
          <div className="player__bezelRing">
            {bezel === "play" ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" />
              </svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
              </svg>
            )}
          </div>
        </div>
      ) : null}

      {error && !rotating ? (
        <div className="player__state player__state--error" role="alert">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="12" cy="12" r="9.3" />
            <path d="M12 7.5v5.5M12 16.3h.01" strokeLinecap="round" />
          </svg>
          <p>{error}</p>
          <div className="player__errorActions">
            <button className="player__retry" onClick={retry} disabled={retrying}>
              {retrying ? "Retrying…" : "Retry"}
            </button>
            <span className="player__hint">Trying another available server may help.</span>
          </div>
        </div>
      ) : null}

      {rotating && rotatingMessage && !activeSwitchingProvider ? (
        <div className="player__rotationToast" role="status">
          <span className="player__spinner" style={{ width: 14, height: 14 }} aria-hidden />
          <span>{rotatingMessage}</span>
        </div>
      ) : null}

      {activeSwitchingProvider ? <BeatLoader provider={activeSwitchingProvider} /> : null}

      <div className="player__top">
        <div>
          <b>{title}</b>
          <span>{episodeLabel}</span>
        </div>
      </div>

      {volumeHud ? (
        <div
          className="player__volhud"
          role="status"
          aria-label={`Volume ${volumeHud.muted ? 0 : Math.round(volumeHud.volume * 100)}%`}
        >
          <VolumeIcon muted={volumeHud.muted || volumeHud.volume === 0} />
          <div className="player__volhudBar">
            <span
              className="player__volhudFill"
              style={{ width: `${volumeHud.muted ? 0 : Math.round(volumeHud.volume * 100)}%` }}
            />
          </div>
          <span className="player__volhudPercent tnum">
            {volumeHud.muted ? "0%" : `${Math.round(volumeHud.volume * 100)}%`}
          </span>
        </div>
      ) : null}

      {nudge ? (
        <div
          className={nudge.dir === 1 ? "player__nudge is-fwd" : "player__nudge is-back"}
          aria-hidden
          key={`${nudge.dir}-${nudge.n}`}
        >
          <div className="player__nudgePill">
            <span className="player__nudgeIcon" aria-hidden>
              {nudge.dir === 1 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m13 17 5-5-5-5M6 17l5-5-5-5" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
                </svg>
              )}
            </span>
            <span className="player__nudgeSeconds tnum">
              {nudge.dir === 1 ? "+" : "−"}
              {nudge.n}s
            </span>
          </div>
        </div>
      ) : null}

      {inIntro && !skippedIntro.current && intro && (intro.end - intro.start) > 3 ? (
        <button
          className="player__skipPill"
          onClick={() => {
            skippedIntro.current = true;
            seek(intro.end);
          }}
          aria-label="Skip Opening"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M5 4.5v15a1 1 0 0 0 1.54.84l10-7.5a1 1 0 0 0 0-1.68l-10-7.5A1 1 0 0 0 5 4.5Z" />
            <path d="M19 4a1 1 0 0 0-1 1v14a1 1 0 0 0 2 0V5a1 1 0 0 0-1-1Z" />
          </svg>
          <span className="player__skipText">Skip Intro</span>
          <span className="player__skipdur tnum">{Math.max(0, Math.round(intro.end - time))}s</span>
        </button>
      ) : null}

      {inOutro && !skippedOutro.current && nextCountdown === null && !advancing && outro && (outro.end - outro.start) > 3 ? (
        <button
          className="player__skipPill"
          onClick={() => {
            skippedOutro.current = true;
            if (nextHref) advanceNext();
            else if (outro) seek(outro.end);
          }}
          aria-label="Next Episode"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M5 4.5v15a1 1 0 0 0 1.54.84l10-7.5a1 1 0 0 0 0-1.68l-10-7.5A1 1 0 0 0 5 4.5Z" />
            <path d="M19 4a1 1 0 0 0-1 1v14a1 1 0 0 0 2 0V5a1 1 0 0 0-1-1Z" />
          </svg>
          <span className="player__skipText">{nextHref ? "Next Episode" : "Skip Credits"}</span>
          <span className="player__skipdur tnum">{Math.max(0, Math.round(outro.end - time))}s</span>
        </button>
      ) : null}


      {nextCountdown !== null || advancing ? (
        <div className="player__handoff" role="status" aria-live="polite">
          <div className="player__handoffcopy">
            <span>{advancing ? "Up next" : autoplayNext ? `Playing in ${nextCountdown}s` : "Up next"}</span>
            <strong>{advancing ? "Opening next episode…" : nextLabel}</strong>
          </div>
          {!advancing ? (
            <div className="player__handoffactions">
              <button className="player__next" onClick={advanceNext}>
                Play now
              </button>
              <button onClick={() => setNextCountdown(null)}>Not yet</button>
              <button onClick={replay}>Watch again</button>
            </div>
          ) : (
            <span className="player__spinner" aria-hidden />
          )}
        </div>
      ) : null}

      <div className="player__bar">
        <div className="player__scrub">
          <span className="player__track" aria-hidden>
            <span className="player__buf" style={{ width: `${bufferedProgress * 100}%` }} />
            <span className="player__fill" style={{ width: `${progress * 100}%` }} />
            <span className="player__knob" style={{ left: `${progress * 100}%` }} />
          </span>
          <input
            type="range"
            aria-label="Seek through episode"
            aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(event) => seek(Number(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                nudgeBy(10);
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                nudgeBy(-10);
              }
            }}
          />
        </div>

        <div className="player__controls">
          <button className="player__icon" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            <span className={playing ? "player__morph is-second" : "player__morph"} aria-hidden>
              <svg className="player__glyph player__glyph--first" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" />
              </svg>
              <svg className="player__glyph player__glyph--second" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
              </svg>
            </span>
          </button>
          <button className="player__seekbtn" onClick={() => nudgeBy(-10)} aria-label="Back 10 seconds">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 4 12l7 7" />
              <path d="M20 5l-7 7 7 7" />
            </svg>
          </button>
          <button className="player__seekbtn" onClick={() => nudgeBy(10)} aria-label="Forward 10 seconds">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M13 5l7 7-7 7" />
              <path d="M4 5l7 7-7 7" />
            </svg>
          </button>

          <div className="player__volume">
            <button className="player__icon" onClick={toggleMute} aria-label={muted || volume === 0 ? "Unmute" : "Mute"}>
              <VolumeIcon muted={muted || volume === 0} />
            </button>
            <input
              type="range"
              className="player__volumeSlider"
              aria-label="Volume"
              aria-valuetext={`${muted ? 0 : volumePercent}%`}
              min={0}
              max={1}
              step={0.01}
              value={volume}
              style={{ "--volume": `${muted ? 0 : volumePercent}%` } as CSSProperties}
              onChange={(event) => changeVolume(Number(event.target.value))}
            />
          </div>

          <span className="player__time tnum">
            <span className="player__timeCurrent">{fmt(time)}</span>
            <span className="player__timeSep" aria-hidden> / </span>
            <span className="player__timeTotal">{fmt(duration)}</span>
          </span>

          <span className="player__spacer" />

          {inIntro && !skippedIntro.current && intro && (intro.end - intro.start) > 5 ? (
            <button
              className="player__skipTextBtn"
              onClick={() => {
                skippedIntro.current = true;
                seek(intro.end);
              }}
              aria-label="Skip Intro"
            >
              <span>Skip Intro</span>
              <span className="player__skipdur tnum">{Math.max(0, Math.round(intro.end - time))}s</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m13 17 5-5-5-5M6 17l5-5-5-5" />
              </svg>
            </button>
          ) : null}

          {inOutro && !skippedOutro.current && nextCountdown === null && !advancing && outro && (outro.end - outro.start) > 5 ? (
            <button
              className="player__skipTextBtn"
              onClick={() => {
                skippedOutro.current = true;
                if (nextHref) advanceNext();
                else if (outro) seek(outro.end);
              }}
              aria-label="Next Episode"
            >
              <span>{nextHref ? "Next Ep" : "Skip Outro"}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m13 17 5-5-5-5M6 17l5-5-5-5" />
              </svg>
            </button>
          ) : null}

          {/* Quick Audio Switcher (SUB / DUB or multi-track audio) */}
          {audioOptions.length > 1 && !hlsAudioTracks.length ? (
            <button
              className="player__icon player__audioQuickBtn"
              onClick={() => {
                const other = audioOptions.find((o) => o.value !== audio);
                if (other) onAudioChange?.(other, videoRef.current?.currentTime ?? 0);
              }}
              aria-label={`Switch audio to ${audio === "sub" ? "English Dub" : "Japanese Sub"}`}
              title={`Audio: ${audio.toUpperCase()} (Click to switch to ${audio === "sub" ? "DUB" : "SUB"})`}
            >
              <span className="player__audioBadge">{audio.toUpperCase()}</span>
            </button>
          ) : hlsAudioTracks.length > 1 ? (
            <button
              className="player__icon player__audioQuickBtn"
              onClick={() => {
                const curIdx = hlsAudioTracks.findIndex((t) => t.id === activeAudioTrack);
                const nextIdx = (curIdx + 1) % hlsAudioTracks.length;
                const nextTrack = hlsAudioTracks[nextIdx];
                if (nextTrack) {
                  userSelectedAudioTrack.current = nextTrack.id;
                  setActiveAudioTrack(nextTrack.id);
                  if (hlsRef.current) {
                    hlsRef.current.audioTrack = nextTrack.id;
                  } else if (videoRef.current && (videoRef.current as any).audioTracks) {
                    const vTracks = (videoRef.current as any).audioTracks;
                    for (let i = 0; i < vTracks.length; i++) {
                      vTracks[i].enabled = i === nextTrack.id;
                    }
                  }
                }
              }}
              aria-label={`Audio Track: ${hlsAudioTracks.find((t) => t.id === activeAudioTrack)?.label || "Audio"}`}
              title={`Current Audio: ${hlsAudioTracks.find((t) => t.id === activeAudioTrack)?.label || "Audio"} (Click to cycle)`}
            >
              <span className="player__audioBadge">
                {(() => {
                  const cur = hlsAudioTracks.find((t) => t.id === activeAudioTrack);
                  if (!cur) return "AUD";
                  const l = (cur.language || cur.label || "").toUpperCase();
                  if (l.includes("HIN")) return "HIN";
                  if (l.includes("JAP") || l.includes("JA")) return "JPN";
                  if (l.includes("ENG") || l.includes("EN")) return "ENG";
                  return cur.label.slice(0, 3).toUpperCase();
                })()}
              </span>
            </button>
          ) : null}

          {/* Quick Captions Toggle (CC) */}
          <button
            className={`player__icon player__ccBtn ${captionIndex >= 0 ? "is-on" : ""}`}
            onClick={() => {
              if (captionIndex >= 0) {
                chooseCaption(-1);
              } else {
                chooseCaption(lastCaption.current >= 0 ? lastCaption.current : 0);
              }
            }}
            aria-label={captionIndex >= 0 ? "Disable Subtitles (CC)" : "Enable Subtitles (CC)"}
            title={captionIndex >= 0 ? "Subtitles: ON (Click to turn off)" : "Subtitles: OFF (Click to turn on)"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect width="20" height="15" x="2" y="4.5" rx="3" />
              <path d="M7 15h3.5a1.5 1.5 0 0 0 0-3H8v-1h2.5" />
              <path d="M14 15h3.5a1.5 1.5 0 0 0 0-3H15v-1h2.5" />
            </svg>
          </button>

          <div className="player__settings">
            <button
              className={settingsOpen ? "player__icon is-on" : "player__icon"}
              aria-label="Playback settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="12" r="3.1" />
                <path d="M19.4 15a1.6 1.6 0 0 0 .33 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.76-.33 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.76.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06a1.6 1.6 0 0 0 .33-1.76 1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.33-1.76l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.76.33H9a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.76-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.33 1.76V9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
              </svg>
            </button>

            {settingsOpen ? (() => {
              const hasAudio = Boolean(
                (audioOptions && audioOptions.length > 1) ||
                (hlsAudioTracks && hlsAudioTracks.length > 1)
              );
              const hasServer = Boolean((servers && servers.length > 0) || (providers && providers.length > 1));
              const availableTabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
                {
                  id: "quality",
                  label: "Quality",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <line x1="4" x2="4" y1="21" y2="14" />
                      <line x1="4" x2="4" y1="10" y2="3" />
                      <line x1="12" x2="12" y1="21" y2="12" />
                      <line x1="12" x2="12" y1="8" y2="3" />
                      <line x1="20" x2="20" y1="21" y2="16" />
                      <line x1="20" x2="20" y1="12" y2="3" />
                      <line x1="1" x2="7" y1="14" y2="14" />
                      <line x1="9" x2="15" y1="8" y2="8" />
                      <line x1="17" x2="23" y1="16" y2="16" />
                    </svg>
                  ),
                },
                {
                  id: "speed",
                  label: "Speed",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  ),
                },
                ...(hasAudio
                  ? [
                      {
                        id: "audio" as const,
                        label: "Audio",
                        icon: (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                        ),
                      },
                    ]
                  : []),
                {
                  id: "subtitles",
                  label: "Captions",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect width="20" height="15" x="2" y="4.5" rx="2" />
                      <path d="M7 15h3.5a1.5 1.5 0 0 0 0-3H8v-1h2.5" />
                      <path d="M14 15h3.5a1.5 1.5 0 0 0 0-3H15v-1h2.5" />
                    </svg>
                  ),
                },
                ...(hasServer
                  ? [
                      {
                        id: "servers" as const,
                        label: servers?.length && providers?.length > 1 ? "Server" : servers?.length ? "Server" : "Source",
                        icon: (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect width="20" height="8" x="2" y="2" rx="2" />
                            <rect width="20" height="8" x="2" y="14" rx="2" />
                            <line x1="6" x2="6.01" y1="6" y2="6" strokeWidth="2.5" />
                            <line x1="6" x2="6.01" y1="18" y2="18" strokeWidth="2.5" />
                          </svg>
                        ),
                      },
                    ]
                  : []),
              ];

              const currentTab = availableTabs.some((t) => t.id === settingsTab) ? settingsTab : "quality";

              return (
                <>
                  <div className="player__menuScrim" onClick={() => setSettingsOpen(false)} aria-hidden />
                  <div className="player__menu" role="dialog" aria-label="Playback settings">
                    <div className="player__menuHandle" aria-hidden />

                    {/* Tabs navigation bar */}
                    <div className="player__tabsNav" role="tablist" aria-label="Settings Categories">
                      {availableTabs.map((tab) => {
                        const isActive = currentTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`player-tabpanel-${tab.id}`}
                            id={`player-tab-${tab.id}`}
                            className={isActive ? "player__tabBtn is-active" : "player__tabBtn"}
                            onClick={() => setSettingsTab(tab.id)}
                          >
                            <span className="player__tabIcon">{tab.icon}</span>
                            <span className="player__tabLabel">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="player__tabBody">
                      {/* Quality Tab */}
                      {currentTab === "quality" && (
                        <div className="player__tabContent" role="tabpanel" id="player-tabpanel-quality" aria-labelledby="player-tab-quality">
                          <button
                            className="player__menuitem"
                            aria-checked={level === -1}
                            role="menuitemradio"
                            onClick={() => {
                              setLevel(-1);
                              if (hlsRef.current) hlsRef.current.currentLevel = -1;
                            }}
                          >
                            <span className="player__menuitemText">
                              <span>Auto</span>
                              {activeLevelLabel ? <i>({activeLevelLabel})</i> : <i>(1080p)</i>}
                            </span>
                            {level === -1 && <CheckIcon />}
                          </button>
                          {levels.length > 1 ? (
                            levels.map((label, index) => (
                              <button
                                key={`${label}-${index}`}
                                className="player__menuitem"
                                aria-checked={level === index}
                                role="menuitemradio"
                                onClick={() => {
                                  setLevel(index);
                                  if (hlsRef.current) hlsRef.current.currentLevel = index;
                                }}
                              >
                                <span className="player__menuitemText">
                                  <span>{label}</span>
                                </span>
                                {level === index && <CheckIcon />}
                              </button>
                            ))
                          ) : (
                            ["1080p (HD)", "720p", "480p", "360p"].map((label, index) => (
                              <button
                                key={label}
                                className="player__menuitem"
                                aria-checked={level === index}
                                role="menuitemradio"
                                onClick={() => {
                                  setLevel(index);
                                  if (hlsRef.current && levels.length) {
                                    hlsRef.current.currentLevel = Math.min(index, levels.length - 1);
                                  }
                                }}
                              >
                                <span className="player__menuitemText">
                                  <span>{label}</span>
                                </span>
                                {level === index && <CheckIcon />}
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {/* Speed Tab */}
                      {currentTab === "speed" && (
                        <div className="player__tabContent" role="tabpanel" id="player-tabpanel-speed" aria-labelledby="player-tab-speed">
                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                            <button
                              key={rate}
                              className="player__menuitem"
                              aria-checked={playbackRate === rate}
                              role="menuitemradio"
                              onClick={() => {
                                setPlaybackRate(rate);
                                if (videoRef.current) videoRef.current.playbackRate = rate;
                              }}
                            >
                              <span className="player__menuitemText">
                                <span>{rate === 1 ? "1.0x (Normal)" : `${rate}x`}</span>
                              </span>
                              {playbackRate === rate && <CheckIcon />}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Audio Tab */}
                      {currentTab === "audio" && (
                        <div className="player__tabContent" role="tabpanel" id="player-tabpanel-audio" aria-labelledby="player-tab-audio">
                          {hlsAudioTracks.length > 1 && (
                            <>
                              <span className="player__menuhead">Audio Tracks</span>
                              {hlsAudioTracks.map((track) => {
                                const isSelected = activeAudioTrack === track.id;
                                const isHindi = isHindiTrack(track, provider?.includes("hindi") || provider === "watchanimeworld");
                                return (
                                  <button
                                    key={`hls-audio-${track.id}`}
                                    className="player__menuitem"
                                    aria-checked={isSelected}
                                    role="menuitemradio"
                                    onClick={() => {
                                      userSelectedAudioTrack.current = track.id;
                                      setActiveAudioTrack(track.id);
                                      if (hlsRef.current) {
                                        hlsRef.current.audioTrack = track.id;
                                      } else if (videoRef.current && (videoRef.current as any).audioTracks) {
                                        const vTracks = (videoRef.current as any).audioTracks;
                                        for (let i = 0; i < vTracks.length; i++) {
                                          vTracks[i].enabled = i === track.id;
                                        }
                                      }
                                    }}
                                  >
                                    <span className="player__menuitemText">
                                      <span>{track.label}</span>
                                      {isHindi && <i>(Hindi)</i>}
                                    </span>
                                    {isSelected && <CheckIcon />}
                                  </button>
                                );
                              })}
                            </>
                          )}

                          {audioOptions && audioOptions.length > 1 && (
                            <>
                              {hlsAudioTracks.length > 1 && (
                                <span className="player__menuhead" style={{ marginTop: 8 }}>
                                  Stream Version
                                </span>
                              )}
                              {audioOptions.map((option) => (
                                <button
                                  key={option.value}
                                  className="player__menuitem"
                                  aria-checked={option.value === audio}
                                  role="menuitemradio"
                                  onClick={() => onAudioChange?.(option, videoRef.current?.currentTime ?? 0)}
                                >
                                  <span className="player__menuitemText">
                                    <span>{option.label}</span>
                                  </span>
                                  {option.value === audio && <CheckIcon />}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      )}

                      {/* Subtitles Tab */}
                      {currentTab === "subtitles" && (
                        <div className="player__tabContent" role="tabpanel" id="player-tabpanel-subtitles" aria-labelledby="player-tab-subtitles">
                          <button
                            className="player__menuitem"
                            aria-checked={captionIndex === -1}
                            role="menuitemradio"
                            onClick={() => chooseCaption(-1)}
                          >
                            <span className="player__menuitemText">
                              <span>Off</span>
                            </span>
                            {captionIndex === -1 && <CheckIcon />}
                          </button>
                          {subtitles.length ? (
                            subtitles.map((track, index) => (
                              <button
                                key={track.src}
                                className="player__menuitem"
                                aria-checked={captionIndex === index}
                                role="menuitemradio"
                                onClick={() => chooseCaption(index)}
                              >
                                <span className="player__menuitemText">
                                  <span>{track.label}</span>
                                </span>
                                {captionIndex === index && <CheckIcon />}
                              </button>
                            ))
                          ) : (
                            <button
                              className="player__menuitem"
                              aria-checked={captionIndex === 0}
                              role="menuitemradio"
                              onClick={() => chooseCaption(0)}
                            >
                              <span className="player__menuitemText">
                                <span>English (Default)</span>
                              </span>
                              {captionIndex === 0 && <CheckIcon />}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Server / Provider Tab */}
                      {currentTab === "servers" && (
                        <div className="player__tabContent" role="tabpanel" id="player-tabpanel-servers" aria-labelledby="player-tab-servers">
                          {servers && servers.length > 0 ? (
                            <div className="player__menugroup">
                              <span className="player__menuhead">Streaming Server</span>
                              {servers.map((srv) => {
                                const isCur = srv.toLowerCase() === currentServer?.toLowerCase();
                                return (
                                  <button
                                    key={srv}
                                    className="player__menuitem"
                                    aria-checked={isCur}
                                    role="menuitemradio"
                                    onClick={() => {
                                      onServerChange?.(srv, videoRef.current?.currentTime ?? 0);
                                      setSettingsOpen(false);
                                    }}
                                  >
                                    <span className="player__menuitemText">
                                      <span>{srv}</span>
                                      {isCur ? <i>(Active)</i> : null}
                                    </span>
                                    {isCur && <CheckIcon />}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}

                          {providers && providers.length > 1 ? (
                            <div className="player__menugroup">
                              <span className="player__menuhead">Provider</span>
                              {providers.map((p) => {
                                const isCur = p.toLowerCase() === provider?.toLowerCase();
                                const provLabel =
                                  p === "zoro"
                                    ? "Zoro (HiAnime)"
                                    : p === "aniwave"
                                    ? "Aniwave"
                                    : p === "anidao"
                                    ? "Anidao"
                                    : p === "watchanimeworld"
                                    ? "AnimeWorld (Hindi)"
                                    : p === "hindi"
                                    ? "Hindi (Auto)"
                                    : p.toUpperCase();
                                return (
                                  <button
                                    key={p}
                                    className="player__menuitem"
                                    aria-checked={isCur}
                                    role="menuitemradio"
                                    onClick={() => {
                                      setLocalSwitching(p);
                                      onProviderChange?.(p, videoRef.current?.currentTime ?? 0);
                                      setSettingsOpen(false);
                                    }}
                                  >
                                    <span className="player__menuitemText">
                                      <span>{provLabel}</span>
                                      {isCur ? <i>(Active)</i> : null}
                                    </span>
                                    {isCur && <CheckIcon />}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })() : null}
          </div>

          <button
            className="player__icon player__tiltBtn"
            onClick={toggleTilt}
            aria-label="Rotate screen"
            title="Tilt / Rotate Screen"
          >
            <TiltIcon />
          </button>

          <button className="player__icon" onClick={toggleFullscreen} aria-label="Fullscreen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="player__checkIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <span className={muted ? "player__morph is-second" : "player__morph"} aria-hidden>
      <svg className="player__glyph player__glyph--first" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6.7 8.5H3.8v7h2.9L11 19V5Z" />
        <path d="M15 9.2a4 4 0 0 1 0 5.6m2.8-8.4a8 8 0 0 1 0 11.2" />
      </svg>
      <svg className="player__glyph player__glyph--second" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6.7 8.5H3.8v7h2.9L11 19V5Z" />
        <path d="m16 9 5 6m0-6-5 6" />
      </svg>
    </span>
  );
}

function mediaEnd(video: HTMLVideoElement, fallback: number): number {
  return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function subtitleLang(label: string): string {
  const value = label.toLocaleLowerCase();
  if (/english|\ben\b/.test(value)) return "en";
  if (/japanese|\bja\b/.test(value)) return "ja";
  if (/spanish|\bes\b/.test(value)) return "es";
  if (/french|\bfr\b/.test(value)) return "fr";
  if (/german|\bde\b/.test(value)) return "de";
  if (/italian|\bit\b/.test(value)) return "it";
  if (/portuguese|\bpt\b/.test(value)) return "pt";
  if (/arabic|\bar\b/.test(value)) return "ar";
  if (/hindi|\bhi\b/.test(value)) return "hi";
  if (/korean|\bko\b/.test(value)) return "ko";
  if (/chinese|\bzh\b/.test(value)) return "zh";
  if (/russian|\bru\b/.test(value)) return "ru";
  return "und";
}

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(remainder).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function TiltIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Vertical portrait phone on top-left */}
      <rect x="2.5" y="2.5" width="7.5" height="12.5" rx="2" />
      <path d="M5 4.5h2.5" />

      {/* Horizontal landscape phone on bottom-right */}
      <rect x="9.5" y="11.5" width="12" height="8" rx="2" />
      <path d="M19.5 14.5v2" />

      {/* Curved rotation arrow */}
      <path d="M14 3.5h3.5a2 2 0 0 1 2 2v3" />
      <path d="m17 6.5 2.5 2.5 2.5-2.5" />
    </svg>
  );
}
