import * as SQLite from "expo-sqlite";

import { migrateDatabase } from "./migrations";

export const ANIGHOST_DATABASE_NAME = "anighost.db";

let sharedDatabasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function openAniGhostDatabase(
  databaseName = ANIGHOST_DATABASE_NAME,
): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(databaseName);
  await migrateDatabase(database);
  return database;
}

/** Returns the one shared, initialized connection used by app repositories. */
export function getAniGhostDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!sharedDatabasePromise) {
    sharedDatabasePromise = openAniGhostDatabase().catch((error: unknown) => {
      sharedDatabasePromise = null;
      throw error;
    });
  }
  return sharedDatabasePromise;
}

/** Useful for app teardown and isolated tests; this never deletes the database. */
export async function closeAniGhostDatabase(): Promise<void> {
  const pending = sharedDatabasePromise;
  sharedDatabasePromise = null;
  if (!pending) return;

  const database = await pending;
  await database.closeAsync();
}
