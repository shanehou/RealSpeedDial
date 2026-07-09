import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';
import { Guidance } from './Guidance';

describe('states', () => {
  it('EmptyState shows message and add button', async () => {
    const onAdd = vi.fn();
    render(<EmptyState onAdd={onAdd} />);
    expect(screen.getByText(/还没有书签/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /新增/ }));
    expect(onAdd).toHaveBeenCalled();
  });
  it('Guidance opens options', async () => {
    const onOpen = vi.fn();
    render(<Guidance onOpenOptions={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /选择目录/ }));
    expect(onOpen).toHaveBeenCalled();
  });
});
