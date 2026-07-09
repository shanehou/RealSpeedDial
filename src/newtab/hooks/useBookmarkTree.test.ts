import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../../../tests/setup';
import { useBookmarkTree } from './useBookmarkTree';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); });

describe('useBookmarkTree', () => {
  it('loads subtree for rootId', async () => {
    c.bookmarks.getSubTree.mockResolvedValue([{ id: 'r', title: 'R', children: [] }]);
    const { result } = renderHook(() => useBookmarkTree('r'));
    await waitFor(() => expect(result.current.root?.id).toBe('r'));
  });
  it('reloads on bookmark change event', async () => {
    c.bookmarks.getSubTree.mockResolvedValue([{ id: 'r', title: 'R', children: [] }]);
    const { result } = renderHook(() => useBookmarkTree('r'));
    await waitFor(() => expect(result.current.root).toBeTruthy());
    c.bookmarks.getSubTree.mockResolvedValue([{ id: 'r', title: 'R2', children: [] }]);
    act(() => { c.bookmarks.onChanged._emit(); });
    await waitFor(() => expect(result.current.root?.title).toBe('R2'));
  });
  it('handles null rootId as no-op', async () => {
    const { result } = renderHook(() => useBookmarkTree(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.root).toBeNull();
  });
});
