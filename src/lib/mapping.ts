import { HOME_TAB_ID } from './constants';
import type { BookmarkNode, TabModel } from '@/types';

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
