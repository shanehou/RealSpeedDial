import { getAsset, putAsset } from './thumbnails';
import { WALLPAPER_AUTO_KEY, WALLPAPER_META_KEY, UNSPLASH_KEY } from './constants';
import type { WallpaperSource, WallpaperAttribution } from '@/types';

const UTM = '?utm_source=real_speed_dial&utm_medium=referral';

export function todayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function screenPx(): { w: number; h: number } {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
  const cap = (n: number) => Math.min(Math.round(n), 3840);
  return {
    w: cap((globalThis.screen?.width ?? 1920) * dpr),
    h: cap((globalThis.screen?.height ?? 1080) * dpr),
  };
}

export async function getUnsplashKey(): Promise<string | undefined> {
  const got = await chrome.storage.local.get(UNSPLASH_KEY);
  return (got[UNSPLASH_KEY] as string) || undefined;
}
export async function setUnsplashKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [UNSPLASH_KEY]: key });
}

interface Meta { source: WallpaperSource; date: string; salt: string; attribution?: WallpaperAttribution; }
interface Resolved { imageUrl: string; attribution?: WallpaperAttribution; downloadLocation?: string; }

async function loadMeta(): Promise<Meta | null> {
  const got = await chrome.storage.local.get(WALLPAPER_META_KEY);
  return (got[WALLPAPER_META_KEY] as Meta) ?? null;
}

export async function resolveBing(): Promise<Resolved> {
  const res = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1');
  const data = (await res.json()) as { images: { urlbase: string }[] };
  const base = data.images?.[0]?.urlbase ?? '';
  return { imageUrl: `https://www.bing.com${base}_UHD.jpg` };
}

export function resolvePicsum(salt: string): Resolved {
  const { w, h } = screenPx();
  return { imageUrl: `https://picsum.photos/seed/${encodeURIComponent(salt)}/${w}/${h}` };
}

export async function resolveUnsplash(key: string): Promise<Resolved> {
  const { w, h } = screenPx();
  const res = await fetch(`https://api.unsplash.com/photos/random?orientation=landscape&client_id=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`unsplash ${res.status}`);
  const p = (await res.json()) as {
    urls: { raw: string };
    links: { download_location: string };
    user: { name: string; links: { html: string } };
  };
  return {
    imageUrl: `${p.urls.raw}&w=${w}&h=${h}&fit=crop&dpr=1&q=80`,
    downloadLocation: p.links.download_location,
    attribution: {
      photographer: p.user.name,
      photographerUrl: `${p.user.links.html}${UTM}`,
      unsplashUrl: `https://unsplash.com/${UTM}`,
    },
  };
}

async function triggerUnsplashDownload(downloadLocation: string, key: string): Promise<void> {
  const sep = downloadLocation.includes('?') ? '&' : '?';
  try { await fetch(`${downloadLocation}${sep}client_id=${encodeURIComponent(key)}`); } catch { /* 合规上报失败不影响展示 */ }
}

async function resolveFor(source: WallpaperSource, salt: string): Promise<Resolved> {
  if (source === 'bing') return resolveBing();
  if (source === 'picsum') return resolvePicsum(salt);
  const key = await getUnsplashKey();
  if (!key) throw new Error('missing unsplash key');
  return resolveUnsplash(key);
}

// 取当日壁纸 blob；命中缓存直接用（force 强制换一张）；网络失败回退到上次缓存，绝不白屏。
export async function getDailyWallpaper(
  source: WallpaperSource,
  opts?: { force?: boolean },
): Promise<{ blob: Blob; attribution?: WallpaperAttribution } | null> {
  const meta = await loadMeta();
  const today = todayKey();
  const cached = await getAsset(WALLPAPER_AUTO_KEY);
  if (!opts?.force && cached && meta && meta.source === source && meta.date === today) {
    return { blob: cached, attribution: meta.attribution };
  }
  try {
    const salt = opts?.force ? `${today}-${Date.now()}` : today;
    const resolved = await resolveFor(source, salt);
    const imgRes = await fetch(resolved.imageUrl);
    if (!imgRes.ok) throw new Error(`image ${imgRes.status}`);
    const blob = await imgRes.blob();
    await putAsset(WALLPAPER_AUTO_KEY, blob);
    const nextMeta: Meta = { source, date: today, salt, attribution: resolved.attribution };
    await chrome.storage.local.set({ [WALLPAPER_META_KEY]: nextMeta });
    if (source === 'unsplash' && resolved.downloadLocation) {
      const key = await getUnsplashKey();
      if (key) void triggerUnsplashDownload(resolved.downloadLocation, key);
    }
    return { blob, attribution: resolved.attribution };
  } catch {
    if (cached) return { blob: cached, attribution: meta?.attribution };
    return null;
  }
}
