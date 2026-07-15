import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import { getPendingCapture, getThumbnail, putPendingCapture } from '@/lib/thumbnails';
import { ThumbnailPicker } from './ThumbnailPicker';

let c: ChromeMock;
const capture = { sourceUrl: 'https://unmatched.test/state', dataUrl: 'data:image/jpeg;base64,picked', capturedAt: 123 };
const tree = { id: '0', title: '', children: [
  { id: 'bar', title: '书签栏', children: [
    { id: 'github', title: 'GitHub', url: 'https://github.com' },
    { id: 'work', title: '工作', children: [
      { id: 'jira', title: 'Jira Board', url: 'https://jira.test/board' },
    ] },
  ] },
] };

beforeEach(async () => {
  indexedDB = new IDBFactory();
  c = installChromeMock();
  c.bookmarks.getTree.mockResolvedValue([tree]);
  vi.spyOn(window, 'close').mockImplementation(() => undefined);
  await putPendingCapture('capture-1', capture);
});

describe('ThumbnailPicker', () => {
  it('filters by title and URL tokens, shows paths, and saves the chosen bookmark', async () => {
    render(<ThumbnailPicker captureId="capture-1" />);

    expect(await screen.findByText('选择缩略图对应的书签')).toBeInTheDocument();
    expect(screen.getByText(capture.sourceUrl)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox'), 'jira board');

    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    expect(screen.getByText('Jira Board')).toBeInTheDocument();
    expect(screen.getByText('书签栏 › 工作')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Jira Board.*jira\.test/ }));

    await waitFor(async () => {
      expect((await getThumbnail('https://jira.test/board'))?.dataUrl).toBe(capture.dataUrl);
    });
    expect(await getPendingCapture('capture-1')).toBeUndefined();
    expect(c.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'thumbnail-updated',
      urls: ['https://jira.test/board'],
    });
    expect(window.close).toHaveBeenCalled();
  });

  it('deletes the pending capture when cancelled', async () => {
    render(<ThumbnailPicker captureId="capture-1" />);
    await screen.findByText('选择缩略图对应的书签');
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(async () => expect(await getPendingCapture('capture-1')).toBeUndefined());
    expect(window.close).toHaveBeenCalled();
  });

  it('carries the pending region onto the saved thumbnail', async () => {
    await putPendingCapture('capture-2', { ...capture, region: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } });
    render(<ThumbnailPicker captureId="capture-2" />);
    await screen.findByText('选择缩略图对应的书签');
    await userEvent.click(screen.getByRole('button', { name: /Jira Board.*jira\.test/ }));
    await waitFor(async () => {
      expect((await getThumbnail('https://jira.test/board'))?.region).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
    });
  });
});
