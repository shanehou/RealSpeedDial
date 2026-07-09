import { describe, it, expect } from 'vitest';
import { computeMoveIndex } from './reorder';

describe('computeMoveIndex', () => {
  it('moving down accounts for removal shift', () => {
    // [a,b,c,d]，把 index0 移到 index2 → chrome.move 需要 index 3
    expect(computeMoveIndex(0, 2)).toBe(3);
  });
  it('moving up keeps target index', () => {
    expect(computeMoveIndex(3, 1)).toBe(1);
  });
  it('same position returns same', () => {
    expect(computeMoveIndex(2, 2)).toBe(2);
  });
});
