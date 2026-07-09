import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByText(/📁 后端/)).toBeInTheDocument();
  });
  it('drills into folder tile (recursive replace) and shows breadcrumb', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.click(screen.getByRole('tab', { name: '工作' }));
    await userEvent.click(await screen.findByRole('button', { name: /📁 后端/ }));
    await waitFor(() => expect(screen.getByText('MySQL')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '根' })).toBeInTheDocument();
  });
  it('shows guidance when no root selected', async () => {
    await c.storage.sync.set({ [SETTINGS_KEY]: { rootFolderId: null } });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /选择目录/ })).toBeInTheDocument());
  });
});
