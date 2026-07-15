# 区域截图缩略图 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在网页上右键框选一块区域作为磁贴缩略图焦点；缩略图升级为「整页截图 + 归一化焦点区域」，磁贴按焦点放大显示，且所有截图入口共用该焦点区域。

**Architecture:** 新增两个纯逻辑模块——`thumbFocus.ts`（焦点显示算法 + 坐标归一化）与 `regionOverlay.ts`（可注入页面的框选遮罩）。service worker 作为 Chrome API 适配层：先 `captureVisibleTab` 截干净的可见页，再用 `scripting.executeScript` 注入遮罩取归一化区域，落库为 `ThumbnailRecord.region`。所有更新入口（自动抓取 / 手动刷新 / 过期）沿用已存 `region`。`Tile` 用 `background-image` + 计算出的 `background-size/position` 实现焦点放大，随磁贴比例（列数变化）自适应。

**Tech Stack:** React 19, TypeScript, Chrome MV3（`scripting` + `activeTab`）, IndexedDB, Vitest, Testing Library。

**约定：** 计划包含 TDD 节奏的「提交」步骤；是否真正执行 `git commit` 遵循用户授权（本仓库惯例：仅在用户明确要求时提交）。测试命令：单文件 `npx vitest run <path>`，全量 `npm test`；类型/构建 `npm run build`。

---

## 文件结构

**新增：**
- `src/lib/thumbFocus.ts` — `FULL_REGION`、`normalizeRect`、`isRegionTooSmall`、`computeFocusBackground`（纯函数，重点单测）。
- `src/lib/thumbFocus.test.ts`
- `src/background/regionOverlay.ts` — `selectRegionOverlay`（注入页面的框选遮罩，返回像素矩形 + 视口尺寸）。
- `src/background/regionOverlay.test.ts`

**修改：**
- `src/types.ts` — `NormalizedRegion` 类型 + `ThumbnailRecord.region?`。
- `src/lib/thumbnails.ts` — `PendingThumbnailCapture.region?`。
- `src/lib/i18n.ts` — `context.captureRegion` 中英文案。
- `manifest.config.ts` — `permissions` 增 `scripting`。
- `tests/setup.ts` — Chrome mock 增 `scripting.executeScript`；全局 `ResizeObserver` stub。
- `src/background/service-worker.ts` — 第二个右键菜单 + 区域截图流程 + `storeCapture` 支持 `region` + 各更新入口沿用 `region`。
- `src/background/service-worker.test.ts` — 新增区域截图 / 沿用 region 用例。
- `src/options/ThumbnailPicker.tsx` / `.test.tsx` — 落库携带 `region`。
- `src/newtab/hooks/useThumbnails.ts` / `.test.ts` — 返回整条 `ThumbnailRecord`（含 region）。
- `src/newtab/components/Grid.tsx` — `thumbnails` prop 形状变更并透传 region。
- `src/newtab/App.tsx` — 类型透传（无逻辑变更）。
- `src/newtab/components/Tile.tsx` / `.test.tsx` — `background` 焦点显示。
- `src/newtab/styles.css` — `.tile__screenshot` 改为 background 元素。
- `README.md` / `README.zh-CN.md` — 区域截图说明。

---

### Task 1: 数据模型 — 归一化焦点区域

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/thumbnails.ts`

> 纯类型基础改动，无运行时行为，用 `tsc` 编译验证代替单测。

- [ ] **Step 1: 在 `src/types.ts` 增加 `NormalizedRegion` 并扩展 `ThumbnailRecord`**

在文件末尾的 `ThumbnailRecord` 处修改为：

```ts
// 归一化焦点区域：均为 0~1，相对「当前可见页」截图
export interface NormalizedRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ThumbnailRecord {
  url: string;
  dataUrl: string; // 始终是「当前可见页」整页截图
  capturedAt: number;
  region?: NormalizedRegion; // 缺省 = 全图 {0,0,1,1}（旧数据 / 整页截图）
}
```

- [ ] **Step 2: 在 `src/lib/thumbnails.ts` 为 `PendingThumbnailCapture` 增加可选 `region`**

```ts
import { THUMB_DB_NAME, THUMB_DB_VERSION, THUMB_STORE, ASSET_STORE } from './constants';
import type { NormalizedRegion, ThumbnailRecord } from '@/types';

