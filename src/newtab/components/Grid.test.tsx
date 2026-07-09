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
  it('renders bookmarks and folders, wires callbacks', async () => {
    const onOpen = vi.fn();
    const onEnter = vi.fn();
    render(<Grid items={items} columns={6} thumbnails={{}} onOpen={onOpen} onEnter={onEnter} onContextMenu={() => {}} onReorder={() => {}} onMoveInto={() => {}} />);
    // dnd-kit 的 useSortable 会给每个磁贴外层 div 加 role="button"，与内层 <button> 同名，
    // 故按可访问文本定位内层按钮标签，避免 getByRole 命中多个元素。
    await userEvent.click(screen.getByText('GitHub'));
    await userEvent.click(screen.getByText(/工作/));
    expect(onOpen).toHaveBeenCalledWith('https://github.com');
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
  it('renders nothing when single crumb', () => {
    const { container } = render(<Breadcrumb crumbs={[{ id: 'root', title: '根' }]} onGo={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
