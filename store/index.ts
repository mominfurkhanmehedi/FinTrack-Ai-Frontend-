import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { authService } from '../services/authService';
import { cacheProfilePicture, removeProfilePictureFile } from '../services/profilePicture';
import { ensureUsableSession, isAuthError, isNetworkError, recoverSession, resetSessionCache } from '../services/session';
import { supabase } from '../services/supabase';
import { storage } from '../services/storage';
import { Goal, NotificationPrefs, ThemeMode, Transaction, User } from '../types';
import { isoToday, toNumber, uid } from '../utils';

// Tracks in-flight / most-recent Supabase hydration so repeated triggers
// (React StrictMode double-effects, onAuthStateChange + explicit boot checks)
// don't fire duplicate transaction/goal requests.
let activeHydrationUserId: string | null = null;
let lastHydratedUserId: string | null = null;

/**
 * Forgets which account the store has already hydrated.
 *
 * Must be called whenever the authenticated account changes or disappears —
 * including the `SIGNED_OUT` event that session recovery raises after it purges
 * a token the server rejected. Without it, signing back into the same account
 * would hit the "already hydrated" short-circuit in `hydrateFromSupabase` and
 * show stale data instead of re-fetching.
 */
export function resetHydrationState(): void {
  activeHydrationUserId = null;
  lastHydratedUserId = null;
}

/**
 * The single read of a user's server-side data. Kept as one function so the
 * auth-error retry below re-runs *exactly* the same query — same table, same
 * `user_id` filter, same `date.desc` ordering.
 */
async function runUserDataQueries(userId: string) {
  const [txResult, goalResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false }),
    supabase.from('goals').select('*').eq('user_id', userId),
  ]);
  return { txResult, goalResult };
}

type UserDataQueries = Awaited<ReturnType<typeof runUserDataQueries>>;

/**
 * Picks the auth failure out of a query pair, if either query has one.
 *
 * Both results must be inspected: the `goals` request is a separate HTTP call
 * and is the one that actually reported "JWT issued at future", so a check that
 * only looked at `transactions` would classify the failure as "not an auth
 * problem" and skip recovery entirely.
 */
function pickAuthFailure(queries: UserDataQueries): { label: string; error: { message: string } } | null {
  if (isAuthError(queries.txResult.error)) {
    return { label: 'transactions', error: queries.txResult.error };
  }
  if (isAuthError(queries.goalResult.error)) {
    return { label: 'goals', error: queries.goalResult.error };
  }
  return null;
}

/**
 * Logs one query outcome, keeping authentication failures clearly distinct from
 * transport failures so a flaky connection is never mistaken for a bad token.
 */
function logQueryResult(label: string, error: unknown, rowCount: number): void {
  if (!error) {
    if (__DEV__) console.log(`[${label}] fetch completed: ${rowCount} row(s).`);
    return;
  }
  const message = (error as { message?: string }).message ?? String(error);
  if (isNetworkError(error)) {
    console.warn(`[${label}] network error (not an auth problem):`, message);
    return;
  }
  console.error(`[${label}] fetch error:`, message);
}

/**
 * Global app state via Zustand.
 * Persists onboarding + auth to platform storage (AsyncStorage on native,
 * localStorage on web) so routing decisions survive restarts (and doubles as an
 * offline cache for transactions/goals).
 * When a user is signed in, transactions/goals are also synced to Supabase:
 * every write updates local state immediately (optimistic), then fires the
 * matching Supabase call in the background.
 */
interface AppState {
  user: User | null;
  hasOnboarded: boolean;
  transactions: Transaction[];
  goals: Goal[];

  // Preferences
  theme: ThemeMode;
  currency: string;
  language: string;
  notifications: NotificationPrefs;
  /**
   * Safety/emergency buffer reserved by Safe-to-Spend. `null` (default) means
   * "auto": derived from the user's observed daily spending pace.
   */
  emergencyBuffer: number | null;

  // Data load state (Supabase hydration). Never persisted.
  /** True while transactions/goals are being fetched from Supabase. */
  isLoadingData: boolean;
  /** Human-readable message when the last hydration failed, else null. */
  dataLoadError: string | null;

  // Auth
  setUser: (user: User | null) => void;
  finishOnboarding: () => void;
  updateUser: (patch: Partial<User>) => void;
  /** Sets (or clears) the signed-in user's profile picture and caches it per-user. */
  setProfilePicture: (picture: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ ok: boolean; error?: string }>;

