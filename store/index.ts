import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Goal, NotificationPrefs, ThemeMode, Transaction, User } from '../types';
import { isoToday, uid } from '../utils';

/**
 * Global app state via Zustand.
 * Persists onboarding + auth to AsyncStorage so routing decisions survive
 * restarts. `transactions` and `goals` start seeded with demo data so every
 * screen reflects real, changeable state out of the box.
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
  signOut: () => void;

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
    (set) => ({
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
      signOut: () => set({ user: null }),

      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setLanguage: (language) => set({ language }),
      setNotifications: (prefs) =>
        set((s) => ({ notifications: { ...s.notifications, ...prefs } })),

      addTransaction: (input) =>
        set((s) => ({ transactions: [{ ...input, id: uid('tx') }, ...s.transactions] })),
      updateTransaction: (id, patch) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      deleteTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      addGoal: (input) => set((s) => ({ goals: [...s.goals, { ...input, id: uid('goal') }] })),
      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      resetDemoData: () => set({ transactions: seededTransactions, goals: seededGoals }),
      clearAllData: () => set({ transactions: [], goals: [] }),
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
