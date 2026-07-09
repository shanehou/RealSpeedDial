import { describe, it, expect } from 'vitest';
import { shouldCapture } from './capturePolicy';

const DAY = 86400000;

describe('shouldCapture', () => {
  it('never policy → false', () => {
    expect(shouldCapture('never', undefined, 7, 1000)).toBe(false);
  });
  it('always policy → true even if fresh', () => {
    expect(shouldCapture('always', 999, 7, 1000)).toBe(true);
  });
  it('stale policy → true when no existing capture', () => {
    expect(shouldCapture('stale', undefined, 7, 1000)).toBe(true);
  });
  it('stale policy → false when within N days', () => {
    expect(shouldCapture('stale', 1000, 7, 1000 + 3 * DAY)).toBe(false);
  });
  it('stale policy → true when older than N days', () => {
    expect(shouldCapture('stale', 1000, 7, 1000 + 8 * DAY)).toBe(true);
  });
});
