import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Appearance } from 'react-native';
import { ActivityIndicator, View } from 'react-native';

import { storage } from '../../services/storage';
import { useAppStore } from '../../store';

const STORE_KEY = 'fintrack-store';

interface ThemeInitializerProps {
  children: React.ReactNode;
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  // The app only supports explicit 'light' | 'dark'; 'system' falls back to 'light'
  const effectiveTheme = theme === 'dark' ? 'dark' : 'light';
  if (Platform.OS !== 'web') {
    Appearance.setColorScheme(effectiveTheme);
  } else if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
  }
}

export function ThemeInitializer({ children }: ThemeInitializerProps) {
  const [isReady, setIsReady] = useState(false);

  // Apply initial theme from storage
  useEffect(() => {
    let isMounted = true;

    async function initTheme() {
      try {
        const stored = await storage.getItem(STORE_KEY);
        let theme: 'light' | 'dark' = 'light';

        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const stateTheme = parsed?.state?.theme;
            if (stateTheme === 'dark' || stateTheme === 'light') {
              theme = stateTheme;
            }
          } catch {
            // ignore parse errors, use default
          }
        }

        if (!isMounted) return;
        applyTheme(theme);
        setIsReady(true);
      } catch {
        if (!isMounted) return;
        applyTheme('light');
        setIsReady(true);
      }
    }

    initTheme();

    return () => {
      isMounted = false;
    };
  }, []);

  // Subscribe to store theme changes and re-apply
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      if (state.theme !== prevState.theme) {
        applyTheme(state.theme);
      }
    });
    return unsubscribe;
  }, []);

  if (!isReady) {
    // Minimal loading indicator while theme initializes
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#f9fafb' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return <>{children}</>;
}