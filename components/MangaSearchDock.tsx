"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SearchResultItem {
  id: string;
  title: string;
  cover: string;
  type: string;
  author: string;
  rating?: number | string;
  latestChapter?: string;
}

interface MangaSearchDockProps {
  initialQuery?: string;
  initialType?: string;
}

const TYPE_OPTIONS = [
  { label: "Manga", value: "manga", desc: "Japanese comics" },
  { label: "Manwha", value: "manwha", desc: "Korean webtoons" },
  { label: "Manhua", value: "manhua", desc: "Chinese comics" },
  { label: "All", value: "all", desc: "All comic types" },
];

export function MangaSearchDock({ initialQuery = "", initialType = "manga" }: MangaSearchDockProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState(initialType.toLowerCase() || "manga");
  const [isOpen, setIsOpen] = useState(false);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync initial query and type from props if changed
  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (initialType) {
      setSelectedType(initialType.toLowerCase());
    }
  }, [initialType]);

  // Handle global keyboard shortcuts: '/' or 'Cmd+K' / 'Ctrl+K'
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive = activeTag === "input" || activeTag === "textarea";

      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && !isInputActive) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setIsTypeMenuOpen(false);
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close popovers when clicking outside the dock
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsTypeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live search debounced fetch
  const fetchLiveResults = useCallback(async (searchQuery: string, typeFilter: string) => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const typeParam = typeFilter && typeFilter !== "all" ? `&type=${encodeURIComponent(typeFilter)}` : "";
      const res = await fetch(`/api/manga/search?q=${encodeURIComponent(q)}${typeParam}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (val.trim().length >= 2) {
      debounceTimer.current = setTimeout(() => {
        fetchLiveResults(val, selectedType);
      }, 250);
    } else {
      setResults([]);
      setIsLoading(false);
    }
  };

  const handleSelectType = (val: string) => {
    setSelectedType(val);
    setIsTypeMenuOpen(false);

    // If there's an active query in the input or url
    const q = query.trim();
    if (q) {
      const typeParam = val !== "all" ? `&type=${encodeURIComponent(val)}` : "";
      router.push(`/manga?q=${encodeURIComponent(q)}${typeParam}`);
      // Re-fetch live results with new type filter
      fetchLiveResults(q, val);
    } else {
      if (val === "all") {
        router.push("/manga");
      } else {
        router.push(`/manga?type=${encodeURIComponent(val)}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setIsOpen(false);
    setIsTypeMenuOpen(false);

    const typeParam = selectedType !== "all" ? `&type=${encodeURIComponent(selectedType)}` : "";

    if (q) {
      router.push(`/manga?q=${encodeURIComponent(q)}${typeParam}`);
    } else if (selectedType !== "all") {
      router.push(`/manga?type=${encodeURIComponent(selectedType)}`);
    } else {
      router.push("/manga");
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
    if (initialQuery) {
      if (selectedType !== "all") {
        router.push(`/manga?type=${encodeURIComponent(selectedType)}`);
      } else {
        router.push("/manga");
      }
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showPopover = isOpen && (query.trim().length >= 2 || results.length > 0 || isLoading);

  const activeTypeObj = TYPE_OPTIONS.find((t) => t.value === selectedType) || TYPE_OPTIONS[0];

  const searchPlaceholder =
    selectedType === "manwha"
      ? "Search manhwa..."
      : selectedType === "manhua"
      ? "Search manhua..."
      : selectedType === "all"
      ? "Search all comics..."
      : "Search manga...";

  return (
    <div className="manga-dock-container" ref={dockRef}>
      {/* ── Type Selector Dropdown Menu (Floats above type badge) ── */}
      {isTypeMenuOpen ? (
        <div className="manga-dock-type-menu" ref={typeMenuRef} role="menu">
          <div className="manga-dock-type-menu__header">Select Type</div>
          {TYPE_OPTIONS.map((opt) => {
            const isSelected = opt.value === selectedType;
            return (
              <button
                key={opt.value}
                type="button"
                className={`manga-dock-type-menu__item ${isSelected ? "is-selected" : ""}`}
                onClick={() => handleSelectType(opt.value)}
                role="menuitem"
              >
                <div className="manga-dock-type-menu__item-left">
                  <span className="manga-dock-type-menu__item-label">{opt.label}</span>
                  <span className="manga-dock-type-menu__item-desc">{opt.desc}</span>
                </div>
                {isSelected ? (
                  <svg className="manga-dock-type-menu__check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ── Live Autocomplete Popover (Floats above the search dock) ── */}
      {showPopover ? (
        <div className="manga-dock-popover" role="listbox">
          <div className="manga-dock-popover__header">
            <span>
              {isLoading
                ? "Searching titles..."
                : results.length > 0
                ? `${activeTypeObj.label} Suggestions (${results.length})`
                : "No results found"}
            </span>
            <span className="manga-dock-popover__hint">Esc to close</span>
          </div>

          <div className="manga-dock-popover__list">
            {isLoading ? (
              <div className="manga-dock-popover__loading">
                <div className="manga-dock-spinner" />
                <span>Searching title database...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((item) => (
                <Link
                  key={item.id}
                  href={`/manga/${encodeURIComponent(item.id)}`}
                  className="manga-dock-popover__item"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="manga-dock-popover__thumb">
                    {item.cover ? (
                      <img src={item.cover} alt="" loading="lazy" />
                    ) : (
                      <div className="manga-dock-popover__thumb-fallback">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="manga-dock-popover__meta">
                    <div className="manga-dock-popover__title" title={item.title}>
                      {item.title}
                    </div>
                    <div className="manga-dock-popover__sub">
                      <span>{item.type}</span>
                      {item.author && item.author !== item.type ? (
                        <>
                          <span>•</span>
                          <span className="manga-dock-popover__author">{item.author}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {item.rating ? (
                    <div className="manga-dock-popover__badge">
                      ★ {typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating}
                    </div>
                  ) : item.latestChapter ? (
                    <div className="manga-dock-popover__badge">Ch. {item.latestChapter}</div>
                  ) : null}
                </Link>
              ))
            ) : query.trim().length >= 2 ? (
              <div className="manga-dock-popover__empty">
                No {activeTypeObj.label.toLowerCase()} matching &ldquo;{query}&rdquo;
              </div>
            ) : null}
          </div>

          {query.trim().length > 0 ? (
            <button
              type="button"
              className="manga-dock-popover__viewall"
              onClick={handleSubmit}
            >
              <span>View all {activeTypeObj.label.toLowerCase()} results for &ldquo;<strong>{query}</strong>&rdquo;</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── Main Dock Bar ── */}
      <div className={`manga-dock-bar ${isFocused ? "is-focused" : ""}`}>
        {/* Left Type Selector Badge (Clickable to switch Manga, Manwha, Manhua) */}
        <button
          type="button"
          className={`manga-dock-badge manga-dock-badge--clickable ${isTypeMenuOpen ? "is-open" : ""}`}
          onClick={() => {
            setIsTypeMenuOpen((prev) => !prev);
            setIsOpen(false);
          }}
          title="Click to switch between Manga, Manwha, and Manhua"
          aria-haspopup="menu"
          aria-expanded={isTypeMenuOpen}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span className="manga-dock-badge__text">{activeTypeObj.label}</span>
          <svg
            className={`manga-dock-badge__chevron ${isTypeMenuOpen ? "is-rotated" : ""}`}
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Search Input Form */}
        <form className="manga-dock-form" onSubmit={handleSubmit}>
          <div className="manga-dock-input-wrap">
            <svg
              className="manga-dock-search-icon"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              ref={inputRef}
              type="text"
              className="manga-dock-input"
              placeholder={searchPlaceholder}
              value={query}
              onChange={handleInputChange}
              onFocus={() => {
                setIsFocused(true);
                setIsTypeMenuOpen(false);
                setIsOpen(true);
              }}
              onBlur={() => setIsFocused(false)}
              aria-label={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />

            {query ? (
              <button
                type="button"
                className="manga-dock-clear-btn"
                onClick={handleClear}
                title="Clear search"
                aria-label="Clear"
              >
                ✕
              </button>
            ) : (
              <span className="manga-dock-shortcut-badge" title="Press / to search">/</span>
            )}
          </div>

          <button
            type="submit"
            className="manga-dock-submit-btn"
            title="Search"
            aria-label="Submit search"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </form>

        <div className="manga-dock-divider" />

        {/* Scroll To Top Action Button */}
        <button
          type="button"
          className="manga-dock-action-btn manga-dock-action-btn--scroll"
          onClick={scrollToTop}
          title="Back to Top"
          aria-label="Back to top"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