export interface PendingThumbnailCapture {
  sourceUrl: string;
  dataUrl: string;
  capturedAt: number;
  region?: NormalizedRegion;
}
```

（仅新增 `import` 的 `NormalizedRegion` 与接口中的 `region?` 字段，其余不变。）

- [ ] **Step 3: 编译验证**

Run: `npm run build`
Expected: 通过（无类型错误）。

- [ ] **Step 4: 提交**

```bash
git add src/types.ts src/lib/thumbnails.ts
git commit -m "feat(types): 缩略图记录支持归一化焦点区域"
```

---

### Task 2: 焦点显示算法与坐标归一化（thumbFocus）

**Files:**
- Create: `src/lib/thumbFocus.ts`
- Create: `src/lib/thumbFocus.test.ts`

- [ ] **Step 1: 写失败测试 `src/lib/thumbFocus.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/lib/thumbFocus.test.ts`
Expected: FAIL（`thumbFocus` 模块不存在）。

- [ ] **Step 3: 实现 `src/lib/thumbFocus.ts`**

```ts
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/lib/thumbFocus.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/thumbFocus.ts src/lib/thumbFocus.test.ts
git commit -m "feat(thumbnail): 焦点区域显示算法与坐标归一化工具"
```

---

### Task 3: 网页区域框选遮罩脚本（regionOverlay）

**Files:**
- Create: `src/background/regionOverlay.ts`
- Create: `src/background/regionOverlay.test.ts`

> `selectRegionOverlay` 会被 `chrome.scripting.executeScript({ func })` 序列化注入页面，**必须完全自包含**（函数体内不引用任何模块作用域符号 / import；`OverlayResult` 是编译期类型，运行时已擦除，可安全引用）。

- [ ] **Step 1: 写失败测试 `src/background/regionOverlay.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { selectRegionOverlay } from './regionOverlay';

function drag(x1: number, y1: number, x2: number, y2: number) {
  const root = document.querySelector('[data-rsd-region-overlay]') as HTMLElement;
  root.dispatchEvent(new MouseEvent('mousedown', { clientX: x1, clientY: y1, bubbles: true }));
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: x2, clientY: y2, bubbles: true }));
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: x2, clientY: y2, bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});

