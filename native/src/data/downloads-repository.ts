import type { SQLiteDatabase } from "expo-sqlite";

import {
  downloadIdentityKey,
  normalizeDownloadIdentity,
  normalizeDownloadInput,
  normalizeProfileId,
  normalizeSaveIdentity,
  patchDownloadRecord,
  planDownloadRequest,
  transitionDownloadRecord,
} from "./model";
import type {
  Clock,
  DownloadAttachment,
  DownloadIdentity,
  DownloadInput,
  DownloadListFilter,
  DownloadRecord,
  DownloadRequestResult,
  DownloadState,
  DownloadTransferPatch,
} from "./types";
import { DataWriteQueue } from "./write-queue";

interface DownloadRow {
  profile_id: string;
  content_id: string;
  episode: number;
  audio: "sub" | "dub";
  quality: string;
  slug: string | null;
  title: string | null;
  episode_title: string | null;
  image_uri: string | null;
  state: DownloadState;
  remote_uri: string | null;
  local_uri: string | null;
  bytes_downloaded: number;
  total_bytes: number | null;
  failure_code: string | null;
  failure_message: string | null;
  queued_at: number | null;
  started_at: number | null;
  completed_at: number | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
}

function mapDownload(row: DownloadRow): DownloadRecord {
  return {
    profileId: row.profile_id,
    contentId: row.content_id,
    episode: row.episode,
    audio: row.audio,
    quality: row.quality,
    slug: row.slug,
    title: row.title,
    episodeTitle: row.episode_title,
    imageUri: row.image_uri,
    state: row.state,
    remoteUri: row.remote_uri,
    localUri: row.local_uri,
    bytesDownloaded: row.bytes_downloaded,
    totalBytes: row.total_bytes,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_DOWNLOAD = `
  SELECT
    profile_id,
    content_id,
    episode,
    audio,
    quality,
    slug,
    title,
    episode_title,
    image_uri,
    state,
    remote_uri,
    local_uri,
    bytes_downloaded,
    total_bytes,
    failure_code,
    failure_message,
    queued_at,
    started_at,
    completed_at,
    expires_at,
    created_at,
    updated_at
  FROM downloads
`;

const IDENTITY_WHERE = `
  profile_id = ? AND
  content_id = ? AND
  episode = ? AND
  audio = ? AND
  quality = ?
`;

type DownloadConnection = Pick<
  SQLiteDatabase,
  "getFirstAsync" | "runAsync"
>;

function identityParams(identity: DownloadIdentity): [string, string, number, string, string] {
  return [
    identity.profileId,
    identity.contentId,
    identity.episode,
    identity.audio,
    identity.quality,
  ];
}

async function selectDownload(
  connection: DownloadConnection,
  identity: DownloadIdentity,
): Promise<DownloadRecord | null> {
  const row = await connection.getFirstAsync<DownloadRow>(
    `${SELECT_DOWNLOAD} WHERE ${IDENTITY_WHERE}`,
    identityParams(identity),
  );
  return row ? mapDownload(row) : null;
}

async function attachCanonicalDownload(
  connection: DownloadConnection,
  input: DownloadInput,
  now: number,
): Promise<DownloadAttachment> {
  const insert = await connection.runAsync(
    `INSERT INTO downloads (
      profile_id,
      content_id,
      episode,
      audio,
      quality,
      slug,
      title,
      episode_title,
      image_uri,
      state,
      remote_uri,
      local_uri,
      bytes_downloaded,
      total_bytes,
      failure_code,
      failure_message,
      queued_at,
      started_at,
      completed_at,
      expires_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'notDownloaded', NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)
    ON CONFLICT (profile_id, content_id, episode, audio, quality) DO NOTHING`,
    [
      input.profileId,
      input.contentId,
      input.episode,
      input.audio,
      input.quality,
      input.slug ?? null,
      input.title ?? null,
      input.episodeTitle ?? null,
      input.imageUri ?? null,
      now,
      now,
    ],
  );

  const created = insert.changes > 0;
  if (!created) {
    // Reconciliation may enrich metadata, but it never replaces transfer state.
    await connection.runAsync(
      `UPDATE downloads SET
        slug = COALESCE(?, slug),
        title = COALESCE(?, title),
        episode_title = COALESCE(?, episode_title),
        image_uri = COALESCE(?, image_uri)
       WHERE ${IDENTITY_WHERE}`,
      [
        input.slug ?? null,
        input.title ?? null,
        input.episodeTitle ?? null,
        input.imageUri ?? null,
        ...identityParams(input),
      ],
    );
  }

  const record = await selectDownload(connection, input);
  if (!record) throw new Error("Canonical download disappeared after attach");
  return { created, record };
}

async function writeDownloadRecord(
  connection: DownloadConnection,
  record: DownloadRecord,
): Promise<void> {
  const update = await connection.runAsync(
    `UPDATE downloads SET
      state = ?,
      remote_uri = ?,
      local_uri = ?,
      bytes_downloaded = ?,
      total_bytes = ?,
      failure_code = ?,
      failure_message = ?,
      queued_at = ?,
      started_at = ?,
      completed_at = ?,
      expires_at = ?,
      updated_at = ?
     WHERE ${IDENTITY_WHERE}`,
    [
      record.state,
      record.remoteUri,
      record.localUri,
      record.bytesDownloaded,
      record.totalBytes,
      record.failureCode,
      record.failureMessage,
      record.queuedAt,
      record.startedAt,
      record.completedAt,
      record.expiresAt,
      record.updatedAt,
      ...identityParams(record),
    ],
  );
  if (update.changes !== 1) {
    throw new Error("Canonical download was not updated");
  }
}

export class DownloadNotFoundError extends Error {
  readonly identity: DownloadIdentity;

  constructor(identity: DownloadIdentity) {
    super(`No download exists for ${downloadIdentityKey(identity)}`);
    this.name = "DownloadNotFoundError";
    this.identity = identity;
  }
}

export class DownloadsRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly clock: Clock = Date.now,
    private readonly writes = new DataWriteQueue(),
  ) {}

  async get(identity: DownloadIdentity): Promise<DownloadRecord | null> {
    const key = normalizeDownloadIdentity(identity);
    return selectDownload(this.database, key);
  }

  /**
   * Atomically inserts the canonical identity or attaches to the existing row.
   * It never creates a retry row and never changes an existing transfer state.
   */
  async getOrCreate(input: DownloadInput): Promise<DownloadAttachment> {
    return this.writes.run(async () => {
      const normalized = normalizeDownloadInput(input);
      const now = this.clock();
      let attachment: DownloadAttachment | null = null;

      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.execAsync("PRAGMA busy_timeout = 5000;");
        attachment = await attachCanonicalDownload(transaction, normalized, now);
      });

      if (!attachment) throw new Error("Download could not be attached");
      return attachment;
    });
  }

  /** Alias used when rebuilding queue state after an app restart. */
  reconcile(input: DownloadInput): Promise<DownloadAttachment> {
    return this.getOrCreate(input);
  }

  /**
   * Idempotent user intent: an active or completed identity is attached to;
   * retryable states are requeued in-place.
   */
  async request(input: DownloadInput): Promise<DownloadRequestResult> {
    return this.writes.run(async () => {
      const normalized = normalizeDownloadInput(input);
      const now = this.clock();
      let result: DownloadRequestResult | null = null;

      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.execAsync("PRAGMA busy_timeout = 5000;");
        const attachment = await attachCanonicalDownload(transaction, normalized, now);
        const plan = planDownloadRequest(
          attachment.record.state,
          attachment.created,
        );
        let record = attachment.record;

        if (plan.nextState !== record.state) {
          record = transitionDownloadRecord(record, plan.nextState, {}, now);
          await writeDownloadRecord(transaction, record);
        }

        result = {
          created: attachment.created,
          disposition: plan.disposition,
          record,
        };
      });

      if (!result) throw new Error("Download request could not be persisted");
      return result;
    });
  }

  async transition(
    identity: DownloadIdentity,
    nextState: DownloadState,
    patch: DownloadTransferPatch = {},
  ): Promise<DownloadRecord> {
    return this.writes.run(async () => {
      const key = normalizeDownloadIdentity(identity);
      const now = this.clock();
      let transitioned: DownloadRecord | null = null;

      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.execAsync("PRAGMA busy_timeout = 5000;");
        const current = await selectDownload(transaction, key);
        if (!current) throw new DownloadNotFoundError(key);

        transitioned = transitionDownloadRecord(current, nextState, patch, now);
        await writeDownloadRecord(transaction, transitioned);
      });

      if (!transitioned) throw new Error("Download transition did not complete");
      return transitioned;
    });
  }

  async updateTransfer(
    identity: DownloadIdentity,
    patch: DownloadTransferPatch,
  ): Promise<DownloadRecord> {
    return this.writes.run(async () => {
      const key = normalizeDownloadIdentity(identity);
      const now = this.clock();
      let updated: DownloadRecord | null = null;

      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.execAsync("PRAGMA busy_timeout = 5000;");
        const current = await selectDownload(transaction, key);
        if (!current) throw new DownloadNotFoundError(key);

        updated = patchDownloadRecord(current, patch, now);
        await writeDownloadRecord(transaction, updated);
      });

      if (!updated) throw new Error("Download transfer update did not complete");
      return updated;
    });
  }

  /** Resets transfer details in place; the canonical identity remains reserved. */
  reset(identity: DownloadIdentity): Promise<DownloadRecord> {
    return this.transition(identity, "notDownloaded");
  }

  async list(
    profileId: string,
    filter: DownloadListFilter = {},
  ): Promise<DownloadRecord[]> {
    const normalizedProfileId = normalizeProfileId(profileId);
    const clauses = ["profile_id = ?"];
    const parameters: Array<string | number> = [normalizedProfileId];

    if (filter.contentId != null) {
      const normalizedContentId = normalizeSaveIdentity({
        profileId: normalizedProfileId,
        contentId: filter.contentId,
      }).contentId;
      clauses.push("content_id = ?");
      parameters.push(normalizedContentId);
    }

    if (filter.states?.length) {
      const uniqueStates = [...new Set(filter.states)];
      clauses.push(`state IN (${uniqueStates.map(() => "?").join(", ")})`);
      parameters.push(...uniqueStates);
    }

    const rows = await this.database.getAllAsync<DownloadRow>(
      `${SELECT_DOWNLOAD}
       WHERE ${clauses.join(" AND ")}
       ORDER BY updated_at DESC, content_id ASC, episode ASC`,
      parameters,
    );
    return rows.map(mapDownload);
  }

  listPending(profileId: string): Promise<DownloadRecord[]> {
    return this.list(profileId, {
      states: ["queued", "downloading", "paused"],
    });
  }

  /** A process killed mid-transfer resumes as paused, never as a second job. */
  async pauseInterrupted(profileId: string): Promise<number> {
    return this.writes.run(async () => {
      const normalizedProfileId = normalizeProfileId(profileId);
      const result = await this.database.runAsync(
        `UPDATE downloads
         SET state = 'paused', updated_at = ?
         WHERE profile_id = ? AND state = 'downloading'`,
        [this.clock(), normalizedProfileId],
      );
      return result.changes;
    });
  }

  async expireDue(now = this.clock()): Promise<number> {
    return this.writes.run(async () => {
      const result = await this.database.runAsync(
        `UPDATE downloads
         SET state = 'expired', updated_at = ?
         WHERE state = 'downloaded'
           AND expires_at IS NOT NULL
           AND expires_at <= ?`,
        [now, now],
      );
      return result.changes;
    });
  }
}
