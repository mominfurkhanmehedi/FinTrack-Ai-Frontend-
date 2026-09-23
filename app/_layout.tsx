import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useTheme } from '../hooks';
import { authService, mapSupabaseUser } from '../services/authService';
import { supabase } from '../services/supabase';
import { useAppStore } from '../store';
import { User } from '../types';

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
  const clearAllData = useAppStore((s) => s.clearAllData);
  const { isDark } = useTheme();

  // True while we check whether a real Supabase session exists on cold start.
  // Prevents a flash of the login screen before we know the real auth state.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Applies the signed-in user and loads their transactions (only after the
    // session/token has been validated so the fetch carries a valid JWT).
    const applyUser = async (nextUser: User | null) => {
      if (nextUser) {
        console.log('[auth] Authenticated user:', nextUser.id);
        setUser(nextUser);
        await hydrateFromSupabase(nextUser.id);
      } else {
        console.log('[auth] No authenticated user.');
        setUser(null);
        clearAllData();
      }
    };

    // 1. Validate any persisted session on cold start. `auth.getUser()` checks
    //    the token against Supabase and refreshes it if expired — a plain
    //    `getSession()` only returns the stored JWT, which can be stale and
    //    cause 401s on the first transactions request.
    authService
      .getCurrentUser()
      .then((sessionUser) => {
        if (isMounted) return applyUser(sessionUser);
      })
      .catch((err) => {
        console.error('[auth] Session check failed:', err);
        if (isMounted) applyUser(null);
      })
      .finally(() => {
        if (isMounted) setIsCheckingSession(false);
      });

    // 2. Keep listening for auth changes (sign in, sign out, token refresh)
    //    that happen anywhere in the app after startup. `hydrateFromSupabase`
    //    de-duplicates, so overlap with the boot check causes no extra fetches.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        const sessionUser = session?.user;
        // Guard: signing up fires a SIGNED_IN event with an *unconfirmed*
        // session. Ignore it so routing keeps the user on the OTP screen
        // instead of racing to the tabs.
        const confirmed = Boolean(sessionUser && sessionUser.email_confirmed_at);
        console.log(`[auth] event=${event} signedIn=${confirmed}`);
        if (confirmed && isMounted) {
          await applyUser(mapSupabaseUser(sessionUser));
        } else if (event === 'SIGNED_OUT' && isMounted) {
          console.log('[auth] Signed out — clearing transactions and goals.');
          setUser(null);
          clearAllData();
        }
      },
    );

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