describe('selectRegionOverlay', () => {
  it('resolves the drawn rect and viewport on Enter', async () => {
    const promise = selectRegionOverlay();
    drag(100, 200, 300, 500);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await expect(promise).resolves.toEqual({ x: 100, y: 200, w: 200, h: 300, viewW: 1000, viewH: 800 });
    expect(document.querySelector('[data-rsd-region-overlay]')).toBeNull();
  });

  it('resolves null on Escape', async () => {
    const promise = selectRegionOverlay();
    drag(10, 10, 200, 200);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBeNull();
  });

  it('resolves null when the drawn rect is too small', async () => {
    const promise = selectRegionOverlay();
    drag(10, 10, 13, 13);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await expect(promise).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/background/regionOverlay.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/background/regionOverlay.ts`**

```ts
export interface OverlayResult {
  x: number;
  y: number;
  w: number;
  h: number;
  viewW: number;
  viewH: number;
}

// 注入到页面的自包含框选遮罩：拖拽画框 → 8 手柄/整体拖动可调整 → Enter/✓ 确认、Esc/✕ 取消。
export function selectRegionOverlay(): Promise<OverlayResult | null> {
  return new Promise((resolve) => {
    const MIN = 8;
    const doc = document;
    const DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    const root = doc.createElement('div');
    root.setAttribute('data-rsd-region-overlay', '');
    Object.assign(root.style, { position: 'fixed', inset: '0', zIndex: '2147483647', cursor: 'crosshair' } as Partial<CSSStyleDeclaration>);

    const box = doc.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', boxSizing: 'border-box', border: '1px solid #fff',
      boxShadow: '0 0 0 100vmax rgba(0,0,0,.45)', display: 'none', cursor: 'move',
    } as Partial<CSSStyleDeclaration>);
    root.appendChild(box);

    const bar = doc.createElement('div');
    Object.assign(bar.style, { position: 'fixed', display: 'none', gap: '8px', transform: 'translateY(6px)' } as Partial<CSSStyleDeclaration>);
    const mkBtn = (label: string, bg: string) => {
      const b = doc.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        font: '13px system-ui, sans-serif', padding: '4px 12px', border: 'none',
        borderRadius: '6px', color: '#fff', background: bg, cursor: 'pointer',
      } as Partial<CSSStyleDeclaration>);
      return b;
    };
    const okBtn = mkBtn('\u2713', '#2563eb');
    const cancelBtn = mkBtn('\u2715', '#4b5563');
    bar.append(okBtn, cancelBtn);
    root.appendChild(bar);

    const handles: Record<string, HTMLDivElement> = {};
    for (const dir of DIRS) {
      const h = doc.createElement('div');
      h.dataset.dir = dir;
      Object.assign(h.style, {
        position: 'fixed', width: '10px', height: '10px', boxSizing: 'border-box',
        background: '#fff', border: '1px solid #2563eb', borderRadius: '2px', display: 'none',
      } as Partial<CSSStyleDeclaration>);
      handles[dir] = h;
      root.appendChild(h);
    }

    let sel: { x: number; y: number; w: number; h: number } | null = null;
    type Mode =
      | { kind: 'idle' }
      | { kind: 'create'; ox: number; oy: number }
      | { kind: 'move'; dx: number; dy: number }
      | { kind: 'resize'; dir: string };
    let mode: Mode = { kind: 'idle' };
    const clampView = (v: number, max: number) => Math.min(max, Math.max(0, v));

    function layout() {
      if (!sel) {
        box.style.display = 'none';
        bar.style.display = 'none';
        for (const d of DIRS) handles[d].style.display = 'none';
        return;
      }
      const { x, y, w, h } = sel;
      box.style.display = 'block';
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;
      const pos: Record<string, [number, number]> = {
        nw: [x, y], n: [x + w / 2, y], ne: [x + w, y], e: [x + w, y + h / 2],
        se: [x + w, y + h], s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2],
      };
      for (const d of DIRS) {
        handles[d].style.display = 'block';
        handles[d].style.left = `${pos[d][0] - 5}px`;
        handles[d].style.top = `${pos[d][1] - 5}px`;
        handles[d].style.cursor = `${d}-resize`;
      }
      bar.style.display = 'flex';
      bar.style.left = `${Math.max(0, x + w - 76)}px`;
      bar.style.top = `${y + h}px`;
    }

    function resize(s: { x: number; y: number; w: number; h: number }, dir: string, mx: number, my: number) {
      let { x, y, w, h } = s;
      const right = x + w;
      const bottom = y + h;
      if (dir.includes('w')) { x = Math.min(mx, right); w = right - x; }
      if (dir.includes('e')) { w = Math.max(0, mx - x); }
      if (dir.includes('n')) { y = Math.min(my, bottom); h = bottom - y; }
      if (dir.includes('s')) { h = Math.max(0, my - y); }
      return { x, y, w, h };
    }

    function cleanup() {
      root.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', stopScroll, true);
      window.removeEventListener('touchmove', stopScroll, true);
      root.remove();
    }

    function finish(commit: boolean) {
      cleanup();
      if (commit && sel && sel.w >= MIN && sel.h >= MIN) {
        resolve({ x: sel.x, y: sel.y, w: sel.w, h: sel.h, viewW: window.innerWidth, viewH: window.innerHeight });
      } else {
        resolve(null);
      }
    }

    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target === okBtn || target === cancelBtn) return;
      e.preventDefault();
      if (target.dataset && target.dataset.dir) { mode = { kind: 'resize', dir: target.dataset.dir }; return; }
      if (sel && target === box) { mode = { kind: 'move', dx: e.clientX - sel.x, dy: e.clientY - sel.y }; return; }
      mode = { kind: 'create', ox: e.clientX, oy: e.clientY };
      sel = { x: e.clientX, y: e.clientY, w: 0, h: 0 };
      layout();
    }

    function onMove(e: MouseEvent) {
      if (mode.kind === 'idle' || !sel) return;
      e.preventDefault();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (mode.kind === 'create') {
        sel = { x: Math.min(mode.ox, e.clientX), y: Math.min(mode.oy, e.clientY), w: Math.abs(e.clientX - mode.ox), h: Math.abs(e.clientY - mode.oy) };
      } else if (mode.kind === 'move') {
        sel = { ...sel, x: clampView(e.clientX - mode.dx, vw - sel.w), y: clampView(e.clientY - mode.dy, vh - sel.h) };
      } else {
        sel = resize(sel, mode.dir, e.clientX, e.clientY);
      }
      layout();
    }

    function onUp(e: MouseEvent) {
      if (mode.kind !== 'idle') { e.preventDefault(); mode = { kind: 'idle' }; }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    }

    function stopScroll(e: Event) { e.preventDefault(); }

    root.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', stopScroll, { passive: false, capture: true });
    window.addEventListener('touchmove', stopScroll, { passive: false, capture: true });
    okBtn.addEventListener('click', (e) => { e.preventDefault(); finish(true); });
    cancelBtn.addEventListener('click', (e) => { e.preventDefault(); finish(false); });

    doc.documentElement.appendChild(root);
  });
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/background/regionOverlay.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/background/regionOverlay.ts src/background/regionOverlay.test.ts
git commit -m "feat(thumbnail): 网页区域框选遮罩注入脚本"
```

---

### Task 4: 文案、权限与测试桩

**Files:**
- Modify: `src/lib/i18n.ts`
- Modify: `manifest.config.ts`
- Modify: `tests/setup.ts`

- [ ] **Step 1: 在 `src/lib/i18n.ts` 两个词典各加一条 `context.captureRegion`**

`en` 词典中 `'context.captureCurrent'` 行后新增：

```ts
    'context.captureRegion': 'Capture a region as thumbnail',
```

`zh` 词典中 `'context.captureCurrent'` 行后新增：

```ts
    'context.captureRegion': '截取区域设为缩略图',
```

- [ ] **Step 2: 在 `manifest.config.ts` 增加 `scripting` 权限**

```ts
  permissions: ['bookmarks', 'storage', 'favicon', 'contextMenus', 'activeTab', 'scripting'],
```

- [ ] **Step 3: 在 `tests/setup.ts` 增加 `scripting` mock 与全局 `ResizeObserver` stub**

在 `globalThis.File = ...` 行之后新增（供 `Tile` 用）：

```ts
// jsdom 无 ResizeObserver；提供最小 stub，回调不自动触发（组件初始渲染即用 cover 兜底）。
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
```

在 `chromeMock` 对象里 `windows: { create: vi.fn() },` 行后新增：

```ts
    scripting: { executeScript: vi.fn() },
