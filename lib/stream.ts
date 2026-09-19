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

function serversFrom(value: unknown): string[] {
  const root = unwrap(value);
  const candidates = list(root.servers ?? root.data ?? value);
  return candidates.map(serverName).filter(Boolean).filter((name, index, all) => all.indexOf(name) === index);
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

function parseStream(value: unknown, audio: "sub" | "dub", selectedServer: string): ResolvedStream | null {
  const root = unwrap(value);
  const source = sourceItems(value).map(asRecord).find((item) => {
    const name = serverName(item);
    return !selectedServer || !name || name.toLowerCase() === selectedServer.toLowerCase();
  }) ?? root;
  const url = text(source, "url", "file", "stream", "src");
  if (!/^https?:\/\//i.test(url)) return null;
  const tracks = list(source.subtitles ?? source.tracks ?? root.subtitles).map(parseTrack).filter(Boolean) as StreamSubtitle[];
  const intro = asRecord(source.intro);
  const outro = asRecord(source.outro);
  return {
    url,
    audio,
    serverName: serverName(source) || selectedServer || "Default",
    referer: text(source, "referer", "headersReferer") || undefined,
    subtitles: tracks,
    intro: Number.isFinite(Number(intro.start)) && Number.isFinite(Number(intro.end)) ? { start: Number(intro.start), end: Number(intro.end) } : undefined,
    outro: Number.isFinite(Number(outro.start)) && Number.isFinite(Number(outro.end)) ? { start: Number(outro.start), end: Number(outro.end) } : undefined,
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
  const rawServers = list(root.servers ?? root.sources ?? root.links ?? episode.data);
  const available = serversFrom({ servers: rawServers });
  const selected = rawServers.find((item) => !options.serverName || serverName(item).toLowerCase() === options.serverName.toLowerCase()) ?? rawServers[0];
  const link = serverId(selected);
  const sources = link
    ? await api.sources(link)
    : ids
    ? await api.sources(ids)
    : ({ ok: false, status: 404, error: "No stream source found." } as import("./backend").Result<import("./types").BackendPayload>);
  const stream = sources.ok ? parseStream(sources.data, options.audio, options.serverName || serverName(selected)) : null;
  return {
    stream,
    available: { sub: options.audio === "sub" ? available : [], dub: options.audio === "dub" ? available : [] },
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