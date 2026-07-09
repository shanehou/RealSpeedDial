import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditDialog } from './EditDialog';

describe('EditDialog', () => {
  it('submits bookmark title and url', async () => {
    const onSubmit = vi.fn();
    render(<EditDialog mode="create-bookmark" initial={{ title: '', url: '' }} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText('标题'), 'GitHub');
    await userEvent.type(screen.getByLabelText('网址'), 'https://github.com');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'GitHub', url: 'https://github.com' });
  });
  it('hides url field for folder mode', () => {
    render(<EditDialog mode="create-folder" initial={{ title: '' }} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.queryByLabelText('网址')).not.toBeInTheDocument();
  });
});
