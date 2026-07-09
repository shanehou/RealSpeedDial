import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from '../../tests/setup';
import { loadSettings, saveSettings } from './settings';
import { DEFAULT_SETTINGS } from '@/types';

beforeEach(() => { installChromeMock(); });

describe('settings', () => {
  it('returns defaults when empty', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
  it('merges patch over defaults and persists', async () => {
    const next = await saveSettings({ rootFolderId: 'abc', columns: 8 });
    expect(next.rootFolderId).toBe('abc');
    expect(next.columns).toBe(8);
    expect((await loadSettings()).rootFolderId).toBe('abc');
  });
  it('provides default language "auto" when unset', async () => {
    const s = await loadSettings();
    expect(s.language).toBe('auto');
  });
});
