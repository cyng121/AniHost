"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Ghost } from "./Ghost";
import { AccountMenu } from "./AccountMenu";
import { SuggestPanel, useSuggestions } from "./SearchSuggest";
import {
  resultHref,
  scopeFromParam,
  scopeFromPath,
  scopePlaceholder,
  searchHref,
  type SearchScope,
} from "@/lib/search-scope";

const LEFT = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/#discover", label: "Discover" },
];
// Genres already has its own section on Browse, so it is not repeated here.
const RIGHT = [
  { href: "/manga", label: "Manga" },
  { href: "/schedule", label: "Schedule" },
  { href: "/saves", label: "Saved" },
];

/** Minimal shape of the vendor-prefixed speech API, which TS does not ship. */
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

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [stuck, setStuck] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [voiceReady, setVoiceReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchRef = useRef<HTMLFormElement>(null);

  // The section you are standing in decides what the box searches. On the
  // results page the URL wins, so a shared link keeps its scope.
  const routeScope = scopeFromParam(params.get("type")) ?? scopeFromPath(pathname);
  const [pickedScope, setPickedScope] = useState<SearchScope | null>(null);
  const scope = pickedScope ?? routeScope;

  // Walking into another section drops a manual choice, so the box goes
  // back to meaning what the page around it means.
  useEffect(() => setPickedScope(null), [routeScope]);

  const { items: suggestions, loading: suggestLoading } = useSuggestions(q, suggestOpen, scope);

  // Reset the highlight whenever the result set changes underneath it.
  useEffect(() => setActiveSuggestion(-1), [q, scope]);

  // Clicking anywhere outside the search closes the layer.
  useEffect(() => {
    if (!suggestOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [suggestOpen]);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // "/" focuses search, the way it works everywhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("anighost-theme");
    const resolved =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    setTheme(resolved);
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }, []);

  // Voice search only appears where the browser actually supports it, rather
  // than showing a mic that does nothing on Firefox.
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

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("anighost-theme", next);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Enter on a highlighted suggestion opens that title rather than running
    // a full search for text the viewer has already resolved.
    const picked = suggestions[activeSuggestion];
    setSuggestOpen(false);
    if (picked) {
      router.push(resultHref(picked.id, scope));
      return;
    }
    const term = q.trim();
    if (term) router.push(searchHref(term, scope));
  }

  /** Arrow keys walk the layer; Escape dismisses it without losing the query. */
  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestOpen(false);
      setActiveSuggestion(-1);
      return;
    }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestOpen(true);
      setActiveSuggestion((n) => (n + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((n) => (n <= 0 ? suggestions.length - 1 : n - 1));
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
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <header className={stuck ? "topbar stuck" : "topbar"}>
      <div className="topbar__in">
        <div className="topbar__lead">
          <Link className="brand" href="/" aria-label="Ani Ghost — home">
            <Ghost priority />
          </Link>
          <nav className="topnav topnav--left" aria-label="Primary">
            {LEFT.map((l) => (
              <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <form className="search" role="search" onSubmit={onSubmit} ref={searchRef}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.4-3.4" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder={scopePlaceholder(scope)}
            aria-label="Search"
            aria-autocomplete="list"
            aria-expanded={suggestOpen && q.trim().length > 1}
            autoComplete="off"
          />
          <span className="search__k" aria-hidden>/</span>
          {voiceReady ? (
            <button
              type="button"
              className={listening ? "search__mic is-live" : "search__mic"}
              onClick={listen}
              aria-label={listening ? "Stop listening" : "Search by voice"}
              aria-pressed={listening}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
              </svg>
            </button>
          ) : null}

          {suggestOpen ? (
            <SuggestPanel
              items={suggestions}
              loading={suggestLoading}
              query={q}
              scope={scope}
              onScope={(next) => {
                setPickedScope(next);
                inputRef.current?.focus();
              }}
              active={activeSuggestion}
              onHover={setActiveSuggestion}
              onPick={() => setSuggestOpen(false)}
            />
          ) : null}
        </form>

        <div className="topbar__right">
          <nav className="topnav topnav--right" aria-label="Library">
            {RIGHT.map((l) => (
              <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <span className="topbar__div" aria-hidden />
          <button className="icon-btn topbar__theme" onClick={toggleTheme} aria-label="Switch theme">
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="4.1" />
                <path d="M12 2.2v2.3M12 19.5v2.3M4.3 4.3l1.7 1.7M18 18l1.7 1.7M2.2 12h2.3M19.5 12h2.3M4.3 19.7 6 18M18 6l1.7-1.7" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6a8.5 8.5 0 1 0 10.6 10.6Z" />
              </svg>
            )}
          </button>

          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
