import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { installChromeMock } from '../../../tests/setup';
import { SearchResults } from './SearchResults';
import type { GroupedSearch } from '@/lib/search';

beforeEach(() => { installChromeMock(); });

const results: GroupedSearch = {
  current: [{ id: 'b2', title: 'Jira Board', url: 'https://jira.com', path: [{ id: '1', title: '书签栏' }, { id: 'work', title: '工作' }] }],
  others: [{ id: 'b4', title: 'Jira Tutorial', url: 'https://learn.com/jira', path: [{ id: '1', title: '书签栏' }, { id: 'study', title: '学习' }] }],
};

describe('SearchResults', () => {
  it('renders grouped rows with links and full paths', () => {
    render(<SearchResults results={results} openInNewTab={false} onContextMenu={() => {}} />);
    expect(screen.getByText('当前目录')).toBeInTheDocument();
    expect(screen.getByText('其他目录')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Jira Board/ })).toHaveAttribute('href', 'https://jira.com');
    expect(screen.getByText('书签栏 › 工作')).toBeInTheDocument();
  });
  it('shows empty state when no hits', () => {
    render(<SearchResults results={{ current: [], others: [] }} openInNewTab={false} onContextMenu={() => {}} />);
    expect(screen.getByText('没有匹配的书签')).toBeInTheDocument();
  });
});
