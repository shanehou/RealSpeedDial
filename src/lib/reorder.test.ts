import { describe, it, expect } from 'vitest';
import { computeMoveIndex, resolveMoveIndex } from './reorder';

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

describe('resolveMoveIndex (uses each item real .index for mixed folders)', () => {
  it('subfolder tab: bookmarks with a folder occupying a real index gap', () => {
    // 真实索引 [0,1,3]（文件夹占了 index 2，不在可见 items 里）
    const items = [{ index: 0 }, { index: 1 }, { index: 3 }];
    expect(resolveMoveIndex(items, 0, 2)).toBe(4); // 显示位 0→2 == 真实 0→3（下移）
    expect(resolveMoveIndex(items, 2, 0)).toBe(0); // 真实 3→0（上移）
  });
  it('home tab: folder occupies real index 0 so bookmarks start at 1', () => {
    const items = [{ index: 1 }, { index: 2 }];
    expect(resolveMoveIndex(items, 0, 1)).toBe(3); // 真实 1→2（下移）
    expect(resolveMoveIndex(items, 1, 0)).toBe(1); // 真实 2→1（上移）
  });
});
