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
  it('magnifies a tall sub-region (Ar < Ac branch) and positions it', () => {
    // region 0.2×0.4，图 1:1 放进 2:1 磁贴 → Ar=0.5<Ac=2 → 以高为准：Vh=0.4, Vw=0.8
    const out = computeFocusBackground({ x: 0.4, y: 0.3, w: 0.2, h: 0.4 }, 1, 2);
    expect(out.backgroundSize).toBe('125% auto'); // 100/0.8
    expect(out.backgroundPositionX).toBe('50%');  // Vx=0.1 → 0.1/(1-0.8)
    expect(out.backgroundPositionY).toBe('50%');  // Vy=0.3 → 0.3/(1-0.4)
  });
  it('clamps the viewport back inside when the ideal center would overflow the left edge', () => {
    // region 贴左边 x=0，Ar=0.5<Ac=2 → Vh=0.2, Vw=0.4；理想 Vx=0.05-0.2=-0.15 被 clamp 到 0
    const out = computeFocusBackground({ x: 0, y: 0.4, w: 0.1, h: 0.2 }, 1, 2);
    expect(out.backgroundSize).toBe('250% auto'); // 100/0.4
    expect(out.backgroundPositionX).toBe('0%');   // Vx clamped 0 → 0/(1-0.4)
    expect(out.backgroundPositionY).toBe('50%');  // Vy=0.4 → 0.4/(1-0.2)
  });
});
