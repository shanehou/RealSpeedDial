import { describe, it, expect } from 'vitest';
import { resolveInitialNav } from './navState';
import { HOME_TAB_ID } from './constants';
import type { BookmarkNode } from '@/types';

const tree: BookmarkNode = { id: 'root', title: 'R', children: [
  { id: 'f1', title: '工作', children: [{ id: 'f2', title: '后端', children: [] }] },
] };

describe('resolveInitialNav', () => {
  it('uses saved nav when folder & tab valid', () => {
    const r = resolveInitialNav(tree, { currentFolderId: 'f1', selectedTabId: 'f2' }, true);
    expect(r).toEqual({ currentFolderId: 'f1', selectedTabId: 'f2' });
  });
  it('falls back to root when folder missing', () => {
    const r = resolveInitialNav(tree, { currentFolderId: 'gone', selectedTabId: 'x' }, true);
    expect(r).toEqual({ currentFolderId: 'root', selectedTabId: HOME_TAB_ID });
  });
  it('falls back to folder home when tab invalid but folder valid', () => {
    const r = resolveInitialNav(tree, { currentFolderId: 'f1', selectedTabId: 'zzz' }, true);
    expect(r).toEqual({ currentFolderId: 'f1', selectedTabId: HOME_TAB_ID });
  });
  it('ignores saved nav when restore disabled', () => {
    const r = resolveInitialNav(tree, { currentFolderId: 'f1', selectedTabId: 'f2' }, false);
    expect(r).toEqual({ currentFolderId: 'root', selectedTabId: HOME_TAB_ID });
  });
  it('uses root when no saved nav', () => {
    const r = resolveInitialNav(tree, null, true);
    expect(r).toEqual({ currentFolderId: 'root', selectedTabId: HOME_TAB_ID });
  });
});
