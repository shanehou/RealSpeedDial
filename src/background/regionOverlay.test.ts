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
