import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../../../tests/setup';
import { putThumbnail } from '@/lib/thumbnails';
import { useThumbnails } from './useThumbnails';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); indexedDB = new IDBFactory(); });

describe('useThumbnails', () => {
  it('loads thumbnails for given urls when style is screenshot', async () => {
    await putThumbnail({ url: 'https://a.com', dataUrl: 'data:img', capturedAt: 1 });
    const { result } = renderHook(() => useThumbnails(['https://a.com'], 'screenshot'));
    await waitFor(() => expect(result.current['https://a.com']).toBe('data:img'));
  });
  it('returns empty map when style is not screenshot', async () => {
    await putThumbnail({ url: 'https://a.com', dataUrl: 'data:img', capturedAt: 1 });
    const { result } = renderHook(() => useThumbnails(['https://a.com'], 'themeColor'));
    await waitFor(() => expect(result.current).toEqual({}));
  });
  it('reloads an affected thumbnail when the background broadcasts an update', async () => {
    const url = 'https://a.com';
    const { result } = renderHook(() => useThumbnails([url], 'screenshot'));
    await waitFor(() => expect(result.current).toEqual({}));

    await putThumbnail({ url, dataUrl: 'data:new', capturedAt: 2 });
    act(() => {
      c.runtime.onMessage._emit({ type: 'thumbnail-updated', urls: [url] });
    });

    await waitFor(() => expect(result.current[url]).toBe('data:new'));
  });
});
