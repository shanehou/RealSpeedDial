import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from '../../tests/setup';
import { loadSettings, saveSettings } from './settings';
import { SETTINGS_KEY } from './constants';
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
  it('migrates legacy single-value color background into light/dark pair', async () => {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { background: { type: 'color', value: '#123456' } } });
    const s = await loadSettings();
    expect(s.background).toEqual({ type: 'color', light: '#123456', dark: '#123456' });
  });
  it('migrates the removed favicon tile style to themeColor', async () => {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { tileStyle: 'favicon' } });
    expect((await loadSettings()).tileStyle).toBe('themeColor');
  });
  it('keeps screenshot and normalizes unknown tile styles', async () => {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { tileStyle: 'screenshot' } });
    expect((await loadSettings()).tileStyle).toBe('screenshot');
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { tileStyle: 'unknown' } });
    expect((await loadSettings()).tileStyle).toBe('themeColor');
  });
});
