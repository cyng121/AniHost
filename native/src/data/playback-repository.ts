import type { SQLiteDatabase } from "expo-sqlite";

import {
  mergePlaybackProgress,
  normalizeListLimit,
  normalizeProfileId,
  normalizeSaveIdentity,
} from "./model";
import type {
  Clock,
  PlaybackIdentity,
  PlaybackProgress,
  PlaybackProgressInput,
} from "./types";
import { DataWriteQueue } from "./write-queue";

interface PlaybackProgressRow {
  profile_id: string;
  content_id: string;
  slug: string;
  title: string;
  image_uri: string | null;
  episode: number;
  position_seconds: number;
  duration_seconds: number;
  audio: "sub" | "dub";
  completed_at: number | null;
  updated_at: number;
}

function mapPlaybackProgress(row: PlaybackProgressRow): PlaybackProgress {
  return {
    profileId: row.profile_id,
    contentId: row.content_id,
    slug: row.slug,
    title: row.title,
    imageUri: row.image_uri,
    episode: row.episode,
    positionSeconds: row.position_seconds,
    durationSeconds: row.duration_seconds,
    audio: row.audio,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_PLAYBACK_PROGRESS = `
  SELECT
    profile_id,
    content_id,
    slug,
    title,
    image_uri,
    episode,
    position_seconds,
    duration_seconds,
    audio,
    completed_at,
    updated_at
  FROM playback_progress
`;

export class PlaybackRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly clock: Clock = Date.now,
    private readonly writes = new DataWriteQueue(),
  ) {}

  async get(identity: PlaybackIdentity): Promise<PlaybackProgress | null> {
    const key = normalizeSaveIdentity(identity);
    const row = await this.database.getFirstAsync<PlaybackProgressRow>(
      `${SELECT_PLAYBACK_PROGRESS} WHERE profile_id = ? AND content_id = ?`,
      [key.profileId, key.contentId],
    );
    return row ? mapPlaybackProgress(row) : null;
  }

  async listRecent(
    profileId: string,
    options: { includeCompleted?: boolean; limit?: number } = {},
  ): Promise<PlaybackProgress[]> {
    const normalizedProfileId = normalizeProfileId(profileId);
    const limit = normalizeListLimit(options.limit);
    const completedClause = options.includeCompleted ? "" : "AND completed_at IS NULL";
    const rows = await this.database.getAllAsync<PlaybackProgressRow>(
      `${SELECT_PLAYBACK_PROGRESS}
       WHERE profile_id = ? ${completedClause}
       ORDER BY updated_at DESC, content_id ASC
       LIMIT ?`,
      [normalizedProfileId, limit],
    );
    return rows.map(mapPlaybackProgress);
  }

  async save(input: PlaybackProgressInput): Promise<PlaybackProgress> {
    return this.writes.run(async () => {
      const now = this.clock();
      const key = normalizeSaveIdentity(input);
      let merged: PlaybackProgress | null = null;

      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.execAsync("PRAGMA busy_timeout = 5000;");
        const currentRow = await transaction.getFirstAsync<PlaybackProgressRow>(
          `${SELECT_PLAYBACK_PROGRESS} WHERE profile_id = ? AND content_id = ?`,
          [key.profileId, key.contentId],
        );
        const current = currentRow ? mapPlaybackProgress(currentRow) : null;
        merged = mergePlaybackProgress(current, input, now);

        await transaction.runAsync(
          `INSERT INTO playback_progress (
            profile_id,
            content_id,
            slug,
            title,
            image_uri,
            episode,
            position_seconds,
            duration_seconds,
            audio,
            completed_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (profile_id, content_id) DO UPDATE SET
            slug = excluded.slug,
            title = excluded.title,
            image_uri = excluded.image_uri,
            episode = excluded.episode,
            position_seconds = excluded.position_seconds,
            duration_seconds = excluded.duration_seconds,
            audio = excluded.audio,
            completed_at = excluded.completed_at,
            updated_at = excluded.updated_at`,
          [
            merged.profileId,
            merged.contentId,
            merged.slug,
            merged.title,
            merged.imageUri ?? null,
            merged.episode,
            merged.positionSeconds,
            merged.durationSeconds,
            merged.audio,
            merged.completedAt,
            merged.updatedAt,
          ],
        );
      });

      if (!merged) throw new Error("Playback progress was not persisted");
      return merged;
    });
  }

  async clear(identity: PlaybackIdentity): Promise<boolean> {
    return this.writes.run(async () => {
      const key = normalizeSaveIdentity(identity);
      const result = await this.database.runAsync(
        "DELETE FROM playback_progress WHERE profile_id = ? AND content_id = ?",
        [key.profileId, key.contentId],
      );
      return result.changes > 0;
    });
  }

  async clearProfile(profileId: string): Promise<number> {
    return this.writes.run(async () => {
      const normalizedProfileId = normalizeProfileId(profileId);
      const result = await this.database.runAsync(
        "DELETE FROM playback_progress WHERE profile_id = ?",
        [normalizedProfileId],
      );
      return result.changes;
    });
  }
}
