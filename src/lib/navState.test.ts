import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from '../../tests/setup';
import { loadNavState, saveNavState } from './navState';

beforeEach(() => { installChromeMock(); });

describe('navState', () => {
  it('returns null when empty', async () => {
    expect(await loadNavState()).toBeNull();
  });
  it('saves and loads', async () => {
    await saveNavState({ currentFolderId: 'f', selectedTabId: '__home__' });
    expect(await loadNavState()).toEqual({ currentFolderId: 'f', selectedTabId: '__home__' });
  });
});
