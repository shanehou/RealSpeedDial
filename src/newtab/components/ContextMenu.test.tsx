import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  it('renders actions and fires callback', async () => {
    const onAction = vi.fn();
    render(<ContextMenu x={10} y={10} isFolder={false} onAction={onAction} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(onAction).toHaveBeenCalledWith('delete');
  });
  it('omits screenshot refresh for folders', () => {
    render(<ContextMenu x={0} y={0} isFolder onAction={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: '刷新缩略图' })).not.toBeInTheDocument();
  });
});
