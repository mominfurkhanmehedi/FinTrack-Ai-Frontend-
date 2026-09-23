import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { authService } from '../services/authService';
import { supabase } from '../services/supabase';
import { Goal, NotificationPrefs, ThemeMode, Transaction, User } from '../types';
import { isoToday, uid } from '../utils';

/**
 * Global app state via Zustand.
 * Persists onboarding + auth to AsyncStorage so routing decisions survive
 * restarts (and doubles as an offline cache for transactions/goals).
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

  // Auth
  setUser: (user: User | null) => void;
  finishOnboarding: () => void;
  updateUser: (patch: Partial<User>) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ ok: boolean; error?: string }>;

  // Preferences
  setTheme: (theme: ThemeMode) => void;
  setCurrency: (currency: string) => void;
  setLanguage: (language: string) => void;
  setNotifications: (prefs: Partial<NotificationPrefs>) => void;

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
  /** Fetches this user's real transactions/goals from Supabase and replaces local state. */
  hydrateFromSupabase: (userId: string) => Promise<void>;
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
      transactions: seededTransactions,
      goals: seededGoals,

      theme: 'light',
      currency: 'USD',
      language: 'en',
      notifications: {
        transactionAlerts: true,
        budgetLimitWarnings: true,
        weeklySummary: false,
        goalReminders: true,
      },

      setUser: (user) => set({ user }),
      finishOnboarding: () => set({ hasOnboarded: true }),
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      signOut: async () => {
        await authService.signOut();
        set({ user: null, transactions: [], goals: [] });
      },
      deleteAccount: async () => {
        const result = await authService.deleteAccount();
        if (!result.ok) {
          return result;
        }
        await authService.signOut();
        set({ user: null, transactions: [], goals: [] });
        return { ok: true };
      },

      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setLanguage: (language) => set({ language }),
      setNotifications: (prefs) =>
        set((s) => ({ notifications: { ...s.notifications, ...prefs } })),

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

      hydrateFromSupabase: async (userId) => {
        try {
          const loadData = () =>
            Promise.all([
              supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false }),
              supabase.from('goals').select('*').eq('user_id', userId),
            ]);

          let [txResult, goalResult] = await loadData();
          const hasFutureJwtError = [txResult.error, goalResult.error].some((error: any) =>
            error?.message?.toLowerCase().includes('jwt issued at future'),
          );

          if (hasFutureJwtError) {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (!refreshError) [txResult, goalResult] = await loadData();
          }

          if (txResult.error) {
            console.error('[hydrateFromSupabase] transactions error:', txResult.error.message);
          }
          if (goalResult.error) {
            console.error('[hydrateFromSupabase] goals error:', goalResult.error.message);
          }

          set({
            transactions: (txResult.data ?? []).map((t: any) => ({
              id: t.id,
              title: t.title,
              amount: Number(t.amount),
              type: t.type,
              category: t.category,
              date: t.date,
            })),
            goals: (goalResult.data ?? []).map((g: any) => ({
              id: g.id,
              title: g.title,
              target: Number(g.target),
              saved: Number(g.saved),
              deadline: g.deadline ?? undefined,
            })),
          });
        } catch (e) {
          console.error('[hydrateFromSupabase] failed:', e);
        }
      },
    }),
    {
      name: 'fintrack-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        user: s.user,
        hasOnboarded: s.hasOnboarded,
        transactions: s.transactions,
        goals: s.goals,
        theme: s.theme,
        currency: s.currency,
        language: s.language,
        notifications: s.notifications,
      }),
    },
  ),
);