  // Preferences
  setTheme: (theme: ThemeMode) => void;
  setCurrency: (currency: string) => void;
  setLanguage: (language: string) => void;
  setNotifications: (prefs: Partial<NotificationPrefs>) => void;
  setEmergencyBuffer: (buffer: number | null) => void;

  // Transactions
  addTransaction: (input: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string) => void;

  // Goals
  addGoal: (input: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void;
  deleteGoal: (id: string) => void;

  // Data utilities
  resetDemoData: () => void;
  clearAllData: () => void;

  // Supabase sync
  /**
   * Fetches this user's real transactions/goals from Supabase and replaces
   * local state. Pass `force` to re-fetch even when the data was already
   * hydrated (used by the manual "refresh" action on Insights).
   */
  hydrateFromSupabase: (userId?: string, force?: boolean) => Promise<void>;
}

const seededTransactions: Transaction[] = [
  { id: 'tx-1', title: 'Salary', amount: 3200, type: 'income', category: 'Salary', date: isoToday(2) },
  { id: 'tx-2', title: 'Rent', amount: 1200, type: 'expense', category: 'Housing', date: isoToday(3) },
  { id: 'tx-3', title: 'Groceries', amount: 186.4, type: 'expense', category: 'Food', date: isoToday(5) },
  { id: 'tx-4', title: 'Freelance project', amount: 500, type: 'income', category: 'Freelance', date: isoToday(6) },
  { id: 'tx-5', title: 'Transport', amount: 64.2, type: 'expense', category: 'Transport', date: isoToday(8) },
  { id: 'tx-6', title: 'Dining out', amount: 47.9, type: 'expense', category: 'Food', date: isoToday(10) },
  { id: 'tx-7', title: 'Utilities', amount: 95.5, type: 'expense', category: 'Utilities', date: isoToday(12) },
];

const seededGoals: Goal[] = [
  { id: 'goal-1', title: 'Emergency fund', target: 5000, saved: 2150 },
  { id: 'goal-2', title: 'Vacation', target: 1500, saved: 940 },
  { id: 'goal-3', title: 'New laptop', target: 1200, saved: 1200 },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      hasOnboarded: false,
      transactions: [],
      goals: [],

      theme: 'light',
      currency: 'USD',
      language: 'en',
      notifications: {
        transactionAlerts: true,
        budgetLimitWarnings: true,
        weeklySummary: false,
        goalReminders: true,
      },
      emergencyBuffer: null,
      isLoadingData: false,
      dataLoadError: null,

      setUser: (user) => set({ user }),
      finishOnboarding: () => set({ hasOnboarded: true }),
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      setProfilePicture: async (picture) => {
        const previousPicture = get().user?.profilePicture;
        set((s) => ({
          user: s.user ? { ...s.user, profilePicture: picture ?? undefined } : s.user,
        }));
        const userId = get().user?.id;
        if (userId) {
          await cacheProfilePicture(userId, picture);
        }
        if (previousPicture && previousPicture !== picture) {
          await removeProfilePictureFile(previousPicture);
        }
      },
      signOut: async () => {
        await authService.signOut();
        console.log('[auth] Signed out — clearing transactions and goals.');
        lastHydratedUserId = null;
        activeHydrationUserId = null;
        // Forgetting the guard lets the same account recover normally next time.
        resetSessionCache({ forgetRecoveryGuard: true });
        set({ user: null, transactions: [], goals: [], isLoadingData: false, dataLoadError: null });
      },
      deleteAccount: async () => {
        const userId = get().user?.id;
        const result = await authService.deleteAccount();
        if (!result.ok) {
          return result;
        }
        await authService.signOut();
        lastHydratedUserId = null;
        activeHydrationUserId = null;
        resetSessionCache({ forgetRecoveryGuard: true });
        // Remove the per-user picture cache for this account.
        if (userId) {
          await cacheProfilePicture(userId, null);
        }
        set({
          user: null,
          transactions: [],
          goals: [],
          isLoadingData: false,
          dataLoadError: null,
        });
        return { ok: true };
      },

      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setLanguage: (language) => set({ language }),
      setNotifications: (prefs) =>
        set((s) => ({ notifications: { ...s.notifications, ...prefs } })),
      setEmergencyBuffer: (buffer) => set({ emergencyBuffer: buffer }),

      addTransaction: (input) => {
        const tempId = uid('tx');
        set((s) => ({ transactions: [{ ...input, id: tempId }, ...s.transactions] }));

        const userId = get().user?.id;
        if (!userId) return; // not signed in (e.g. demo mode) — local only

        supabase
          .from('transactions')
          .insert({
            user_id: userId,
            title: input.title,
            amount: input.amount,
            type: input.type,
            category: input.category,
            date: input.date,
          })
          .select()
          .single()
          .then(({ data, error }: { data: any; error: any }) => {
            if (error || !data) {
              console.error('[addTransaction] supabase error:', error?.message);
              set((s) => ({ transactions: s.transactions.filter((t) => t.id !== tempId) }));
              return;
            }
            // Swap the optimistic temp id for the real Supabase-generated id.
            set((s) => ({
              transactions: s.transactions.map((t) => (t.id === tempId ? { ...t, id: data.id } : t)),
            }));
          });
      },

      updateTransaction: (id, patch) => {
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));

