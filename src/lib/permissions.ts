import type { WallpaperSource } from '@/types';

const CAPTURE_PERMS: chrome.permissions.Permissions = { permissions: ['tabs'], origins: ['<all_urls>'] };

// 网页截图所需的 tabs + <all_urls> 属敏感权限，仅在用户开启截图/手动抓取时按需申请
// （必须在用户手势中调用）。已授予则直接返回 true。
export async function ensureCapturePermission(): Promise<boolean> {
  if (await chrome.permissions.contains(CAPTURE_PERMS)) return true;
  return chrome.permissions.request(CAPTURE_PERMS);
}

const WALLPAPER_ORIGINS: Record<WallpaperSource, string[]> = {
  bing: ['https://www.bing.com/*'],
  picsum: ['https://picsum.photos/*', 'https://*.picsum.photos/*'],
  unsplash: ['https://api.unsplash.com/*', 'https://images.unsplash.com/*'],
};

// 仅在用户开启自动壁纸/切换来源时按需申请对应主机权限（须在用户手势中调用）。
export async function ensureWallpaperPermission(source: WallpaperSource): Promise<boolean> {
  const origins = WALLPAPER_ORIGINS[source];
  if (await chrome.permissions.contains({ origins })) return true;
  return chrome.permissions.request({ origins });
}
