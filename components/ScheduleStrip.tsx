import Link from "next/link";
import { fetchAniCoreSchedule, normalizeAniCoreScheduleItem } from "@/lib/anicore-schedule";
import { getSchedule } from "@/lib/anilist";
import type { ZoroScheduleEntry } from "@/lib/types";

function formatHHMM(airingAtSeconds: number): string {
  const d = new Date(airingAtSeconds * 1000);
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${mins}`;
}

/**
 * Today's broadcast slots, compressed to a clean sleek strip with posters & logos.
 */
export async function ScheduleStrip() {
  const now = Date.now();
  const todayIso = new Date(now).toISOString().slice(0, 10);

  let entries: ZoroScheduleEntry[] = [];

  try {
    const aniCoreItems = await fetchAniCoreSchedule(7);
    if (aniCoreItems && aniCoreItems.length > 0) {
      const normalized = aniCoreItems.map(normalizeAniCoreScheduleItem);
      // Filter for today's date or pick first 14 upcoming
      const todayEntries = normalized.filter((e) => e.airDate === todayIso);
      entries = todayEntries.length > 0 ? todayEntries : normalized.slice(0, 14);
    } else {
      // Fallback
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      const todayMidnight = Math.floor(d.getTime() / 1000);
      const res = await getSchedule(todayMidnight, todayMidnight + 86400);
      const airingList = res?.Page?.airingSchedules ?? [];
      entries = airingList.slice(0, 14).map((item: any) => {
        const media = item.media || {};
        return {
          id: String(item.id || media.id),
          slug: String(media.id),
          title: media.title?.english || media.title?.romaji || media.title?.native || "Unknown",
          time: item.airingAt ? formatHHMM(item.airingAt) : "TBA",
          episodeLabel: item.episode ? `EP ${item.episode}` : undefined,
          poster: media.coverImage?.extraLarge || media.coverImage?.large,
        };
      });
    }
  } catch {
    return null;
  }

  if (!entries.length) return null;

  return (
    <section className="section on-air-section" id="schedule">
      <div className="section__head">
        <div>
          <h2>On air today</h2>
        </div>
        <div className="section__act">
          <Link className="btn btn--ghost btn--sm" href="/schedule">
            Full schedule &rarr;
          </Link>
        </div>
      </div>

      <div className="rail rail--slots">
        {entries.map((e) => {
          const poster = e.poster || e.image;
          return (
            <Link
              className="on-air__card"
              key={`${e.slug}-${e.episodeNumber ?? e.time ?? e.title}`}
              href={`/anime/${encodeURIComponent(e.slug)}`}
            >
              {poster ? (
                <div className="on-air__bg">
                  <img src={poster} alt={e.title} className="on-air__bgImg" loading="lazy" />
                  <div className="on-air__overlay" />
                </div>
              ) : null}

              <div className="on-air__top">
                <span className="on-air__time tnum">{e.time || "TBA"}</span>
                <span className="on-air__tz">JST</span>
              </div>

              {e.logo ? (
                <div className="on-air__logoWrap">
                  <img src={e.logo} alt={e.title} className="on-air__logoImg" loading="lazy" />
                </div>
              ) : (
                <span className="on-air__title">{e.title}</span>
              )}

              <span className="on-air__ep tnum">
                {e.episodeLabel || (e.episodeNumber ? `EP ${e.episodeNumber}` : "Upcoming")}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
