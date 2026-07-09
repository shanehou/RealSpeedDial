import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { installChromeMock } from '../../../tests/setup';
import { putThumbnail } from '@/lib/thumbnails';
import { useThumbnails } from './useThumbnails';

beforeEach(() => { installChromeMock(); indexedDB = new IDBFactory(); });

describe('useThumbnails', () => {
  it('loads thumbnails for given urls when style is screenshot', async () => {
    await putThumbnail({ url: 'https://a.com', dataUrl: 'data:img', capturedAt: 1 });
    const { result } = renderHook(() => useThumbnails(['https://a.com'], 'screenshot'));
    await waitFor(() => expect(result.current['https://a.com']).toBe('data:img'));
  });
  it('returns empty map when style is not screenshot', async () => {
    await putThumbnail({ url: 'https://a.com', dataUrl: 'data:img', capturedAt: 1 });
    const { result } = renderHook(() => useThumbnails(['https://a.com'], 'favicon'));
    await waitFor(() => expect(result.current).toEqual({}));
  });
});
