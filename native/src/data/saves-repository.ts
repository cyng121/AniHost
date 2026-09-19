import type { SQLiteDatabase } from "expo-sqlite";

import {
  normalizeProfileId,
  normalizeSaveIdentity,
  normalizeSaveInput,
} from "./model";
import type {
  Clock,
  SaveIdentity,
  SaveInput,
  SavedItem,
} from "./types";
import { DataWriteQueue } from "./write-queue";

interface SavedItemRow {
  profile_id: string;
  content_id: string;
  content_type: "anime" | "manga";
  slug: string;
  title: string;
  image_uri: string | null;
  rating: string | null;
  quality_label: string | null;
  total_episodes_or_chapters: string | null;
  saved_at: number;
  updated_at: number;
}

function mapSavedItem(row: SavedItemRow): SavedItem {
  return {
    profileId: row.profile_id,
    contentId: row.content_id,
    contentType: row.content_type,
    slug: row.slug,
    title: row.title,
    imageUri: row.image_uri,
    rating: row.rating,
    qualityLabel: row.quality_label,
    totalEpisodesOrChapters: row.total_episodes_or_chapters,
    savedAt: row.saved_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_SAVED_ITEM = `
  SELECT
    profile_id,
    content_id,
    content_type,
    slug,
    title,
    image_uri,
    rating,
    quality_label,
    total_episodes_or_chapters,
    saved_at,
    updated_at
  FROM saved_items
`;

export class SavesRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly clock: Clock = Date.now,
    private readonly writes = new DataWriteQueue(),
  ) {}

  async get(identity: SaveIdentity): Promise<SavedItem | null> {
    const key = normalizeSaveIdentity(identity);
    const row = await this.database.getFirstAsync<SavedItemRow>(
      `${SELECT_SAVED_ITEM} WHERE profile_id = ? AND content_id = ?`,
      [key.profileId, key.contentId],
    );
    return row ? mapSavedItem(row) : null;
  }

  async isSaved(identity: SaveIdentity): Promise<boolean> {
    const key = normalizeSaveIdentity(identity);
    const row = await this.database.getFirstAsync<{ found: number }>(
      `SELECT 1 AS found FROM saved_items
       WHERE profile_id = ? AND content_id = ?`,
      [key.profileId, key.contentId],
    );
    return Boolean(row?.found);
  }

  async list(profileId: string): Promise<SavedItem[]> {
    const normalizedProfileId = normalizeProfileId(profileId);
    const rows = await this.database.getAllAsync<SavedItemRow>(
      `${SELECT_SAVED_ITEM}
       WHERE profile_id = ?
       ORDER BY saved_at DESC, content_id ASC`,
      [normalizedProfileId],
    );
    return rows.map(mapSavedItem);
  }

  async save(input: SaveInput): Promise<SavedItem> {
    return this.writes.run(async () => {
      const item = normalizeSaveInput(input);
      const now = this.clock();

      await this.database.runAsync(
        `INSERT INTO saved_items (
          profile_id,
          content_id,
          content_type,
          slug,
          title,
          image_uri,
          rating,
          quality_label,
          total_episodes_or_chapters,
          saved_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (profile_id, content_id) DO UPDATE SET
          content_type = excluded.content_type,
          slug = excluded.slug,
          title = excluded.title,
          image_uri = excluded.image_uri,
          rating = excluded.rating,
          quality_label = excluded.quality_label,
          total_episodes_or_chapters = excluded.total_episodes_or_chapters,
          updated_at = excluded.updated_at`,
        [
          item.profileId,
          item.contentId,
          item.contentType,
          item.slug,
          item.title,
          item.imageUri ?? null,
          item.rating ?? null,
          item.qualityLabel ?? null,
          item.totalEpisodesOrChapters ?? null,
          now,
          now,
        ],
      );

      const saved = await this.get(item);
      if (!saved) throw new Error("Saved item disappeared after upsert");
      return saved;
    });
  }

  async remove(identity: SaveIdentity): Promise<boolean> {
    return this.writes.run(async () => {
      const key = normalizeSaveIdentity(identity);
      const result = await this.database.runAsync(
        "DELETE FROM saved_items WHERE profile_id = ? AND content_id = ?",
        [key.profileId, key.contentId],
      );
      return result.changes > 0;
    });
  }

  async toggle(input: SaveInput): Promise<{ saved: boolean; item: SavedItem | null }> {
    return this.writes.run(async () => {
      const item = normalizeSaveInput(input);
      const now = this.clock();
      let result: { saved: boolean; item: SavedItem | null } = {
        saved: false,
        item: null,
      };

      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.execAsync("PRAGMA busy_timeout = 5000;");
        const existing = await transaction.getFirstAsync<SavedItemRow>(
          `${SELECT_SAVED_ITEM} WHERE profile_id = ? AND content_id = ?`,
          [item.profileId, item.contentId],
        );

        if (existing) {
          await transaction.runAsync(
            "DELETE FROM saved_items WHERE profile_id = ? AND content_id = ?",
            [item.profileId, item.contentId],
          );
          result = { saved: false, item: null };
          return;
        }

        await transaction.runAsync(
          `INSERT INTO saved_items (
            profile_id, content_id, content_type, slug, title, image_uri, rating,
            quality_label, total_episodes_or_chapters, saved_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.profileId,
            item.contentId,
            item.contentType,
            item.slug,
            item.title,
            item.imageUri ?? null,
            item.rating ?? null,
            item.qualityLabel ?? null,
            item.totalEpisodesOrChapters ?? null,
            now,
            now,
          ],
        );

        result = {
          saved: true,
          item: {
            ...item,
            savedAt: now,
            updatedAt: now,
          },
        };
      });

      return result;
    });
  }

  async clear(profileId: string): Promise<number> {
    return this.writes.run(async () => {
      const normalizedProfileId = normalizeProfileId(profileId);
      const result = await this.database.runAsync(
        "DELETE FROM saved_items WHERE profile_id = ?",
        [normalizedProfileId],
      );
      return result.changes;
    });
  }
}
