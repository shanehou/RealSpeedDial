import { NAV_STATE_KEY, HOME_TAB_ID } from './constants';
import { findNode, buildTabs } from './mapping';
import type { BookmarkNode, NavState } from '@/types';

export async function loadNavState(): Promise<NavState | null> {
  const got = await chrome.storage.local.get(NAV_STATE_KEY);
  return (got[NAV_STATE_KEY] as NavState) ?? null;
}

export async function saveNavState(state: NavState): Promise<void> {
  await chrome.storage.local.set({ [NAV_STATE_KEY]: state });
}

// 打开新标签页时决定初始位置：仅在开启「恢复上次位置」且保存的目录/Tab 仍有效时才恢复，
// 否则优雅回退到根目录（或该目录的主页 Tab），避免书签被删/移动后白屏或错乱。
export function resolveInitialNav(
  root: BookmarkNode,
  saved: NavState | null,
  restoreEnabled: boolean,
  landingId?: string,
): NavState {
  // 默认落地：优先配置目录；失效则回退到「书签栏」(id="1")；再退到整树根。
  const landing = landingId && findNode(root, landingId)
    ? landingId
    : (findNode(root, '1') ? '1' : root.id);
  const fallback: NavState = { currentFolderId: landing, selectedTabId: HOME_TAB_ID };
  if (!restoreEnabled || !saved) return fallback;
  const folder = findNode(root, saved.currentFolderId);
  if (!folder) return fallback;
  const tabs = buildTabs(folder);
  const tabValid = tabs.some((t) => t.id === saved.selectedTabId);
  return { currentFolderId: folder.id, selectedTabId: tabValid ? saved.selectedTabId : HOME_TAB_ID };
}
