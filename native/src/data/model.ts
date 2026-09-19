import {
  AUDIO_TRACKS,
  CONTENT_TYPES,
  type AudioTrack,
  type ContentType,
  type DownloadIdentity,
  type DownloadInput,
  type DownloadRecord,
  type DownloadRequestPlan,
  type DownloadState,
  type DownloadTransferPatch,
  type PlaybackProgress,
  type PlaybackProgressInput,
  type SaveIdentity,
  type SaveInput,
} from "./types";

const FINISHED_WINDOW_SECONDS = 45;

export class DataInvariantError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "DataInvariantError";
    this.field = field;
  }
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new DataInvariantError(`${field} must not be empty`, field);
  }
  return normalized;
}

function optionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized || null;
}

function finiteNonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new DataInvariantError(`${field} must be a finite, non-negative number`, field);
  }
  return value;
}

function wholeNonNegative(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DataInvariantError(
      `${field} must be a non-negative safe integer`,
      field,
    );
  }
  return value;
}

function wholeEpisode(value: number): number {
  return wholeNonNegative(value, "episode");
}

function audioTrack(value: AudioTrack): AudioTrack {
  if (!(AUDIO_TRACKS as readonly string[]).includes(value)) {
    throw new DataInvariantError(`Unsupported audio track: ${String(value)}`, "audio");
  }
  return value;
}

function contentType(value: ContentType): ContentType {
  if (!(CONTENT_TYPES as readonly string[]).includes(value)) {
    throw new DataInvariantError(`Unsupported content type: ${String(value)}`, "contentType");
  }
  return value;
}

export function normalizeSaveIdentity(identity: SaveIdentity): SaveIdentity {
  return {
    profileId: normalizeProfileId(identity.profileId),
    contentId: requiredText(identity.contentId, "contentId"),
  };
}

export function normalizeProfileId(profileId: string): string {
  return requiredText(profileId, "profileId");
}

export function normalizeListLimit(
  limit: number | undefined,
  fallback = 100,
  maximum = 500,
): number {
  const normalizedFallback = wholeNonNegative(fallback, "fallback");
  const normalizedMaximum = wholeNonNegative(maximum, "maximum");
  if (normalizedFallback < 1 || normalizedMaximum < 1) {
    throw new DataInvariantError(
      "List limits must be positive safe integers",
      normalizedMaximum < 1 ? "maximum" : "fallback",
    );
  }

  if (limit == null || !Number.isFinite(limit)) {
    return Math.min(normalizedFallback, normalizedMaximum);
  }
  return Math.max(1, Math.min(normalizedMaximum, Math.trunc(limit)));
}

export function normalizeSaveInput(input: SaveInput): SaveInput {
  return {
    ...normalizeSaveIdentity(input),
    contentType: contentType(input.contentType),
    slug: requiredText(input.slug, "slug"),
    title: requiredText(input.title, "title"),
    imageUri: optionalText(input.imageUri),
    rating: optionalText(input.rating),
    qualityLabel: optionalText(input.qualityLabel),
    totalEpisodesOrChapters: optionalText(input.totalEpisodesOrChapters),
  };
}

export function normalizePlaybackInput(
  input: PlaybackProgressInput,
): PlaybackProgressInput {
  return {
    ...normalizeSaveIdentity(input),
    slug: requiredText(input.slug, "slug"),
    title: requiredText(input.title, "title"),
    imageUri: optionalText(input.imageUri),
    episode: wholeEpisode(input.episode),
    positionSeconds: finiteNonNegative(input.positionSeconds, "positionSeconds"),
    durationSeconds: finiteNonNegative(input.durationSeconds, "durationSeconds"),
    audio: audioTrack(input.audio),
  };
}

/** Protects stored progress from the player's initial zero-valued metadata event. */
export function mergePlaybackProgress(
  current: PlaybackProgress | null,
  incoming: PlaybackProgressInput,
  now: number,
): PlaybackProgress {
  const normalized = normalizePlaybackInput(incoming);
  // Progress is canonical per title. Switching between sub and dub for the same
  // episode must not let the new player's initial zero event erase the resume point.
  const isSameEpisode = current?.episode === normalized.episode;

  const positionSeconds =
    isSameEpisode && normalized.positionSeconds === 0 && current.positionSeconds > 0
      ? current.positionSeconds
      : normalized.positionSeconds;
  const durationSeconds =
    isSameEpisode && normalized.durationSeconds === 0 && current.durationSeconds > 0
      ? current.durationSeconds
      : normalized.durationSeconds;

  const merged = {
    ...normalized,
    positionSeconds,
    durationSeconds,
  };

  return {
    ...merged,
    completedAt: isPlaybackFinished(merged) ? now : null,
    updatedAt: now,
  };
}

