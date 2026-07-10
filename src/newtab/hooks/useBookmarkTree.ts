import { useCallback, useEffect, useState } from 'react';
import { getTree, onBookmarksChanged } from '@/lib/bookmarks';
import type { BookmarkNode } from '@/types';

// 加载整棵书签树（根节点 id="0"）。落地目录由 App 用 settings.rootFolderId 决定，与加载无关。
export function useBookmarkTree() {
  const [root, setRoot] = useState<BookmarkNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await getTree();
      setRoot(tree[0] ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRoot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => onBookmarksChanged(() => { void reload(); }), [reload]);

  return { root, loading, error, reload };
}
