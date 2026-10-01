"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Ghost } from "./Ghost";
import { AccountMenu } from "./AccountMenu";

interface YouTubeHeaderProps {
  onToggleSidebar: () => void;
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function YouTubeHeader({ onToggleSidebar }: YouTubeHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [voiceReady, setVoiceReady] = useState(false);
  const [listening, setListening] = useState(false);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Focus input when mobile search is opened
  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [mobileSearchOpen]);

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        if (window.innerWidth <= 768) {
          setMobileSearchOpen(true);
        } else {
          inputRef.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setVoiceReady(true);
    return () => recognitionRef.current?.stop();
  }, []);

  const currentQuery = searchParams.get("q") ?? "";
  useEffect(() => {
    setQ(currentQuery);
  }, [currentQuery]);

  function onSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    inputRef.current?.blur();
    const term = (inputRef.current?.value || q).trim();
    if (term) {
      router.push(`/search?q=${encodeURIComponent(term)}`);
      setMobileSearchOpen(false);
    }
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  }

  function listen() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const said = event.results?.[0]?.[0]?.transcript?.trim();
      if (said) {
        setQ(said);
        router.push(`/search?q=${encodeURIComponent(said)}`);
        setMobileSearchOpen(false);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <header className={`yt-header ${mobileSearchOpen ? "yt-header--mobile-search-active" : ""}`}>
      {/* Mobile Search Overlay Bar */}
      {mobileSearchOpen ? (
        <div className="yt-mobile-search-bar">
          <button
            type="button"
            className="yt-icon-btn yt-mobile-search-back-btn"
            onClick={() => setMobileSearchOpen(false)}
            aria-label="Back"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          <form className="yt-mobile-search-form" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              className="yt-mobile-search-input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search AniGhost"
              aria-label="Search"
              autoComplete="off"
            />
            {q ? (
              <button
                type="button"
                className="yt-mobile-search-clear"
                onClick={() => setQ("")}
                aria-label="Clear"
              >
                ✕
              </button>
            ) : null}
          </form>

          {voiceReady ? (
            <button
              type="button"
              className={`yt-mic-btn yt-mobile-mic-btn ${listening ? "is-active" : ""}`}
              onClick={listen}
              aria-label="Voice search"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Left: Hamburger (desktop) & Brand */}
          <div className="yt-header__left">
            <button
              type="button"
              className="yt-icon-btn yt-header__guide-btn"
              onClick={onToggleSidebar}
              aria-label="Guide"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <Link className="yt-brand" href="/" aria-label="AniHost Home">
              <span className="yt-brand__logo" style={{ width: 26, height: 26 }}>
                <Ghost priority />
              </span>
              <span className="yt-brand__name">
                AniHost
                <span className="yt-brand__badge">IN</span>
              </span>
            </Link>
          </div>

          {/* Center: Search Box & Voice Mic (Desktop only) */}
          <div className="yt-header__center">
            <form className="yt-search-form" onSubmit={onSubmit} ref={searchRef}>
              <div className="yt-search-box">
                <input
                  ref={inputRef}
                  className="yt-search-input"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search anime"
                  aria-label="Search"
                  autoComplete="off"
                />
              </div>

              <button type="submit" className="yt-search-btn" aria-label="Search">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            </form>

            {voiceReady ? (
              <button
                type="button"
                className={`yt-mic-btn ${listening ? "is-active" : ""}`}
                onClick={listen}
                aria-label="Search with your voice"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>
            ) : null}
          </div>

          {/* Right: Search (mobile), Create (desktop), Notifications, Account */}
          <div className="yt-header__right">
            {/* Mobile Search Icon Button */}
            <button
              type="button"
              className="yt-icon-btn yt-mobile-search-btn"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            <Link href="/shorts" className="yt-icon-btn yt-desktop-only-btn" aria-label="Create / Watch Shorts">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" />
              </svg>
            </Link>

            <Link href="/schedule" className="yt-icon-btn" aria-label="Notifications / Schedule">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </Link>

            <AccountMenu />
          </div>
        </>
      )}
    </header>
  );
}