export function isPlaybackFinished(
  progress: Pick<PlaybackProgressInput, "positionSeconds" | "durationSeconds">,
): boolean {
  return (
    progress.durationSeconds > 0 &&
    progress.positionSeconds >= Math.max(0, progress.durationSeconds - FINISHED_WINDOW_SECONDS)
  );
}

export function normalizeDownloadIdentity(identity: DownloadIdentity): DownloadIdentity {
  return {
    profileId: requiredText(identity.profileId, "profileId"),
    contentId: requiredText(identity.contentId, "contentId"),
    episode: wholeEpisode(identity.episode),
    audio: audioTrack(identity.audio),
    quality: requiredText(identity.quality, "quality").toLowerCase(),
  };
}

export function normalizeDownloadInput(input: DownloadInput): DownloadInput {
  return {
    ...normalizeDownloadIdentity(input),
    slug: optionalText(input.slug),
    title: optionalText(input.title),
    episodeTitle: optionalText(input.episodeTitle),
    imageUri: optionalText(input.imageUri),
  };
}

/** Collision-safe in-memory key; SQLite uses the same five values as its primary key. */
export function downloadIdentityKey(identity: DownloadIdentity): string {
  const normalized = normalizeDownloadIdentity(identity);
  return JSON.stringify([
    normalized.profileId,
    normalized.contentId,
    normalized.episode,
    normalized.audio,
    normalized.quality,
  ]);
}

const DOWNLOAD_TRANSITIONS: Readonly<Record<DownloadState, readonly DownloadState[]>> = {
  notDownloaded: ["queued"],
  queued: ["downloading", "paused", "failed", "notDownloaded"],
  downloading: ["paused", "downloaded", "failed", "notDownloaded"],
  paused: ["queued", "downloading", "failed", "expired", "notDownloaded"],
  downloaded: ["expired", "notDownloaded"],
  expired: ["queued", "notDownloaded"],
  failed: ["queued", "notDownloaded"],
};

export function allowedDownloadTransitions(
  state: DownloadState,
): readonly DownloadState[] {
  return DOWNLOAD_TRANSITIONS[state];
}

export function canTransitionDownload(
  from: DownloadState,
  to: DownloadState,
): boolean {
  return from === to || DOWNLOAD_TRANSITIONS[from].includes(to);
}

export class InvalidDownloadTransitionError extends Error {
  readonly from: DownloadState;
  readonly to: DownloadState;

