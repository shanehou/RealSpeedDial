import { loadSettings } from '@/lib/settings';
import { getTree } from '@/lib/bookmarks';
import { deletePendingCapture, getThumbnail, putThumbnail, putPendingCapture } from '@/lib/thumbnails';
import { shouldCapture } from '@/lib/capturePolicy';
import { findExactBookmarkUrls, normalizePageUrl } from '@/lib/search';
import type { RsdMessage, RsdResponse } from '@/lib/messages';
import { resolveLang, t } from '@/lib/i18n';
import { normalizeRect, isRegionTooSmall } from '@/lib/thumbFocus';
import { selectRegionOverlay } from './regionOverlay';
import type { NormalizedRegion } from '@/types';
import { createCaptureQueue } from './captureQueue';

const MIN_INTERVAL_MS = 1100; // captureVisibleTab 频率限制约 1/s
const CAPTURE_MENU_ID = 'save-current-page-thumbnail';
const REGION_MENU_ID = 'capture-region-thumbnail';
const captureQueue = createCaptureQueue(MIN_INTERVAL_MS);

async function hasCapturePermission(): Promise<boolean> {
  return chrome.permissions.contains({ permissions: ['tabs'], origins: ['<all_urls>'] });
}

async function validateActiveTab(windowId: number | undefined, expectedTabId: number, expectedUrl?: string): Promise<void> {
  const [active] = await chrome.tabs.query({ active: true, ...(windowId === undefined ? { currentWindow: true } : { windowId }) });
  if (active?.id !== expectedTabId) throw new Error('Active tab changed before capture');
  if (expectedUrl) {
    const expected = normalizePageUrl(expectedUrl);
    const actual = active.url ? normalizePageUrl(active.url) : null;
    if (!expected || actual !== expected || active.status !== 'complete') {
      throw new Error('Active page changed before capture completed');
    }
  }
}

async function captureVisibleData(windowId: number | undefined, expectedTabId: number, expectedUrl?: string): Promise<string> {
  return captureQueue.run(async () => {
    await validateActiveTab(windowId, expectedTabId, expectedUrl);
    const dataUrl = windowId === undefined
      ? await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 70 })
      : await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 70 });
    await validateActiveTab(windowId, expectedTabId, expectedUrl);
    return dataUrl;
  });
}

async function broadcastThumbnailUpdate(urls: string[]): Promise<void> {
  try { await chrome.runtime.sendMessage({ type: 'thumbnail-updated', urls } satisfies RsdMessage); } catch { /* no open extension page */ }
}

async function storeCapture(urls: string[], dataUrl: string, region?: NormalizedRegion): Promise<void> {
  const unique = [...new Set(urls)];
  const capturedAt = Date.now();
  await Promise.all(unique.map((url) => putThumbnail({ url, dataUrl, capturedAt, ...(region ? { region } : {}) })));
  await broadcastThumbnailUpdate(unique);
}

async function exactBookmarkUrls(pageUrl: string): Promise<string[]> {
  const tree = await getTree();
  return tree[0] ? findExactBookmarkUrls(tree[0], pageUrl) : [];
}

async function maybeAutoCapture(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.active || tab.status !== 'complete' || !tab.url || tab.id === undefined) return;
  if (!/^https?:/.test(tab.url) || !(await hasCapturePermission())) return;
  const settings = await loadSettings();
  if (settings.tileStyle !== 'screenshot') return;
  const targets = await exactBookmarkUrls(tab.url);
  if (targets.length === 0) return;
  const now = Date.now();
  const existing = await Promise.all(targets.map(getThumbnail));
  if (!existing.some((record) => shouldCapture(settings.thumbnailPolicy, record?.capturedAt, settings.thumbnailStaleDays, now))) return;
  const dataUrl = await captureVisibleData(tab.windowId, tab.id, tab.url);
  // 多个精确匹配书签共享同一张截图；沿用首个已存焦点区域即可（可接受近似）
  const reuseRegion = existing.find((record) => record?.region)?.region;
  await storeCapture(targets, dataUrl, reuseRegion);
}

// 自动抓取：既覆盖新加载完成的活动页，也覆盖用户切回的已加载书签页。
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status !== 'complete') return;
  void maybeAutoCapture({ ...tab, status: 'complete' }).catch((e) => console.warn('[RSD] auto capture failed', e));
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs.get(tabId)
    .then(maybeAutoCapture)
    .catch((e) => console.warn('[RSD] activated capture failed', e));
});

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

let menuRegistration = Promise.resolve();
function scheduleCaptureMenuRegistration(): void {
  menuRegistration = menuRegistration.then(ensureMenus, ensureMenus);
  void menuRegistration.catch((e) => console.warn('[RSD] context menu registration failed', e));
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleCaptureMenuRegistration();
});
// Self-heal a missing menu when the service worker starts (e.g. enable/reload edge cases).
scheduleCaptureMenuRegistration();

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
  const out = res?.result;
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

// 手动抓取：接受来自新标签页/设置页的消息
chrome.runtime.onMessage.addListener((msg: RsdMessage, _sender, sendResponse: (r: RsdResponse) => void) => {
  if (msg.type !== 'save-current-as' && msg.type !== 'capture-url') return false;
  void (async () => {
    try {
      if (msg.type === 'save-current-as') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab');
        const reuseRegion = (await getThumbnail(msg.url))?.region;
        await storeCapture([msg.url], await captureVisibleData(tab.windowId, tab.id, tab.url), reuseRegion);
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
          const reuseRegion = (await getThumbnail(msg.url))?.region;
          await storeCapture([msg.url], await captureVisibleData(loaded.windowId, tab.id, loaded.url), reuseRegion);
        } finally {
          await chrome.tabs.remove(tab.id);
        }
      }
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  })();
  return true; // 异步响应
});

// 点击工具栏图标打开设置页；右键图标时 Chrome 会自动附带「选项」入口（因已声明 options_page）
chrome.action.onClicked.addListener(() => { void chrome.runtime.openOptionsPage(); });

console.info('[RSD] service worker ready');
