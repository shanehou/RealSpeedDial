import type { NormalizedRegion } from '@/types';

export const FULL_REGION: NormalizedRegion = { x: 0, y: 0, w: 1, h: 1 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// 拖拽像素矩形（相对视口）→ 归一化区域，clamp 到 [0,1] 且右/下不越界
export function normalizeRect(
  rect: { x: number; y: number; w: number; h: number },
  viewportW: number,
  viewportH: number,
): NormalizedRegion {
  const x = clamp(rect.x / viewportW, 0, 1);
  const y = clamp(rect.y / viewportH, 0, 1);
  return {
    x,
    y,
    w: clamp(rect.w / viewportW, 0, 1 - x),
    h: clamp(rect.h / viewportH, 0, 1 - y),
  };
}

export function isRegionTooSmall(rect: { w: number; h: number }, minPx = 8): boolean {
  return rect.w < minPx || rect.h < minPx;
}

export interface FocusBackground {
  backgroundSize: string;
  backgroundPositionX: string;
  backgroundPositionY: string;
}

const COVER: FocusBackground = { backgroundSize: 'cover', backgroundPositionX: 'center', backgroundPositionY: 'center' };

// region 相对图片归一化；imageAspect=IW/IH；containerAspect=CW/CH
export function computeFocusBackground(
  region: NormalizedRegion,
  imageAspect: number,
  containerAspect: number,
): FocusBackground {
  if (!(imageAspect > 0) || !(containerAspect > 0)) return COVER;
  if (region.w >= 1 && region.h >= 1) return COVER; // 全图 → 保持 cover（不留白、不回归）

  const Ai = imageAspect;
  const Ac = containerAspect;
  const Ar = (region.w / region.h) * Ai; // 焦点区域像素比

  // 视窗 V（归一化，像素比=Ac，含整个 region）
  let Vw: number;
  let Vh: number;
  if (Ar >= Ac) { Vw = region.w; Vh = (region.w * Ai) / Ac; }
  else { Vh = region.h; Vw = (region.h * Ac) / Ai; }

  // 无法在图内容纳该比例视窗 → cover 兜底，定位到 region 中心
  if (Vw > 1 || Vh > 1) {
    return {
      backgroundSize: 'cover',
      backgroundPositionX: `${(region.x + region.w / 2) * 100}%`,
      backgroundPositionY: `${(region.y + region.h / 2) * 100}%`,
    };
  }

  // 视窗中心对齐 region 中心，clamp 到 [0,1]
  const Vx = clamp(region.x + region.w / 2 - Vw / 2, 0, 1 - Vw);
  const Vy = clamp(region.y + region.h / 2 - Vh / 2, 0, 1 - Vh);

  return {
    backgroundSize: `${100 / Vw}% auto`,
    backgroundPositionX: Vw < 1 ? `${(Vx / (1 - Vw)) * 100}%` : '0%',
    backgroundPositionY: Vh < 1 ? `${(Vy / (1 - Vh)) * 100}%` : '0%',
  };
}
