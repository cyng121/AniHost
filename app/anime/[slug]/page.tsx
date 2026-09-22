export const runtime = "edge";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/backend";
import { loadTitle } from "@/lib/catalogue";
import { Footer } from "@/components/Footer";
import { Notice } from "@/components/Notice";
import { findAnimeFranchiseData } from "@/lib/relations";
import { YouTubeChannelView } from "@/components/YouTubeChannelView";

export const revalidate = 1800;

type Params = { slug: string };
type Search = { audio?: string; season?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await loadTitle(slug);
  if (!res.ok) {
    return {
      title: "Title",
      openGraph: { images: [] },
      twitter: { images: [] },
    };
  }
  const info = res.info;
  const description = trim(info.description ?? info.synopsis ?? "", 180);
  const images = info.image ? [{ url: info.image, alt: `Cover art for ${info.title}` }] : [];
  return {
    title: info.title,
    description,
    openGraph: { title: info.title, description, images },
    twitter: { card: "summary_large_image", title: info.title, description, images },
  };
}

export default async function AnimePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const { audio: audioParam } = await searchParams;

  const result = await loadTitle(slug);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <div className="wrap page">
        <Notice
          title="This title would not load"
          body={result.error}
          action={{ href: "/", label: "Back to Home" }}
        />
        <Footer />
      </div>
    );
  }

  const { info, episodes } = result;

  const franchise = await findAnimeFranchiseData(info.malId || info.anilistId, info.title);

  const hasDub = Boolean(info.dubCount) || episodes.some((e) => e.dub);
  const audio: "sub" | "dub" = audioParam === "dub" && hasDub ? "dub" : "sub";

  return (
    <div>
      <YouTubeChannelView
        slug={slug}
        info={info}
        episodes={episodes}
        seasons={franchise.seasons}
        characters={franchise.characters}
        recommendations={franchise.recommendations}
        trailer={franchise.trailer}
        audio={audio}
      />
      <div style={{ marginTop: "48px" }}>
        <Footer />
      </div>
    </div>
  );
}

function trim(s: string, n: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean;
}
