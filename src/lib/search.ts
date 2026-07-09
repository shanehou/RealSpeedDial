import type { BookmarkNode, SpeedDialBookmark } from '@/types';

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
