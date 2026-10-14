import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { authService } from '../services/authService';
import { loadCurrencyForUser, removeCurrencyForUser, saveCurrencyForUser } from '../services/currencyPreference';
import {
  ensureExchangeRates,
  getExchangeRates,
  getRateTable,
  getRatesStatus,
  hydrateCachedExchangeRates,
  subscribeExchangeRates,
  type RatesStatus,
} from '../services/exchangeRates';
import { cacheProfilePicture, removeProfilePictureFile } from '../services/profilePicture';
import { ensureUsableSession, isAuthError, isNetworkError, recoverSession, resetSessionCache } from '../services/session';
import { setAuthToken } from '../services/axios';
import { supabase } from '../services/supabase';
import { storage } from '../services/storage';
import { Budget, Goal, NotificationPrefs, ThemeMode, Transaction, User } from '../types';import {
  BASE_CURRENCY,
  RateTable,
  isoToday,
  isSupportedCurrency,
  planCurrencyChange,
  reconcileCurrencyFromRecords,
  recordCurrency,
  roundForCurrency,
  toNumber,
  uid,
} from '../utils';

/**
 * Normalize a date string to ISO YYYY-MM-DD format.
 * Accepts DD/MM/YYYY, D/M/YYYY, or YYYY-MM-DD.
 * Returns the input unchanged if already ISO, or undefined if invalid.
 */
function normalizeDate(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year)) {
      if (month >= 1 && month <= 12 && year >= 1000 && year <= 9999) {
        const daysInMonth = new Date(year, month, 0).getDate();
        if (day >= 1 && day <= daysInMonth) {
          const mm = String(month).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          return `${year}-${mm}-${dd}`;
        }
      }
    }
  }
  return undefined;
}

// Tracks in-flight / most-recent Supabase hydration so repeated triggers
// (React StrictMode double-effects, onAuthStateChange + explicit boot checks)
// don't fire duplicate transaction/goal requests.
let activeHydrationUserId: string | null = null;
let lastHydratedUserId: string | null = null;

/**
 * Guards against a second currency change starting while one is still running.
 *
 * A currency change reads the current currency, converts, writes, and then moves
 * the preference. Two overlapping changes would both read the SAME starting
 * currency and the second would convert already-converted data, so the store
 * serializes them here and the UI simply reports the change as busy.
 */
let activeCurrencyChange: Promise<CurrencyChangeResult> | null = null;

/**
 * Forgets which account the store has already hydrated.
 *
 * Must be called whenever the authenticated account changes or disappears ΓÇö
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
 * auth-error retry below re-runs *exactly* the same query ΓÇö same table, same
 * `user_id` filter, same `date.desc` ordering.
 */
