/**
 * Calendar + daily/monthly aggregation helpers for the AI Insights calendar.
 *
 * Pure, framework-free and fully unit-tested (see tests/calendar.test.mjs).
 * Three rules drive everything here:
 *
 *  1. NO HARDCODED DATES. Month lengths come from the `Date` engine
 *     (`new Date(y, m + 1, 0).getDate()`), so 28/29/30/31-day months and leap
 *     years (including century rules like 2100) are always correct. Weekday
 *     alignment comes from `getDay()` on the 1st of the month, so any
 *     start-weekday is handled. Year/month arithmetic is normalised, so
 *     December → January and January → December roll over correctly.
 *
 *  2. LOCAL-DATE SAFETY. Every key is a LOCAL `yyyy-mm-dd` string, matching
 *     the `Transaction.date` convention used across the app. Nothing here ever
 *     calls `toISOString()` / `new Date(iso)`, both of which parse/emit UTC and
 *     would shift a day for users east or west of Greenwich. `todayIso` is a
 *     parameter, not an implicit `new Date()`, so results are deterministic.
 *
 *  3. REAL DATA ONLY. Every amount is summed from actual `Transaction` rows
 *     with `toNumber` coercion; nothing is invented, and nothing returns NaN.
 */

import { Transaction } from '../../types';
import { toLocalIso, toNumber } from '../../utils';

/** Days in a week — the calendar grid is always 7 columns wide. */
export const WEEK_LENGTH = 7;
/** Months in a year — used to normalise month arithmetic. */
export const MONTHS_PER_YEAR = 12;

/**
 * Category used by the app for money moved into a goal (see the Add Saving
 * modal, which writes `category: 'Savings'` alongside a goal contribution).
 */
export const SAVINGS_CATEGORY = 'Savings';

/** Monday-based week start is intentionally NOT used: the app's `days.short`
 * dictionary is Sunday-first, matching `Date#getDay()`. */

export interface CalendarCell {
  /** Local `yyyy-mm-dd` key for this cell. */
  iso: string;
  /** Day of month, 1–31. */
  day: number;
  /** Full year of this cell (differs from the displayed month for spill cells). */
  year: number;
  /** Month index 0–11 of this cell. */
  month: number;
  /** False for the leading/trailing days borrowed from adjacent months. */
  inCurrentMonth: boolean;
  /** True only for today's cell. */
  isToday: boolean;
  /** True when this cell is after today. */
  isFuture: boolean;
  /** 0 = Sunday … 6 = Saturday, matching the `days.short` dictionary order. */
  weekday: number;
}

export interface DaySummary {
  iso: string;
  /** Total income recorded on this exact date. */
  income: number;
  /** Total non-savings expenses recorded on this exact date. */
  expenses: number;
  /** Total moved into savings/goals on this exact date. */
  savings: number;
  /** income − expenses − savings. */
  net: number;
  /** Number of transaction rows on this date. */
  count: number;
  hasIncome: boolean;
  hasExpense: boolean;
  hasSavings: boolean;
  hasActivity: boolean;
}

export interface MonthSummary {
  year: number;
  /** 0–11. */
  month: number;
  /** `yyyy-mm` key. */
  key: string;
  income: number;
  expenses: number;
  savings: number;
  /** income − expenses − savings. */
  net: number;
  count: number;
  /** Days in this month that recorded at least one transaction. */
  activeDays: number;
  /** Share of income actually kept: (income − expenses − savings) / income × 100. */
  savingsRate: number;
}

/* ------------------------------------------------------------------ *
 * Local-date primitives
 * ------------------------------------------------------------------ */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * True when `value` is a well-formed `yyyy-mm-dd` string that names a real
 * calendar day. Rejects `2026-02-30`, `2026-13-01`, `2026-2-1` and junk, so a
 * malformed stored date can never match a calendar cell.
 */
