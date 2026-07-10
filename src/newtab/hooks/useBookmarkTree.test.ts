import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../../../tests/setup';
import { useBookmarkTree } from './useBookmarkTree';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); });

describe('useBookmarkTree', () => {
  it('loads the whole bookmark tree (root id 0)', async () => {
    c.bookmarks.getTree.mockResolvedValue([{ id: '0', title: '', children: [] }]);
    const { result } = renderHook(() => useBookmarkTree());
    await waitFor(() => expect(result.current.root?.id).toBe('0'));
  });
  it('reloads on bookmark change event', async () => {
    c.bookmarks.getTree.mockResolvedValue([{ id: '0', title: '', children: [{ id: '1', title: '书签栏', children: [] }] }]);
    const { result } = renderHook(() => useBookmarkTree());
    await waitFor(() => expect(result.current.root).toBeTruthy());
    c.bookmarks.getTree.mockResolvedValue([{ id: '0', title: '', children: [{ id: '1', title: 'BookmarksBar', children: [] }] }]);
    act(() => { c.bookmarks.onChanged._emit(); });
    await waitFor(() => expect(result.current.root?.children?.[0].title).toBe('BookmarksBar'));
  });
});
