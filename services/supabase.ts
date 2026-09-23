import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client singleton.
 * Uses AsyncStorage for session persistence (same storage the Zustand store
 * already uses), so auth survives app restarts on both web and native.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const authStorage = {
  getItem: (key: string) => (typeof window === 'undefined' ? null : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) =>
    typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.removeItem(key),
};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});