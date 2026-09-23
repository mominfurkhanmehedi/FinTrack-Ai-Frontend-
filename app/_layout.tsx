import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useTheme } from '../hooks';
import { mapSupabaseUser } from '../services/authService';
import { supabase } from '../services/supabase';
import { useAppStore } from '../store';

/**
 * Root layout.
 * Imports global.css for NativeWind, checks for a real Supabase session on
 * startup, and decides whether to show the auth stack or the main tabs based
 * on store state (signed-in user).
 */
export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const hydrateFromSupabase = useAppStore((s) => s.hydrateFromSupabase);
  const { isDark } = useTheme();

  // True while we check whether a real Supabase session exists on cold start.
  // Prevents a flash of the login screen before we know the real auth state.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 1. Check for an existing session immediately on app start.
    supabase.auth.getSession().then(({ data }: { data: any }) => {
      if (!isMounted) return;
      const sessionUser = data.session?.user;
      // Only treat the session as authenticated when the email is actually
      // confirmed. An unconfirmed session (right after signup) must NOT be
      // routed to the tabs — it belongs on the OTP verification screen.
      if (sessionUser && sessionUser.email_confirmed_at) {
        setUser(mapSupabaseUser(sessionUser));
        hydrateFromSupabase(sessionUser.id);
      }
      setIsCheckingSession(false);
    });

    // 2. Keep listening for auth changes (sign in, sign out, token refresh)
    // that happen anywhere in the app after startup.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      const sessionUser = session?.user;
      // Same guard as above: signing up fires a SIGNED_IN event with an
      // *unconfirmed* session. Ignore it so routing keeps the user on the OTP
      // screen instead of racing to the tabs.
      if (sessionUser && sessionUser.email_confirmed_at) {
        setUser(mapSupabaseUser(sessionUser));
        hydrateFromSupabase(sessionUser.id);
      } else {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isCheckingSession) return; // don't redirect until we know the real session state

    // `user` is only ever set for a *confirmed* email, so this routing logic
    // never treats an unconfirmed session (right after signup) as signed in.
    const inAuthGroup = segments[0] === '(auth)';
    const inVerifyOtp = segments[1] === 'verify-otp';

    if (!user && !inAuthGroup) {
      router.replace('/landing');
    } else if (user && inAuthGroup && !inVerifyOtp) {
      router.replace('/dashboard');
    }
  }, [user, segments, router, isCheckingSession]);

  if (isCheckingSession) {
    // Keep this minimal — swap for a branded splash view if you have one.
    return null;
  }

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