async function runUserDataQueries(userId: string) {
  const [txResult, goalResult, budgetResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false }),
    supabase.from('goals').select('*').eq('user_id', userId),
    supabase.from('budgets').select('*').eq('user_id', userId),
  ]);
  return { txResult, goalResult, budgetResult };
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
  if (isAuthError(queries.budgetResult.error)) {
    return { label: 'budgets', error: queries.budgetResult.error };
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
 * Outcome of a currency change.
 *
 * `ok: false` means NOTHING was changed: the preference still points at the
 * previous currency, the stored amounts are untouched, and `error` explains why
 * so the UI can tell the user instead of silently doing nothing.
 */
export interface CurrencyChangeResult {
  ok: boolean;
  /** The currency amounts are now denominated in. Unchanged when `ok` is false. */
  currency: string;
  /** Why the change was refused. */
  error?: CurrencyChangeError | 'busy' | 'persist-failed';
  /** Number of monetary records rewritten. */
  converted?: number;
}

type CurrencyChangeError = 'unsupported' | 'same-currency' | 'no-rate' | 'invalid-amount';

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
  budgets: Budget[];

  // Preferences
  theme: ThemeMode;
  /**
   * The user's selected currency ΓÇö and the currency EVERY stored monetary value
   * is denominated in. These are deliberately the same thing: selecting a
   * different currency permanently converts the data (see `setCurrency`), so the
   * database always speaks the selected currency and the display layer never
   * converts a second time.
   */
  currency: string;
  language: string;
  notifications: NotificationPrefs;
  /**
   * Safety/emergency buffer reserved by Safe-to-Spend. `null` (default) means
   * "auto": derived from the user's observed daily spending pace.
   *
   * Stored in the selected currency and converted along with everything else
   * when that currency changes.
   */
  emergencyBuffer: number | null;

  // Exchange rates. Never persisted here ΓÇö `services/exchangeRates` owns the
  // cache (memory + storage) and mirrors it in, so there is exactly one copy
  // on disk and one fetch per app run.
  /**
   * The rate table currently in use, or `null` when no rate has ever been
   * obtained. `rates.USD` is how many dollars one `BASE_CURRENCY` unit buys.
   */
  exchangeRates: RateTable | null;
  /** Whether rates are current, cached-but-old, or entirely unavailable. */
  exchangeRatesStatus: RatesStatus;
  /** Epoch ms of the fetch the in-use table came from, or `null`. */
  exchangeRatesUpdatedAt: number | null;
  /**
   * Id of the feed the in-use table came from, or `null`. Shown in Settings so a
   * user served by a fallback provider can see it, rather than the fallback being
   * invisible. See `RATE_PROVIDER_LABELS` in `services/rateProviders`.
   */
  exchangeRatesSource: string | null;

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
  /**
   * Changes the selected currency, PERMANENTLY converting every stored monetary
   * value (transaction amounts, goal targets, savings, the safety buffer) from
   * the currency the data is currently in into `currency` first.
   *
   * The conversion always starts from the currency the records are actually
   * stored in ΓÇö never a hardcoded base ΓÇö so switching INR -> USD -> EUR converts
   * INR -> USD -> EUR and never re-converts from INR.
   *
   * Resolves with `{ ok: false }` and changes nothing if the target currency is
   * unsupported, is already selected, no exchange rate is available, or the
   * database write fails. The preference is updated only after the data has been
   * rewritten, and the store state is refreshed in the same update so the whole
   * UI re-renders in the new currency at once.
   */
  setCurrency: (currency: string) => Promise<CurrencyChangeResult>;
  setLanguage: (language: string) => void;
  setNotifications: (prefs: Partial<NotificationPrefs>) => void;
  setEmergencyBuffer: (buffer: number | null) => void;

  /**
   * Ensures a rate table is loaded, fetching it only if the cached one is
   * missing or expired. Concurrent callers share a single request.
   */
  refreshExchangeRates: (options?: { force?: boolean }) => Promise<void>;

  // Transactions
  addTransaction: (input: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string) => void;

  // Goals
  addGoal: (input: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void;
  deleteGoal: (id: string) => void;

  // Budgets
  addBudget: (input: Omit<Budget, 'id'>) => { error?: { message: string; category: string; period: string } } | void;
  updateBudget: (id: string, patch: Partial<Omit<Budget, 'id'>>) => { error?: { message: string; category: string; period: string } } | void;
  deleteBudget: (id: string) => void;

  // Data utilities
  resetDemoData: () => void;
  clearAllData: () => Promise<void>;
  clearLocalFinancialData: () => void;

  // Supabase sync
  /**
   * Fetches this user's real transactions/goals from Supabase and replaces
   * local state. Pass `force` to re-fetch even when the data was already
   * hydrated (used by the manual "refresh" action on Insights).
   */
  hydrateFromSupabase: (userId?: string, force?: boolean) => Promise<void>;
}

/**
 * Demo rows. They carry no `currency` of their own: `resetDemoData` stamps the
 * current selection, because a demo balance is denominated in whatever currency
 * the user is actually working in.
 */
const seededTransactions: Transaction[] = [
  { id: 'tx-1', title: 'Salary', amount: 3200, type: 'income', category: 'Salary', date: isoToday(2), currency: BASE_CURRENCY },
  { id: 'tx-2', title: 'Rent', amount: 1200, type: 'expense', category: 'Housing', date: isoToday(3), currency: BASE_CURRENCY },
  { id: 'tx-3', title: 'Groceries', amount: 186.4, type: 'expense', category: 'Food', date: isoToday(5), currency: BASE_CURRENCY },
  { id: 'tx-4', title: 'Freelance project', amount: 500, type: 'income', category: 'Freelance', date: isoToday(6), currency: BASE_CURRENCY },
  { id: 'tx-5', title: 'Transport', amount: 64.2, type: 'expense', category: 'Transport', date: isoToday(8), currency: BASE_CURRENCY },
  { id: 'tx-6', title: 'Dining out', amount: 47.9, type: 'expense', category: 'Food', date: isoToday(10), currency: BASE_CURRENCY },
  { id: 'tx-7', title: 'Utilities', amount: 95.5, type: 'expense', category: 'Utilities', date: isoToday(12), currency: BASE_CURRENCY },
];

const seededGoals: Goal[] = [
  { id: 'goal-1', title: 'Emergency fund', target: 5000, saved: 2150, currency: BASE_CURRENCY },
  { id: 'goal-2', title: 'Vacation', target: 1500, saved: 940, currency: BASE_CURRENCY },
  { id: 'goal-3', title: 'New laptop', target: 1200, saved: 1200, currency: BASE_CURRENCY },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      hasOnboarded: false,
transactions: [],
goals: [],
budgets: [],

      theme: 'light',
      // The selected currency IS the currency stored amounts are denominated
      // in, so the default has to be the currency existing data was written in
      // ΓÇö otherwise a restored INR balance would be labelled and rendered as
      // USD, a wrong number that looks right.
      currency: BASE_CURRENCY,
      language: 'en',
      notifications: {
        transactionAlerts: true,
        budgetLimitWarnings: true,
        weeklySummary: false,
        goalReminders: true,
      },
      emergencyBuffer: null,
      exchangeRates: null,
      exchangeRatesStatus: 'idle',
      exchangeRatesUpdatedAt: null,
      exchangeRatesSource: null,
      isLoadingData: false,
      dataLoadError: null,

      setUser: (user) => {
        set({ user });
        if (!user) return;
        // Restore this account's own currency.
        //
        // The saved preference only decides the code when there is no data to go
        // on: a brand new account has no rows, and the rows are what actually
        // state their unit. Once records are in memory they are authoritative ΓÇö
        // `hydrateFromSupabase` and the persisted-state `merge` both adopt the
        // currency the rows record, so this path never has to relabel anything.
        //
        // Guarded so a slow read can never clobber a currency the user picked in
        // the meantime, and so an unknown account keeps whatever the device was
        // last using.
        const userId = user.id;
        void loadCurrencyForUser(userId).then((saved) => {
          if (!saved) return;
          const current = get();
          if (current.user?.id !== userId) return;
          if (current.currency === saved) return;
          if (current.transactions.length === 0 && current.goals.length === 0) {
            set({ currency: saved });
            return;
          }
          // Data is already in memory, so it decides. Adopting a different code
          // here would relabel it without rescaling it; only `setCurrency` may move
          // the currency of loaded data, and it does the conversion properly.
          // Reaching this means hydration is still in flight, in which case it
          // reconciles to the rows' currency a moment later.
          console.warn(
            `[currency] Deferring saved ${saved} for ${userId} ΓÇö loaded data decides the currency (currently ${current.currency}).`,
          );
        });
      },
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
        console.log('[auth] Signed out ΓÇö clearing transactions, goals, and budgets.');
        setAuthToken(null);
        lastHydratedUserId = null;
        activeHydrationUserId = null;
        // Forgetting the guard lets the same account recover normally next time.
        resetSessionCache({ forgetRecoveryGuard: true });
        set({ user: null, transactions: [], goals: [], budgets: [], isLoadingData: false, dataLoadError: null });
      },
      deleteAccount: async () => {
        const userId = get().user?.id;
        const result = await authService.deleteAccount();
        if (!result.ok) {
          return result;
        }
        await authService.signOut();
        setAuthToken(null);
        lastHydratedUserId = null;
        activeHydrationUserId = null;
        resetSessionCache({ forgetRecoveryGuard: true });
        // Remove the per-user picture cache and display currency for this account.
        if (userId) {
          await cacheProfilePicture(userId, null);
          await removeCurrencyForUser(userId);
        }
        set({
          user: null,
          transactions: [],
          goals: [],
          budgets: [],
          isLoadingData: false,
          dataLoadError: null,
        });
        return { ok: true };
      },

      setTheme: (theme) => set({ theme }),
      setCurrency: (next) => runCurrencyChange(set, get, next),
      setLanguage: (language) => set({ language }),
      setNotifications: (prefs) =>
        set((s) => ({ notifications: { ...s.notifications, ...prefs } })),
      setEmergencyBuffer: (buffer) => set({ emergencyBuffer: buffer }),

      refreshExchangeRates: async (options = {}) => {
        await ensureExchangeRates(options);
      },

      addTransaction: (input) => {
        // New records are created in the CURRENTLY selected currency, so the
        // value the user typed is stored as-is ΓÇö no conversion on the way in.
        const currency = get().currency;
        const normalizedDate = normalizeDate(input.date) ?? input.date;
        const record = { ...input, currency, amount: roundForCurrency(input.amount, currency), date: normalizedDate };
        const tempId = uid('tx');
        set((s) => ({ transactions: [{ ...record, id: tempId }, ...s.transactions] }));

        const userId = get().user?.id;
        if (!userId) return; // not signed in (e.g. demo mode) ΓÇö local only

        supabase
          .from('transactions')
          .insert({
            user_id: userId,
            title: record.title,
            amount: record.amount,
            type: record.type,
            category: record.category,
            date: record.date,
            currency: record.currency,
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
        // An edited amount belongs to the currency the record is already in;
        // re-stamping it on every patch keeps the column truthful even when only
        // the title changed. The stamp is applied AFTER the spread so a stray
        // `currency` in the patch cannot move the record off the selected
        // currency without a conversion ΓÇö that is `setCurrency`'s job alone.
        const currency = get().currency;
        const next: Partial<Omit<Transaction, 'id'>> = { ...patch, currency };
        if (patch.amount !== undefined) next.amount = roundForCurrency(patch.amount, currency);
        if (patch.date !== undefined) next.date = normalizeDate(patch.date) ?? patch.date;
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...next } : t)),
        }));

        const userId = get().user?.id;
        if (!userId) return;

        supabase
          .from('transactions')
          .update(next)
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
        const currency = get().currency;
        const record = {
          ...input,
          currency,
          target: roundForCurrency(input.target, currency),
          saved: roundForCurrency(input.saved, currency),
        };
        const tempId = uid('goal');
        set((s) => ({ goals: [...s.goals, { ...record, id: tempId }] }));

        const userId = get().user?.id;
        if (!userId) return;

        supabase
          .from('goals')
          .insert({
            user_id: userId,
            title: record.title,
            target: record.target,
            saved: record.saved,
            deadline: record.deadline ?? null,
            currency: record.currency,
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
        // `saved` and `target` are monetary, so they are re-stamped with the
        // record's currency and rounded to that currency's minor unit. Both
        // amounts are recomputed from the stored values rather than the patch
        // alone, so a partial patch (e.g. only `saved`) never leaves the other
        // field unrounded.
        const currency = get().currency;
        const next: Partial<Omit<Goal, 'id'>> = { ...patch, currency };
        set((s) => ({
          goals: s.goals.map((g) => {
            if (g.id !== id) return g;
            const merged = { ...g, ...next };
            return {
              ...merged,
              target: roundForCurrency(merged.target, currency),
              saved: roundForCurrency(merged.saved, currency),
              currency,
            };
          }),
        }));

        const userId = get().user?.id;
        if (!userId) return;

        const stored = get().goals.find((g) => g.id === id);
        if (!stored) return;

        supabase
          .from('goals')
          .update({
            ...patch,
            target: stored.target,
            saved: stored.saved,
            currency,
          })
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

      addBudget: (input) => {
        const currency = get().currency;
        const record = {
          ...input,
          amount: roundForCurrency(input.amount, currency),
        };

        // Check for duplicate budget (same category + period) before inserting
        const existingBudget = get().budgets.find(
          (b) => b.category === record.category && b.period === record.period
        );
        if (existingBudget) {
          // Return a specific error that the UI can display
          return {
            error: {
              message: 'DUPLICATE_BUDGET',
              category: record.category,
              period: record.period,
            },
          };
        }

        const tempId = uid('budget');
        set((s) => ({ budgets: [{ ...record, id: tempId }, ...s.budgets] }));

        const userId = get().user?.id;
        if (!userId) return;

        supabase
          .from('budgets')
          .insert({
            user_id: userId,
            category: record.category,
            amount: record.amount,
            limit_amount: record.amount,
            period: record.period,
            start_date: record.startDate ?? null,
            end_date: record.endDate ?? null,
            rollover: record.rollover,
          })
          .select()
          .single()
          .then(({ data, error }: { data: any; error: any }) => {
            if (error || !data) {
              console.error('[addBudget] supabase error:', error?.message);
              set((s) => ({ budgets: s.budgets.filter((b) => b.id !== tempId) }));
              return;
            }
            set((s) => ({
              budgets: s.budgets.map((b) => (b.id === tempId ? { ...b, id: data.id } : b)),
            }));
          });
      },

      updateBudget: (id, patch) => {
        const currency = get().currency;
        const next: Partial<Omit<Budget, 'id'>> = { ...patch };
        if (patch.amount !== undefined) next.amount = roundForCurrency(patch.amount, currency);

        // Check for duplicate budget (same category + period) excluding current budget
        const checkCategory = patch.category ?? get().budgets.find((b) => b.id === id)?.category;
        const checkPeriod = patch.period ?? get().budgets.find((b) => b.id === id)?.period;
        if (checkCategory && checkPeriod) {
          const existingBudget = get().budgets.find(
            (b) => b.id !== id && b.category === checkCategory && b.period === checkPeriod
          );
          if (existingBudget) {
            return {
              error: {
                message: 'DUPLICATE_BUDGET',
                category: existingBudget.category,
                period: existingBudget.period,
              },
            };
          }
        }

        set((s) => ({
          budgets: s.budgets.map((b) => (b.id === id ? { ...b, ...next } : b)),
        }));

        const userId = get().user?.id;
        if (!userId) return;

        const stored = get().budgets.find((b) => b.id === id);
        if (!stored) return;

        // Map camelCase patch fields to snake_case database columns
        const supabaseUpdate: Record<string, any> = {
          amount: stored.amount,
          limit_amount: stored.amount,
        };
        if (patch.category !== undefined) supabaseUpdate.category = patch.category;
        if (patch.amount !== undefined) {
          supabaseUpdate.amount = next.amount;
          supabaseUpdate.limit_amount = next.amount;
        }
        if (patch.period !== undefined) supabaseUpdate.period = patch.period;
        if (patch.startDate !== undefined) supabaseUpdate.start_date = patch.startDate;
        if (patch.endDate !== undefined) supabaseUpdate.end_date = patch.endDate;
        if (patch.rollover !== undefined) supabaseUpdate.rollover = patch.rollover;

        supabase
          .from('budgets')
          .update(supabaseUpdate)
          .eq('id', id)
          .eq('user_id', userId)
          .then(({ error }: { error: any }) => {
            if (error) console.error('[updateBudget] supabase error:', error.message);
          });
      },

      deleteBudget: (id) => {
        set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));

        const userId = get().user?.id;
        if (!userId) return;

        supabase
          .from('budgets')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
          .then(({ error }: { error: any }) => {
            if (error) console.error('[deleteBudget] supabase error:', error.message);
          });
      },

      resetDemoData: () => {
        const currency = get().currency;
        const round = (n: number) => roundForCurrency(n, currency);
        set({
          transactions: seededTransactions.map((t) => ({
            ...t,
            amount: round(t.amount),
            currency,
          })),
          goals: seededGoals.map((g) => ({
            ...g,
            target: round(g.target),
            saved: round(g.saved),
            currency,
          })),
          budgets: [],
        });
      },
      clearLocalFinancialData: () => {
        const userId = get().user?.id;
        resetHydrationState();
        if (userId) {
          void removeCurrencyForUser(userId);
        }
        set({
          transactions: [],
          goals: [],
          budgets: [],
        });
      },
      clearAllData: async () => {
        const userId = get().user?.id;
        if (!userId) {
          get().clearLocalFinancialData();
          return;
        }

        const result = await authService.clearAllData();
        if (!result.ok) {
          console.error('[clearAllData] Cloud deletion failed:', result.error);
          throw new Error(result.error ?? 'Failed to clear data on server');
        }

        // Cloud deletion succeeded - now seed default categories
        const seedResult = await authService.seedDefaultCategories();
        if (!seedResult.ok) {
          console.error('[clearAllData] Category seeding failed:', seedResult.error);
          // Don't throw - cloud deletion succeeded, categories can be seeded later
        }

        // Cloud deletion succeeded - now clear local financial state
        resetHydrationState();
        await removeCurrencyForUser(userId);
        set({
          transactions: [],
          goals: [],
          budgets: [],
          // Preserve theme, language, onboarding state, profile identity
          // Only reset financial preferences
          currency: BASE_CURRENCY,
          emergencyBuffer: null,
          notifications: {
            transactionAlerts: true,
            budgetLimitWarnings: true,
            weeklySummary: false,
            goalReminders: true,
          },
        });
      },

      hydrateFromSupabase: async (userId?: string, force = false) => {
        // 1. Resolve a session that is safe to send, escalating to a single
        //    token refresh if the persisted one is expired or was issued in the
        //    future. `ensureUsableSession()` is coalesced, so concurrent triggers
        //    (React StrictMode, `onAuthStateChange`, the boot check, the manual
        //    refresh button) cost at most one refresh between them ΓÇö and on the
        //    happy path none at all, because the local read is free.
        //
        //    The id always comes from the session, never from the `userId`
        //    argument and never hardcoded, so a query can never be scoped to
        //    the wrong account.
        const session = await ensureUsableSession(userId);
        const authedUserId = session?.user?.id ?? null;
        if (session?.access_token) {
          setAuthToken(session.access_token);
        }
        if (!authedUserId) {
          // Either genuinely signed out, or recovery failed ΓÇö which purges the
          // persisted session and fires SIGNED_OUT, so the app lands on the
          // signed-out state instead of replaying a token the server rejects.
          console.error('[auth] Transaction fetch skipped ΓÇö no usable authenticated session.');
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
            console.log('[transactions] Fetch skipped ΓÇö a request is already running.');
          }
          return;
        }
        if (!force && lastHydratedUserId === authedUserId) {
          if (__DEV__) console.log('[transactions] Fetch skipped ΓÇö already hydrated.');
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
              `[${authFailure.label}] auth error on fetch ΓÇö refreshing session and retrying once:`,
              authFailure.error.message,
            );
            const recovered = await recoverSession(authedUserId);
            if (recovered.ok && recovered.session.user?.id === authedUserId) {
              if (recovered.session.access_token) {
                setAuthToken(recovered.session.access_token);
              }
              if (__DEV__) console.log('[auth] Retrying queries with the refreshed token.');
              queries = await runUserDataQueries(authedUserId);
            } else {
              console.error(
                `[auth] Token refresh did not yield a usable session (${
                  recovered.ok ? 'wrong user' : recovered.reason
                }) ΓÇö not retrying.`,
              );
            }
          }

          const { txResult, goalResult, budgetResult } = queries;
          logQueryResult('transactions', txResult.error, txResult.data?.length ?? 0);
          logQueryResult('goals', goalResult.error, goalResult.data?.length ?? 0);
          logQueryResult('budgets', budgetResult.error, budgetResult.data?.length ?? 0);

          // Classify the outcome. Auth and network failures get different
          // messages and different follow-ups: an auth failure that survived the
          // retry means the session is unusable, while a network failure says
          // nothing about the session and must not tear the user out.
          const authRejected = pickAuthFailure(queries) !== null;
          const networkFailed = isNetworkError(txResult.error) || isNetworkError(goalResult.error) || isNetworkError(budgetResult.error);
          const failed = Boolean(txResult.error) || authRejected;

          const transactions = (txResult.data ?? []).map((t: any) => ({
            id: t.id,
            title: t.title,
            amount: toNumber(t.amount),
            type: t.type,
            category: t.category,
            date: normalizeDate(t.date) ?? t.date,
            // A row written before the currency column existed is INR; every
            // other row states its own currency, which the currency change
            // rewrites along with the amount.
            currency: recordCurrency(t),
          }));
          const goals = (goalResult.data ?? []).map((g: any) => ({
            id: g.id,
            title: g.title,
            target: toNumber(g.target),
            saved: toNumber(g.saved),
            deadline: g.deadline ?? undefined,
            currency: recordCurrency(g),
          }));
          const budgets = (budgetResult.data ?? []).map((b: any) => ({
            id: b.id,
            category: b.category,
            amount: toNumber(b.amount ?? b.limit_amount ?? 0),
            period: b.period,
            startDate: b.start_date ?? undefined,
            endDate: b.end_date ?? undefined,
            rollover: Boolean(b.rollover),
            currency: recordCurrency(b),
          }));

          // The rows are authoritative about their own unit. After a currency
          // change they hold the NEW currency, while the device's preference may
          // still say the old one (a fresh install, or a display-only choice made
          // before this feature existed). Following the rows instead of the
          // preference is what stops the UI labelling USD amounts as rupees.
          //
          // Nothing is converted here: the code is simply adopted, because the
          // amounts are already denominated in it.
          const reconciled = reconcileCurrencyFromRecords([...transactions, ...goals]);
          const loadedCurrency = get().currency;
          let currency = loadedCurrency;
          if (reconciled.kind === 'agreed' || reconciled.kind === 'ambiguous') {
            currency = reconciled.currency;
            if (reconciled.kind === 'ambiguous') {
              console.warn(
                `[currency] Loaded rows disagree (${reconciled.mixed.join(', ')}) ΓÇö showing ${currency}. ` +
                  'Switching currency normalizes every row onto one code.',
              );
            }
          }

          set({
            transactions,
            goals,
            budgets,
            currency,
            isLoadingData: false,
            dataLoadError: failed
              ? authRejected
                ? 'Your session could not be verified. Please sign in again.'
                : networkFailed
                  ? 'You appear to be offline. Check your connection and try again.'
                  : 'Your data could not be loaded. Please try again.'
              : null,
          });

          // Keep the account-level preference in step with what the server
          // actually holds, so the next sign-in does not restore a stale code and
          // re-introduce the mismatch. Best-effort: a failure here only means the
          // reconciliation runs again next time.
          if (!failed && authedUserId && currency !== loadedCurrency) {
            void saveCurrencyForUser(authedUserId, currency);
          }

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
        budgets: s.budgets,
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
        const persistedCurrency = isSupportedCurrency(merged.currency) ? merged.currency : BASE_CURRENCY;

        // The restored records are authoritative about their own unit, exactly as
        // in `hydrateFromSupabase`. This matters most for a pre-feature restore:
        // those rows predate the `currency` column, so they carry no code and are
        // all INR, while the preference they were saved with was a DISPLAY choice
        // (a user could have had "USD" selected while the amounts were rupee
        // amounts). Following the rows here is what stops that from restoring as
        // "these INR amounts are dollars".
        //
        // With no records there is nothing to infer, so the saved preference stands
        // (a brand new account legitimately has no rows yet).
        const records = [...(merged.transactions ?? []), ...(merged.goals ?? [])];
        const reconciled = reconcileCurrencyFromRecords(records);

        return {
          ...merged,
          language: isSupportedLanguage(merged.language) ? merged.language : 'en',
          theme: merged.theme === 'dark' ? 'dark' : 'light',
          currency:
            reconciled.kind === 'agreed' || reconciled.kind === 'ambiguous'
              ? reconciled.currency
              : persistedCurrency,
        };
      },
    },
  ),
);

