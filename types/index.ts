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
  /**
   * Profile picture reference: a `data:` URI on web or a persistent
   * `file://` path on Android/iOS. Never a temporary blob URL.
   */
  profilePicture?: string;
}

export type ThemeMode = 'light' | 'dark';

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

/** Available display languages (native-script labels). */
export const LANGUAGES = [
  { code: 'en', label: 'English', isDefault: true },
  { code: 'hi', label: 'हिन्दी', isDefault: false },
  { code: 'kn', label: 'ಕನ್ನಡ', isDefault: false },
  { code: 'mr', label: 'मराठी', isDefault: false },
  { code: 'te', label: 'తెలుగు', isDefault: false },
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
