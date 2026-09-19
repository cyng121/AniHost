import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import { DownloadsRepository } from "../downloads-repository";
import {
  LATEST_DATABASE_VERSION,
  migrateDatabase,
} from "../migrations";
import { PlaybackRepository } from "../playback-repository";
import { SavesRepository } from "../saves-repository";
import type { DownloadInput, PlaybackProgressInput, SaveInput } from "../types";
import { DataWriteQueue } from "../write-queue";

type BindValue = Extract<SQLInputValue, string | number | null>;

/** Minimal async facade matching the Expo SQLite calls used by the repositories. */
class TestSQLiteDatabase {
  private readonly database = new DatabaseSync(":memory:");

  async execAsync(source: string): Promise<void> {
    this.database.exec(source);
  }

  async runAsync(
    source: string,
    parameters: BindValue[] = [],
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.database.prepare(source).run(...parameters);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync<T>(
    source: string,
    parameters: BindValue[] = [],
  ): Promise<T | null> {
    return (this.database.prepare(source).get(...parameters) as T | undefined) ?? null;
  }

  async getAllAsync<T>(
    source: string,
    parameters: BindValue[] = [],
  ): Promise<T[]> {
    return this.database.prepare(source).all(...parameters) as T[];
  }

  async withExclusiveTransactionAsync(
    task: (transaction: TestSQLiteDatabase) => Promise<void>,
  ): Promise<void> {
    this.database.exec("BEGIN");
    try {
      await task(this);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}

async function createMigratedDatabase(): Promise<TestSQLiteDatabase> {
  const database = new TestSQLiteDatabase();
  await migrateDatabase(database as never);
  return database;
}

const SAVE: SaveInput = {
  profileId: "profile-a",
  contentId: "anime-42",
  contentType: "anime",
  slug: "example-title",
  title: "Example Title",
};

const PLAYBACK: PlaybackProgressInput = {
  profileId: "profile-a",
  contentId: "anime-42",
  slug: "example-title",
  title: "Example Title",
  episode: 7,
  positionSeconds: 120,
  durationSeconds: 1_440,
  audio: "sub",
};

const DOWNLOAD: DownloadInput = {
  profileId: "profile-a",
  contentId: "anime-42",
  episode: 7,
  audio: "sub",
  quality: "1080p",
  slug: "example-title",
  title: "Example Title",
};

test("migrations are idempotent and install the latest schema", async (context) => {
  const database = await createMigratedDatabase();
  context.after(() => database.close());

  await migrateDatabase(database as never);

  const migration = await database.getFirstAsync<{ version: number }>(
    "SELECT MAX(version) AS version FROM schema_migrations",
  );
  const userVersion = await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  assert.equal(migration?.version, LATEST_DATABASE_VERSION);
  assert.equal(userVersion?.user_version, LATEST_DATABASE_VERSION);
});

test("saves remain singular and an upsert preserves the original saved time", async (context) => {
  const database = await createMigratedDatabase();
  context.after(() => database.close());
  let now = 100;
  const repository = new SavesRepository(database as never, () => ++now);

  const first = await repository.save(SAVE);
  const updated = await repository.save({ ...SAVE, title: "Updated Title" });

  assert.equal((await repository.list("profile-a")).length, 1);
  assert.equal(updated.title, "Updated Title");
  assert.equal(updated.savedAt, first.savedAt);
  assert.ok(updated.updatedAt > first.updatedAt);

  assert.deepEqual(await repository.toggle(SAVE), { saved: false, item: null });
  assert.equal(await repository.isSaved(SAVE), false);
});

test("playback keeps one continuation per profile and title", async (context) => {
  const database = await createMigratedDatabase();
  context.after(() => database.close());
  let now = 200;
  const repository = new PlaybackRepository(database as never, () => ++now);

  await repository.save(PLAYBACK);
  await repository.save({
    ...PLAYBACK,
    audio: "dub",
    positionSeconds: 0,
    durationSeconds: 0,
  });
  const continuation = await repository.get(PLAYBACK);

  assert.equal((await repository.listRecent("profile-a")).length, 1);
  assert.equal(continuation?.audio, "dub");
  assert.equal(continuation?.positionSeconds, PLAYBACK.positionSeconds);
  assert.equal(continuation?.durationSeconds, PLAYBACK.durationSeconds);
});

test("repeat download requests attach to one composite identity", async (context) => {
  const database = await createMigratedDatabase();
  context.after(() => database.close());
  let now = 300;
  const repository = new DownloadsRepository(database as never, () => ++now);

  const [first, second, third] = await Promise.all([
    repository.request({ ...DOWNLOAD, quality: " 1080P " }),
    repository.request(DOWNLOAD),
    repository.request(DOWNLOAD),
  ]);

  assert.equal(first.disposition, "created");
  assert.equal(second.disposition, "attached");
  assert.equal(third.disposition, "attached");
  assert.equal((await repository.list("profile-a")).length, 1);

  await repository.request({ ...DOWNLOAD, audio: "dub" });
  await repository.request({ ...DOWNLOAD, quality: "720p" });
  assert.equal((await repository.list("profile-a")).length, 3);
});

test("a completed download is attached and the SQL trigger rejects lifecycle skips", async (context) => {
  const database = await createMigratedDatabase();
  context.after(() => database.close());
  const writes = new DataWriteQueue();
  let now = 400;
  const repository = new DownloadsRepository(
    database as never,
    () => ++now,
    writes,
  );

  await repository.request(DOWNLOAD);
  await assert.rejects(
    database.runAsync(
      `UPDATE downloads SET state = 'downloaded'
       WHERE profile_id = ? AND content_id = ? AND episode = ? AND audio = ? AND quality = ?`,
      ["profile-a", "anime-42", 7, "sub", "1080p"],
    ),
    /invalid download state transition/,
  );

  await repository.transition(DOWNLOAD, "downloading", {
    remoteUri: "https://media.example/episode.m3u8",
    totalBytes: 1_000,
  });
  await repository.transition(DOWNLOAD, "downloaded", {
    localUri: "file:///episodes/example-7.mp4",
    bytesDownloaded: 1_000,
  });
  const repeated = await repository.request(DOWNLOAD);

  assert.equal(repeated.disposition, "attached");
  assert.equal(repeated.record.state, "downloaded");
  assert.equal((await repository.listPending("profile-a")).length, 0);
});
