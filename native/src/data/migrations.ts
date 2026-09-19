import type { SQLiteDatabase } from "expo-sqlite";

export interface DatabaseMigration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    name: "device_library",
    sql: `
      CREATE TABLE IF NOT EXISTS saved_items (
        profile_id TEXT NOT NULL CHECK (profile_id = trim(profile_id) AND length(profile_id) > 0),
        content_id TEXT NOT NULL CHECK (content_id = trim(content_id) AND length(content_id) > 0),
        content_type TEXT NOT NULL CHECK (content_type IN ('anime', 'manga')),
        slug TEXT NOT NULL CHECK (length(trim(slug)) > 0),
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        image_uri TEXT,
        rating TEXT,
        quality_label TEXT,
        total_episodes_or_chapters TEXT,
        saved_at INTEGER NOT NULL CHECK (saved_at >= 0),
        updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
        PRIMARY KEY (profile_id, content_id)
      ) WITHOUT ROWID;

      CREATE TABLE IF NOT EXISTS playback_progress (
        profile_id TEXT NOT NULL CHECK (profile_id = trim(profile_id) AND length(profile_id) > 0),
        content_id TEXT NOT NULL CHECK (content_id = trim(content_id) AND length(content_id) > 0),
        slug TEXT NOT NULL CHECK (length(trim(slug)) > 0),
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        image_uri TEXT,
        episode INTEGER NOT NULL CHECK (episode >= 0),
        position_seconds REAL NOT NULL CHECK (position_seconds >= 0),
        duration_seconds REAL NOT NULL CHECK (duration_seconds >= 0),
        audio TEXT NOT NULL CHECK (audio IN ('sub', 'dub')),
        completed_at INTEGER CHECK (completed_at IS NULL OR completed_at >= 0),
        updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
        PRIMARY KEY (profile_id, content_id)
      ) WITHOUT ROWID;

      CREATE TABLE IF NOT EXISTS downloads (
        profile_id TEXT NOT NULL CHECK (profile_id = trim(profile_id) AND length(profile_id) > 0),
        content_id TEXT NOT NULL CHECK (content_id = trim(content_id) AND length(content_id) > 0),
        episode INTEGER NOT NULL CHECK (episode >= 0),
        audio TEXT NOT NULL CHECK (audio IN ('sub', 'dub')),
        quality TEXT NOT NULL CHECK (
          quality = lower(trim(quality)) AND length(quality) > 0
        ),
        slug TEXT,
        title TEXT,
        episode_title TEXT,
        image_uri TEXT,
        state TEXT NOT NULL CHECK (state IN (
          'notDownloaded',
          'queued',
          'downloading',
          'paused',
          'downloaded',
          'expired',
          'failed'
        )),
        remote_uri TEXT,
        local_uri TEXT,
        bytes_downloaded INTEGER NOT NULL DEFAULT 0 CHECK (bytes_downloaded >= 0),
        total_bytes INTEGER CHECK (
          total_bytes IS NULL OR
          (total_bytes >= 0 AND bytes_downloaded <= total_bytes)
        ),
        failure_code TEXT,
        failure_message TEXT,
        queued_at INTEGER CHECK (queued_at IS NULL OR queued_at >= 0),
        started_at INTEGER CHECK (started_at IS NULL OR started_at >= 0),
        completed_at INTEGER CHECK (completed_at IS NULL OR completed_at >= 0),
        expires_at INTEGER CHECK (expires_at IS NULL OR expires_at >= 0),
        created_at INTEGER NOT NULL CHECK (created_at >= 0),
        updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
        PRIMARY KEY (profile_id, content_id, episode, audio, quality)
      ) WITHOUT ROWID;
    `,
  },
  {
    version: 2,
    name: "query_indexes_and_download_state_guard",
    sql: `
      CREATE INDEX IF NOT EXISTS saved_items_recent_idx
        ON saved_items (profile_id, saved_at DESC);

      CREATE INDEX IF NOT EXISTS playback_progress_recent_idx
        ON playback_progress (profile_id, updated_at DESC);

      CREATE INDEX IF NOT EXISTS downloads_state_recent_idx
        ON downloads (profile_id, state, updated_at DESC);

      CREATE INDEX IF NOT EXISTS downloads_expiration_idx
        ON downloads (state, expires_at)
        WHERE state = 'downloaded' AND expires_at IS NOT NULL;

      CREATE TRIGGER IF NOT EXISTS downloads_valid_state_transition
      BEFORE UPDATE OF state ON downloads
      FOR EACH ROW
      WHEN NEW.state <> OLD.state AND NOT (
        (OLD.state = 'notDownloaded' AND NEW.state IN ('queued')) OR
        (OLD.state = 'queued' AND NEW.state IN ('downloading', 'paused', 'failed', 'notDownloaded')) OR
        (OLD.state = 'downloading' AND NEW.state IN ('paused', 'downloaded', 'failed', 'notDownloaded')) OR
        (OLD.state = 'paused' AND NEW.state IN ('queued', 'downloading', 'failed', 'expired', 'notDownloaded')) OR
        (OLD.state = 'downloaded' AND NEW.state IN ('expired', 'notDownloaded')) OR
        (OLD.state = 'expired' AND NEW.state IN ('queued', 'notDownloaded')) OR
        (OLD.state = 'failed' AND NEW.state IN ('queued', 'notDownloaded'))
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid download state transition');
      END;
    `,
  },
] as const;

export const LATEST_DATABASE_VERSION =
  DATABASE_MIGRATIONS[DATABASE_MIGRATIONS.length - 1]?.version ?? 0;

interface AppliedMigrationRow {
  version: number;
}

/**
 * Runs every unapplied migration exactly once. The second in-process caller
 * rechecks inside the exclusive transaction, so initialization is idempotent.
 */
export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const newestApplied = await database.getFirstAsync<AppliedMigrationRow>(
    "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
  );

  if ((newestApplied?.version ?? 0) > LATEST_DATABASE_VERSION) {
    throw new Error(
      `Ani Ghost database version ${newestApplied?.version} is newer than supported version ${LATEST_DATABASE_VERSION}`,
    );
  }

  for (const migration of DATABASE_MIGRATIONS) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      // SDK 57 creates a dedicated connection for exclusive transactions, so
      // connection-local pragmas must be applied again inside the callback.
      await transaction.execAsync("PRAGMA busy_timeout = 5000;");
      const applied = await transaction.getFirstAsync<AppliedMigrationRow>(
        "SELECT version FROM schema_migrations WHERE version = ?",
        [migration.version],
      );
      if (applied) return;

      await transaction.execAsync(migration.sql);
      await transaction.runAsync(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [migration.version, migration.name, Date.now()],
      );
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
