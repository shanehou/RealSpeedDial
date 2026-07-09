import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderTreeSelect } from './FolderTreeSelect';
import type { BookmarkNode } from '@/types';

const tree: BookmarkNode = { id: '0', title: '', children: [
  { id: '1', title: '书签栏', children: [
    { id: 'f1', title: '工作', children: [] },
    { id: 'b1', title: 'GitHub', url: 'https://github.com' },
  ] },
] };

describe('FolderTreeSelect', () => {
  it('lists only folders and selects on click', async () => {
    const onSelect = vi.fn();
    render(<FolderTreeSelect tree={tree} selectedId={null} onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: '工作' })).toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '工作' }));
    expect(onSelect).toHaveBeenCalledWith('f1');
  });
});
