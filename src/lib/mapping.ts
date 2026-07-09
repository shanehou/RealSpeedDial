import { HOME_TAB_ID, FOLDER_PREVIEW_COUNT } from './constants';
import type { BookmarkNode, TabModel, SpeedDialItem, SpeedDialBookmark, SpeedDialFolder } from '@/types';

export function isFolder(node: BookmarkNode): boolean {
  return node.url === undefined;
}

export function getBookmarks(folder: BookmarkNode): BookmarkNode[] {
  return (folder.children ?? []).filter((c) => c.url !== undefined);
}

export function getSubfolders(folder: BookmarkNode): BookmarkNode[] {
  return (folder.children ?? []).filter((c) => c.url === undefined);
}

export function findNode(root: BookmarkNode, id: string): BookmarkNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function getAncestors(root: BookmarkNode, id: string): BookmarkNode[] {
  const path: BookmarkNode[] = [];
  function dfs(node: BookmarkNode): boolean {
    path.push(node);
    if (node.id === id) return true;
    for (const child of node.children ?? []) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  }
  return dfs(root) ? path : [];
}

export function buildTabs(folder: BookmarkNode): TabModel[] {
  const tabs: TabModel[] = [];
  if (getBookmarks(folder).length > 0) {
    tabs.push({ id: HOME_TAB_ID, title: '主页', isHome: true });
  }
  for (const sf of getSubfolders(folder)) {
    tabs.push({ id: sf.id, title: sf.title, isHome: false });
  }
  return tabs;
}

export function resolveActiveTabId(folder: BookmarkNode, requested?: string): string {
  const tabs = buildTabs(folder);
  if (tabs.length === 0) return '';
  if (requested && tabs.some((t) => t.id === requested)) return requested;
  return tabs[0].id;
}

function toBookmarkItem(node: BookmarkNode): SpeedDialBookmark {
  return { kind: 'bookmark', id: node.id, title: node.title, url: node.url!, index: node.index ?? 0 };
}

function collectPreviewUrls(folder: BookmarkNode, limit: number): string[] {
  const urls: string[] = [];
  const walk = (n: BookmarkNode) => {
    for (const c of n.children ?? []) {
      if (urls.length >= limit) return;
      if (c.url) urls.push(c.url);
    }
    for (const c of n.children ?? []) {
      if (urls.length >= limit) return;
      if (!c.url) walk(c);
    }
  };
  walk(folder);
  return urls.slice(0, limit);
}

function toFolderItem(node: BookmarkNode): SpeedDialFolder {
  return {
    kind: 'folder',
    id: node.id,
    title: node.title,
    index: node.index ?? 0,
    childrenPreview: collectPreviewUrls(node, FOLDER_PREVIEW_COUNT),
  };
}

export function buildItems(folder: BookmarkNode, activeTabId: string): SpeedDialItem[] {
  if (activeTabId === HOME_TAB_ID) {
    return getBookmarks(folder).map(toBookmarkItem);
  }
  const sub = (folder.children ?? []).find((c) => c.id === activeTabId && c.url === undefined);
  if (!sub) return [];
  return [
    ...getBookmarks(sub).map(toBookmarkItem),
    ...getSubfolders(sub).map(toFolderItem),
  ];
}
