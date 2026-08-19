import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';

import { useAppStore } from '../store';
import { ThemeMode } from '../types';

/**
 * useTheme
 * Resolves the active theme from the stored preference ('light' | 'dark' |
 * 'system') and applies it so NativeWind's `dark:` variants respond.
 *
 * IMPORTANT: The app is LIGHT by default. Only an explicit 'dark' selection
 * applies the dark palette. 'system' is treated as light (system auto-follow
 * is intentionally bypassed so the OS color scheme can't unexpectedly flip
 * the whole UI on load).
 *
 * - Native (iOS/Android): Appearance.setColorScheme() forces the scheme and
 *   drives the color scheme observable NativeWind reads.
 * - Web: Appearance.setColorScheme() does not exist, so we toggle a "dark"
 *   class on the root <html> element instead (darkMode: 'class' config).
 */
export function useTheme(): { isDark: boolean; mode: ThemeMode } {
  const mode = useAppStore((s) => s.theme);

  // Dark only when the user explicitly picks 'dark'. 'light' and 'system'
  // both render the original light theme.
  const isDark = mode === 'dark';

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // 'light' and 'system' reset to follow the OS (light default); 'dark'
      // forces the dark scheme.
      Appearance.setColorScheme(isDark ? 'dark' : 'unspecified');
      return;
    }
    // Web: toggle a "dark" class on the root element. NativeWind's class-based
    // dark mode (darkMode: 'class') reacts to this class.
    const root =
      typeof document !== 'undefined' ? document.documentElement : null;
    if (!root) {
      return;
    }
    root.classList.toggle('dark', isDark);
  }, [isDark]);

  return { isDark, mode };
}
