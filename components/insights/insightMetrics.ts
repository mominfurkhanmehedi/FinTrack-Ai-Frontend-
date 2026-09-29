/**
 * Pure insight metrics for the "Smart suggestions" card.
 *
 * Everything here is derived from REAL transaction rows — there are no
 * thresholds, amounts or categories baked in, and no fabricated values. Each
 * function takes the transaction set it should reason about (the page passes the
 * displayed month for "current" figures and the full history for baselines), so
 * a suggestion can always be traced back to a transaction the user recorded.
 *
 * Kept framework-free and unit-tested (see tests/calendar.test.mjs).
 */

import { Transaction } from '../../types';
import { toNumber } from '../../utils';
import { isSavingsRow } from './calendarData';

export interface CategoryTotal {
  name: string;
  value: number;
  /** Share of all non-savings expenses, 0–100. */
  pct: number;
}

/** Expense rows excluding savings contributions, ordered largest first. */
export function spendingRows(transactions: Transaction[]): Transaction[] {
  if (!Array.isArray(transactions)) return [];
  return transactions.filter((t) => t && t.type === 'expense' && !isSavingsRow(t) && toNumber(t.amount) > 0);
}

/** Non-savings expenses grouped by category, largest first. */
export function categoryTotals(transactions: Transaction[]): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const t of spendingRows(transactions)) {
    const name = t.category?.trim() || 'Other';
    totals.set(name, (totals.get(name) ?? 0) + toNumber(t.amount));
  }
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((s, e) => s + e[1], 0);
  if (sum <= 0) return [];
  return entries.map(([name, value]) => ({ name, value, pct: (value / sum) * 100 }));
}

export interface CategoryBaseline {
  /** Distinct `yyyy-mm` months in which this category was ever recorded. */
  months: number;
  /** Total recorded across those months. */
  total: number;
  /** total / months — the user's own historical pace for this category. */
  average: number;
}

/**
 * Per-category monthly baselines built from the FULL history, so "unusual
 * spending" is measured against the user's own record rather than a constant.
 */
export function categoryBaselines(transactions: Transaction[]): Map<string, CategoryBaseline> {
  const acc = new Map<string, { total: number; months: Set<string> }>();
  if (!Array.isArray(transactions)) return new Map();
  for (const t of spendingRows(transactions)) {
    if (!t.date || t.date.length < 7) continue;
    const name = t.category?.trim() || 'Other';
    const month = t.date.slice(0, 7);
    const entry = acc.get(name) ?? { total: 0, months: new Set<string>() };
    entry.total += toNumber(t.amount);
    entry.months.add(month);
    acc.set(name, entry);
  }
  const out = new Map<string, CategoryBaseline>();
  for (const [name, entry] of acc) {
    out.set(name, {
      months: entry.months.size,
      total: entry.total,
      average: entry.months.size > 0 ? entry.total / entry.months.size : 0,
    });
  }
  return out;
}

export interface UnusualSpend {
  category: string;
  amount: number;
  average: number;
  /** How far above the baseline, as a percentage (always > 0). */
  pctOver: number;
}

/**
 * Categories in the current period that exceed their own monthly average by
 * more than `thresholdPct`. Only categories with at least 2 months of history
 * are eligible — a single recorded month has no baseline to compare against.
 */
export function unusualSpending(
  currentTransactions: Transaction[],
  baselines: Map<string, CategoryBaseline>,
  thresholdPct = 25,
): UnusualSpend[] {
  return categoryTotals(currentTransactions)
    .filter((c) => {
      const base = baselines.get(c.name);
      if (!base || base.months < 2 || base.average <= 0) return false;
      const pctOver = ((c.value - base.average) / base.average) * 100;
      return pctOver >= thresholdPct;
    })
    .map((c) => {
      const base = baselines.get(c.name)!;
      return {
        category: c.name,
        amount: c.value,
        average: base.average,
        pctOver: ((c.value - base.average) / base.average) * 100,
      };
    })
    .sort((a, b) => b.pctOver - a.pctOver);
}

/**
 * What trimming `pct` off the largest category would free up, i.e. a concrete
 * savings opportunity. Returns null when there is no spending to trim.
 */
export function savingsOpportunity(
  transactions: Transaction[],
  pct = 0.1,
): { category: string; current: number; potential: number } | null {
  const totals = categoryTotals(transactions);
  const top = totals[0];
  if (!top || top.value <= 0) return null;
  return { category: top.name, current: top.value, potential: top.value * pct };
}

/** The single largest expense row, used for "unusual transaction" callouts. */
export function largestExpense(
  transactions: Transaction[],
): { transaction: Transaction; ratio: number } | null {
  const totals = categoryTotals(transactions);
  if (totals.length === 0) return null;
  const topCategory = totals[0];
  const rows = spendingRows(transactions)
    .filter((t) => (t.category?.trim() || 'Other') === topCategory.name)
    .sort((a, b) => toNumber(b.amount) - toNumber(a.amount));
  const top = rows[0];
  if (!top) return null;
  // How many times bigger than the typical transaction in that category.
  const others = rows.slice(1).map((r) => toNumber(r.amount)).filter((n) => n > 0);
  const typical =
    others.length > 0 ? others.reduce((s, n) => s + n, 0) / others.length : toNumber(top.amount);
  return { transaction: top, ratio: typical > 0 ? toNumber(top.amount) / typical : 1 };
}

/**
 * Projected spending for the rest of a 31-day month, given what has already
 * been spent and how many days remain. Uses the observed daily pace, so it stays
 * honest on a month that is only 3 days old or a month that is nearly over.
 */
export function projectedMonthSpend(
  currentTransactions: Transaction[],
  daysElapsed: number,
  daysInMonth: number,
): { spent: number; dailyPace: number; projected: number } {
  const spent = spendingRows(currentTransactions).reduce((s, t) => s + toNumber(t.amount), 0);
  const elapsed = Math.max(1, Math.min(daysElapsed, daysInMonth));
  const dailyPace = spent / elapsed;
  const remaining = Math.max(0, daysInMonth - daysElapsed);
  return { spent, dailyPace, projected: spent + dailyPace * remaining };
}
