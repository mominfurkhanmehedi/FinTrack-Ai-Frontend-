import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { storage } from './storage';

/**
 * Supabase client singleton.
 *
 * Session persistence goes through `services/storage`, which is platform-aware:
 * AsyncStorage on iOS/Android and `localStorage` in a browser, with a no-op
 * while Expo Router renders the app on the server. The previous version passed
 * `AsyncStorage` directly; on web that import resolves to a `window.localStorage`
 * shim with no guard, so the auth client's very first storage read during server
 * rendering threw `ReferenceError: window is not defined` and crashed the whole
 * route tree. See `services/storage.ts` for the details.
 *
 * This module is still evaluated on the server — the client is still created
 * once, server-side, from the same `EXPO_PUBLIC_*` variables — so the module
 * shape stays identical between SSR and CSR and hydration does not mismatch.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.',
  );
}

type SupabaseClientType = SupabaseClient;

/**
 * The client is cached on `globalThis` so that Fast Refresh / HMR re-evaluating
 * this module cannot construct a second client. A second client would own a
 * second in-memory session, a second auto-refresh timer and a second
 * `onAuthStateChange` emitter, which is a direct source of the duplicated auth
 * traffic this module exists to prevent.
 */
const globalScope = globalThis as typeof globalThis & {
  __fintrackSupabaseClient?: SupabaseClientType;
};

/**
 * Incremented every time a client is actually constructed. A value above 1
 * means a second client exists, which is always a bug (see below) and is
 * surfaced in dev so it cannot go unnoticed.
 */
let constructionCount = 0;

function createSupabaseClient(): SupabaseClientType {
  constructionCount += 1;
  if (constructionCount > 1 && __DEV__) {
    console.error(
      `[supabase] A ${constructionCount}th Supabase client was constructed. ` +
        'This app must use exactly one client — duplicate clients each own a ' +
        'separate in-memory session and refresh timer.',
    );
  }
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

const existing = globalScope.__fintrackSupabaseClient;

if (__DEV__) {
  console.log(
    existing
      ? '[supabase] Reusing existing client singleton (no duplicate created).'
      : '[supabase] Client singleton created.',
  );
  console.log(`[supabase] Project: ${supabaseUrl}`);
}

export const supabase: SupabaseClientType = existing ?? createSupabaseClient();

if (!existing) {
  globalScope.__fintrackSupabaseClient = supabase;
}

/**
 * The one and only Supabase client.
 *
 * Every module must reach the database through this (or the `supabase` export
 * above) rather than calling `createClient` itself, so that there is exactly
 * one session, one auto-refresh timer and one `onAuthStateChange` emitter.
 * Two clients would mean two in-memory copies of the session, which is a
 * direct source of a request being sent with a token the other client has
 * already replaced.
 */
export function getSupabase(): SupabaseClientType {
  return globalScope.__fintrackSupabaseClient ?? supabase;
}
