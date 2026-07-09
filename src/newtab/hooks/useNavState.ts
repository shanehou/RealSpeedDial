import { useCallback, useEffect, useState } from 'react';
import { loadNavState, saveNavState } from '@/lib/navState';
import type { NavState } from '@/types';

export function useNavState(enabled: boolean) {
  const [navState, setNavStateInternal] = useState<NavState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) { setReady(true); return; }
    void loadNavState().then((s) => { setNavStateInternal(s); setReady(true); });
  }, [enabled]);

  const persist = useCallback((s: NavState) => {
    setNavStateInternal(s);
    if (enabled) void saveNavState(s);
  }, [enabled]);

  return { navState, persist, ready };
}
