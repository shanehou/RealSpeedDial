import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getThumbnail, putThumbnail, deleteThumbnail } from './thumbnails';

beforeEach(async () => {
  indexedDB = new IDBFactory();
});

describe('thumbnails', () => {
  it('returns undefined when missing', async () => {
    expect(await getThumbnail('https://x.com')).toBeUndefined();
  });
  it('puts and gets a record', async () => {
    await putThumbnail({ url: 'https://x.com', dataUrl: 'data:...', capturedAt: 123 });
    const rec = await getThumbnail('https://x.com');
    expect(rec?.dataUrl).toBe('data:...');
  });
  it('deletes a record', async () => {
    await putThumbnail({ url: 'https://x.com', dataUrl: 'd', capturedAt: 1 });
    await deleteThumbnail('https://x.com');
    expect(await getThumbnail('https://x.com')).toBeUndefined();
  });
});