  constructor(from: DownloadState, to: DownloadState) {
    super(`Cannot transition a download from ${from} to ${to}`);
    this.name = "InvalidDownloadTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function assertDownloadTransition(
  from: DownloadState,
  to: DownloadState,
): void {
  if (!canTransitionDownload(from, to)) {
    throw new InvalidDownloadTransitionError(from, to);
  }
}

/**
 * A request is idempotent while work is already pending/active or a valid file
 * is already present. Retryable terminal states are moved back to the queue.
 */
export function stateForDownloadRequest(current: DownloadState): DownloadState {
  switch (current) {
    case "queued":
    case "downloading":
    case "downloaded":
      return current;
    case "notDownloaded":
    case "paused":
    case "expired":
    case "failed":
      return "queued";
  }
}

/** Pure request planner: repeat taps attach unless the existing row is retryable. */
export function planDownloadRequest(
  current: DownloadState,
  created: boolean,
): DownloadRequestPlan {
  const nextState = stateForDownloadRequest(current);
  return {
    nextState,
    disposition: created
      ? "created"
      : nextState === current
        ? "attached"
        : "requeued",
  };
}

export function normalizeTransferPatch(
  patch: DownloadTransferPatch,
): DownloadTransferPatch {
  const bytesDownloaded =
    patch.bytesDownloaded == null
      ? undefined
      : wholeNonNegative(patch.bytesDownloaded, "bytesDownloaded");
  const totalBytes =
    patch.totalBytes == null
      ? patch.totalBytes
      : wholeNonNegative(patch.totalBytes, "totalBytes");

  if (
    bytesDownloaded != null &&
    totalBytes != null &&
    bytesDownloaded > totalBytes
  ) {
    throw new DataInvariantError(
      "bytesDownloaded cannot be greater than totalBytes",
      "bytesDownloaded",
    );
  }

  return {
    ...(patch.remoteUri !== undefined && { remoteUri: optionalText(patch.remoteUri) }),
    ...(patch.localUri !== undefined && { localUri: optionalText(patch.localUri) }),
    ...(bytesDownloaded !== undefined && { bytesDownloaded }),
    ...(patch.totalBytes !== undefined && { totalBytes }),
    ...(patch.expiresAt !== undefined && {
      expiresAt:
        patch.expiresAt == null
          ? null
          : wholeNonNegative(patch.expiresAt, "expiresAt"),
    }),
    ...(patch.failureCode !== undefined && {
      failureCode: optionalText(patch.failureCode),
    }),
    ...(patch.failureMessage !== undefined && {
      failureMessage: optionalText(patch.failureMessage),
    }),
  };
}

export function assertDownloadedFile(
  current: Pick<DownloadRecord, "localUri">,
  patch: DownloadTransferPatch,
): void {
  const localUri = patch.localUri === undefined ? current.localUri : patch.localUri;
  if (!optionalText(localUri)) {
    throw new DataInvariantError(
      "A downloaded record must include the final localUri",
      "localUri",
    );
  }
}

export function createDownloadRecord(input: DownloadInput, now: number): DownloadRecord {
  const normalized = normalizeDownloadInput(input);
  return {
    ...normalized,
    state: "notDownloaded",
    remoteUri: null,
    localUri: null,
    bytesDownloaded: 0,
    totalBytes: null,
    failureCode: null,
    failureMessage: null,
    queuedAt: null,
    startedAt: null,
    completedAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function patchDownloadRecord(
  current: DownloadRecord,
  patch: DownloadTransferPatch,
  now: number,
): DownloadRecord {
  const normalized = normalizeTransferPatch(patch);
  const updated: DownloadRecord = {
    ...current,
    ...normalized,
    updatedAt: now,
  };

  if (
    updated.totalBytes != null &&
    updated.bytesDownloaded > updated.totalBytes
  ) {
    throw new DataInvariantError(
      "bytesDownloaded cannot be greater than totalBytes",
      "bytesDownloaded",
    );
  }

  return updated;
}

/** Pure transition reducer shared by the repository and unit tests. */
export function transitionDownloadRecord(
  current: DownloadRecord,
  nextState: DownloadState,
  patch: DownloadTransferPatch,
  now: number,
): DownloadRecord {
  assertDownloadTransition(current.state, nextState);
  let updated = patchDownloadRecord(current, patch, now);

  if (nextState === "downloaded") {
    assertDownloadedFile(current, patch);
  }

  if (current.state !== nextState) {
    switch (nextState) {
      case "notDownloaded":
        updated = {
          ...updated,
          remoteUri: null,
          localUri: null,
          bytesDownloaded: 0,
          totalBytes: null,
          failureCode: null,
          failureMessage: null,
          queuedAt: null,
          startedAt: null,
          completedAt: null,
          expiresAt: null,
        };
        break;
      case "queued":
        updated = {
          ...updated,
          queuedAt: now,
          completedAt: null,
          failureCode: null,
          failureMessage: null,
          ...(current.state === "failed" || current.state === "expired"
            ? {
                remoteUri: null,
                localUri: null,
                bytesDownloaded: 0,
                totalBytes: null,
                startedAt: null,
                expiresAt: null,
              }
            : {}),
        };
        break;
      case "downloading":
        updated = {
          ...updated,
          startedAt: updated.startedAt ?? now,
          failureCode: null,
          failureMessage: null,
        };
        break;
      case "paused":
        break;
      case "downloaded":
        updated = {
          ...updated,
          bytesDownloaded: updated.totalBytes ?? updated.bytesDownloaded,
          completedAt: now,
          failureCode: null,
          failureMessage: null,
        };
        break;
      case "expired":
        break;
      case "failed":
        updated = {
          ...updated,
          completedAt: null,
        };
        break;
    }
  }

  return {
    ...updated,
    state: nextState,
    updatedAt: now,
  };
}
