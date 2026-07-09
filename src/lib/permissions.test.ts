import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import { ensureCapturePermission } from './permissions';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); });

describe('ensureCapturePermission', () => {
  it('returns true immediately if already granted', async () => {
    c.permissions.contains.mockResolvedValue(true);
    expect(await ensureCapturePermission()).toBe(true);
    expect(c.permissions.request).not.toHaveBeenCalled();
  });
  it('requests when missing', async () => {
    c.permissions.contains.mockResolvedValue(false);
    c.permissions.request.mockResolvedValue(true);
    expect(await ensureCapturePermission()).toBe(true);
    expect(c.permissions.request).toHaveBeenCalledWith({ permissions: ['tabs'], origins: ['<all_urls>'] });
  });
});