/**
 * THE currency change.
 *
 * Permanently converts every monetary value the app stores, then moves the
 * preference. The ordering is the whole point of this function:
 *
 *   1. resolve the currency the data is CURRENTLY in (never a hardcoded base);
 *   2. refuse immediately if that is the currency already selected, which is
 *      what makes a repeated tap a no-op instead of a second conversion;
 *   3. make sure a usable rate table exists;
 *   4. plan the conversion purely, which fails as a unit if any value cannot be
 *      converted ΓÇö so a missing rate never produces a half-converted data set;
 *   5. persist the converted rows to Supabase in ONE transaction, so a failure
 *      leaves the database exactly as it was;
 *   6. only then commit the new records AND the preference in a single store
 *      update, so the entire UI re-renders in the new currency at once.
 *
 * Any failure before step 6 returns `{ ok: false }` having written nothing, so
 * the previous currency and the original amounts both survive.
 */
async function runCurrencyChange(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  next: string,
): Promise<CurrencyChangeResult> {
  const from = get().currency;
  const unchanged = { ok: true, currency: from, converted: 0 };

  if (!isSupportedCurrency(next)) {
    return { ok: false, currency: from, error: 'unsupported' };
  }
  // Double-conversion guard. Re-selecting the current currency must not touch a
  // single amount, so this is checked before any rate lookup or arithmetic.
  if (next === from) return unchanged;
  // A second change while one is in flight would read the same starting
  // currency as the first and convert already-converted data.
  if (activeCurrencyChange) {
    return { ok: false, currency: from, error: 'busy' };
  }

  const run = (async (): Promise<CurrencyChangeResult> => {
    // Signed-in state can change under us (the user signs out, or another
    // account signs in, while the rate fetch is in flight). The conversion below
    // is planned from, and written for, whoever was signed in when it started, so
    // a change of user must abandon it rather than write one account's rows under
    // another's session.
    const userId = get().user?.id;

    try {
      // The rate table is the app's single shared table (see services/exchangeRates);
      // this only fetches if the cached one is missing or expired.
      await ensureExchangeRates();
      const table = getRateTable();

      // The currency can only move through `setCurrency` (serialized by the guard
      // above) or `setUser` (which only adopts a saved currency when no data is
      // loaded). Re-checking after the await closes the remaining window: if it did
      // move, the amounts read now are no longer in `from`, and converting them
      // would rescale data that was never measured against this rate.
      if (get().currency !== from) {
        return { ok: false, currency: get().currency, error: 'busy' };
      }
      if (get().user?.id !== userId) {
        return { ok: false, currency: from, error: 'busy' };
      }

      const { transactions, goals, budgets, emergencyBuffer } = get();
      const plan = planCurrencyChange({ transactions, goals, budgets, emergencyBuffer }, from, next, table);
      if (!plan.ok) {
        return { ok: false, currency: from, error: plan.error };
      }

      if (userId) {
const persisted = await persistConvertedAmounts(
  plan,
  transactions,
  goals,
  budgets,
);        if (!persisted.ok) {
          // The database rolled the whole conversion back, so the previous currency
          // and the original amounts are both still intact. Nothing is committed
          // locally and the preference stays put.
          //
          // `stale` means the server data had already moved (a row no longer in the
          // currency we planned from), so local state is now describing something
          // that is not on the server. Re-read it rather than trusting either side.
          if (persisted.stale && get().user?.id === userId) {
            console.error('[setCurrency] data changed concurrently ΓÇö re-syncing from the server.');
            await get().hydrateFromSupabase(userId, true);
          }
          return { ok: false, currency: from, error: 'persist-failed' };
        }
      }

      // Re-check after the write: if the account changed hands while the RPC was
      // running, the rows above were converted for the previous user's data, so
      // do not apply them to whoever is signed in now. The server rows are
      // already consistent (the RPC was atomic); only the local commit is skipped.
      if (get().user?.id !== userId) {
        return { ok: false, currency: get().currency, error: 'busy' };
      }

      // One update: converted records, the safety buffer and the preference all
      // land together, so no subscriber ever sees new amounts under the old code
      // (or the reverse).
      set({
        transactions: plan.transactions,
        goals: plan.goals,
        budgets: plan.budgets,
        emergencyBuffer: plan.emergencyBuffer,
        currency: plan.to,
      });

      // Also remember it against the signed-in account so a sign-out/sign-in
      // cycle restores this user's choice (and another user's own).
      if (userId) void saveCurrencyForUser(userId, plan.to);

      return {
        ok: true,
        currency: plan.to,
        converted: plan.transactions.length + plan.goals.length + plan.budgets.length,
      };
    } catch (e) {
      // A thrown network error (rate fetch offline, RPC unreachable) must not
      // leave the caller spinning on a promise that never resolves: report a
      // failed change so the picker's busy state clears and the user can retry.
      // Nothing was committed locally, so the previous state is still current.
      console.error('[setCurrency] conversion threw:', e);
      return { ok: false, currency: get().currency, error: 'persist-failed' };
    }
  })();

  activeCurrencyChange = run.finally(() => {
    activeCurrencyChange = null;
  });
  return activeCurrencyChange;
}

