export interface CaptureQueue {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createCaptureQueue(
  minIntervalMs: number,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): CaptureQueue {
  let tail: Promise<void> = Promise.resolve();
  let lastStartedAt = Number.NEGATIVE_INFINITY;

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(async () => {
        const wait = minIntervalMs - (now() - lastStartedAt);
        if (wait > 0) await sleep(wait);
        lastStartedAt = now();
        return task();
      });
      // A failed capture must not poison the queue.
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
