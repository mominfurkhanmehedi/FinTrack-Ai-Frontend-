import { Transaction, TransactionType } from '../types';

/**
 * Every piece of currency maths and formatting lives in `./currency`, which is
 * pure (no React Native, no network) and unit-testable. It is re-exported here
 * so the app's long-standing `from '../utils'` import path keeps working
 * without creating a second, divergent copy of the formatting rules.
 */
export {
  BASE_CURRENCY,
  SUPPORTED_CURRENCY_CODES,
  convertAmount,
  convertCurrency,
  convertFromBase,
  convertToBase,
  currencyFractionDigits,
  currencySymbol,
  effectiveRate,
  formatCompactAmount,
  formatMoney,
  formatMoneyAmount,
  formatMoneyCompact,
  hasRateFor,
  isSupportedCurrency,
  normalizeCurrency,
  planCurrencyChange,
  reconcileCurrencyFromRecords,
  recordCurrency,
  roundForCurrency,
  toInputValue,
} from './currency';
export type {
  CurrencyChangeError,
  CurrencyChangePlan,
  CurrencyReconciliation,
  MonetaryData,
  MonetaryDataInput,
  RateTable,
  RatesSnapshot,
} from './currency';

/**
 * Safely coerce a value to a finite number, falling back to 0.
 * Prevents NaN/Infinity from leaking into amounts, chart math, and SVG
 * coordinates when a row is null, missing, or otherwise non-numeric.
 */
export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Human-friendly date from an ISO `yyyy-mm-dd` string. */
export function formatDate(iso: string, locale = 'en-US'): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A deterministic `id` for locally-created records. */
export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Format a `Date` as an ISO `yyyy-mm-dd` string using its LOCAL calendar
 * fields. Deliberately avoids `toISOString()`, which converts to UTC and would
 * report the previous day for anyone east of Greenwich in the small hours
 * (e.g. 00:30 IST on the 28th would stringify as the 27th).
 */
export function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today as an ISO `yyyy-mm-dd` string (local date), optionally offset by `days`. */
export function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return toLocalIso(d);
}

/**
 * Total amount for a list of transactions of a given type.
 *
 * Aggregates in the currency the records are stored in, which is always the
 * user's currently selected currency. No conversion is applied here or at the
 * call site, so a total on screen is exactly the sum of the amounts listed
 * above it, and every ratio derived from two aggregates (category shares,
 * budget percentages) is likewise identical to the one the user entered.
 */
export function sumByType(txs: Transaction[], type: TransactionType): number {
  return txs
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + toNumber(t.amount), 0);
}

/** Income minus expenses. */
export function netBalance(txs: Transaction[]): number {
  return sumByType(txs, 'income') - sumByType(txs, 'expense');
}

/** Basic email format check. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
