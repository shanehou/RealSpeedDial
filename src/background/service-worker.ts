import { loadSettings } from '@/lib/settings';
import { getThumbnail, putThumbnail } from '@/lib/thumbnails';
import { shouldCapture } from '@/lib/capturePolicy';
import type { RsdMessage, RsdResponse } from '@/lib/messages';

const MIN_INTERVAL_MS = 1100; // captureVisibleTab 频率限制约 1/s
let lastCaptureAt = 0;

async function hasCapturePermission(): Promise<boolean> {
  return chrome.permissions.contains({ permissions: ['tabs'], origins: ['<all_urls>'] });
}

async function captureAndStore(url: string, windowId?: number): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCaptureAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCaptureAt = Date.now();
  const dataUrl = windowId === undefined
    ? await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 70 })
    : await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 70 });
  if (dataUrl) await putThumbnail({ url, dataUrl, capturedAt: Date.now() });
}

// 自动抓取：页面加载完成且为当前活动页时，按策略抓一张（需已授予截图权限 + 截图样式）
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  void (async () => {
    if (info.status !== 'complete' || !tab.active || !tab.url) return;
    if (!/^https?:/.test(tab.url)) return;
    if (!(await hasCapturePermission())) return;
    const settings = await loadSettings();
    if (settings.tileStyle !== 'screenshot') return;
    const existing = await getThumbnail(tab.url);
    if (!shouldCapture(settings.thumbnailPolicy, existing?.capturedAt, settings.thumbnailStaleDays, Date.now())) return;
    try { await captureAndStore(tab.url, tab.windowId); } catch (e) { console.warn('[RSD] capture failed', e); }
  })();
});

// 手动抓取：接受来自新标签页/设置页的消息
chrome.runtime.onMessage.addListener((msg: RsdMessage, _sender, sendResponse: (r: RsdResponse) => void) => {
  void (async () => {
    try {
      if (msg.type === 'save-current-as') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await captureAndStore(msg.url, tab?.windowId);
      } else if (msg.type === 'capture-url') {
        const tab = await chrome.tabs.create({ url: msg.url, active: true });
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
        await captureAndStore(msg.url, tab.windowId);
        if (tab.id) await chrome.tabs.remove(tab.id);
      }
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  })();
  return true; // 异步响应
});

console.info('[RSD] service worker ready');
