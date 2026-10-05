import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useTheme } from '../hooks';
import { mapSupabaseUser } from '../services/authService';
import { getCachedProfilePicture } from '../services/profilePicture';
import { describeSession, ensureUsableSession } from '../services/session';
import { setAuthToken } from '../services/axios';
import { supabase } from '../services/supabase';
import { useAppStore, resetHydrationState } from '../store';
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
  const refreshExchangeRates = useAppStore((s) => s.refreshExchangeRates);
  const clearAllData = useAppStore((s) => s.clearAllData);
  const { isDark } = useTheme();

  // Fetch the shared exchange-rate table once, as soon as the app starts, so
  // every financial screen has converted amounts available from its first
  // frame. The service coalesces this with the per-screen requests in
  // `useMoney` and honours its own TTL, so a restart within the TTL reuses the
  // cached table and an offline start simply keeps serving it.
  useEffect(() => {
    void refreshExchangeRates();
  }, [refreshExchangeRates]);

  // True while we check whether a real Supabase session exists on cold start.
  // Prevents a flash of the login screen before we know the real auth state.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Idempotency key for this effect instance. Every auth event re-announces
    // the same account (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, plus a
    // remount under Fast Refresh), and the previous implementation re-ran the
    // whole apply + hydrate chain for each one. Tracking the id that was last
    // applied turns every repeat event into a no-op.
    let lastAppliedUserId: string | null = null;

    // Applies the signed-in user and loads their transactions. The fetch goes
    // through the store, which waits for a valid session/access token before
    // issuing the REST request.
    const applyUser = async (nextUser: User | null) => {
      if (nextUser) {
        if (nextUser.id === lastAppliedUserId) {
          if (__DEV__) {
            console.log('[auth] Auth event ignored — user already applied:', nextUser.id);
          }
          return;
        }
        lastAppliedUserId = nextUser.id;
        if (__DEV__) console.log('[auth] Authenticated user:', nextUser.id);
        // Restore the previously persisted profile picture for this account so a
        // full sign-out/sign-in keeps the same avatar on the same device.
        const cachedPicture = await getCachedProfilePicture(nextUser.id);
        if (!isMounted) return;
        if (cachedPicture) {
          nextUser = { ...nextUser, profilePicture: cachedPicture };
        }
        setUser(nextUser);
        // The store de-duplicates, so overlapping triggers cost nothing extra.
        await hydrateFromSupabase(nextUser.id);
      } else {
        if (__DEV__) console.log('[auth] No authenticated user.');
        lastAppliedUserId = null;
        resetHydrationState();
        setUser(null);
        clearAllData();
      }
    };

    // 1. Cold start. `ensureUsableSession()` serves the session from local
    //    storage with NO network request, and only spends one `refreshSession()`
    //    when the persisted token is expired or was issued in the future (the
    //    "JWT issued at future" case). The old code called `auth.getUser()` — a
    //    real GET /auth/v1/user — which raced the `onAuthStateChange`
    //    subscription below and doubled the auth calls on every launch.
    //
    //    The id and email below come from the session itself, so an unconfirmed
    //    session (right after signup) is never treated as signed in.
    ensureUsableSession()
      .then((session) => {
        if (!isMounted) return undefined;
        if (!session) {
          if (__DEV__) console.log('[auth] No usable session at startup.');
          setAuthToken(null);
          setUser(null);
          clearAllData();
          return undefined;
        }
        if (__DEV__) {
          console.log(`[auth] Session exists at startup (${describeSession(session)}).`);
        }
        setAuthToken(session.access_token);
        const sessionUser = session.user;
        if (!sessionUser) {
          console.error('[auth] Session exists but carries no user — treating as signed out.');
          setUser(null);
          clearAllData();
          return undefined;
        }
        if (__DEV__) console.log('[auth] Authenticated user exists:', sessionUser.id);
        // Confirmed-email guard: an unconfirmed session (right after signup)
        // must not be treated as signed in.
        if (!sessionUser.email_confirmed_at) {
          if (__DEV__) console.log('[auth] Session user is unconfirmed — not applying.');
          return undefined;
        }
        return applyUser(mapSupabaseUser(sessionUser));
      })
      .catch((err) => {
        console.error('[auth] Session check failed:', err);
        if (isMounted) void applyUser(null);
      })
      .finally(() => {
        if (isMounted) setIsCheckingSession(false);
      });

    // 2. A single subscription for auth changes (sign in, sign out, token
    //    refresh) that happen anywhere in the app after startup. It is
    //    unsubscribed on unmount below.
    //
    //    The callback MUST NOT `await` other Supabase calls — it runs inside
    //    the auth client's own dispatch, and awaiting there can deadlock the
    //    internal lock. Work is fired with `void` and guarded by `isMounted`.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: string, session: any) => {
        const sessionUser = session?.user;
        // Guard: signing up fires a SIGNED_IN event with an *unconfirmed*
        // session. Ignore it so routing keeps the user on the OTP screen
        // instead of racing to the tabs.
        const confirmed = Boolean(sessionUser && sessionUser.email_confirmed_at);
        if (__DEV__) console.log(`[auth] event=${event} signedIn=${confirmed}`);

        if (!isMounted) return;

        if (event === 'SIGNED_OUT') {
          console.log('[auth] Signed out — clearing transactions and goals.');
          setAuthToken(null);
          lastAppliedUserId = null;
          // Raised both by a real sign-out and by session recovery purging a
          // token the server rejected, so the next sign-in must re-hydrate.
          resetHydrationState();
          setUser(null);
          clearAllData();
          setIsCheckingSession(false);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          if (__DEV__) console.log('[auth] Session initialized.');
          if (!sessionUser) setIsCheckingSession(false);
        }

        if (!sessionUser || !confirmed) return;
        if (sessionUser.id === lastAppliedUserId) return;

        setAuthToken(session.access_token);
        void applyUser(mapSupabaseUser(sessionUser)).then(() => {
          if (isMounted) setIsCheckingSession(false);
        });
      },
    );

    if (__DEV__) console.log('[auth] Auth listener registered (1x).');

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      if (__DEV__) console.log('[auth] Auth listener unsubscribed.');
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