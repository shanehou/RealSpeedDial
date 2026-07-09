import { describe, it, expect } from 'vitest';
import { isFolder, getBookmarks, getSubfolders, findNode, getAncestors } from './mapping';
import type { BookmarkNode } from '@/types';

const tree: BookmarkNode = {
  id: 'root', title: 'Root', children: [
    { id: 'b1', title: 'GitHub', url: 'https://github.com', index: 0 },
    { id: 'f1', title: '工作', index: 1, children: [
      { id: 'b2', title: 'Jira', url: 'https://jira.com', index: 0 },
      { id: 'f2', title: '后端', index: 1, children: [
        { id: 'b3', title: 'MySQL', url: 'https://mysql.com', index: 0 },
      ] },
    ] },
  ],
};

describe('tree utils', () => {
  it('isFolder distinguishes folders from bookmarks', () => {
    expect(isFolder(tree.children![0])).toBe(false);
    expect(isFolder(tree.children![1])).toBe(true);
  });
  it('getBookmarks returns only url children', () => {
    expect(getBookmarks(tree).map((n) => n.id)).toEqual(['b1']);
  });
  it('getSubfolders returns only folder children', () => {
    expect(getSubfolders(tree).map((n) => n.id)).toEqual(['f1']);
  });
  it('findNode locates nested node', () => {
    expect(findNode(tree, 'f2')?.title).toBe('后端');
    expect(findNode(tree, 'nope')).toBeNull();
  });
  it('getAncestors returns root..node path', () => {
    expect(getAncestors(tree, 'f2').map((n) => n.id)).toEqual(['root', 'f1', 'f2']);
    expect(getAncestors(tree, 'nope')).toEqual([]);
  });
});
