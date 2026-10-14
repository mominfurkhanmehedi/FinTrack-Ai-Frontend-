import { AuthResult, User } from '../types';
import { resetSessionCache } from './session';
import { supabase } from './supabase';
import { api } from './axios';

/**
 * Supabase-backed auth service.
 * Same AuthResult contract as the old mock version, so nothing that calls
 * authService (login/signup screens, the store) needs to change.
 */

/**
 * A successful sign-in starts a brand-new session, so any "this user's cached
 * token is broken and we already tried recovering it" note from the previous
 * session must be forgotten — otherwise the account could never recover again
 * until a full app restart.
 */
function onNewSession(): void {
  resetSessionCache({ forgetRecoveryGuard: true });
}

function toUser(supaUser: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: any;
}): User {
  return {
    id: supaUser.id,
    name: supaUser.user_metadata?.name ?? supaUser.email?.split('@')[0] ?? 'User',
    email: supaUser.email ?? '',
    avatar: supaUser.user_metadata?.avatar,
  };
}

/** Maps a Supabase session user to the app's User shape (used by app/_layout.tsx). */
export function mapSupabaseUser(supaUser: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: any;
}): User {
  return toUser(supaUser);
}

export const authService = {
  async login(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? 'Invalid email or password.' };
    }
    onNewSession();
    return { ok: true, user: toUser(data.user) };
  },

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } },
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? 'Could not create account.' };
    }
    // With email confirmation enabled, signUp returns session:null and the
    // user isn't confirmed yet. Treat that as "pending" — the caller must
    // route to the OTP verification screen, not treat the user as signed in.
    const confirmed = Boolean(data.session && data.user.email_confirmed_at);
    if (!confirmed) {
      return { ok: true, needsEmailConfirmation: true };
    }
    return { ok: true, user: toUser(data.user) };
  },

  /** Verifies the 6-digit email confirmation code from signup. Starts a real session on success. */
  async verifySignupOtp(email: string, token: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? 'Invalid or expired code.' };
    }
    onNewSession();
    return { ok: true, user: toUser(data.user) };
  },

  /** Re-sends the 6-digit email confirmation code for a pending signup. */
  async resendSignupOtp(email: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  async sendResetLink(email: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    resetSessionCache({ forgetRecoveryGuard: true });
  },

  /**
   * Resolves the current session's user via `auth.getUser()` (a validating,
   * network-backed call).
   *
   * Deliberately NOT used on app startup: it costs a `/auth/v1/user` round
   * trip, and calling it alongside `onAuthStateChange` multiplied the auth
   * traffic on every launch. Startup uses `services/session.ts` instead, which
   * serves the session locally and only refreshes the token when it is close
   * to expiry. Keep this for explicit, user-initiated flows.
   */
  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      console.warn('[auth] getCurrentUser: no valid session.', error?.message ?? 'no user');
      return null;
    }
    return toUser(data.user);
  },

  /** Delete user account and all associated data. */
  async deleteAccount(): Promise<{ ok: boolean; error?: string }> {
    try {
      // Get current user (validates the token too).
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        console.error('[deleteAccount] no active session:', userError?.message ?? 'no user');
        return { ok: false, error: 'No active session.' };
      }

      const userId = userData.user.id;

      // Delete all user transactions
      const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId);

      if (txError) {
        console.error('[deleteAccount] Failed to delete transactions:', txError.message);
        return { ok: false, error: 'Failed to delete transactions.' };
      }

      // Delete all user goals
      const { error: goalError } = await supabase
        .from('goals')
        .delete()
        .eq('user_id', userId);

      if (goalError) {
        console.error('[deleteAccount] Failed to delete goals:', goalError.message);
        return { ok: false, error: 'Failed to delete goals.' };
      }

      return { ok: true };
    } catch (error) {
      console.error('[deleteAccount] Error:', error);
      return { ok: false, error: 'An error occurred while deleting your account.' };
    }
  },

  /** Clear all application data for the current user (keeps the account). */
  async clearAllData(): Promise<{ ok: boolean; error?: string }> {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        console.error('[clearAllData] no active session:', userError?.message ?? 'no user');
        return { ok: false, error: 'No active session.' };
      }

      const { error } = await supabase.rpc('clear_user_data');
      if (error) {
        console.error('[clearAllData] RPC failed:', error.message);
        return { ok: false, error: 'Failed to clear data on server.' };
      }

      return { ok: true };
    } catch (error) {
      console.error('[clearAllData] Error:', error);
      return { ok: false, error: 'An error occurred while clearing your data.' };
    }
  },

  /** Seed default categories for the current user (after clear_all_data). */
  async seedDefaultCategories(): Promise<{ ok: boolean; error?: string }> {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        console.error('[seedDefaultCategories] no active session:', userError?.message ?? 'no user');
        return { ok: false, error: 'No active session.' };
      }

      await api.post('/categories/seed');
      return { ok: true };
    } catch (error) {
      console.error('[seedDefaultCategories] Error:', error);
      return { ok: false, error: 'An error occurred while seeding categories.' };
    }
  },
};
