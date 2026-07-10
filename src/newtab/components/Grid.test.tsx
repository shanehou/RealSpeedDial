import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installChromeMock } from '../../../tests/setup';
import { Grid } from './Grid';
import { Breadcrumb } from './Breadcrumb';
import type { SpeedDialItem } from '@/types';

beforeEach(() => { installChromeMock(); });

const items: SpeedDialItem[] = [
  { kind: 'bookmark', id: 'b', title: 'GitHub', url: 'https://github.com', index: 0 },
  { kind: 'folder', id: 'f', title: '工作', index: 1, childrenPreview: [] },
];

describe('Grid', () => {
  it('renders bookmarks as links and folders trigger onEnter', async () => {
    const onEnter = vi.fn();
    render(<Grid items={items} columns={6} thumbnails={{}} tileStyle="themeColor" openInNewTab={false} onEnter={onEnter} onContextMenu={() => {}} onReorder={() => {}} onMoveInto={() => {}} />);
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com');
    await userEvent.click(screen.getByText(/工作/));
    expect(onEnter).toHaveBeenCalledWith('f');
  });
});

describe('Breadcrumb', () => {
  it('renders crumbs and triggers navigation on non-last', async () => {
    const onGo = vi.fn();
    render(<Breadcrumb crumbs={[{ id: 'root', title: '根' }, { id: 'f', title: '工作' }]} onGo={onGo} />);
    await userEvent.click(screen.getByRole('button', { name: '根' }));
    expect(onGo).toHaveBeenCalledWith('root');
  });
  it('renders a single root crumb as a clickable home button', async () => {
    const onGo = vi.fn();
    render(<Breadcrumb crumbs={[{ id: 'root', title: '根' }]} onGo={onGo} />);
    const home = screen.getByRole('button', { name: /根/ });
    await userEvent.click(home);
    expect(onGo).toHaveBeenCalledWith('root');
  });
  it('renders nothing when no crumbs', () => {
    const { container } = render(<Breadcrumb crumbs={[]} onGo={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
