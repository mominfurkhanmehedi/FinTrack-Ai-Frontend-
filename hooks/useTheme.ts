import { useAppStore } from '../store';
import { ThemeMode } from '../types';

/**
 * useTheme
 * Resolves the active theme from the stored preference ('light' | 'dark').
 * Does NOT apply the theme — ThemeInitializer is the single source of truth
 * for applying theme via Appearance.setColorScheme / document.documentElement.
 */
export function useTheme(): { isDark: boolean; mode: ThemeMode } {
  const mode = useAppStore((s) => s.theme);

  // Dark only when the user explicitly picks 'dark'; 'light' renders light.
  const isDark = mode === 'dark';

  return { isDark, mode };
}
