import { describe, it, expect } from 'vitest';
import { isFolder, getBookmarks, getSubfolders, findNode, getAncestors, buildTabs, resolveActiveTabId, buildItems, buildFolderView } from './mapping';
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

describe('buildItems', () => {
  it('Home tab shows only the folder direct bookmarks (folders are tabs, not tiles)', () => {
    const items = buildItems(tree, HOME_TAB_ID);
    expect(items).toEqual([
      { kind: 'bookmark', id: 'b1', title: 'GitHub', url: 'https://github.com', index: 0 },
    ]);
  });
  it('subfolder tab shows that subfolder bookmarks + its subfolders as folder tiles', () => {
    const items = buildItems(tree, 'f1');
    expect(items[0]).toEqual({ kind: 'bookmark', id: 'b2', title: 'Jira', url: 'https://jira.com', index: 0 });
    expect(items[1]).toMatchObject({ kind: 'folder', id: 'f2', title: '后端', index: 1 });
  });
  it('folder tile childrenPreview collects up to 4 descendant bookmark urls', () => {
    const items = buildItems(tree, 'f1');
    const folder = items[1] as { childrenPreview: string[] };
    expect(folder.childrenPreview).toEqual(['https://mysql.com']);
  });
  it('folder tile childrenPreview caps at 4 and lists direct bookmarks before nested ones', () => {
    const parent: BookmarkNode = { id: 'p', title: 'P', children: [
      { id: 'active', title: 'Active', index: 0, children: [
        { id: 'tile', title: 'Tile', index: 0, children: [
          // 含书签的子目录故意排在最前：验证直链书签优先于向子目录递归
          { id: 'nf', title: 'Nested', index: 0, children: [
            { id: 'n1', title: 'N1', url: 'https://n1.com', index: 0 },
            { id: 'deep', title: 'Deep', index: 1, children: [
              { id: 'n2', title: 'N2', url: 'https://n2.com', index: 0 },
              { id: 'n3', title: 'N3', url: 'https://n3.com', index: 1 },
            ] },
          ] },
          { id: 'd1', title: 'D1', url: 'https://d1.com', index: 1 },
          { id: 'd2', title: 'D2', url: 'https://d2.com', index: 2 },
          { id: 'd3', title: 'D3', url: 'https://d3.com', index: 3 },
          { id: 'd4', title: 'D4', url: 'https://d4.com', index: 4 },
        ] },
      ] },
    ] };
    const items = buildItems(parent, 'active');
    const folder = items[0] as { childrenPreview: string[] };
    expect(folder.childrenPreview.length).toBe(4);
    expect(folder.childrenPreview).toEqual([
      'https://d1.com', 'https://d2.com', 'https://d3.com', 'https://d4.com',
    ]);
  });
  it('returns empty for unknown tab', () => {
    expect(buildItems(tree, 'zzz')).toEqual([]);
  });
});

describe('buildFolderView', () => {
  it('composes tabs, items, breadcrumb for root', () => {
    const view = buildFolderView(tree, 'root');
    expect(view.folderId).toBe('root');
    expect(view.activeTabId).toBe(HOME_TAB_ID);
    expect(view.tabs.map((t) => t.id)).toEqual([HOME_TAB_ID, 'f1']);
    expect(view.items.map((i) => i.id)).toEqual(['b1']);
    expect(view.breadcrumb.map((c) => c.id)).toEqual(['root']);
  });
  it('drills into a deep folder as recursion root', () => {
    const view = buildFolderView(tree, 'f2', HOME_TAB_ID);
    expect(view.folderId).toBe('f2');
    expect(view.items.map((i) => i.id)).toEqual(['b3']);
    expect(view.breadcrumb.map((c) => c.id)).toEqual(['root', 'f1', 'f2']);
  });
  it('falls back to root when folderId missing', () => {
    const view = buildFolderView(tree, 'gone');
    expect(view.folderId).toBe('root');
  });
});
