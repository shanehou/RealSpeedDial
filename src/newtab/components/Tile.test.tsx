import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installChromeMock } from '../../../tests/setup';
import { Tile } from './Tile';
import { FolderTile } from './FolderTile';

beforeEach(() => { installChromeMock(); });

describe('Tile', () => {
  it('renders title and triggers onOpen', async () => {
    const onOpen = vi.fn();
    render(<Tile id="b" title="GitHub" url="https://github.com" onOpen={onOpen} onContextMenu={() => {}} />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /GitHub/ }));
    expect(onOpen).toHaveBeenCalledWith('https://github.com');
  });
});

describe('FolderTile', () => {
  it('renders folder title and triggers onEnter', async () => {
    const onEnter = vi.fn();
    render(<FolderTile id="f" title="工作" preview={['https://a.com']} onEnter={onEnter} onContextMenu={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /工作/ }));
    expect(onEnter).toHaveBeenCalledWith('f');
  });
});
