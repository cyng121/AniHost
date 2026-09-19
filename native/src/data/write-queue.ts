/**
 * Serializes the tiny SQLite writes issued by the repositories. Expo SQLite's
 * exclusive async transactions use a dedicated connection, so keeping writes
 * ordered avoids lock races between rapid player events and repeated taps.
 */
export class DataWriteQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
