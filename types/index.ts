export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  /** ISO date string (yyyy-mm-dd). */
  date: string;
  /** Currency code the amount is denominated in. */
  currency: string;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  saved: number;
  deadline?: string;
  /** Currency code the amounts are denominated in. */
  currency: string;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  period: string;
  startDate?: string;
  endDate?: string;
  rollover: boolean;
  /** Currency code the amount is denominated in. */
  currency: string;
}

export interface User {
  /** Supabase auth user id — used to scope transactions/goals queries. */
  id: string;
  name: string;
  email: string;
  /** Emoji or single-char avatar marker. */
  avatar?: string;
  /** Profile picture URL. */
  profilePicture?: string;
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
  needsEmailConfirmation?: boolean;
}

/** Available display languages. */
export const LANGUAGES = [
  { code: 'en', label: 'English', isDefault: true },
  { code: 'hi', label: 'हिन्दी', isDefault: false },
  { code: 'es', label: 'Español', isDefault: false },
  { code: 'fr', label: 'Français', isDefault: false },
  { code: 'de', label: 'Deutsch', isDefault: false },
] as const;

/** Available currencies. */
export const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { code: 'INR', label: 'INR — Indian Rupee', symbol: '₹' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { code: 'GBP', label: 'GBP — British Pound', symbol: '£' },
  { code: 'JPY', label: 'JPY — Japanese Yen', symbol: '¥' },
  { code: 'AED', label: 'AED — UAE Dirham', symbol: 'د.إ' },
  { code: 'SGD', label: 'SGD — Singapore Dollar', symbol: 'S$' },
  { code: 'CAD', label: 'CAD — Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', label: 'AUD — Australian Dollar', symbol: 'A$' },
  { code: 'CHF', label: 'CHF — Swiss Franc', symbol: 'CHF' },
] as const;

/** Avatar options for the profile editor. */
export const AVATARS = ['😀', '🦊', '🐼', '🦁', '🐸', '🚀', '⭐', '💎'] as const;