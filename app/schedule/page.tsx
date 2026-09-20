export const runtime = "edge";
import type { Metadata } from "next";
import { getSchedule } from "@/lib/anilist";
import { fetchAniCoreSchedule, normalizeAniCoreScheduleItem } from "@/lib/anicore-schedule";
import { Footer } from "@/components/Footer";
import { Notice } from "@/components/Notice";
import { ScheduleView, type ScheduleDay } from "@/components/ScheduleView";
import type { ZoroScheduleEntry } from "@/lib/types";

export const metadata: Metadata = {
  title: "Schedule · Ani Ghost",
  description: "What airs today, and every day this week with official logos and artwork.",
};

export const revalidate = 900;

type Search = { day?: string };

function getMidnight(timestampMs: number): number {
  const d = new Date(timestampMs);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function formatHHMM(airingAtSeconds: number): string {
  const d = new Date(airingAtSeconds * 1000);
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${mins}`;
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { day } = await searchParams;

  // Build 7 days around today
  const now = Date.now();
  const todayMidnight = getMidnight(now);

  const days: ScheduleDay[] = [];
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (let i = 0; i < 7; i++) {
    const t = todayMidnight + i * 86400;
    const dateObj = new Date(t * 1000);
    const dayStr = DAY_NAMES[dateObj.getDay()];
    const fullDayName = FULL_DAY_NAMES[dateObj.getDay()];
    const dateStr = dateObj.toISOString().slice(0, 10);
    days.push({
      day: dayStr,
      fullDayName,
      date: dateStr,
      time: t,
      active: i === 0,
    });
  }

  const active = days.find((d) => d.active) ?? days[0];
  const wanted = Number(day) || active.time;

  let entries: ZoroScheduleEntry[] = [];
  let dayError: string | undefined;

  try {
    const aniCoreItems = await fetchAniCoreSchedule(7);
    if (aniCoreItems && aniCoreItems.length > 0) {
      entries = aniCoreItems.map(normalizeAniCoreScheduleItem);
    } else {
      // Fallback to AniList
      const fromTime = wanted;
      const toTime = wanted + 86400;
      const schedRes = await getSchedule(fromTime, toTime);
      const airingList = schedRes?.Page?.airingSchedules ?? [];
      entries = airingList.map((item: any) => {
        const media = item.media || {};
        const title = media.title?.english || media.title?.romaji || media.title?.native || "Unknown";
        const japaneseTitle = media.title?.native || media.title?.romaji;
        return {
          id: String(item.id || media.id),
          slug: String(media.id),
          title,
          japaneseTitle,
          time: item.airingAt ? formatHHMM(item.airingAt) : undefined,
          episodeNumber: item.episode,
          episodeLabel: item.episode ? `EP ${item.episode}` : undefined,
          poster: media.coverImage?.extraLarge || media.coverImage?.large,
          image: media.coverImage?.extraLarge || media.coverImage?.large,
          type: media.format || "TV",
          score: media.averageScore ? media.averageScore / 10 : undefined,
        };
      });
    }
  } catch (err: any) {
    dayError = err?.message || "Could not load broadcast schedule";
  }

  return (
    <main className="wrap page sched-page">
      <header className="page__head">
        <h1>Broadcast Schedule</h1>
        <p className="page__sub">
          Official Japanese broadcast slots. Subtitled episodes stream on Ani Ghost as soon as translation releases.
        </p>
      </header>

      {dayError ? (
        <Notice title="That day would not load" body={dayError} />
      ) : (
        <ScheduleView
          days={days}
          initialEntries={entries}
          initialDayTime={wanted}
        />
      )}

      <Footer />
    </main>
  );
}
