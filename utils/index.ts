import { CURRENCIES, Transaction, TransactionType } from '../types';

/**
 * Safely coerce a value to a finite number, falling back to 0.
 * Prevents NaN/Infinity from leaking into amounts, chart math, and SVG
 * coordinates when a row is null, missing, or otherwise non-numeric.
 */
export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

const CURRENCY_LOCALES: Record<string, string> = { INR: 'en-IN' };

/**
 * Symbol for a supported currency code — e.g. "₹" for INR, "$" for USD.
 * Reuses the shared CURRENCIES list so charts and formatters never need to
 * hardcode symbols and always stay in sync with the currency picker.
 */
export function currencySymbol(currency = 'USD'): string {
  const match = CURRENCIES.find((c) => c.code === currency);
  return match?.symbol ?? currency;
}

/**
 * Locale that produces the native grouping for a currency. INR uses the Indian
 * "en-IN" grouping (₹10,00,000); everything else keeps western grouping.
 */
function localeForCurrency(currency: string): string {
  return CURRENCY_LOCALES[currency] ?? 'en-US';
}

/** Format a number as a currency string (defaults to USD). */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(localeForCurrency(currency), {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Compact money for tight spaces, e.g. $1.2k / ₹2.5K / ₹1L.
 * INR uses Indian compact units: K (thousand), L (lakh), Cr (crore).
 */
export function formatCompact(amount: number, currency = 'USD'): string {
  if (currency === 'INR') {
    return `${currencySymbol(currency)}${compactNumber(amount)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Compact number for INR: 0, 2.5K, 75K, 1L, 12.5L, 2Cr, … */
function compactNumber(amount: number): string {
  const abs = Math.abs(amount);
  // Drop trailing ".0" and cap non-integers at one decimal place.
  const trim = (n: number) =>
    Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1e7) return `${trim(amount / 1e7)}Cr`;
  if (abs >= 1e5) return `${trim(amount / 1e5)}L`;
  if (abs >= 1e3) return `${trim(amount / 1e3)}K`;
  return trim(amount);
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

/** Total amount for a list of transactions of a given type. */
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
