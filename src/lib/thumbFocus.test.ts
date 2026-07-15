import { describe, it, expect } from 'vitest';
import { FULL_REGION, normalizeRect, isRegionTooSmall, computeFocusBackground } from './thumbFocus';

describe('normalizeRect', () => {
  it('normalizes a pixel rect against the viewport', () => {
    expect(normalizeRect({ x: 100, y: 50, w: 200, h: 100 }, 1000, 500)).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  });
  it('clamps out-of-range values and keeps right/bottom inside', () => {
    const r = normalizeRect({ x: -50, y: 480, w: 2000, h: 200 }, 1000, 500);
    expect(r.x).toBe(0);
    expect(r.y).toBeCloseTo(0.96);
    expect(r.w).toBe(1);
    expect(r.h).toBeCloseTo(0.04);
  });
});

describe('isRegionTooSmall', () => {
  it('flags rects below the min pixel size', () => {
    expect(isRegionTooSmall({ w: 4, h: 100 })).toBe(true);
    expect(isRegionTooSmall({ w: 40, h: 40 })).toBe(false);
  });
});

describe('computeFocusBackground', () => {
  it('uses cover for the full-image region', () => {
    expect(computeFocusBackground(FULL_REGION, 1.5, 2)).toEqual({
      backgroundSize: 'cover', backgroundPositionX: 'center', backgroundPositionY: 'center',
    });
  });
  it('magnifies a small sub-region and centers it', () => {
    // 宽图 2:1 放进方形磁贴 1:1，焦点为正中 0.2×0.2 小块 → 放大 5 倍、居中
    const out = computeFocusBackground({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 2, 1);
    expect(out.backgroundSize).toBe('500% auto');
    expect(out.backgroundPositionX).toBe('50%');
    expect(out.backgroundPositionY).toBe('50%');
  });
  it('keeps an edge region inside the image (no negative offset)', () => {
    const out = computeFocusBackground({ x: 0, y: 0, w: 0.2, h: 0.2 }, 1, 1);
    expect(out.backgroundSize).toBe('500% auto');
    expect(out.backgroundPositionX).toBe('0%');
    expect(out.backgroundPositionY).toBe('0%');
  });
  it('falls back to cover when the ideal viewport would exceed the image', () => {
    const out = computeFocusBackground({ x: 0, y: 0, w: 1, h: 0.9 }, 1, 3);
    expect(out.backgroundSize).toBe('cover');
  });
});
