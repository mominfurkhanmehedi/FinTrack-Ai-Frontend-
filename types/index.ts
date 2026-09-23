export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  /** ISO date string (yyyy-mm-dd). */
  date: string;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  saved: number;
  deadline?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  /** Emoji or single-char avatar marker. */
  avatar?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface NotificationPrefs {
  transactionAlerts: boolean;
  budgetLimitWarnings: boolean;
  weeklySummary: boolean;
  goalReminders: boolean;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: User;
  /** True when signup succeeded but the email still needs to be confirmed. */
  needsEmailConfirmation?: boolean;
}

/** Available display languages. */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
] as const;

/** Available currencies. */
export const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { code: 'INR', label: 'INR — Indian Rupee', symbol: '₹' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { code: 'GBP', label: 'GBP — British Pound', symbol: '£' },
  { code: 'JPY', label: 'JPY — Japanese Yen', symbol: '¥' },
] as const;

/** Avatar options for the profile editor. */
export const AVATARS = ['😀', '🦊', '🐼', '🦁', '🐸', '🚀', '⭐', '💎'] as const;
