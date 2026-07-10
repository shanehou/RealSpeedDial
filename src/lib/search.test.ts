import { describe, it, expect } from 'vitest';
import { flattenBookmarks, filterBookmarks, buildSearchUrl, searchBookmarks } from './search';
import type { BookmarkNode } from '@/types';

const tree: BookmarkNode = { id: 'root', title: 'R', children: [
  { id: 'b1', title: 'GitHub', url: 'https://github.com' },
  { id: 'f1', title: '工作', children: [
    { id: 'b2', title: 'Jira Board', url: 'https://jira.com' },
  ] },
] };

describe('search', () => {
  it('flattenBookmarks collects all bookmarks recursively', () => {
    expect(flattenBookmarks(tree).map((b) => b.id)).toEqual(['b1', 'b2']);
  });
  it('filterBookmarks matches title case-insensitively', () => {
    expect(filterBookmarks(tree, 'jira').map((b) => b.id)).toEqual(['b2']);
  });
  it('filterBookmarks matches url', () => {
    expect(filterBookmarks(tree, 'github.com').map((b) => b.id)).toEqual(['b1']);
  });
  it('empty query returns nothing', () => {
    expect(filterBookmarks(tree, '  ')).toEqual([]);
  });
  it('buildSearchUrl substitutes %s encoded', () => {
    expect(buildSearchUrl('https://g.com/s?q=%s', 'a b')).toBe('https://g.com/s?q=a%20b');
  });
});

const tree2 = { id: '0', title: '', children: [
  { id: '1', title: '书签栏', children: [
    { id: 'b1', title: 'GitHub', url: 'https://github.com' },
    { id: 'work', title: '工作', children: [
      { id: 'b2', title: 'Jira Board', url: 'https://jira.com' },
      { id: 'proj', title: '项目A', children: [
        { id: 'b3', title: 'Jira Sprint', url: 'https://jira.com/sprint' },
      ] },
    ] },
    { id: 'study', title: '学习', children: [
      { id: 'b4', title: 'Jira Tutorial', url: 'https://learn.com/jira' },
    ] },
  ] },
] } as const;

describe('searchBookmarks', () => {
  it('searches the whole tree and groups by current folder subtree', () => {
    const r = searchBookmarks(tree2 as never, 'jira', 'work');
    expect(r.current.map((h) => h.id)).toEqual(['b2', 'b3']);
    expect(r.others.map((h) => h.id)).toEqual(['b4']);
  });
  it('attaches the full folder path excluding the invisible root', () => {
    const r = searchBookmarks(tree2 as never, 'sprint', 'work');
    expect(r.current[0].path.map((c) => c.title)).toEqual(['书签栏', '工作', '项目A']);
  });
  it('returns empty groups for blank query', () => {
    expect(searchBookmarks(tree2 as never, '  ', 'work')).toEqual({ current: [], others: [] });
  });
  it('treats all hits as current when current folder is the root', () => {
    const r = searchBookmarks(tree2 as never, 'jira', '0');
    expect(r.current.map((h) => h.id)).toEqual(['b2', 'b3', 'b4']);
    expect(r.others).toEqual([]);
  });
});
