import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import Options from './Options';
import { SETTINGS_KEY } from '@/lib/constants';

let c: ChromeMock;
beforeEach(() => {
  c = installChromeMock();
  c.bookmarks.getTree.mockResolvedValue([{ id: '0', title: '', children: [
    { id: '1', title: '书签栏', children: [{ id: 'f1', title: '工作', children: [] }] },
  ] }]);
});

describe('Options', () => {
  it('selects a root folder and persists to settings', async () => {
    render(<Options />);
    await userEvent.click(await screen.findByRole('button', { name: '工作' }));
    await waitFor(async () => {
      const got = await c.storage.sync.get(SETTINGS_KEY);
      expect((got[SETTINGS_KEY] as { rootFolderId: string }).rootFolderId).toBe('f1');
    });
  });

  it('changes tile style', async () => {
    render(<Options />);
    const select = await screen.findByLabelText('磁贴样式');
    await userEvent.selectOptions(select, 'themeColor');
    await waitFor(async () => {
      const got = await c.storage.sync.get(SETTINGS_KEY);
      expect((got[SETTINGS_KEY] as { tileStyle: string }).tileStyle).toBe('themeColor');
    });
  });
});
