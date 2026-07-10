import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { installChromeMock } from '../../tests/setup';
import { todayKey, screenPx, resolvePicsum, resolveUnsplash, getDailyWallpaper, setUnsplashKey } from './wallpaper';

beforeEach(() => { installChromeMock(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('wallpaper helpers', () => {
  it('todayKey formats YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 6, 9))).toBe('2026-07-09');
  });
  it('screenPx applies dpr and caps at 3840', () => {
    vi.stubGlobal('screen', { width: 2000, height: 1000 });
    vi.stubGlobal('devicePixelRatio', 2);
    expect(screenPx()).toEqual({ w: 3840, h: 2000 });
  });
  it('resolvePicsum builds a seeded sized url', () => {
    vi.stubGlobal('screen', { width: 1000, height: 800 });
    vi.stubGlobal('devicePixelRatio', 1);
    expect(resolvePicsum('2026-07-09').imageUrl).toBe('https://picsum.photos/seed/2026-07-09/1000/800');
  });
});

describe('resolveUnsplash', () => {
  it('uses raw url + sizing params + attribution + download location', async () => {
    vi.stubGlobal('screen', { width: 1000, height: 800 });
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        urls: { raw: 'https://images.unsplash.com/photo-1' },
        links: { download_location: 'https://api.unsplash.com/photos/x/download' },
        user: { name: 'Ansel', links: { html: 'https://unsplash.com/@ansel' } },
      }),
    })));
    const r = await resolveUnsplash('KEY');
    expect(r.imageUrl).toContain('https://images.unsplash.com/photo-1');
    expect(r.imageUrl).toContain('w=1000');
    expect(r.imageUrl).toContain('h=800');
    expect(r.imageUrl).toContain('fit=crop');
    expect(r.attribution?.photographer).toBe('Ansel');
    expect(r.attribution?.photographerUrl).toContain('utm_source=real_speed_dial');
    expect(r.downloadLocation).toContain('/download');
  });
});

describe('getDailyWallpaper', () => {
  it('fetches + caches + triggers unsplash download, then serves cache', async () => {
    await setUnsplashKey('KEY');
    vi.stubGlobal('screen', { width: 100, height: 100 });
    vi.stubGlobal('devicePixelRatio', 1);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        urls: { raw: 'https://images.unsplash.com/p' },
        links: { download_location: 'https://api.unsplash.com/photos/x/download' },
        user: { name: 'Ansel', links: { html: 'https://unsplash.com/@ansel' } },
      }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['img'], { type: 'image/jpeg' }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getDailyWallpaper('unsplash');
    expect(first?.blob).toBeInstanceOf(Blob);
    expect(first?.attribution?.photographer).toBe('Ansel');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const second = await getDailyWallpaper('unsplash');
    expect(second?.blob).toBeInstanceOf(Blob);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 命中缓存，无新请求
  });

  it('falls back to cached blob when the network fails', async () => {
    vi.stubGlobal('screen', { width: 100, height: 100 });
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: [{ urlbase: '/th?id=OHR.Test' }] }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['bing'], { type: 'image/jpeg' }) }));
    await getDailyWallpaper('bing');

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const r = await getDailyWallpaper('bing', { force: true });
    expect(r?.blob).toBeInstanceOf(Blob);
  });
});
