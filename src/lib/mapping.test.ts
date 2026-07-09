import { describe, it, expect } from 'vitest';
import { isFolder, getBookmarks, getSubfolders, findNode, getAncestors, buildTabs, resolveActiveTabId } from './mapping';
import { HOME_TAB_ID } from './constants';
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

describe('buildTabs', () => {
  it('adds Home tab when folder has direct bookmarks, then subfolders', () => {
    const tabs = buildTabs(tree);
    expect(tabs.map((t) => t.id)).toEqual([HOME_TAB_ID, 'f1']);
    expect(tabs[0].isHome).toBe(true);
    expect(tabs[1].title).toBe('工作');
  });
  it('omits Home tab when no direct bookmarks', () => {
    const folder: BookmarkNode = { id: 'x', title: 'X', children: [
      { id: 'sf', title: 'Sub', index: 0, children: [] },
    ] };
    expect(buildTabs(folder).map((t) => t.id)).toEqual(['sf']);
  });
  it('returns only Home when folder has only bookmarks', () => {
    const folder: BookmarkNode = { id: 'x', title: 'X', children: [
      { id: 'b', title: 'B', url: 'https://b.com', index: 0 },
    ] };
    expect(buildTabs(folder).map((t) => t.id)).toEqual([HOME_TAB_ID]);
  });
});

describe('resolveActiveTabId', () => {
  it('keeps requested tab when valid', () => {
    expect(resolveActiveTabId(tree, 'f1')).toBe('f1');
  });
  it('falls back to first tab when requested invalid', () => {
    expect(resolveActiveTabId(tree, 'zzz')).toBe(HOME_TAB_ID);
  });
  it('returns empty string when no tabs', () => {
    expect(resolveActiveTabId({ id: 'e', title: 'E', children: [] }, undefined)).toBe('');
  });
});
