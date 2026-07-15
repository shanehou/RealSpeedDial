export interface OverlayResult {
  x: number;
  y: number;
  w: number;
  h: number;
  viewW: number;
  viewH: number;
}

// 注意：本函数经 func.toString() 序列化后注入页面执行，函数体内禁止引用任何模块作用域符号/import；改动构建 target 前需评估序列化安全性。
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
      if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
      if (e.key === 'Enter') { e.preventDefault(); finish(true); return; }
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
      if (scrollKeys.includes(e.key)) e.preventDefault();
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
