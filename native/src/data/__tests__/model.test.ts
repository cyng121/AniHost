import assert from "node:assert/strict";
import test from "node:test";

import {
  DataInvariantError,
  InvalidDownloadTransitionError,
  createDownloadRecord,
  downloadIdentityKey,
  isPlaybackFinished,
  mergePlaybackProgress,
  normalizeListLimit,
  normalizeTransferPatch,
  planDownloadRequest,
  transitionDownloadRecord,
} from "../model";
import type {
  DownloadInput,
  DownloadRecord,
  PlaybackProgress,
  PlaybackProgressInput,
} from "../types";
import { DataWriteQueue } from "../write-queue";

const DOWNLOAD_INPUT: DownloadInput = {
  profileId: "profile-a",
  contentId: "anime-42",
  episode: 7,
  audio: "sub",
  quality: "1080p",
  slug: "example-title",
  title: "Example Title",
};

function playback(
  patch: Partial<PlaybackProgressInput> = {},
): PlaybackProgressInput {
  return {
    profileId: "profile-a",
    contentId: "anime-42",
    slug: "example-title",
    title: "Example Title",
    episode: 7,
    positionSeconds: 120,
    durationSeconds: 1_440,
    audio: "sub",
    ...patch,
  };
}

test("download identity is canonical across harmless formatting differences", () => {
  const first = downloadIdentityKey({
    ...DOWNLOAD_INPUT,
    profileId: " profile-a ",
    quality: " 1080P ",
  });
  const second = downloadIdentityKey(DOWNLOAD_INPUT);
  const otherQuality = downloadIdentityKey({
    ...DOWNLOAD_INPUT,
    quality: "720p",
  });

  assert.equal(first, second);
  assert.notEqual(first, otherQuality);
});

test("repeat download taps attach while retryable records requeue in place", () => {
  for (const state of ["queued", "downloading", "downloaded"] as const) {
    assert.deepEqual(planDownloadRequest(state, false), {
      nextState: state,
      disposition: "attached",
    });
  }

  for (const state of [
    "notDownloaded",
    "paused",
    "expired",
    "failed",
  ] as const) {
    assert.deepEqual(planDownloadRequest(state, false), {
      nextState: "queued",
      disposition: "requeued",
    });
  }

  assert.deepEqual(planDownloadRequest("notDownloaded", true), {
    nextState: "queued",
    disposition: "created",
  });
});

test("download reducer enforces the lifecycle and final file invariant", () => {
  let record: DownloadRecord = createDownloadRecord(DOWNLOAD_INPUT, 100);
  record = transitionDownloadRecord(record, "queued", {}, 110);
  assert.equal(record.queuedAt, 110);

  record = transitionDownloadRecord(
    record,
    "downloading",
    { remoteUri: "https://media.example/episode.m3u8", totalBytes: 1_000 },
    120,
  );
  assert.equal(record.startedAt, 120);

  assert.throws(
    () => transitionDownloadRecord(record, "downloaded", {}, 130),
    DataInvariantError,
  );

  record = transitionDownloadRecord(
    record,
    "downloaded",
    { localUri: "file:///episodes/example-7.mp4", bytesDownloaded: 1_000 },
    140,
  );
  assert.equal(record.completedAt, 140);
  assert.equal(record.bytesDownloaded, 1_000);

  assert.throws(
    () => transitionDownloadRecord(record, "downloading", {}, 150),
    InvalidDownloadTransitionError,
  );
});

test("failed retries preserve the canonical key and reset stale transfer data", () => {
  let record = createDownloadRecord(DOWNLOAD_INPUT, 100);
  record = transitionDownloadRecord(record, "queued", {}, 110);
  record = transitionDownloadRecord(
    record,
    "downloading",
    { remoteUri: "https://media.example/episode.m3u8", totalBytes: 1_000 },
    120,
  );
  record = transitionDownloadRecord(
    record,
    "failed",
    {
      bytesDownloaded: 250,
      failureCode: "NETWORK",
      failureMessage: "Connection lost",
    },
    130,
  );
  const identityBeforeRetry = downloadIdentityKey(record);

  record = transitionDownloadRecord(record, "queued", {}, 140);

  assert.equal(downloadIdentityKey(record), identityBeforeRetry);
  assert.equal(record.bytesDownloaded, 0);
  assert.equal(record.totalBytes, null);
  assert.equal(record.remoteUri, null);
  assert.equal(record.failureCode, null);
  assert.equal(record.failureMessage, null);
});

test("byte counters remain SQLite-safe integers", () => {
  assert.throws(
    () => normalizeTransferPatch({ bytesDownloaded: 1.5 }),
    DataInvariantError,
  );
  assert.throws(
    () => normalizeTransferPatch({ totalBytes: Number.MAX_SAFE_INTEGER + 1 }),
    DataInvariantError,
  );
});

test("per-title playback survives a same-episode audio switch zero event", () => {
  const current: PlaybackProgress = {
    ...playback(),
    completedAt: null,
    updatedAt: 100,
  };
  const merged = mergePlaybackProgress(
    current,
    playback({
      audio: "dub",
      positionSeconds: 0,
      durationSeconds: 0,
    }),
    200,
  );

  assert.equal(merged.audio, "dub");
  assert.equal(merged.positionSeconds, current.positionSeconds);
  assert.equal(merged.durationSeconds, current.durationSeconds);
  assert.equal(merged.updatedAt, 200);
});

test("a different episode replaces the title's continuation", () => {
  const current: PlaybackProgress = {
    ...playback(),
    completedAt: null,
    updatedAt: 100,
  };
  const merged = mergePlaybackProgress(
    current,
    playback({ episode: 8, positionSeconds: 0, durationSeconds: 0 }),
    200,
  );

  assert.equal(merged.episode, 8);
  assert.equal(merged.positionSeconds, 0);
  assert.equal(merged.durationSeconds, 0);
});

test("completion and list bounds are deterministic", () => {
  assert.equal(
    isPlaybackFinished({ positionSeconds: 1_395, durationSeconds: 1_440 }),
    true,
  );
  assert.equal(
    isPlaybackFinished({ positionSeconds: 1_394.9, durationSeconds: 1_440 }),
    false,
  );
  assert.equal(normalizeListLimit(Number.NaN), 100);
  assert.equal(normalizeListLimit(0), 1);
  assert.equal(normalizeListLimit(1_000), 500);
  assert.equal(normalizeListLimit(12.9), 12);
});

test("write queue preserves order and remains usable after a failed task", async () => {
  const writes = new DataWriteQueue();
  const events: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = writes.run(async () => {
    events.push("first:start");
    await firstGate;
    events.push("first:end");
  });
  const second = writes.run(async () => {
    events.push("second");
  });

  await Promise.resolve();
  assert.deepEqual(events, ["first:start"]);
  releaseFirst?.();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first:start", "first:end", "second"]);

  await assert.rejects(
    writes.run(async () => {
      throw new Error("expected failure");
    }),
  );
  await writes.run(async () => {
    events.push("after-failure");
  });
  assert.equal(events.at(-1), "after-failure");
});
