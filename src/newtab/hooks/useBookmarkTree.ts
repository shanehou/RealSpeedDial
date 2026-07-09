import { useCallback, useEffect, useState } from 'react';
import { getSubTree, onBookmarksChanged } from '@/lib/bookmarks';
import type { BookmarkNode } from '@/types';

export function useBookmarkTree(rootId: string | null) {
  const [root, setRoot] = useState<BookmarkNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!rootId) { setRoot(null); setLoading(false); return; }
    setLoading(true);
    try {
      setRoot(await getSubTree(rootId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRoot(null);
    } finally {
      setLoading(false);
    }
  }, [rootId]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => onBookmarksChanged(() => { void reload(); }), [reload]);

  return { root, loading, error, reload };
}
