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

export function normalizePageUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function findExactBookmarkUrls(root: BookmarkNode, pageUrl: string): string[] {
  const normalized = normalizePageUrl(pageUrl);
  if (!normalized) return [];
  return [...new Set(
    flattenBookmarks(root)
      .filter((bookmark) => normalizePageUrl(bookmark.url) === normalized)
      .map((bookmark) => bookmark.url),
  )];
}

// 目标选择弹窗搜索：空查询显示全部；非空查询按空白分词，每个词都需命中标题或 URL。
export function searchBookmarkChoices(root: BookmarkNode, query: string): SearchHit[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];
  const path: Crumb[] = [];
  const walk = (node: BookmarkNode) => {
    for (const child of node.children ?? []) {
      if (child.url) {
        const haystack = `${child.title}\n${child.url}`.toLowerCase();
        if (terms.every((term) => haystack.includes(term))) {
          hits.push({ id: child.id, title: child.title, url: child.url, path: path.slice() });
        }
      } else {
        path.push({ id: child.id, title: child.title });
        walk(child);
        path.pop();
      }
    }
  };
  walk(root);
  return hits;
}

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
