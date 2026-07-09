import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../../../tests/setup';
import { NAV_STATE_KEY } from '@/lib/constants';
import { loadNavState } from '@/lib/navState';
import { useNavState } from './useNavState';
import type { NavState } from '@/types';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); });

describe('useNavState', () => {
  it('enabled: loads saved state, becomes ready, and persists changes', async () => {
    const seed: NavState = { currentFolderId: 'f1', selectedTabId: 't1' };
    await c.storage.local.set({ [NAV_STATE_KEY]: seed });

    const { result } = renderHook(() => useNavState(true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.navState).toEqual(seed);

    const next: NavState = { currentFolderId: 'f2', selectedTabId: 't2' };
    act(() => { result.current.persist(next); });
    await waitFor(() => expect(result.current.navState).toEqual(next));

    expect(c.storage.local.set).toHaveBeenCalledWith({ [NAV_STATE_KEY]: next });
    expect(await loadNavState()).toEqual(next);
  });

  it('disabled: skips loading, still becomes ready, and persist stays in-memory only', async () => {
    const seed: NavState = { currentFolderId: 'f1', selectedTabId: 't1' };
    await c.storage.local.set({ [NAV_STATE_KEY]: seed });

    const { result } = renderHook(() => useNavState(false));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.navState).toBeNull();

    const next: NavState = { currentFolderId: 'f2', selectedTabId: 't2' };
    act(() => { result.current.persist(next); });
    await waitFor(() => expect(result.current.navState).toEqual(next));

    expect(c.storage.local.set).not.toHaveBeenCalledWith({ [NAV_STATE_KEY]: next });
    expect(await loadNavState()).toEqual(seed);
  });
});