/**
 * Rewrites every monetary row into the new currency, in ONE database transaction.
 *
 * Each converted amount is different, so this cannot be a single bulk `update`;
 * the values are computed by `planCurrencyChange` and shipped to the
 * `convert_currency_data` RPC from migration 0003 as two JSON arrays, which the
 * database applies atomically. PostgREST runs a function call in a single
 * transaction, so the whole data set is rewritten or none of it is - which is
 * what makes the guarantee "if it fails, nothing is partially updated" actually
 * true. A row-by-row REST loop cannot promise that, and a half-converted data
 * set is worse than an unchanged one because every amount in it is wrong.
 *
 * Each entry carries the currency that row was in when the plan was computed, and
 * the SQL only matches a row that is STILL in that currency. A concurrent change
 * on another device therefore fails the row count check and aborts the whole
 * call rather than overwriting data the client never saw.
 *
 * Ownership is enforced twice over: every UPDATE filters `user_id = auth.uid()`,
 * and RLS (migration 0001) still applies because the function is SECURITY
 * INVOKER.
 */
async function persistConvertedAmounts(
  plan: {
    to: string;
    transactions: Transaction[];
    goals: Goal[];
    budgets: Budget[];
  },
  originalTransactions: Transaction[],
  originalGoals: Goal[],
  originalBudgets: Budget[],
): Promise<{ ok: boolean; stale: boolean }> {
  // A locally-created record that never got a server id cannot be written back.
  // It is left out of the request so the database's row count still matches what
  // was sent; the local value is still converted, and it will be written under
  // its own currency when the record is finally inserted.
  const persisted = <T extends { id: string }>(rows: T[]): T[] =>
    rows.filter((r) => typeof r.id === 'string' && r.id !== '');

  const originalGoalCurrencies = new Map(
  originalGoals.map((g) => [g.id, recordCurrency(g)]),
  );

const originalTransactionCurrencies = new Map(
  originalTransactions.map((t) => [t.id, recordCurrency(t)]),
);

const originalBudgetCurrencies = new Map(
  originalBudgets.map((b) => [b.id, recordCurrency(b)]),
);

const goals = persisted(plan.goals).map((g) => ({
  id: g.id,
  from: originalGoalCurrencies.get(g.id) ?? BASE_CURRENCY,
  target: g.target,
  saved: g.saved,
}));

const transactions = persisted(plan.transactions).map((t) => ({
  id: t.id,
  from: originalTransactionCurrencies.get(t.id) ?? BASE_CURRENCY,
  amount: t.amount,
}));

const budgets = persisted(plan.budgets).map((b) => ({
  id: b.id,
  from: originalBudgetCurrencies.get(b.id) ?? BASE_CURRENCY,
  amount: b.amount,
}));

  // Nothing on the server yet (signed out, or every row is still local): there is
  // no database state to move, so the local commit below is the whole change.
  if (goals.length === 0 && transactions.length === 0 && budgets.length === 0) return { ok: true, stale: false };

 console.log(
  '[currency-rpc] payload',
  JSON.stringify(
    {
      to: plan.to,
      goals,
      transactions,
      budgets,
    },
    null,
    2
  )
);
const { error } = await supabase.rpc('convert_currency_data', {
    p_to: plan.to,
    p_goals: goals,
    p_transactions: transactions,
    p_budgets: budgets,
  });
  if (error) {
    // 40001 is the row count mismatch the function raises, meaning the data moved
    // underneath us. The database rolled everything back, so a re-read restores
    // the truth without any reconciliation.
    const stale = error.code === '40001';
    console.error(
      `[setCurrency] atomic conversion failed${stale ? ' (data changed concurrently)' : ''}:`,
      error.message,
    );
    return { ok: false, stale };
  }

  return { ok: true, stale: false };
}

/**
 * Mirrors the exchange-rate service into the store so every `useMoney()`
 * consumer re-renders the moment rates arrive, change, or fail to refresh.
 *
 * This is the only bridge between the two: the service owns fetching and
 * caching, the store owns the reactive copy that React reads.
 */
function mirrorExchangeRates(): void {
  const current = getExchangeRates();
  useAppStore.setState({
    exchangeRates: current?.rates ?? null,
    exchangeRatesStatus: getRatesStatus(),
    exchangeRatesUpdatedAt: current?.fetchedAt ?? null,
    exchangeRatesSource: current?.source ?? null,
  });
}

subscribeExchangeRates(mirrorExchangeRates);

// Read any cached table at store creation so the first frame can tell whether a
// currency change is possible, instead of only discovering it on the first tap.
// Storage-only, so this stays safe during a server render; the network fetch is
// kicked off by `refreshExchangeRates` from the app shell.
hydrateCachedExchangeRates();
