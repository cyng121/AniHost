import Constants from "expo-constants";

import type {
  NativeApiErrorBody,
  NativeHomeResponse,
  NativeMangaChapterResponse,
  NativeMangaHomeResponse,
  NativeMangaSearchResponse,
  NativeMangaTitleResponse,
  NativeMoviesResponse,
  NativePlaybackResponse,
  NativeSearchResponse,
  NativeTitleResponse,
} from "./types";

const API_PREFIX = "/api/native";
const DEFAULT_TIMEOUT_MS = 15_000;

type FetchImplementation = typeof globalThis.fetch;

export interface NativeApiClientOptions {
  origin?: string;
  timeoutMs?: number;
  fetchImplementation?: FetchImplementation;
}

export interface NativeRequestOptions {
  signal?: AbortSignal;
}

export interface NativeSearchOptions extends NativeRequestOptions {
  page?: number;
}

export interface NativePlaybackOptions extends NativeRequestOptions {
  audio?: "sub" | "dub";
  server?: string;
}

export class NativeApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, options: { status: number; code: string; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = "NativeApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

export class NativeApiClient {
  readonly origin: string;

  private readonly timeoutMs: number;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: NativeApiClientOptions = {}) {
    this.origin = normalizeOrigin(options.origin ?? configuredApiOrigin());
    this.timeoutMs = positiveTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  }

  getHome(options: NativeRequestOptions = {}): Promise<NativeHomeResponse> {
    return this.get("/home", undefined, options.signal);
  }

  search(
    query: string,
    options: NativeSearchOptions = {},
  ): Promise<NativeSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      page: String(options.page ?? 1),
    });
    return this.get("/search", params, options.signal);
  }

  getTitle(slug: string, options: NativeRequestOptions = {}): Promise<NativeTitleResponse> {
    return this.get(`/title/${encodeURIComponent(slug)}`, undefined, options.signal);
  }

  getMangaHome(options: NativeRequestOptions = {}): Promise<NativeMangaHomeResponse> {
    return this.get("/manga", undefined, options.signal);
  }

  getMovies(options: NativeRequestOptions = {}): Promise<NativeMoviesResponse> {
    return this.get("/movies", undefined, options.signal);
  }

  searchManga(
    query: string,
    options: NativeRequestOptions = {},
  ): Promise<NativeMangaSearchResponse> {
    return this.get(
      "/manga",
      new URLSearchParams({ q: query }),
      options.signal,
    );
  }

  getMangaTitle(
    id: string,
    options: NativeRequestOptions = {},
  ): Promise<NativeMangaTitleResponse> {
    return this.get(`/manga/${encodeURIComponent(id)}`, undefined, options.signal);
  }

  getMangaChapter(
    id: string,
    chapter: string,
    options: NativeRequestOptions = {},
  ): Promise<NativeMangaChapterResponse> {
    return this.get(
      `/manga/${encodeURIComponent(id)}/${encodeURIComponent(chapter)}`,
      undefined,
      options.signal,
    );
  }

  getPlayback(
    ids: string,
    options: NativePlaybackOptions = {},
  ): Promise<NativePlaybackResponse> {
    const params = new URLSearchParams({ ids, audio: options.audio ?? "sub" });
    if (options.server) params.set("server", options.server);
    return this.get("/play", params, options.signal);
  }

  private async get<T>(
    path: string,
    params?: URLSearchParams,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    const url = new URL(`${API_PREFIX}${path}`, this.origin);
    if (params) url.search = params.toString();

    const controller = new AbortController();
    let timedOut = false;
    const handleExternalAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", handleExternalAbort, { once: true });
    if (externalSignal?.aborted) controller.abort();

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImplementation(url.toString(), {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-anighost-client": "native",
        },
        signal: controller.signal,
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw apiErrorFromResponse(response.status, payload);
      return payload as T;
    } catch (error: unknown) {
      if (error instanceof NativeApiError) throw error;
      if (timedOut) {
        throw new NativeApiError("The Ani Ghost API request timed out", {
          status: 0,
          code: "REQUEST_TIMEOUT",
          cause: error,
        });
      }
      if (externalSignal?.aborted) throw error;
      throw new NativeApiError("The Ani Ghost API could not be reached", {
        status: 0,
        code: "NETWORK_ERROR",
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", handleExternalAbort);
    }
  }
}

export const nativeApi = new NativeApiClient();

function configuredApiOrigin(): string {
  const extra = Constants.expoConfig?.extra as { apiOrigin?: unknown } | undefined;
  if (typeof extra?.apiOrigin !== "string" || !extra.apiOrigin.trim()) {
    throw new Error("Missing extra.apiOrigin; set EXPO_PUBLIC_API_ORIGIN before starting Expo");
  }
  return extra.apiOrigin;
}

function normalizeOrigin(raw: string): string {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    if (url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new Error("The native API origin must be an http(s) origin without a path");
  }
}

function positiveTimeout(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Native API timeout must be a positive number of milliseconds");
  }
  return value;
}

function apiErrorFromResponse(status: number, payload: unknown): NativeApiError {
  if (isApiErrorBody(payload)) {
    return new NativeApiError(payload.error.message, {
      status,
      code: payload.error.code,
    });
  }
  return new NativeApiError(`The Ani Ghost API returned HTTP ${status}`, {
    status,
    code: "UNEXPECTED_RESPONSE",
  });
}

function isApiErrorBody(value: unknown): value is NativeApiErrorBody {
  if (!value || typeof value !== "object" || !("error" in value)) return false;
  const error = value.error;
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      "message" in error &&
      typeof error.message === "string",
  );
}