```

- [ ] **Step 4: 验证类型与既有测试不回归**

Run: `npm run build`
Expected: 通过。

Run: `npx vitest run src/background/service-worker.test.ts src/lib/i18n.test.ts`
Expected: PASS（既有用例不受影响）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/i18n.ts manifest.config.ts tests/setup.ts
git commit -m "feat(thumbnail): 区域截图菜单文案/scripting 权限/测试桩"
```

---

### Task 5: 网页右键区域截图入口

**Files:**
- Modify: `src/background/service-worker.ts`
- Modify: `src/background/service-worker.test.ts`

- [ ] **Step 1: 写失败测试（追加到 `service-worker.test.ts` 的 `describe` 内）**

```ts
  it('registers the region capture menu', async () => {
    await boot();
    await vi.waitFor(() => expect(c.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'capture-region-thumbnail', contexts: ['all'] }),
      expect.any(Function),
    ));
  });

  it('captures a selected region and stores a normalized region for an exact bookmark', async () => {
    c.scripting.executeScript.mockResolvedValue([{ result: { x: 100, y: 80, w: 200, h: 160, viewW: 1000, viewH: 800 } }]);
    await boot();
    c.contextMenus.onClicked._emit({ menuItemId: 'capture-region-thumbnail' }, tab);

    await vi.waitFor(async () => {
      const rec = await getThumbnail('https://github.com');
      expect(rec?.dataUrl).toBe('data:image/jpeg;base64,current');
      expect(rec?.region).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
    });
  });

  it('stores nothing when region selection is cancelled', async () => {
    c.scripting.executeScript.mockResolvedValue([{ result: null }]);
    await boot();
    c.contextMenus.onClicked._emit({ menuItemId: 'capture-region-thumbnail' }, tab);

    await vi.waitFor(() => expect(c.tabs.captureVisibleTab).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(await getThumbnail('https://github.com')).toBeUndefined();
  });
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/background/service-worker.test.ts`
Expected: FAIL（region 菜单未注册 / `capture-region-thumbnail` 未处理）。

- [ ] **Step 3: 修改 `src/background/service-worker.ts`**

**(a) 顶部 import 追加：**

```ts
import { normalizeRect, isRegionTooSmall } from '@/lib/thumbFocus';
import { selectRegionOverlay, type OverlayResult } from './regionOverlay';
import type { NormalizedRegion } from '@/types';
```

**(b) 常量区新增 region 菜单 id（在 `CAPTURE_MENU_ID` 行后）：**

```ts
const REGION_MENU_ID = 'capture-region-thumbnail';
```

**(c) `storeCapture` 增加可选 `region` 参数：**

```ts
async function storeCapture(urls: string[], dataUrl: string, region?: NormalizedRegion): Promise<void> {
  const unique = [...new Set(urls)];
  const capturedAt = Date.now();
  await Promise.all(unique.map((url) => putThumbnail({ url, dataUrl, capturedAt, ...(region ? { region } : {}) })));
  await broadcastThumbnailUpdate(unique);
}
```

**(d) 用通用的 `ensureMenuItem` + `ensureMenus` 替换原 `ensureCaptureMenu`：**

```ts
async function ensureMenuItem(id: string, title: string): Promise<void> {
  const properties: Omit<chrome.contextMenus.CreateProperties, 'id'> = {
    title,
    contexts: ['all'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  };
  const exists = await new Promise<boolean>((resolve) => {
    chrome.contextMenus.update(id, properties, () => {
      const error = chrome.runtime.lastError;
      if (error) void error.message; // 读取 lastError 抑制未处理告警
      resolve(!error);
    });
  });
  if (exists) return;
  await new Promise<void>((resolve, reject) => {
    chrome.contextMenus.create({ id, ...properties }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

async function ensureMenus(): Promise<void> {
  const settings = await loadSettings();
  const lang = resolveLang(settings.language);
  await ensureMenuItem(CAPTURE_MENU_ID, t(lang, 'context.captureCurrent'));
  await ensureMenuItem(REGION_MENU_ID, t(lang, 'context.captureRegion'));
}
```

并把 `scheduleCaptureMenuRegistration` 内对 `ensureCaptureMenu` 的两处引用改为 `ensureMenus`：

```ts
function scheduleCaptureMenuRegistration(): void {
  menuRegistration = menuRegistration.then(ensureMenus, ensureMenus);
  void menuRegistration.catch((e) => console.warn('[RSD] context menu registration failed', e));
}
```

**(e) 用下面整段替换原 `chrome.contextMenus.onClicked.addListener(...)` 块**（抽出可复用的落库逻辑，新增区域流程）：

