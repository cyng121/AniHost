export const runtime = "edge";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/backend";
import { loadTitle } from "@/lib/catalogue";
import type { ZoroEpisode } from "@/lib/types";
import { proxiedPlaylist, proxiedSubtitle, resolveStream } from "@/lib/stream";
import { findAnimeFranchiseData } from "@/lib/relations";
import { WatchStage } from "@/components/WatchStage";
import { YouTubeWatchView } from "@/components/YouTubeWatchView";
import { CommunityThread } from "@/components/CommunityThread";
import { Notice } from "@/components/Notice";
import { Footer } from "@/components/Footer";
import { ViewerIsland } from "@/components/ViewerIsland";

/**
 * Source links are short-lived signed URLs, so this page is always rendered
 * fresh. Everything above it — info, episode list — is still served from the
 * cached backend layer, so "fresh" costs one request, not four.
 */
export const dynamic = "force-dynamic";

type Params = { slug: string; ep: string };
type Search = { audio?: string; server?: string; provider?: string; t?: string; play?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, ep } = await params;
  const res = await loadTitle(slug);
  const name = res.ok ? res.info.title : slug.replace(/-/g, " ");
  return { title: `${name} · Episode ${ep} — YouTube Watch`, robots: { index: false } };
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug, ep } = await params;
  const sp = await searchParams;
  const wanted = Number(ep);
  if (!Number.isFinite(wanted)) notFound();

  const result = await loadTitle(slug);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <Fail slug={slug} message={result.error} />;
  }

  const { info, episodeError } = result;
  let episodes = result.episodes;

  const anilistId = /^\d+$/.test(slug) ? slug : (info.anilistId ? String(info.anilistId) : null);
  // Only fallback to fetching AniList episodes if episodes list was empty in cached result
  if (!episodes.length && anilistId) {
    const anilistRes = await api.anilistEpisodes(anilistId);
    if (anilistRes.ok && Array.isArray(anilistRes.data) && anilistRes.data.length > 0) {
      episodes = anilistRes.data.map((item, idx) => {
        const epNum = Number(item.number ?? idx + 1);
        const existing = result.episodes.find((e) => e.number === epNum);
        return {
          number: epNum,
          slug: String(epNum),
          title: item.title || existing?.title || `Episode ${epNum}`,
          description: item.description || existing?.description,
          thumbnail: item.img || existing?.thumbnail || info.image,
          ids: existing?.ids || "",
          sub: existing?.sub ?? true,
          dub: existing?.dub ?? true,
        };
      });
    }
  }

  const franchise = await findAnimeFranchiseData(info.anilistId, info.title);

  let effectiveAnilistId =
    (/^\d+$/.test(slug) ? slug : null) ||
    (info.anilistId ? String(info.anilistId) : null) ||
    (franchise.anilistId ? String(franchise.anilistId) : null);

  if (!effectiveAnilistId && info.title) {
    try {
      const { searchAnime } = await import("@/lib/anilist");
      const cleanTitle = info.title.replace(/\s*\([^)]*\)/g, "").trim();
      const searchRes = await searchAnime(cleanTitle || info.title, 1, 1);
      const first = searchRes?.Page?.media?.[0] || searchRes?.results?.[0];
      if (first?.id) {
        effectiveAnilistId = String(first.id);
      }
    } catch {
      // Ignore
    }
  }

  if (!episodes.length) {
    return <Fail slug={slug} message={episodeError ?? "This title has no listed episodes."} />;
  }

  const idx = episodes.findIndex((e) => e.number === wanted);
  if (idx === -1) notFound();

  const current = episodes[idx];
  const prev = episodes[idx - 1];
  const next = episodes[idx + 1];

  const provider = sp.provider || "zoro";
  const isHindi =
    provider === "watchanimeworld" ||
    provider === "hindi";
  const audio: "sub" | "dub" = sp.audio ? (sp.audio === "dub" ? "dub" : "sub") : (isHindi ? "dub" : "sub");
  const startAt = Math.max(0, Number(sp.t) || 0);

  const { stream, available, error, episodeMeta } = await resolveStream(current.ids, {
    audio,
    serverName: sp.server,
    provider,
    anilistId: effectiveAnilistId,
    episodeNumber: current.number,
    relativeEpisodeNumber: idx + 1,
  });

  const servers = available[stream?.audio ?? audio] ?? [];
  // Handed to the client so a dying source can rotate without a round trip.
  const cleanServer = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const curSrv = stream?.serverName ? cleanServer(stream.serverName) : "";
  const at = curSrv
    ? servers.findIndex((s) => {
        const cs = cleanServer(s);
        return cs === curSrv || cs.includes(curSrv) || curSrv.includes(cs);
      })
    : -1;
  const fallbackServer =
    at >= 0 && at + 1 < servers.length
      ? servers[at + 1]
      : (servers.find((s) => cleanServer(s) !== curSrv) ?? null);

  const currentStill = episodeMeta?.thumbnail || current.thumbnail || info.image;
  const currentTitle = episodeMeta?.title || current.title;
  const episodeLabel = readableEpisode(current.number, currentTitle);
  const nextHref = next
    ? link(slug, next.number, audio, undefined, provider)
    : undefined;
  const prevHref = prev
    ? link(slug, prev.number, audio, undefined, provider)
    : undefined;

  const audioOptions = isHindi
    ? []
    : [
        ...(available.sub.length
          ? [
              {
                value: "sub" as const,
                label: "Original + subtitles",
                href: link(slug, wanted, "sub", undefined, provider),
              },
            ]
          : []),
        ...(available.dub.length
          ? [
              {
                value: "dub" as const,
                label: "English dub",
                href: link(slug, wanted, "dub", undefined, provider),
              },
            ]
          : []),
      ];

  const playerNode = stream ? (
    <WatchStage
      slug={slug}
      title={info.title}
      image={currentStill || info.image}
      episode={current.number}
      episodeTitle={episodeLabel}
      audio={stream.audio}
      src={proxiedPlaylist(stream)}
      subtitles={stream.subtitles.map((t) => ({
        ...t,
        src: proxiedSubtitle(t.src, stream.referer),
      }))}
      intro={stream.intro}
      outro={stream.outro}
      nextHref={nextHref}
      nextLabel={next ? readableEpisode(next.number, next.title) : undefined}
      audioOptions={audioOptions}
      startAt={startAt}
      autoStart={sp.play !== "0"}
      fallbackServer={fallbackServer}
      servers={servers}
      currentServer={stream.serverName}
      provider={provider}
      providers={["zoro", "aniwave", "anidao", "watchanimeworld"]}
    />
  ) : (
    <div
      className="watch__dead"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        textAlign: "center",
        background: "#181818",
      }}
    >
      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "12px", color: "#fff" }}>
        No source would play this episode
      </h2>
      <p style={{ color: "#aaa", marginBottom: "16px" }}>{error ?? "Every server refused the request."}</p>
      {available.sub.length || available.dub.length ? (
        <p style={{ color: "#888", fontSize: "13px" }}>
          Try switching audio or selecting another server below — availability changes minute to minute.
        </p>
      ) : null}
    </div>
  );

  const commentsNode = (
    <CommunityThread
      key={`${slug}:${current.number}`}
      slug={slug}
      title={info.title}
      episode={current.number}
    />
  );

  return (
    <div>
      <YouTubeWatchView
        slug={slug}
        info={info}
        episodeNumber={current.number}
        episodeTitle={episodeLabel}
        audio={audio}
        availableSub={Boolean(available.sub.length)}
        availableDub={Boolean(available.dub.length)}
        servers={servers}
        currentServer={stream?.serverName}
        provider={provider}
        providers={["zoro", "aniwave", "anidao", "watchanimeworld"]}
        episodes={episodes}
        seasons={franchise.seasons}
        characters={franchise.characters}
        recommendations={franchise.recommendations}
        playerNode={playerNode}
        commentsNode={commentsNode}
        prevHref={prevHref}
        nextHref={nextHref}
        prevNumber={prev?.number}
        nextNumber={next?.number}
      />

      <ViewerIsland />

      <div style={{ marginTop: "48px" }}>
        <Footer />
      </div>
    </div>
  );
}

function link(slug: string, ep: number, audio: "sub" | "dub", server?: string, provider?: string): string {
  const q = new URLSearchParams({ audio });
  if (server) q.set("server", server);
  if (provider) q.set("provider", provider);
  return `/watch/${encodeURIComponent(slug)}/${ep}?${q}`;
}

function readableEpisode(number: number, title?: string): string {
  const named = (title ?? "").trim();
  const generic = !named || new RegExp(`^(episode\\s*)?${number}$`, "i").test(named);
  return generic ? `Episode ${number}` : `Episode ${number} · ${named}`;
}

function Fail({ slug, message }: { slug: string; message: string }) {
  return (
    <main className="wrap page">
      <Notice
        title="This episode would not load"
        body={message}
        action={{ href: `/anime/${encodeURIComponent(slug)}`, label: "Back to the title" }}
      />
      <Footer />
    </main>
  );
}
