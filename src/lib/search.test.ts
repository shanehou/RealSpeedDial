import { describe, it, expect } from 'vitest';
import { flattenBookmarks, filterBookmarks, buildSearchUrl } from './search';
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
