import { describe, expect, it } from 'vitest';
import { createCaptureQueue } from './captureQueue';

describe('captureQueue', () => {
  it('does not start a second capture until the first has settled', async () => {
    const queue = createCaptureQueue(0);
    const starts: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const first = queue.run(async () => {
      starts.push('first');
      await firstGate;
    });
    const second = queue.run(async () => {
      starts.push('second');
    });

    await Promise.resolve();
    expect(starts).toEqual(['first']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(starts).toEqual(['first', 'second']);
  });
});
