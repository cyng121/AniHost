import type { SQLiteDatabase } from "expo-sqlite";

import { getAniGhostDatabase } from "./database";
import { DownloadsRepository } from "./downloads-repository";
import { PlaybackRepository } from "./playback-repository";
import { SavesRepository } from "./saves-repository";
import type { Clock } from "./types";
import { DataWriteQueue } from "./write-queue";

export interface AniGhostDataStore {
  readonly database: SQLiteDatabase;
  readonly saves: SavesRepository;
  readonly playback: PlaybackRepository;
  readonly downloads: DownloadsRepository;
}

export function createAniGhostDataStore(
  database: SQLiteDatabase,
  clock: Clock = Date.now,
): AniGhostDataStore {
  const writes = new DataWriteQueue();
  return {
    database,
    saves: new SavesRepository(database, clock, writes),
    playback: new PlaybackRepository(database, clock, writes),
    downloads: new DownloadsRepository(database, clock, writes),
  };
}

let sharedStorePromise: Promise<AniGhostDataStore> | null = null;

export function getAniGhostDataStore(): Promise<AniGhostDataStore> {
  if (!sharedStorePromise) {
    sharedStorePromise = getAniGhostDatabase()
      .then((database) => createAniGhostDataStore(database))
      .catch((error: unknown) => {
        sharedStorePromise = null;
        throw error;
      });
  }
  return sharedStorePromise;
}
