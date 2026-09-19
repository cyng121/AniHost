"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ZoroScheduleEntry } from "@/lib/types";
import { SaveButton } from "@/components/SaveButton";

export type ScheduleDay = {
  day: string;
  fullDayName?: string;
  date: string;
  time: number;
  active?: boolean;
};

function sortScheduleEntries(list: ZoroScheduleEntry[]): ZoroScheduleEntry[] {
  return [...list].sort((a, b) => {
    const timeA = a.time || "99:99";
    const timeB = b.time || "99:99";
    return timeA.localeCompare(timeB);
  });
}

export function ScheduleView({
  days,
  initialEntries,
  initialDayTime,
}: {
  days: ScheduleDay[];
  initialEntries: ZoroScheduleEntry[];
  initialDayTime: number;
}) {
  const [selectedTime, setSelectedTime] = useState(initialDayTime);
  const [entries] = useState<ZoroScheduleEntry[]>(initialEntries);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Scroll height and progress calculation for animated gradient spine line
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineHeight, setTimelineHeight] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const activeDay = useMemo(() => {
    return days.find((d) => d.time === selectedTime) ?? days.find((d) => d.active) ?? days[0];
  }, [days, selectedTime]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter entries strictly for the currently selected active day
  const currentDayData = useMemo(() => {
    const d = activeDay;

    const dayEntries = entries.filter((e) => {
      if (e.airDate && d.date) {
        return e.airDate === d.date;
      }
      if (e.day && (d.fullDayName || d.day)) {
        const targetDay = (d.fullDayName || d.day).toLowerCase();
        return e.day.toLowerCase().includes(targetDay) || targetDay.includes(e.day.toLowerCase());
      }
      return false;
    });

    return {
      dayInfo: d,
      items: sortScheduleEntries(dayEntries),
    };
  }, [entries, activeDay]);

  // Recalculate line height and handle scroll position progress for mobile & desktop
  useEffect(() => {
    if (timelineRef.current) {
      const updateHeight = () => {
        if (timelineRef.current) {
          setTimelineHeight(timelineRef.current.getBoundingClientRect().height);
        }
      };
      updateHeight();
      window.addEventListener("resize", updateHeight);
      return () => window.removeEventListener("resize", updateHeight);
    }
  }, [currentDayData]);

  useEffect(() => {
    const handleScroll = () => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight || 800;
      const totalHeight = rect.height;
      if (totalHeight <= 0) return;

      const startOffset = windowHeight * 0.65;
      const currentPos = startOffset - rect.top;
      const progress = Math.min(Math.max(currentPos / totalHeight, 0), 1);
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchmove", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchmove", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const selectDayTab = (dayTime: number) => {
    setSelectedTime(dayTime);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { dayInfo, items } = currentDayData;
  const isToday = Boolean(dayInfo.active);

  return (
    <div className="sched-view-wrapper" ref={containerRef}>
      {/* ── Calendar Days Filter Bar ── */}
      <nav className="sched__timeline" aria-label="Schedule calendar days">
        {days.map((d) => {
          const isSelected = d.time === activeDay.time;
          const isTodayTab = Boolean(d.active);
          return (
            <button
              type="button"
              key={d.time}
              className={`sched__day ${isSelected ? "is-selected" : ""} ${isTodayTab ? "is-today" : ""}`}
              onClick={() => selectDayTab(d.time)}
            >
              <span className="sched__dayName">{d.day}</span>
              <span className="sched__dayDate tnum">{d.date.slice(5)}</span>
              {isTodayTab ? <span className="sched__todayPill">Today</span> : null}
            </button>
          );
        })}
      </nav>

      {/* ── Header Controls ── */}
      <div className="sched__controls">
        <div className="sched__meta">
          <h2>
            {dayInfo.fullDayName || dayInfo.day} Broadcasts <span className="sched__dateText">({dayInfo.date})</span>
          </h2>
          <p className="sched__subText tnum">
            {items.length} scheduled broadcast{items.length === 1 ? "" : "s"} &middot; Chronological Timeline (JST)
          </p>
        </div>
      </div>

      {/* ── Centered Spine Alternating Timeline with Animated Gradient Progress Line ── */}
      {items.length ? (
        <div className="sched__timelineTrack" ref={timelineRef}>
          {/* Centered Background Spine Track */}
          <div className="sched__timelineSpine" style={{ height: `${timelineHeight}px` }}>
            {/* Animated Gradient Line Fill */}
            <div
              className="sched__timelineFill"
              style={{
                height: `${scrollProgress * 100}%`,
                opacity: scrollProgress > 0 ? 1 : 0.4,
              }}
            />
          </div>

          <ol className="sched__timelineList">
            {items.map((e, itemIdx) => {
              const epNum =
                e.episodeNumber ??
                (e.episodeLabel ? Number(e.episodeLabel.replace(/\D/g, "")) : undefined);
              const eventId = `${e.slug}-${dayInfo.date}-${itemIdx}`;
              const isExpanded = expandedIds.has(eventId);
              const posterImg = e.poster || e.image;
              const isLeft = itemIdx % 2 === 0;

              return (
                <li
                  key={eventId}
                  className={`sched__timelineItem ${isLeft ? "is-left" : "is-right"}`}
                >
                  {/* Central Node Circle on the Spine Line */}
                  <div className="sched__timelineNode" aria-hidden>
                    <span className={`sched__timelineDot ${isToday ? "is-today" : ""}`} />
                  </div>

                  {/* Alternating Side Timeline Card */}
                  <div className="sched__timelineCard">
                    <div className="sched__timelineHeader">
                      <div className="sched__timeBadge tnum">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{e.time || "TBA"}</span>
                        <span className="sched__tzSub">JST</span>
                      </div>

                      <div className="sched__badges">
                        {e.score ? (
                          <span className="sched__scoreBadge tnum">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            {e.score.toFixed(1)}
                          </span>
                        ) : null}

                        {e.episodeLabel || epNum ? (
                          <span className="sched__epTag tnum">
                            {e.episodeLabel || `EP ${epNum}`}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Inside Card: Side-by-Side Poster & Info Layout */}
                    <div className="sched__cardContent">
                      {/* Poster artwork on left */}
                      {posterImg ? (
                        <Link href={`/anime/${encodeURIComponent(e.slug)}`} className="sched__posterWrap">
                          <img
                            src={posterImg}
                            alt={e.title}
                            className="sched__posterImg"
                            loading="lazy"
                          />
                          {e.type ? <span className="sched__typeBadge">{e.type}</span> : null}
                        </Link>
                      ) : null}

                      {/* Anime Info on right */}
                      <div className="sched__timelineBody">
                        {/* Title Logo if available */}
                        {e.logo ? (
                          <div className="sched__logoWrap">
                            <Link href={`/anime/${encodeURIComponent(e.slug)}`}>
                              <img
                                src={e.logo}
                                alt={e.title}
                                className="sched__logoImg"
                                loading="lazy"
                              />
                            </Link>
                          </div>
                        ) : null}

                        <h3 className="sched__eventTitle">
                          <Link href={`/anime/${encodeURIComponent(e.slug)}`}>
                            {e.title}
                          </Link>
                        </h3>

                        {e.japaneseTitle && e.japaneseTitle !== e.title ? (
                          <p className="sched__eventJp">{e.japaneseTitle}</p>
                        ) : null}

                        {/* Studios & Genres Tags */}
                        {((e.studios && e.studios.length > 0) || (e.genres && e.genres.length > 0)) && (
                          <div className="sched__tagGroup">
                            {e.studios?.slice(0, 2).map((st) => (
                              <span key={st} className="sched__studioTag">{st}</span>
                            ))}
                            {e.genres?.slice(0, 2).map((g) => (
                              <span key={g} className="sched__genrePill">{g}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="sched__timelineActions">
                      <SaveButton
                        variant="icon"
                        slug={e.slug}
                        title={e.title}
                        type="anime"
                      />
                      <Link
                        className="btn btn--ghost btn--sm sched__viewBtn"
                        href={`/anime/${encodeURIComponent(e.slug)}`}
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        className="sched__expandBtn"
                        onClick={() => toggleExpand(eventId)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Collapse details" : "Expand details"}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="sched__timelineDetails">
                        <div className="sched__detailRow">
                          <span className="sched__detailLabel">Broadcast:</span>
                          <span className="sched__detailVal">{dayInfo.fullDayName || dayInfo.day}, {e.time || "TBA"} JST</span>
                        </div>
                        {e.japaneseTitle ? (
                          <div className="sched__detailRow">
                            <span className="sched__detailLabel">Original:</span>
                            <span className="sched__detailVal">{e.japaneseTitle}</span>
                          </div>
                        ) : null}
                        {e.studios && e.studios.length > 0 ? (
                          <div className="sched__detailRow">
                            <span className="sched__detailLabel">Studios:</span>
                            <span className="sched__detailVal">{e.studios.join(", ")}</span>
                          </div>
                        ) : null}
                        {e.genres && e.genres.length > 0 ? (
                          <div className="sched__detailRow">
                            <span className="sched__detailLabel">Genres:</span>
                            <span className="sched__detailVal">{e.genres.join(", ")}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="sched__empty">
          <div className="sched__emptyIcon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h3>No broadcasts match on {dayInfo.fullDayName || dayInfo.day}</h3>
          <p>Select a different day on the calendar above.</p>
        </div>
      )}
    </div>
  );
}
