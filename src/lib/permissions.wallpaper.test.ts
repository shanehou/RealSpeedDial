import { describe, it, expect } from 'vitest';
import { installChromeMock } from '../../tests/setup';
import { ensureWallpaperPermission } from './permissions';

describe('ensureWallpaperPermission', () => {
  it('returns true without requesting when already granted', async () => {
    const c = installChromeMock();
    c.permissions.contains.mockResolvedValue(true);
    await expect(ensureWallpaperPermission('picsum')).resolves.toBe(true);
    expect(c.permissions.request).not.toHaveBeenCalled();
  });
  it('requests the source origins when missing', async () => {
    const c = installChromeMock();
    c.permissions.contains.mockResolvedValue(false);
    c.permissions.request.mockResolvedValue(true);
    await expect(ensureWallpaperPermission('bing')).resolves.toBe(true);
    expect(c.permissions.request).toHaveBeenCalledWith({ origins: ['https://www.bing.com/*'] });
  });
});
