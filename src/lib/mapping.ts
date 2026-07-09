import type { BookmarkNode } from '@/types';

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
