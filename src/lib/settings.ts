import { SETTINGS_KEY } from './constants';
import { DEFAULT_SETTINGS, DEFAULT_BG_LIGHT, DEFAULT_BG_DARK, type Settings } from '@/types';

// 旧版本纯色背景为单值 { type:'color', value }；迁移为 { type:'color', light, dark } 双套。
function normalize(s: Settings): Settings {
  const bg = s.background as { type: string; value?: string; light?: string; dark?: string };
  const tileStyle = (s as Settings & { tileStyle?: string }).tileStyle === 'screenshot' ? 'screenshot' : 'themeColor';
  if (bg.type === 'color' && (typeof bg.light !== 'string' || typeof bg.dark !== 'string')) {
    const legacy = typeof bg.value === 'string' ? bg.value : undefined;
    return { ...s, tileStyle, background: { type: 'color', light: bg.light ?? legacy ?? DEFAULT_BG_LIGHT, dark: bg.dark ?? legacy ?? DEFAULT_BG_DARK } };
  }
  return { ...s, tileStyle };
}

type StoredSettings = Partial<Settings> & { searchEngine?: unknown };

export async function loadSettings(): Promise<Settings> {
  const got = await chrome.storage.sync.get(SETTINGS_KEY);
  const stored = { ...((got[SETTINGS_KEY] as StoredSettings) ?? {}) };
  // 旧版本曾保存自定义搜索 URL；现已统一走 Chrome Search API（浏览器默认搜索引擎），丢弃该遗留字段。
  delete stored.searchEngine;
  return normalize({ ...DEFAULT_SETTINGS, ...stored });
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'sync' && changes[SETTINGS_KEY]) {
      cb(normalize({ ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue as Partial<Settings>) }));
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
