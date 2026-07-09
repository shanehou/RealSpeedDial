import type { Settings } from '@/types';

export function resolveTheme(theme: Settings['theme'], prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}
