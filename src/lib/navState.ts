import { NAV_STATE_KEY } from './constants';
import type { NavState } from '@/types';

export async function loadNavState(): Promise<NavState | null> {
  const got = await chrome.storage.local.get(NAV_STATE_KEY);
  return (got[NAV_STATE_KEY] as NavState) ?? null;
}

export async function saveNavState(state: NavState): Promise<void> {
  await chrome.storage.local.set({ [NAV_STATE_KEY]: state });
}
