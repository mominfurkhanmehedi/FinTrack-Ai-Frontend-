import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useTheme } from '../hooks';
import { useAppStore } from '../store';

/**
 * Root layout.
 * Imports global.css for NativeWind and decides whether to show the auth stack
 * or the main tabs based on store state (signed-in user).
 */
export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const user = useAppStore((s) => s.user);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const { isDark } = useTheme();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace(hasOnboarded ? '/login' : '/landing');
    } else if (user && inAuthGroup) {
      router.replace('/dashboard');
    }
  }, [user, hasOnboarded, segments, router]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(settings)" />
      </Stack>
    </>
  );
}
