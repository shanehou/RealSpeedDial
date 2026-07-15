import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import { SETTINGS_KEY } from '@/lib/constants';
import { getPendingCapture, getThumbnail, putThumbnail } from '@/lib/thumbnails';

const MENU_ID = 'save-current-page-thumbnail';

let c: ChromeMock;
const root = {
  id: '0',
  title: '',
  children: [
    { id: 'folder', title: 'Work', children: [
      { id: 'bookmark', title: 'GitHub', url: 'https://github.com' },
    ] },
  ],
};
const tab = { id: 7, active: true, status: 'complete', url: 'https://github.com/', windowId: 2 };

async function boot() {
  await import('./service-worker');
}

beforeEach(async () => {
  vi.resetModules();
  indexedDB = new IDBFactory();
  c = installChromeMock();
  c.bookmarks.getTree.mockResolvedValue([root]);
  c.permissions.contains.mockResolvedValue(true);
  c.tabs.captureVisibleTab.mockResolvedValue('data:image/jpeg;base64,current');
  c.tabs.query.mockResolvedValue([tab]);
  c.tabs.get.mockResolvedValue(tab);
  c.contextMenus.update.mockImplementation((...args: unknown[]) => {
    c.runtime.lastError = { message: 'Cannot find menu item' };
    (args[2] as (() => void) | undefined)?.();
    c.runtime.lastError = undefined;
  });
  c.contextMenus.create.mockImplementation((...args: unknown[]) => {
    (args[1] as (() => void) | undefined)?.();
    return MENU_ID;
  });
  await c.storage.sync.set({ [SETTINGS_KEY]: { tileStyle: 'screenshot' } });
});

describe('service worker thumbnail capture', () => {
  it('registers the native current-page thumbnail menu', async () => {
    await boot();

    await vi.waitFor(() => expect(c.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({
      id: MENU_ID,
      contexts: ['all'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    }), expect.any(Function)));
  });

  it('captures and stores directly when the current URL exactly matches a bookmark', async () => {
    await boot();
    c.contextMenus.onClicked._emit({ menuItemId: MENU_ID }, tab);

    await vi.waitFor(async () => {
      expect((await getThumbnail('https://github.com'))?.dataUrl).toBe('data:image/jpeg;base64,current');
    });
    expect(c.windows.create).not.toHaveBeenCalled();
    expect(c.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'thumbnail-updated',
      urls: ['https://github.com'],
    });
  });

  it('opens the searchable picker and keeps a pending capture when no exact bookmark matches', async () => {
    const unmatched = { ...tab, url: 'https://example.com/dashboard' };
    c.tabs.query.mockResolvedValue([unmatched]);
    await boot();
    c.contextMenus.onClicked._emit({ menuItemId: MENU_ID }, unmatched);

    await vi.waitFor(() => expect(c.windows.create).toHaveBeenCalled());
    const createArg = c.windows.create.mock.calls[0][0] as { url: string };
    const captureId = new URL(createArg.url).searchParams.get('thumbnailPicker');
    expect(captureId).toBeTruthy();
    expect(await getPendingCapture(captureId!)).toEqual(expect.objectContaining({
      sourceUrl: unmatched.url,
      dataUrl: 'data:image/jpeg;base64,current',
    }));
  });

  it('captures an already-loaded bookmark when its tab becomes active', async () => {
    await boot();
    c.tabs.onActivated._emit({ tabId: tab.id, windowId: tab.windowId });

    await vi.waitFor(async () => {
      expect((await getThumbnail('https://github.com'))?.dataUrl).toBe('data:image/jpeg;base64,current');
    });
    expect(c.tabs.get).toHaveBeenCalledWith(tab.id);
  });

  it('discards a capture when the same tab navigates before capture completes', async () => {
    c.tabs.query
      .mockResolvedValueOnce([tab])
      .mockResolvedValueOnce([{ ...tab, url: 'https://example.com/other' }]);
    await boot();
    c.contextMenus.onClicked._emit({ menuItemId: MENU_ID }, tab);

    await vi.waitFor(() => expect(c.tabs.captureVisibleTab).toHaveBeenCalled());
    await vi.waitFor(() => expect(c.tabs.query).toHaveBeenCalledTimes(2));
    expect(await getThumbnail('https://github.com')).toBeUndefined();
    expect(c.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('cleans the pending capture if the picker window cannot be opened', async () => {
    const unmatched = { ...tab, url: 'https://example.com/dashboard' };
    c.tabs.query.mockResolvedValue([unmatched]);
    c.windows.create.mockRejectedValue(new Error('window failed'));
    await boot();
    c.contextMenus.onClicked._emit({ menuItemId: MENU_ID }, unmatched);

    await vi.waitFor(() => expect(c.windows.create).toHaveBeenCalled());
    const createArg = c.windows.create.mock.calls[0][0] as { url: string };
    const captureId = new URL(createArg.url).searchParams.get('thumbnailPicker')!;
    await vi.waitFor(async () => expect(await getPendingCapture(captureId)).toBeUndefined());
  });

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

  it('keeps a pending region capture when no exact bookmark matches', async () => {
    const unmatched = { ...tab, url: 'https://example.com/dashboard' };
    c.tabs.query.mockResolvedValue([unmatched]); // 让 captureVisibleData 的 validateActiveTab 通过
    c.scripting.executeScript.mockResolvedValue([{ result: { x: 100, y: 80, w: 200, h: 160, viewW: 1000, viewH: 800 } }]);
    await boot();
    c.contextMenus.onClicked._emit({ menuItemId: 'capture-region-thumbnail' }, unmatched);

    await vi.waitFor(() => expect(c.windows.create).toHaveBeenCalled());
    const createArg = c.windows.create.mock.calls[0][0] as { url: string };
    const captureId = new URL(createArg.url).searchParams.get('thumbnailPicker')!;
    expect(await getPendingCapture(captureId)).toEqual(expect.objectContaining({
      sourceUrl: unmatched.url,
      dataUrl: 'data:image/jpeg;base64,current',
      region: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    }));
  });

  it('stores nothing when region selection is cancelled', async () => {
    c.scripting.executeScript.mockResolvedValue([{ result: null }]);
    await boot();
    c.contextMenus.onClicked._emit({ menuItemId: 'capture-region-thumbnail' }, tab);

    await vi.waitFor(() => expect(c.tabs.captureVisibleTab).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(await getThumbnail('https://github.com')).toBeUndefined();
    expect(c.scripting.executeScript).toHaveBeenCalled();
    expect(c.windows.create).not.toHaveBeenCalled();
  });

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
});