export function isValidIso(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const date = new Date(y, mo - 1, d);
  // Date silently rolls 2026-02-30 over to March; compare back to reject it.
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Parse `yyyy-mm-dd` into a LOCAL `Date` at midnight, or null when invalid. */
export function parseLocalIso(iso: string): Date | null {
  if (!isValidIso(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local `yyyy-mm-dd` for a `Date`, defaulting to now. */
export function todayIso(now: Date = new Date()): string {
  return toLocalIso(now);
}

/** `yyyy-mm` key for a year + 0-based month. */
export function monthKey(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Days in the given month. Derived from the `Date` engine rather than a lookup
 * table, so leap years and every 30/31-day month are correct forever:
 *   new Date(2028, 2, 0) → Feb 29 2028   (leap)
 *   new Date(2026, 2, 0) → Feb 28 2026
 *   new Date(2026, 12, 0) → Dec 31 2026
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Gregorian leap-year rule (divisible by 4, except centuries not by 400). */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Normalise a possibly out-of-range month into `{ year, month }` with
 * `month` in 0–11. Handles December → January (`month + 1`) and
 * January → December (`month − 1`) as well as multi-year jumps.
 */
export function normalizeMonth(year: number, month: number): { year: number; month: number } {
  const absolute = year * MONTHS_PER_YEAR + month;
  const y = Math.floor(absolute / MONTHS_PER_YEAR);
  const m = absolute - y * MONTHS_PER_YEAR;
  return { year: y, month: m };
}

/** Shift a year/month pair by `delta` months, rolling years correctly. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  return normalizeMonth(year, month + delta);
}

/** Shift a year/month pair by `delta` years, keeping the month. */
export function shiftYear(year: number, month: number, delta: number): { year: number; month: number } {
  return { year: year + delta, month };
}

/** True when both pairs describe the same calendar month. */
export function isSameMonth(aYear: number, aMonth: number, bYear: number, bMonth: number): boolean {
  return aYear === bYear && aMonth === bMonth;
}

/**
 * Number of week rows the given month needs once its leading days are padded
 * (4, 5 or 6) — used to size the grid without an empty trailing week.
 */
export function weeksInMonth(year: number, month: number): number {
  const leading = new Date(year, month, 1).getDay();
  return Math.ceil((leading + daysInMonth(year, month)) / WEEK_LENGTH);
}

/**
 * Build the full month grid (leading spill days from the previous month +
 * every day of this month + trailing spill days from the next month).
 *
 * `new Date(year, month, 1 - leading)` normalises for us, so a month starting
 * on any weekday — and a spill cell that lands in December or January of the
 * neighbouring year — is always right.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  today: string = todayIso(),
): CalendarCell[] {
  const { year: gy, month: gm } = normalizeMonth(year, month);
  const leading = new Date(gy, gm, 1).getDay();
  const cells = weeksInMonth(gy, gm) * WEEK_LENGTH;
  const start = new Date(gy, gm, 1 - leading);

  const out: CalendarCell[] = [];
  for (let i = 0; i < cells; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = toLocalIso(date);
    out.push({
      iso,
      day: date.getDate(),
      year: date.getFullYear(),
      month: date.getMonth(),
      inCurrentMonth: date.getMonth() === gm && date.getFullYear() === gy,
      isToday: iso === today,
      isFuture: iso > today,
      weekday: date.getDay(),
    });
  }
  return out;
}

/**
 * Sorted list of years for the year selector: `back` years before and
 * `forward` years after `center`, always including `center` and the current
 * year so the list is never empty.
 */
export function yearRange(center: number, back = 6, forward = 6, currentYear = new Date().getFullYear()): number[] {
  const from = Math.min(center - back, currentYear - back);
  const to = Math.max(center + forward, currentYear + forward);
  const years: number[] = [];
  for (let y = from; y <= to; y += 1) years.push(y);
  return years;
}

/* ------------------------------------------------------------------ *
 * Transaction aggregation
 * ------------------------------------------------------------------ */

/** Map of `yyyy-mm-dd` → the transactions recorded on exactly that local day. */
export type DayIndex = Map<string, Transaction[]>;

/** True when a row is money moved into savings/goals rather than spending. */
export function isSavingsRow(t: Transaction): boolean {
  return t.type === 'expense' && (t.category ?? '').trim() === SAVINGS_CATEGORY;
}

/**
 * Bucket every transaction by its exact local date.
 *
 * Rows with a missing or malformed date are skipped rather than throwing, so a
 * single bad row can never break the calendar. Ordering within a day is by
 * descending id/insertion stability — callers that need a specific order pass
 * their own sort.
 */
export function buildDayIndex(transactions: Transaction[]): DayIndex {
  const index: DayIndex = new Map();
  if (!Array.isArray(transactions)) return index;
  for (const t of transactions) {
    if (!t || !isValidIso(t.date)) continue;
    const bucket = index.get(t.date);
    if (bucket) bucket.push(t);
    else index.set(t.date, [t]);
  }
  return index;
}

/** An all-zero summary, used for days with no transactions. */
export function emptyDaySummary(iso: string): DaySummary {
  return {
    iso,
    income: 0,
    expenses: 0,
    savings: 0,
    net: 0,
    count: 0,
    hasIncome: false,
    hasExpense: false,
    hasSavings: false,
    hasActivity: false,
  };
}

/**
 * Totals for ONE exact date read from the prebuilt `DayIndex`.
 *
 * This is a pure local lookup — changing the selected day never triggers a
 * query. `expenses` deliberately excludes savings so that
 * `net = income − expenses − savings` stays internally consistent for the
 * daily panel, the monthly summary and the calendar indicators alike.
 */
export function summarizeDay(iso: string, index: DayIndex): DaySummary {
  const rows = index.get(iso);
  if (!rows || rows.length === 0) return emptyDaySummary(iso);

  const summary = emptyDaySummary(iso);
  for (const t of rows) {
    const amount = toNumber(t.amount);
    summary.count += 1;
    if (t.type === 'income') {
      summary.income += amount;
    } else if (isSavingsRow(t)) {
      summary.savings += amount;
    } else {
      summary.expenses += amount;
    }
  }
  summary.hasIncome = summary.income > 0;
  summary.hasExpense = summary.expenses > 0;
  summary.hasSavings = summary.savings > 0;
  summary.hasActivity = summary.count > 0;
  summary.net = summary.income - summary.expenses - summary.savings;
  return summary;
}

/** All transactions recorded on exactly `iso`, oldest first. */
export function transactionsForDate(iso: string, index: DayIndex): Transaction[] {
  return [...(index.get(iso) ?? [])];
}

/**
 * Totals for a whole month, derived from the same rows as the daily cells so
 * the monthly strip and the calendar can never disagree. Only rows whose
 * `yyyy-mm` prefix matches are counted.
 */
export function summarizeMonth(transactions: Transaction[], year: number, month: number): MonthSummary {
  const { year: gy, month: gm } = normalizeMonth(year, month);
  const key = monthKey(gy, gm);
  const summary: MonthSummary = {
    year: gy,
    month: gm,
    key,
    income: 0,
    expenses: 0,
    savings: 0,
    net: 0,
    count: 0,
    activeDays: 0,
    savingsRate: 0,
  };

  if (!Array.isArray(transactions)) return summary;

  const days = new Set<string>();
  for (const t of transactions) {
    if (!t || !isValidIso(t.date)) continue;
    if (t.date.slice(0, 7) !== key) continue;
    const amount = toNumber(t.amount);
    summary.count += 1;
    days.add(t.date);
    if (t.type === 'income') summary.income += amount;
    else if (isSavingsRow(t)) summary.savings += amount;
    else summary.expenses += amount;
  }

  summary.activeDays = days.size;
  summary.net = summary.income - summary.expenses - summary.savings;
  // The rate of income actually KEPT. Money moved into savings is a real
  // saving, so it must be part of the surplus (net) — otherwise a month that
  // saved ₹500 of ₹4000 income would report 92.5% instead of 12.5%. This is
  // exactly `savings / income`, derived from the same surplus as `net` so the
  // two can never disagree.
  summary.savingsRate =
    summary.income > 0 ? ((summary.income - summary.expenses - summary.savings) / summary.income) * 100 : 0;
  return summary;
}

/**
 * Goal title a savings row refers to, matched against the user's REAL goals by
 * substring (the Add Saving modal titles rows like "Savings: Emergency fund").
 * Returns null when the row cannot be tied to a specific goal, so nothing is
 * ever invented.
 */
export function matchedGoalTitle(
  transaction: Transaction,
  goals: { id: string; title: string }[],
): string | null {
  const title = (transaction.title ?? '').toLowerCase();
  if (!title) return null;
  let best: string | null = null;
  for (const g of goals) {
    const needle = (g.title ?? '').toLowerCase().trim();
    if (needle.length > 0 && title.includes(needle)) {
      if (!best || needle.length > best.length) best = g.title;
    }
  }
  return best;
}