```ts
async function storeOrPickCapture(pageUrl: string, dataUrl: string, region?: NormalizedRegion): Promise<void> {
  const targets = await exactBookmarkUrls(pageUrl);
  if (targets.length > 0) {
    await storeCapture(targets, dataUrl, region);
    return;
  }
  const captureId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  await putPendingCapture(captureId, { sourceUrl: pageUrl, dataUrl, capturedAt: Date.now(), ...(region ? { region } : {}) });
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL(`src/options/index.html?thumbnailPicker=${encodeURIComponent(captureId)}`),
      type: 'popup',
      width: 680,
      height: 600,
    });
  } catch (e) {
    await deletePendingCapture(captureId);
    throw e;
  }
}

async function runRegionOverlay(tabId: number): Promise<NormalizedRegion | null> {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: selectRegionOverlay });
  const out = res?.result as OverlayResult | null | undefined;
  if (!out || isRegionTooSmall(out)) return null;
  return normalizeRect(out, out.viewW, out.viewH);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.active || !tab.url || tab.id === undefined) return;
  const { id: tabId, url: pageUrl, windowId } = tab;
  if (info.menuItemId === CAPTURE_MENU_ID) {
    void (async () => {
      try {
        const dataUrl = await captureVisibleData(windowId, tabId, pageUrl);
        await storeOrPickCapture(pageUrl, dataUrl);
      } catch (e) {
        console.warn('[RSD] current-page capture failed', e);
      }
    })();
    return;
  }
  if (info.menuItemId === REGION_MENU_ID) {
    void (async () => {
      try {
        // 先截干净的可见页，再注入遮罩取焦点区域（遮罩期间锁滚动，坐标与截图对齐）
        const dataUrl = await captureVisibleData(windowId, tabId, pageUrl);
        const region = await runRegionOverlay(tabId);
        if (!region) return; // 用户取消
        await storeOrPickCapture(pageUrl, dataUrl, region);
      } catch (e) {
        console.warn('[RSD] region capture failed', e);
      }
    })();
  }
});
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/background/service-worker.test.ts`
Expected: PASS（含既有用例与 3 个新用例）。

- [ ] **Step 5: 提交**

```bash
git add src/background/service-worker.ts src/background/service-worker.test.ts
git commit -m "feat(thumbnail): 网页右键区域截图入口"
```

---

### Task 6: 更新缩略图时沿用已存焦点区域

**Files:**
- Modify: `src/background/service-worker.ts`
- Modify: `src/background/service-worker.test.ts`

- [ ] **Step 1: 写失败测试（追加到 `service-worker.test.ts`）**

```ts
  it('reuses the stored region on automatic re-capture', async () => {
    await putThumbnail({ url: 'https://github.com', dataUrl: 'old', capturedAt: 1, region: { x: 0.2, y: 0.2, w: 0.3, h: 0.3 } });
    await boot();
    c.tabs.onActivated._emit({ tabId: tab.id, windowId: tab.windowId });

    await vi.waitFor(async () => {
      const rec = await getThumbnail('https://github.com');
      expect(rec?.dataUrl).toBe('data:image/jpeg;base64,current');
      expect(rec?.region).toEqual({ x: 0.2, y: 0.2, w: 0.3, h: 0.3 });
    });
  });
```

（`putThumbnail` 已在文件顶部从 `@/lib/thumbnails` 导入；若未导入则补 `import { putThumbnail } from '@/lib/thumbnails'` 到测试。）

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/background/service-worker.test.ts -t "reuses the stored region"`
Expected: FAIL（`region` 为 `undefined`，自动更新未沿用）。

- [ ] **Step 3: 让各更新入口沿用已存 region（`src/background/service-worker.ts`）**

**(a) `maybeAutoCapture` 尾部**：把 `existing` 里已存的 region 传入 `storeCapture`：

```ts
  const dataUrl = await captureVisibleData(tab.windowId, tab.id, tab.url);
  const reuseRegion = existing.find((record) => record?.region)?.region;
  await storeCapture(targets, dataUrl, reuseRegion);