        const userId = get().user?.id;
        if (!userId) return;

        supabase
          .from('transactions')
          .update(patch)
          .eq('id', id)
          .eq('user_id', userId)
          .then(({ error }: { error: any }) => {
            if (error) console.error('[updateTransaction] supabase error:', error.message);
          });
      },

      deleteTransaction: (id) => {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));

        const userId = get().user?.id;
        if (!userId) return;

        supabase
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
          .then(({ error }: { error: any }) => {
            if (error) console.error('[deleteTransaction] supabase error:', error.message);
          });
      },

      addGoal: (input) => {
        const tempId = uid('goal');
        set((s) => ({ goals: [...s.goals, { ...input, id: tempId }] }));

        const userId = get().user?.id;
        if (!userId) return;

        supabase
          .from('goals')
          .insert({
            user_id: userId,
            title: input.title,
            target: input.target,
            saved: input.saved,
            deadline: input.deadline ?? null,
          })
          .select()
          .single()
          .then(({ data, error }: { data: any; error: any }) => {
            if (error || !data) {
              console.error('[addGoal] supabase error:', error?.message);
              set((s) => ({ goals: s.goals.filter((g) => g.id !== tempId) }));
              return;
            }
            set((s) => ({
              goals: s.goals.map((g) => (g.id === tempId ? { ...g, id: data.id } : g)),
            }));
          });
      },

      updateGoal: (id, patch) => {
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));

        const userId = get().user?.id;
        if (!userId) return;

        supabase
          .from('goals')
          .update(patch)
          .eq('id', id)
          .eq('user_id', userId)
          .then(({ error }: { error: any }) => {
            if (error) console.error('[updateGoal] supabase error:', error.message);
          });
      },

      deleteGoal: (id) => {
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));

        const userId = get().user?.id;
        if (!userId) return;

        supabase
          .from('goals')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
          .then(({ error }: { error: any }) => {
            if (error) console.error('[deleteGoal] supabase error:', error.message);
          });
      },

      resetDemoData: () => set({ transactions: seededTransactions, goals: seededGoals }),
      clearAllData: () => set({ transactions: [], goals: [] }),

      hydrateFromSupabase: async (userId?: string, force = false) => {
        // 1. Resolve a session that is safe to send, escalating to a single
        //    token refresh if the persisted one is expired or was issued in the
        //    future. `ensureUsableSession()` is coalesced, so concurrent triggers
        //    (React StrictMode, `onAuthStateChange`, the boot check, the manual
        //    refresh button) cost at most one refresh between them — and on the
        //    happy path none at all, because the local read is free.
        //
        //    The id always comes from the session, never from the `userId`
        //    argument and never hardcoded, so a query can never be scoped to
        //    the wrong account.
        const session = await ensureUsableSession(userId);
        const authedUserId = session?.user?.id ?? null;
        if (!authedUserId) {
          // Either genuinely signed out, or recovery failed — which purges the
          // persisted session and fires SIGNED_OUT, so the app lands on the
          // signed-out state instead of replaying a token the server rejects.
          console.error('[auth] Transaction fetch skipped — no usable authenticated session.');
          set({
            isLoadingData: false,
            dataLoadError: 'Your session could not be verified. Please sign in again.',
          });
          return;
        }
        if (__DEV__) console.log('[auth] Authenticated user id:', authedUserId);

        // 2. De-duplicate BEFORE any database request goes out.
        //    `force` bypasses only the "already hydrated" short-circuit; an
        //    in-flight hydration is still never duplicated, which keeps a
        //    double-tapped refresh button from firing two REST calls.
        if (activeHydrationUserId === authedUserId) {
          if (__DEV__) {
            console.log('[transactions] Fetch skipped — a request is already running.');
          }
          return;
        }
        if (!force && lastHydratedUserId === authedUserId) {
          if (__DEV__) console.log('[transactions] Fetch skipped — already hydrated.');
          return;
        }

        activeHydrationUserId = authedUserId;
        set({ isLoadingData: true, dataLoadError: null });
        if (__DEV__) console.log('[transactions] Fetch started for user', authedUserId);
        try {
          let queries = await runUserDataQueries(authedUserId);

          // 3. One safe retry. If the server rejected the token, refresh it once
          //    and re-run the *identical* query. This is deliberately not a
          //    loop: `recoverSession()` coalesces concurrent failures into one
          //    refresh, caps itself at one attempt per user per app run, and
          //    purges the persisted session if the fresh token is rejected too.
          //
          //    BOTH results are inspected. Checking only `transactions` meant a
          //    goals-only failure (the "JWT issued at future" the console was
          //    showing) never reached this branch and was re-issued unchanged on
          //    every subsequent hydration.
          const authFailure = pickAuthFailure(queries);
          if (authFailure) {
            console.warn(
              `[${authFailure.label}] auth error on fetch — refreshing session and retrying once:`,
              authFailure.error.message,
            );
            const recovered = await recoverSession(authedUserId);
            if (recovered.ok && recovered.session.user?.id === authedUserId) {
              if (__DEV__) console.log('[auth] Retrying queries with the refreshed token.');
              queries = await runUserDataQueries(authedUserId);
            } else {
              console.error(
                `[auth] Token refresh did not yield a usable session (${
                  recovered.ok ? 'wrong user' : recovered.reason
                }) — not retrying.`,
              );
            }
          }

          const { txResult, goalResult } = queries;
          logQueryResult('transactions', txResult.error, txResult.data?.length ?? 0);
          logQueryResult('goals', goalResult.error, goalResult.data?.length ?? 0);

          // Classify the outcome. Auth and network failures get different
          // messages and different follow-ups: an auth failure that survived the
          // retry means the session is unusable, while a network failure says
          // nothing about the session and must not tear the user out.
          const authRejected = pickAuthFailure(queries) !== null;
          const networkFailed = isNetworkError(txResult.error) || isNetworkError(goalResult.error);
          const failed = Boolean(txResult.error) || authRejected;

          set({
            transactions: (txResult.data ?? []).map((t: any) => ({
              id: t.id,
              title: t.title,
              amount: toNumber(t.amount),
              type: t.type,
              category: t.category,
              date: t.date,
            })),
            goals: (goalResult.data ?? []).map((g: any) => ({
              id: g.id,
              title: g.title,
              target: toNumber(g.target),
              saved: toNumber(g.saved),
              deadline: g.deadline ?? undefined,
            })),
            isLoadingData: false,
            dataLoadError: failed
              ? authRejected
                ? 'Your session could not be verified. Please sign in again.'
                : networkFailed
                  ? 'You appear to be offline. Check your connection and try again.'
                  : 'Your data could not be loaded. Please try again.'
              : null,
          });

          // Mark as hydrated only after a successful load, so a failed attempt
          // is genuinely retried on the next trigger rather than being
          // short-circuited by the de-duplication check above.
          if (!failed) {
            lastHydratedUserId = authedUserId;
          }
        } catch (e) {
          console.error('[hydrateFromSupabase] failed:', e);
          set({ isLoadingData: false, dataLoadError: 'Something went wrong loading your data. Please try again.' });
        } finally {
          activeHydrationUserId = null;
        }
      },
    }),
    {
      name: 'fintrack-store',
      // Platform-safe adapter (AsyncStorage on native, localStorage in a
      // browser, no-op during Expo Router server rendering) rather than
      // AsyncStorage directly, whose web build dereferences `window`.
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({
        user: s.user,
        hasOnboarded: s.hasOnboarded,
        transactions: s.transactions,
        goals: s.goals,
        theme: s.theme,
        currency: s.currency,
        language: s.language,
        notifications: s.notifications,
        emergencyBuffer: s.emergencyBuffer,
      }),
      // Normalize persisted preferences from older app versions: dropped
      // languages (es/fr/de) fall back to 'en', and removed 'system' theme
      // falls back to 'light' (the app's default). Mirrors the default zustand
      // shallow merge otherwise.
      merge: (persisted, current) => {
        const merged = {
          ...(current as AppState),
          ...((persisted ?? {}) as Partial<AppState>),
        } as AppState;
        const isSupportedLanguage = (code: unknown): boolean =>
          typeof code === 'string' && ['en', 'hi', 'kn', 'mr', 'te'].includes(code);
        return {
          ...merged,
          language: isSupportedLanguage(merged.language) ? merged.language : 'en',
          theme: merged.theme === 'dark' ? 'dark' : 'light',
        };
      },
    },
  ),
);