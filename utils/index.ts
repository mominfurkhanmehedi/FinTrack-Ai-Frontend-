import { Transaction, TransactionType } from '../types';

/**
 * Safely coerce a value to a finite number, falling back to 0.
 * Prevents NaN/Infinity from leaking into amounts, chart math, and SVG
 * coordinates when a row is null, missing, or otherwise non-numeric.
 */
export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Format a number as a currency string (defaults to USD). */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/** Compact money for tight spaces, e.g. $1.2k. */
export function formatCompact(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Human-friendly date from an ISO `yyyy-mm-dd` string. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A deterministic `id` for locally-created records. */
export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Today as an ISO `yyyy-mm-dd` string, optionally offset by `days`. */
export function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
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