```

**(b) `chrome.runtime.onMessage` 处理器**：`save-current-as` 与 `capture-url` 落库时带上该 URL 已存 region：

```ts
      if (msg.type === 'save-current-as') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab');
        const region = (await getThumbnail(msg.url))?.region;
        await storeCapture([msg.url], await captureVisibleData(tab.windowId, tab.id, tab.url), region);
      } else if (msg.type === 'capture-url') {
        const tab = await chrome.tabs.create({ url: msg.url, active: true });
        if (!tab.id) throw new Error('Could not create capture tab');
        try {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
            const listener = (id: number, i: { status?: string }) => {
              if (id === tab.id && i.status === 'complete') {
                clearTimeout(timer);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
          const loaded = await chrome.tabs.get(tab.id);
          const region = (await getThumbnail(msg.url))?.region;
          await storeCapture([msg.url], await captureVisibleData(loaded.windowId, tab.id, loaded.url), region);
        } finally {
          await chrome.tabs.remove(tab.id);
        }
      }
```

（`getThumbnail` 已在顶部从 `@/lib/thumbnails` 导入。）

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/background/service-worker.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/background/service-worker.ts src/background/service-worker.test.ts
git commit -m "feat(thumbnail): 更新缩略图时沿用已存焦点区域"
```

---

### Task 7: 缩略图选择器保存焦点区域

**Files:**
- Modify: `src/options/ThumbnailPicker.tsx`
- Modify: `src/options/ThumbnailPicker.test.tsx`

- [ ] **Step 1: 写失败测试（追加到 `ThumbnailPicker.test.tsx` 的 `describe` 内）**

```ts
  it('carries the pending region onto the saved thumbnail', async () => {
    await putPendingCapture('capture-2', { ...capture, region: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } });
    render(<ThumbnailPicker captureId="capture-2" />);
    await screen.findByText('选择缩略图对应的书签');
    await userEvent.click(screen.getByRole('button', { name: /Jira Board.*jira\.test/ }));
    await waitFor(async () => {
      expect((await getThumbnail('https://jira.test/board'))?.region).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
    });
  });
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/options/ThumbnailPicker.test.tsx -t "carries the pending region"`
Expected: FAIL（`region` 为 `undefined`）。

- [ ] **Step 3: `ThumbnailPicker.tsx` 的 `choose` 落库带上 `region`**

```ts
  const choose = async (hit: SearchHit) => {
    if (!capture || saving) return;
    setSaving(true);
    try {
      await putThumbnail({
        url: hit.url,
        dataUrl: capture.dataUrl,
        capturedAt: capture.capturedAt,
        ...(capture.region ? { region: capture.region } : {}),
      });
      await deletePendingCapture(captureId);
      try {
        await chrome.runtime.sendMessage({ type: 'thumbnail-updated', urls: [hit.url] });
      } catch { /* no open new-tab page */ }
      window.close();
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/options/ThumbnailPicker.test.tsx`
Expected: PASS（既有 2 个用例 + 新用例）。

- [ ] **Step 5: 提交**

```bash
git add src/options/ThumbnailPicker.tsx src/options/ThumbnailPicker.test.tsx
git commit -m "feat(thumbnail): 缩略图选择器保存焦点区域"
```

---

### Task 8: 磁贴按焦点区域放大显示

**Files:**
- Modify: `src/newtab/components/Tile.tsx`
- Modify: `src/newtab/styles.css`
- Modify: `src/newtab/components/Tile.test.tsx`

> `Tile` 先加**可选** `region` prop（此阶段 `Grid` 尚未传入，默认 `undefined` → 全图 cover，视觉等同现状）；Task 9 再接上数据流。`ResizeObserver` stub 已在 Task 4 提供，`new Image().onload` 在 jsdom 不触发，故测试中焦点样式保持初始 cover，仅断言渲染结构与 `background-image`。

- [ ] **Step 1: 更新 `Tile.test.tsx` 中三处依赖旧 `<img class="tile__screenshot">` 的用例**

将「renders the screenshot image when a thumbnail is provided」整段替换为：

```ts
  it('renders the screenshot as a background layer when a thumbnail is provided', () => {
    const { container } = render(
      <Tile id="b" title="GitHub" url="https://github.com" thumbnail="data:img" tileStyle="screenshot" onContextMenu={() => {}} />,
    );
    const shot = container.querySelector('.tile__screenshot') as HTMLElement;
    expect(shot).toBeInTheDocument();
    expect(shot.style.backgroundImage).toContain('data:img');
  });
```

将「renders a small favicon over the URL-derived gradient by default」用例内最后一行：

```ts
    expect(container.querySelector('img.tile__screenshot')).toBeNull();
```

改为：

```ts
    expect(container.querySelector('.tile__screenshot')).toBeNull();
```

将「does not show a stale thumbnail outside screenshot style」用例替换为：

```ts
  it('does not show a stale thumbnail outside screenshot style', () => {
    const { container } = render(<Tile id="b" title="GitHub" url="https://github.com" thumbnail="data:img" tileStyle="themeColor" onContextMenu={() => {}} />);
    expect(container.querySelector('.tile__screenshot')).toBeNull();
  });
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/newtab/components/Tile.test.tsx`
Expected: FAIL（当前仍渲染 `<img class="tile__screenshot">`，新断言查 `.tile__screenshot` 的 `backgroundImage` 不通过）。

- [ ] **Step 3: 重写 `src/newtab/components/Tile.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { faviconUrl, firstLetter, colorFromString, hueFromString } from '@/lib/favicon';
import { computeFocusBackground, FULL_REGION, type FocusBackground } from '@/lib/thumbFocus';
import type { NormalizedRegion, TileStyle } from '@/types';

interface Props {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  region?: NormalizedRegion;
  tileStyle?: TileStyle;
  openInNewTab?: boolean;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

const COVER: FocusBackground = { backgroundSize: 'cover', backgroundPositionX: 'center', backgroundPositionY: 'center' };

// 书签磁贴是真正的 <a>：浏览器原生在左下角显示网址，并支持中键/Cmd 点击、右键复制链接。
export function Tile({ id, title, url, thumbnail, region, tileStyle = 'themeColor', openInNewTab, onContextMenu }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const screenshot = tileStyle === 'screenshot' ? thumbnail : undefined;
  const themeMode = !screenshot;
  const shotRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<FocusBackground>(COVER);

  // 依据图片自然比例与磁贴当前比例计算焦点背景；磁贴比例随列数变化时经 ResizeObserver 重算。
  useEffect(() => {
    const el = shotRef.current;
    if (!screenshot || !el) return;
    let aspect = 0;
    const recompute = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!aspect || !cw || !ch) return;
      setFocus(computeFocusBackground(region ?? FULL_REGION, aspect, cw / ch));
    };
    const img = new Image();
    img.onload = () => { aspect = img.naturalWidth / img.naturalHeight; recompute(); };
    img.src = screenshot;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [screenshot, region?.x, region?.y, region?.w, region?.h]);

  return (
    <a
      className={`tile${screenshot ? ' tile--shot' : ''}${themeMode ? ' tile--theme' : ''}`}
      href={url}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      draggable={false}
      style={themeMode ? ({ ['--tile-hue']: hueFromString(url) } as React.CSSProperties) : undefined}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      {screenshot && (
        <div
          ref={shotRef}
          className="tile__screenshot"
          style={{
            backgroundImage: `url(${screenshot})`,
            backgroundSize: focus.backgroundSize,
            backgroundPositionX: focus.backgroundPositionX,
            backgroundPositionY: focus.backgroundPositionY,
          }}
        />
      )}
      <span className="tile__fav">
        {imgOk ? (
          <img src={faviconUrl(url, 32)} alt="" draggable={false} onError={() => setImgOk(false)} />
        ) : (
          <span className="tile__fav-letter" style={{ background: colorFromString(url) }}>{firstLetter(url)}</span>
        )}
      </span>
      <span className="tile__title">{title}</span>
    </a>
  );
}
```

- [ ] **Step 4: 更新 `src/newtab/styles.css` 的 `.tile__screenshot`**

将：

```css
.tile__screenshot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
```

替换为：

```css
.tile__screenshot { position: absolute; inset: 0; z-index: 0; background-repeat: no-repeat; }
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run src/newtab/components/Tile.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/newtab/components/Tile.tsx src/newtab/styles.css src/newtab/components/Tile.test.tsx
git commit -m "feat(tile): 磁贴按焦点区域放大显示截图"
```

---

### Task 9: 缩略图数据流透传焦点区域

**Files:**
- Modify: `src/newtab/hooks/useThumbnails.ts`
- Modify: `src/newtab/hooks/useThumbnails.test.ts`
- Modify: `src/newtab/components/Grid.tsx`

> `App.tsx` 无需改动：`useThumbnails` 返回类型变化后，`thumbnails` 变量类型自动更新并原样传给 `Grid`，仅需编译验证。`Grid.test.tsx` 用 `thumbnails={{}}`（空对象），与新类型兼容，无需改。

- [ ] **Step 1: 改 `useThumbnails.test.ts` 断言为读取整条记录**

将两处断言改为读 `.dataUrl`：

```ts
  it('loads thumbnails for given urls when style is screenshot', async () => {
    await putThumbnail({ url: 'https://a.com', dataUrl: 'data:img', capturedAt: 1 });
    const { result } = renderHook(() => useThumbnails(['https://a.com'], 'screenshot'));
    await waitFor(() => expect(result.current['https://a.com']?.dataUrl).toBe('data:img'));
  });
```

以及广播更新用例的最后一行：

```ts
    await waitFor(() => expect(result.current[url]?.dataUrl).toBe('data:new'));
```

（「returns empty map when style is not screenshot」用例断言 `toEqual({})` 保持不变。）

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/newtab/hooks/useThumbnails.test.ts`
Expected: FAIL（`result.current['https://a.com']` 当前是字符串，无 `.dataUrl`）。

- [ ] **Step 3: 改 `useThumbnails.ts` 返回整条 `ThumbnailRecord`**

```ts
import { useEffect, useState } from 'react';
import { getThumbnail } from '@/lib/thumbnails';
import type { ThumbnailRecord, TileStyle } from '@/types';
import type { RsdMessage } from '@/lib/messages';

// 仅在「网页截图」样式下从 IndexedDB 读取缩略图记录（含焦点区域）；其他样式返回空表。
export function useThumbnails(urls: string[], style: TileStyle, refreshKey = 0): Record<string, ThumbnailRecord> {
  const [map, setMap] = useState<Record<string, ThumbnailRecord>>({});
  const [backgroundRevision, setBackgroundRevision] = useState(0);
  const key = urls.join('|');

  useEffect(() => {
    const listener = (message: RsdMessage) => {
      if (message.type === 'thumbnail-updated' && message.urls.some((url) => urls.includes(url))) {
        setBackgroundRevision((revision) => revision + 1);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (style !== 'screenshot') { setMap({}); return; }
    let cancelled = false;
    void (async () => {
      const next: Record<string, ThumbnailRecord> = {};
      for (const u of urls) {
        const rec = await getThumbnail(u);
        if (rec) next[u] = rec;
      }
      if (!cancelled) setMap(next);
    })();
    return () => { cancelled = true; };
  }, [key, style, refreshKey, backgroundRevision]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}
```

- [ ] **Step 4: 改 `Grid.tsx` 的 prop 类型并透传 `dataUrl` / `region`**

`import` 增加 `ThumbnailRecord`：

```ts
import type { SpeedDialItem, TileStyle, ThumbnailRecord } from '@/types';
```

`Props` 中：

```ts
  thumbnails: Record<string, ThumbnailRecord>;
```

`map` 内的 `<Tile ...>` 改为：

```tsx
              {it.kind === 'bookmark' ? (
                <Tile id={it.id} title={it.title} url={it.url} thumbnail={thumbnails[it.url]?.dataUrl} region={thumbnails[it.url]?.region} tileStyle={tileStyle} openInNewTab={openInNewTab} onContextMenu={onContextMenu} />
              ) : (
                <FolderTile id={it.id} title={it.title} preview={it.childrenPreview} onEnter={onEnter} onContextMenu={onContextMenu} />
              )}
```

- [ ] **Step 5: 运行确认通过 + 编译**

Run: `npx vitest run src/newtab/hooks/useThumbnails.test.ts src/newtab/components/Grid.test.tsx src/newtab/App.test.tsx`
Expected: PASS。

Run: `npm run build`
Expected: 通过（`App.tsx` 类型透传无误）。

- [ ] **Step 6: 提交**

```bash
git add src/newtab/hooks/useThumbnails.ts src/newtab/hooks/useThumbnails.test.ts src/newtab/components/Grid.tsx
git commit -m "feat(thumbnail): 缩略图数据流透传焦点区域"
```

---

### Task 10: 文档与全量验证

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: 在 `README.md`（英文）补充**

- 功能段增加一条：`Right-click any page and choose "Capture a region as thumbnail" to draw and fine-tune a region (drag corners/edges, move, Enter to confirm) that the tile magnifies.`
- 权限说明段增加：`scripting` — inject the region-selection overlay into the current tab on demand (paired with `activeTab`; no host permission prompt).

- [ ] **Step 2: 在 `README.zh-CN.md`（中文）补充**

- 功能段增加一条：`在任意网页右键选择「截取区域设为缩略图」，拖拽框选并可拖角/拖边微调、拖动移动、回车确认，磁贴会放大显示该区域。`
- 权限说明段增加：`scripting` —— 按需向当前标签注入区域框选遮罩（配合 `activeTab`，不触发主机权限弹窗）。

- [ ] **Step 3: 全量测试**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 4: 构建**

Run: `npm run build`
Expected: 通过。

- [ ] **Step 5: 仅检查本计划改动文件的诊断（linter/TS）**，修复本次引入的问题。

- [ ] **Step 6: 手动验证（Chrome 加载 `dist/`）**

- [ ] 在某网页右键 →「截取区域设为缩略图」→ 出现半透明遮罩，拖拽画框。
- [ ] 拖角 / 拖边调整尺寸、拖动选框移动；`Enter`/✓ 确认、`Esc`/✕ 取消；过小选框视为取消。
- [ ] 该页是精确书签 → 磁贴立即显示放大后的焦点；非书签 URL → 弹出选择器选书签后生效。
- [ ] 改变设置里的「列数」→ 磁贴比例变化时焦点主体仍完整展示。
- [ ] 磁贴右键「刷新缩略图」/ 等待过期自动更新 → 焦点区域被沿用。
- [ ] 旧缩略图（无 region）→ 仍为整页 cover，无留白、无回归。

- [ ] **Step 7: 提交**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: 区域截图缩略图使用说明与权限"
```

---

## Spec 覆盖对照

| Spec 章节 / 需求 | 对应 Task |
|---|---|
| §1 数据模型 `NormalizedRegion` / `region` | Task 1 |
| §3 焦点显示算法（含全图 cover、子区域放大、越界兜底） | Task 2（算法）+ Task 8（Tile 接线） |
| §2.2 选区遮罩（框选/8 手柄/移动/确认取消/锁滚动/归一化） | Task 3（遮罩）+ Task 2（归一化） |
| §5 权限 `scripting` + `activeTab` | Task 4 |
| 目标 1 网页右键新增独立菜单项 | Task 4（文案）+ Task 5（注册与流程） |
| §2.1 区域截图流程（先截后框、精确匹配/pending） | Task 5 |
| §4 更新逻辑统一（沿用已存 region） | Task 5（storeCapture 参数）+ Task 6（各入口沿用） |
| §2.1 pending → 选择器携带 region | Task 5（pending 带 region）+ Task 7（落库带 region） |
| 目标 3 磁贴按焦点显示、随列数自适应 | Task 8 + Task 9（数据流） |
| §6 向后兼容（无 region 记录不回归） | Task 2/8（cover 分支）+ Task 9（可选透传） |
| 文档与权限说明 | Task 10 |

## 完成标准（Definition of Done）

- `npm test` 全绿，`npm run build` 通过。
- 网页右键区域截图可框选并微调，磁贴放大显示焦点主体，列数变化自适应。
- 整页截图与旧数据保持 cover，无留白、无行为回归。
- 手动/过期更新沿用已存焦点区域。
