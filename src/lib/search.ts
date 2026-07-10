import type { BookmarkNode, SpeedDialBookmark, Crumb } from '@/types';

export function flattenBookmarks(root: BookmarkNode): SpeedDialBookmark[] {
  const out: SpeedDialBookmark[] = [];
  const walk = (n: BookmarkNode) => {
    for (const c of n.children ?? []) {
      if (c.url) out.push({ kind: 'bookmark', id: c.id, title: c.title, url: c.url, index: c.index ?? 0 });
      else walk(c);
    }
  };
  walk(root);
  return out;
}

export function filterBookmarks(root: BookmarkNode, query: string): SpeedDialBookmark[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return flattenBookmarks(root).filter(
    (b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q),
  );
}

export function buildSearchUrl(template: string, query: string): string {
  return template.replace('%s', encodeURIComponent(query));
}

export interface SearchHit { id: string; title: string; url: string; path: Crumb[]; }
export interface GroupedSearch { current: SearchHit[]; others: SearchHit[]; }

// 整棵树搜索；命中位于 currentFolderId 子树内 → current，否则 others。
// path = 从顶层书签目录到该书签父目录的文件夹链（排除不可见根 id="0"）。
export function searchBookmarks(root: BookmarkNode, query: string, currentFolderId: string): GroupedSearch {
  const q = query.trim().toLowerCase();
  const current: SearchHit[] = [];
  const others: SearchHit[] = [];
  if (!q) return { current, others };
  const stack: Crumb[] = [];
  const walk = (node: BookmarkNode, inCurrent: boolean) => {
    for (const c of node.children ?? []) {
      if (c.url) {
        if (c.title.toLowerCase().includes(q) || c.url.toLowerCase().includes(q)) {
          (inCurrent ? current : others).push({ id: c.id, title: c.title, url: c.url, path: stack.slice() });
        }
      } else {
        stack.push({ id: c.id, title: c.title });
        walk(c, inCurrent || c.id === currentFolderId);
        stack.pop();
      }
    }
  };
  walk(root, root.id === currentFolderId);
  return { current, others };
}
