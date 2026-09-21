import "server-only";
import { api, type Result } from "./backend";
import { proxyUrl } from "./proxy-sign";

export type StreamSubtitle = { src: string; label: string; default: boolean };
export type ResolvedStream = {
  url: string;
  audio: "sub" | "dub";
  serverName: string;
  referer?: string;
  subtitles: StreamSubtitle[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
};

type StreamResult = {
  stream: ResolvedStream | null;
  available: { sub: string[]; dub: string[] };
  error?: string;
  episodeMeta?: { title?: string; thumbnail?: string };
};
type Options = {
  audio: "sub" | "dub";
  serverName?: string;
  provider: string;
  anilistId?: string | null;
  episodeNumber: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function unwrap(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  return asRecord(record.data ?? record.result ?? record);
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return "";
}

function serverName(value: unknown): string {
  const item = asRecord(value);
  return text(item, "serverName", "server_name", "name", "server", "title");
}

function serverId(value: unknown): string {
  const item = asRecord(value);
  return text(item, "link", "url", "id", "serverId", "server_id", "linkId", "link_id");
}

/**
 * One entry in an episode's server list, plus the audio track it serves.
 *
 * `audio` is null when the payload never said — older responses hand back one
 * flat list with no sub/dub split at all.
 */
type ServerEntry = { name: string; audio: "sub" | "dub" | null; raw: unknown };

function audioOf(value: unknown): "sub" | "dub" | null {
  const tag = text(asRecord(value), "type", "audio", "track", "kind").toLowerCase();
  if (tag.includes("dub")) return "dub";
  if (tag.includes("sub")) return "sub";
  return null;
}

/**
 * The episode payload has carried two shapes for its server list: a flat array
 * of `{ serverName, link }`, and an object grouped by audio track
 * (`{ sub: [...], dub: [...] }`) as the current backend returns. `list()` only
 * accepts arrays, so the grouped form used to collapse to an empty list, no
 * server could be selected and every episode rendered as "No source would play
 * this episode". Both shapes are read here.
 */
function collectServers(root: Record<string, unknown>, fallback: unknown): ServerEntry[] {
  const groups = asRecord(root.servers);
  const grouped = (audio: "sub" | "dub"): ServerEntry[] =>
    list(groups[audio]).map(asRecord).map((raw) => ({ name: serverName(raw), audio, raw }));

  const split = [...grouped("sub"), ...grouped("dub")];
  if (split.length) return split;

  return list(root.servers ?? root.sources ?? root.links ?? fallback)
    .map(asRecord)
    .map((raw) => ({ name: serverName(raw), audio: audioOf(raw), raw }));
}

function sourceItems(value: unknown): unknown[] {
  const root = unwrap(value);
  return list(root.sources ?? root.source ?? root.data ?? value);
}

function parseTrack(value: unknown): StreamSubtitle | null {
  const item = asRecord(value);
  const src = text(item, "url", "file", "src");
  if (!src || !/^https?:\/\//i.test(src)) return null;
  return { src, label: text(item, "label", "lang", "language") || "Subtitles", default: Boolean(item.default) };
}

/**
 * The playable file itself. Newer payloads nest it under `sources.file`; older
 * ones put it directly on the entry. A bare `url` is usually the provider's
 * embed page — an HTML document that plays nothing — so it is tried last.
 */
function streamFile(record: Record<string, unknown>): string {
  const nested = asRecord(record.sources);
  return text(nested, "file", "url", "src") || text(record, "file", "stream", "fileUrl", "src");
}

/** `https://megaplay.buzz/` for the CDN that only serves with that Referer. */
function originOf(url: string): string {
  try {
    return `${new URL(url).origin}/`;
  } catch {
    return "";
  }
}

/** Skip markers arrive as `{ start, end }` or as `[start, end]`. */
function range(value: unknown): { start: number; end: number } | undefined {
  const record = asRecord(value);
  const pair = Array.isArray(value) ? value : [record.start, record.end];
  const start = Number(pair[0]);
  const end = Number(pair[1]);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : undefined;
}

function parseStream(value: unknown, audio: "sub" | "dub", selectedServer: string): ResolvedStream | null {
  const root = unwrap(value);
  const source = sourceItems(value).map(asRecord).find((item) => {
    const name = serverName(item);
    return !selectedServer || !name || name.toLowerCase() === selectedServer.toLowerCase();
  }) ?? root;
  const embed = text(source, "url") || text(root, "url");
  const url = streamFile(source) || streamFile(root) || (/^https?:\/\//i.test(embed) ? embed : "");
  if (!/^https?:\/\//i.test(url)) return null;
  const tracks = list(source.subtitles ?? source.tracks ?? root.subtitles ?? root.tracks).map(parseTrack).filter(Boolean) as StreamSubtitle[];
  const skip = asRecord(root.skip_data);
  const intro = range(source.intro) ?? range(root.intro) ?? range(skip.intro);
  const outro = range(source.outro) ?? range(root.outro) ?? range(skip.outro);
  return {
    url,
    audio,
    serverName: serverName(source) || selectedServer || "Default",
    // Hotlink-protected CDNs want the provider's own origin as the Referer, and
    // the payload rarely spells it out — the embed URL gives it exactly.
    referer: text(source, "referer", "headersReferer") || originOf(embed) || undefined,
    subtitles: tracks,
    intro,
    outro,
  };
}

async function fetchEpisode(options: Options): Promise<Result<unknown>> {
  const { provider, anilistId, episodeNumber } = options;
  if (!anilistId) return { ok: false, status: 400, error: "This episode has no provider id." };
  if (provider === "aniwave") return api.aniwaveAnilist(anilistId, episodeNumber);
  if (provider === "anidao") return api.anidaoAnilist(anilistId, episodeNumber);
  if (provider === "watchanimeworld") return api.watchanimeworldAnilist(anilistId, episodeNumber);
  if (provider === "hindi" || provider === "animesalt") return api.animesaltAnilist(anilistId, episodeNumber);
  return api.zoroAnilist(anilistId, episodeNumber);
}

export async function resolveStream(ids: string, options: Options): Promise<StreamResult> {
  const episode = await fetchEpisode(options);
  if (!episode.ok) return { stream: null, available: { sub: [], dub: [] }, error: episode.error };
  const root = unwrap(episode.data);
  const servers = collectServers(root, episode.data);

  // Availability is only claimed for an audio track the payload actually
  // offered. A flat list with no sub/dub marking belongs to whichever track was
  // asked for, which is all the older backend ever told us.
  const splitByAudio = servers.some((entry) => entry.audio);
  const offers = (entry: ServerEntry, audio: "sub" | "dub") =>
    splitByAudio ? entry.audio === audio : options.audio === audio;
  const namesFor = (audio: "sub" | "dub") =>
    servers
      .filter((entry) => offers(entry, audio) && entry.name)
      .map((entry) => entry.name)
      .filter((name, index, all) => all.indexOf(name) === index);
  const available = { sub: namesFor("sub"), dub: namesFor("dub") };

  // An explicit ?server= wins; otherwise stay inside the requested audio track.
  const requested = options.serverName?.toLowerCase();
  const byName = requested ? servers.find((entry) => entry.name.toLowerCase() === requested) : undefined;
  const forAudio = servers.filter((entry) => !splitByAudio || entry.audio === options.audio);
  const selected = byName ?? forAudio[0] ?? servers[0];
  const link = serverId(selected?.raw);
  // The grouped payloads carry the opaque handle on the episode they describe;
  // older ones hand it in as the episode's `ids`.
  const fallbackIds = ids || text(asRecord(asRecord(root.intro).episode), "ids");
  const sources = link
    ? await api.sources(link)
    : fallbackIds
    ? await api.sources(fallbackIds)
    : ({ ok: false, status: 404, error: "No stream source found." } as import("./backend").Result<import("./types").BackendPayload>);
  const stream = sources.ok ? parseStream(sources.data, options.audio, options.serverName || selected?.name || "") : null;
  return {
    stream,
    available,
    error: sources.ok ? (stream ? undefined : "The selected server returned no playable source.") : sources.error,
    episodeMeta: { title: text(root, "title", "episodeTitle"), thumbnail: text(root, "thumbnail", "image", "img") || undefined },
  };
}

export function proxiedPlaylist(stream: ResolvedStream): string {
  return proxyUrl(stream.url, stream.referer);
}

export function proxiedSubtitle(url: string, referer?: string): string {
  return proxyUrl(url, referer);
}