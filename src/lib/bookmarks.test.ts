import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import { getSubTree, createBookmark, moveBookmark, removeBookmark, removeFolder, onBookmarksChanged } from './bookmarks';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); });

describe('bookmarks wrapper', () => {
  it('getSubTree returns first node', async () => {
    c.bookmarks.getSubTree.mockResolvedValue([{ id: 'r', title: 'R', children: [] }]);
    const node = await getSubTree('r');
    expect(node.id).toBe('r');
    expect(c.bookmarks.getSubTree).toHaveBeenCalledWith('r');
  });
  it('createBookmark passes parent/title/url', async () => {
    c.bookmarks.create.mockResolvedValue({ id: 'n' });
    await createBookmark('p', 'T', 'https://t.com');
    expect(c.bookmarks.create).toHaveBeenCalledWith({ parentId: 'p', title: 'T', url: 'https://t.com' });
  });
  it('moveBookmark forwards destination', async () => {
    c.bookmarks.move.mockResolvedValue({});
    await moveBookmark('id', { parentId: 'p', index: 2 });
    expect(c.bookmarks.move).toHaveBeenCalledWith('id', { parentId: 'p', index: 2 });
  });
  it('removeFolder calls removeTree', async () => {
    c.bookmarks.removeTree.mockResolvedValue(undefined);
    await removeFolder('id');
    expect(c.bookmarks.removeTree).toHaveBeenCalledWith('id');
  });
  it('removeBookmark calls remove', async () => {
    c.bookmarks.remove.mockResolvedValue(undefined);
    await removeBookmark('id');
    expect(c.bookmarks.remove).toHaveBeenCalledWith('id');
  });
  it('onBookmarksChanged subscribes all events and returns unsub', () => {
    const cb = vi.fn();
    const unsub = onBookmarksChanged(cb);
    c.bookmarks.onChanged._emit();
    c.bookmarks.onMoved._emit();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    c.bookmarks.onChanged._emit();
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
