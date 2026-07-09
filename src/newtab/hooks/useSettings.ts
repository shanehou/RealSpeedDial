import { useCallback, useEffect, useState } from 'react';
import { loadSettings, saveSettings, onSettingsChanged } from '@/lib/settings';
import type { Settings } from '@/types';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { void loadSettings().then(setSettings); }, []);
  useEffect(() => onSettingsChanged(setSettings), []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await saveSettings(patch));
  }, []);

  return { settings, update };
}
