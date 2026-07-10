import { describe, it, expect } from 'vitest';
import { createDragClickGuard } from './dragClickGuard';

describe('dragClickGuard', () => {
  it('swallows exactly one click after being armed, then disarms', () => {
    const g = createDragClickGuard();
    const uninstall = g.install(document);
    g.arm();

    const first = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    expect(g.isArmed()).toBe(false);

    // 下一次点击是正常点击，不应被吞
    const second = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);

    uninstall();
  });

  it('does not affect clicks when not armed', () => {
    const g = createDragClickGuard();
    const uninstall = g.install(document);

    const e = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);

    uninstall();
  });

  it('disarm() cancels a pending guard (drag produced no click)', () => {
    const g = createDragClickGuard();
    const uninstall = g.install(document);
    g.arm();
    g.disarm();

    const e = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);

    uninstall();
  });

  it('stops listening after uninstall', () => {
    const g = createDragClickGuard();
    const uninstall = g.install(document);
    uninstall();
    g.arm();

    const e = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});
