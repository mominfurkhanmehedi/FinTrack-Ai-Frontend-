export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  title: string;
  /** Denominated in `currency`. */
  amount: number;
  type: TransactionType;
  category: string;
  /** ISO date string (yyyy-mm-dd). */
  date: string;
  /**
   * Currency `amount` is denominated in.
   *
   * Persisted per row, and always equal to the user's currently selected
   * currency: selecting a new currency permanently converts every amount, so
   * the database never holds a mixture. Optional only because rows created
   * before this column existed carry no code — `recordCurrency()` resolves those
   * to the legacy currency. Callers never need to set it: the store stamps the
   * current selection on insert and on every amount edit.
   */
  currency?: string;
}

export interface Goal {
  id: string;
  title: string;
  /** Denominated in `currency`. */
  target: number;
  /** Savings contributed so far. Denominated in `currency`. */
  saved: number;
  deadline?: string;
  /** Currency `target` and `saved` are denominated in. See `Transaction.currency`. */
  currency?: string;
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

/**
 * Available currencies.
 *
 * This list is the single source of truth: the picker, the supported-code
 * set, and the rate providers all derive from it, so adding a code here is
 * enough to make the currency selectable everywhere.
 *
 * `supabase/migrations/0002_currency_columns.sql` also pins a CHECK constraint
 * over the same codes, widened by `0005_widen_currency_constraint.sql`. Both
 * must list the same set or the database will reject a code the UI offers.
 *
 * Symbols are display-only fallbacks. `formatMoneyAmount` formats through
 * `Intl`, so these are only reached by charts and labels that show a bare
 * symbol next to a value.
 */
export const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { code: 'INR', label: 'INR — Indian Rupee', symbol: '₹' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { code: 'GBP', label: 'GBP — British Pound', symbol: '£' },
  { code: 'JPY', label: 'JPY — Japanese Yen', symbol: '¥' },
  { code: 'AED', label: 'AED — UAE Dirham', symbol: 'AED' },
  { code: 'SGD', label: 'SGD — Singapore Dollar', symbol: 'S$' },
  { code: 'CAD', label: 'CAD — Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', label: 'AUD — Australian Dollar', symbol: 'A$' },
  { code: 'CHF', label: 'CHF — Swiss Franc', symbol: 'CHF' },
] as const;

/** Avatar options for the profile editor. */
export const AVATARS = ['😀', '🦊', '🐼', '🦁', '🐸', '🚀', '⭐', '💎'] as const;
