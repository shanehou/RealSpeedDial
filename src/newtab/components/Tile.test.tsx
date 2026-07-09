import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders the screenshot image when a thumbnail is provided', () => {
    const { container } = render(
      <Tile id="b" title="GitHub" url="https://github.com" thumbnail="data:img" onOpen={() => {}} onContextMenu={() => {}} />,
    );
    const shot = container.querySelector('img.tile__screenshot');
    expect(shot).toBeInTheDocument();
    expect(shot).toHaveAttribute('src', 'data:img');
  });

  it('renders a small favicon in the corner by default', () => {
    const { container } = render(
      <Tile id="b" title="GitHub" url="https://github.com" onOpen={() => {}} onContextMenu={() => {}} />,
    );
    const fav = container.querySelector('.tile__fav img');
    expect(fav).toBeInTheDocument();
    expect(fav?.getAttribute('src')).toContain('/_favicon/');
    expect(container.querySelector('img.tile__screenshot')).toBeNull();
  });

  it('falls back to the first-letter block when the favicon fails to load', () => {
    const { container } = render(
      <Tile id="b" title="GitHub" url="https://github.com" onOpen={() => {}} onContextMenu={() => {}} />,
    );
    const fav = container.querySelector('.tile__fav img');
    expect(fav).toBeInTheDocument();
    fireEvent.error(fav!);
    expect(container.querySelector('.tile__fav img')).toBeNull();
    const letter = screen.getByText('G');
    expect(letter).toBeInTheDocument();
    expect(letter).toHaveClass('tile__fav-letter');
  });

  it('applies a theme-color gradient background in themeColor style without a thumbnail', () => {
    render(<Tile id="b" title="GitHub" url="https://github.com" tileStyle="themeColor" onOpen={() => {}} onContextMenu={() => {}} />);
    expect(screen.getByRole('button', { name: /GitHub/ }).getAttribute('style')).toContain('linear-gradient');
  });

  it('does not add a gradient in favicon style', () => {
    render(<Tile id="b" title="GitHub" url="https://github.com" tileStyle="favicon" onOpen={() => {}} onContextMenu={() => {}} />);
    expect(screen.getByRole('button', { name: /GitHub/ }).getAttribute('style') ?? '').not.toContain('linear-gradient');
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
