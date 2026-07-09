import type { BookmarkNode } from '@/types';

export async function getSubTree(id: string): Promise<BookmarkNode> {
  const nodes = await chrome.bookmarks.getSubTree(id);
  return nodes[0] as unknown as BookmarkNode;
}

export async function getTree(): Promise<BookmarkNode[]> {
  return (await chrome.bookmarks.getTree()) as unknown as BookmarkNode[];
}

export async function createBookmark(parentId: string, title: string, url?: string): Promise<BookmarkNode> {
  return (await chrome.bookmarks.create({ parentId, title, url })) as unknown as BookmarkNode;
}

export async function updateBookmark(id: string, changes: { title?: string; url?: string }): Promise<void> {
  await chrome.bookmarks.update(id, changes);
}

export async function removeBookmark(id: string): Promise<void> {
  await chrome.bookmarks.remove(id);
}

export async function removeFolder(id: string): Promise<void> {
  await chrome.bookmarks.removeTree(id);
}

export async function moveBookmark(id: string, dest: { parentId?: string; index?: number }): Promise<void> {
  await chrome.bookmarks.move(id, dest);
}

export function onBookmarksChanged(cb: () => void): () => void {
  const events = [
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered,
  ];
  events.forEach((e) => e.addListener(cb));
  return () => events.forEach((e) => e.removeListener(cb));
}
