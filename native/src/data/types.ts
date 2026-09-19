export const AUDIO_TRACKS = ["sub", "dub"] as const;

export type AudioTrack = (typeof AUDIO_TRACKS)[number];

export const CONTENT_TYPES = ["anime", "manga"] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const DOWNLOAD_STATES = [
  "notDownloaded",
  "queued",
  "downloading",
  "paused",
  "downloaded",
  "expired",
  "failed",
] as const;

export type DownloadState = (typeof DOWNLOAD_STATES)[number];

/** Milliseconds since the Unix epoch. */
export type UnixMillis = number;

export interface SaveIdentity {
  profileId: string;
  contentId: string;
}

export interface SaveInput extends SaveIdentity {
  contentType: ContentType;
  slug: string;
  title: string;
  imageUri?: string | null;
  rating?: string | null;
  qualityLabel?: string | null;
  totalEpisodesOrChapters?: string | null;
}

export interface SavedItem extends SaveInput {
  savedAt: UnixMillis;
  updatedAt: UnixMillis;
}

export interface PlaybackIdentity {
  profileId: string;
  contentId: string;
}

export interface PlaybackProgressInput extends PlaybackIdentity {
  slug: string;
  title: string;
  imageUri?: string | null;
  episode: number;
  positionSeconds: number;
  durationSeconds: number;
  audio: AudioTrack;
}

/**
 * The app keeps one current continuation per profile and title. Moving to a new
 * episode updates this row instead of leaving competing "continue" entries.
 */
export interface PlaybackProgress extends PlaybackProgressInput {
  completedAt: UnixMillis | null;
  updatedAt: UnixMillis;
}

export interface DownloadIdentity {
  profileId: string;
  contentId: string;
  episode: number;
  audio: AudioTrack;
  quality: string;
}

export interface DownloadMetadata {
  slug?: string | null;
  title?: string | null;
  episodeTitle?: string | null;
  imageUri?: string | null;
}

export interface DownloadInput extends DownloadIdentity, DownloadMetadata {}

export interface DownloadRecord extends DownloadIdentity, DownloadMetadata {
  state: DownloadState;
  remoteUri: string | null;
  localUri: string | null;
  bytesDownloaded: number;
  totalBytes: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  queuedAt: UnixMillis | null;
  startedAt: UnixMillis | null;
  completedAt: UnixMillis | null;
  expiresAt: UnixMillis | null;
  createdAt: UnixMillis;
  updatedAt: UnixMillis;
}

export interface DownloadTransferPatch {
  remoteUri?: string | null;
  localUri?: string | null;
  bytesDownloaded?: number;
  totalBytes?: number | null;
  expiresAt?: UnixMillis | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface DownloadAttachment {
  /** True only when this call inserted the canonical identity for the first time. */
  created: boolean;
  record: DownloadRecord;
}

export type DownloadRequestDisposition = "created" | "requeued" | "attached";

export interface DownloadRequestResult extends DownloadAttachment {
  /**
   * `attached` means an equivalent queued, active, or completed request already
   * existed. Callers should observe that record rather than start another job.
   */
  disposition: DownloadRequestDisposition;
}

export interface DownloadRequestPlan {
  nextState: DownloadState;
  disposition: DownloadRequestDisposition;
}

export interface DownloadListFilter {
  states?: readonly DownloadState[];
  contentId?: string;
}

export type Clock = () => UnixMillis;
