import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import App from './App';
import { SETTINGS_KEY } from '@/lib/constants';

let c: ChromeMock;
const tree = { id: 'root', title: '根', children: [
  { id: 'b1', title: 'GitHub', url: 'https://github.com', index: 0 },
  { id: 'f1', title: '工作', index: 1, children: [
    { id: 'b2', title: 'Jira', url: 'https://jira.com', index: 0 },
    { id: 'f2', title: '后端', index: 1, children: [
      { id: 'b3', title: 'MySQL', url: 'https://mysql.com', index: 0 },
    ] },
  ] },
] };

beforeEach(async () => {
  c = installChromeMock();
  await c.storage.sync.set({ [SETTINGS_KEY]: { rootFolderId: 'root' } });
  c.bookmarks.getSubTree.mockResolvedValue([tree]);
});

describe('App navigation', () => {
  it('shows Home tab bookmarks by default', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());
  });
  it('switches tab to show subfolder contents (folder stays root)', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.click(screen.getByRole('tab', { name: '工作' }));
    await waitFor(() => expect(screen.getByText('Jira')).toBeInTheDocument());
    expect(screen.getByText('后端')).toBeInTheDocument();
  });
  it('drills into folder tile (recursive replace) and shows breadcrumb', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.click(screen.getByRole('tab', { name: '工作' }));
    await userEvent.click(await screen.findByText('后端'));
    await waitFor(() => expect(screen.getByText('MySQL')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /根/ })).toBeInTheDocument();
  });
  it('restores root Home when browser Back is pressed after drilling in', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.click(screen.getByRole('tab', { name: '工作' }));
    await userEvent.click(await screen.findByText('后端'));
    await waitFor(() => expect(screen.getByText('MySQL')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /根/ })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { folderId: 'root', tabId: '__home__' } }));
    });

    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());
    // 已回到根首页：深层的「后端」文件夹磁贴不再显示
    expect(screen.queryByText('后端')).not.toBeInTheDocument();
  });
  it('shows guidance when no root selected', async () => {
    await c.storage.sync.set({ [SETTINGS_KEY]: { rootFolderId: null } });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /选择目录/ })).toBeInTheDocument());
  });

  it('filters tiles live as you type in the search box', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.type(screen.getByRole('searchbox'), 'jira');
    await waitFor(() => expect(screen.getByText(/搜索结果/)).toBeInTheDocument());
    expect(screen.getByText('Jira')).toBeInTheDocument();
    // 搜索态隐藏 Tab 栏与非匹配项
    expect(screen.queryByRole('tab', { name: '工作' })).not.toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
  });

  it('adds a new bookmark into the active subfolder tab, not the parent home', async () => {
    c.bookmarks.create.mockResolvedValue({ id: 'newb' });
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.click(screen.getByRole('tab', { name: '工作' }));
    await waitFor(() => expect(screen.getByText('Jira')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('新增书签'));
    await userEvent.type(screen.getByLabelText('标题'), 'Wiki');
    await userEvent.type(screen.getByLabelText('网址'), 'https://wiki.com');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(c.bookmarks.create).toHaveBeenCalledWith({ parentId: 'f1', title: 'Wiki', url: 'https://wiki.com' }));
  });
});
