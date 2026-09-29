import { Transaction } from '../../types';
import { toNumber } from '../../utils';

/**
 * Pure report data builders.
 * Every series is derived from the SAME transaction list the rest of the app
 * uses (the store). No fabricated numbers, no per-component copies of the
 * financial logic: income/expense/balance all come from real transaction rows.
 *
 * All dates are local `yyyy-mm-dd` ISO strings so transactions (also stored as
 * local ISO dates) match the axis days deterministically.
 */

export const CASH_FLOW_DAYS = 7;

/** Chart palette shared by the report charts (indigo first = brand). */
export const REPORT_PALETTE = [
  '#4f46e5',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
] as const;

export interface DayFlow {
  iso: string;
  date: Date;
  income: number;
  expenses: number;
  net: number;
}

export interface BalancePoint {
  iso: string;
  date: Date;
  /** Cumulative balance at the end of this day: balance = previous + income − expenses. */
  balance: number;
  income: number;
  expenses: number;
  /** True when any income/expense was recorded on this exact day. */
  hasActivity: boolean;
}

export interface CategoryDatum {
  name: string;
  value: number;
  pct: number;
  color: string;
}

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isoOfDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Weekday label for axis ("Mon"). */
export function dayShortLabel(date: Date): string {
  return SHORT_DAYS[date.getDay()];
}

/** Full weekday name for tooltips ("Monday"). */
export function dayFullLabel(date: Date): string {
  return FULL_DAYS[date.getDay()];
}

/** Full date for tooltips: "25 Sep 2026". */
export function fullDateLabel(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** Axis label tuned to the range so it stays compact and readable. */
export function dateAxisLabel(date: Date, rangeDays: number): string {
  if (rangeDays <= 7) return dayShortLabel(date);
  if (rangeDays <= 30) return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  return MONTHS_SHORT[date.getMonth()];
}

/**
 * Daily income/expense totals for the trailing N days (oldest → today).
 * Days with no transactions stay at 0 (they still render on the axis).
 */
export function buildCashFlow(txs: Transaction[], days = CASH_FLOW_DAYS, now = new Date()): DayFlow[] {
  const today = startOfDay(now);
  const byDay = new Map<string, { income: number; expenses: number }>();

  for (const t of txs) {
    if (!t.date) continue;
    const amt = toNumber(t.amount);
    const bucket = byDay.get(t.date) ?? { income: 0, expenses: 0 };
    if (t.type === 'income') bucket.income += amt;
    else bucket.expenses += amt;
    byDay.set(t.date, bucket);
  }

  const out: DayFlow[] = [];
  const start = addDays(today, -(days - 1));
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const iso = isoOfDate(date);
    const flow = byDay.get(iso) ?? { income: 0, expenses: 0 };
    out.push({ iso, date, income: flow.income, expenses: flow.expenses, net: flow.income - flow.expenses });
  }
  return out;
}

/**
 * Real balance history for the trailing `rangeDays` days (oldest → today).
 *
 * Each point is the running total
 *     balance = previous balance + income − expenses
 * accumulated chronologically from the user's actual transactions (up to
 * today). Days without transactions simply carry the previous balance forward,
 * so the line is flat instead of an invented zero. The final point equals the
 * current balance. Transactions dated after today are excluded — a future row
 * must never rewrite past balances.
 */
export function buildBalanceSeries(txs: Transaction[], rangeDays: number, now = new Date()): BalancePoint[] {
  const today = startOfDay(now);
  const start = addDays(today, -(rangeDays - 1));
  const todayIso = isoOfDate(today);

  const netByDay = new Map<string, number>();
  const incomeByDay = new Map<string, number>();
  const expenseByDay = new Map<string, number>();

  for (const t of txs) {
    if (!t.date || t.date > todayIso) continue;
    const amt = toNumber(t.amount);
    const net = netByDay.get(t.date) ?? 0;
    netByDay.set(t.date, net + (t.type === 'income' ? amt : -amt));
    if (t.type === 'income') incomeByDay.set(t.date, (incomeByDay.get(t.date) ?? 0) + amt);
    else expenseByDay.set(t.date, (expenseByDay.get(t.date) ?? 0) + amt);
  }

  const sortedDates = [...netByDay.keys()].sort();

  const points: BalancePoint[] = [];
  let running = 0;
  let cursor = 0;
  for (let i = 0; i < rangeDays; i++) {
    const date = addDays(start, i);
    const iso = isoOfDate(date);
    // Advance the running total through every transaction dated on/before this
    // day (including rows older than the range), so the opening balance of the
    // window reflects the user's full history — never a fabricated 0.
    while (cursor < sortedDates.length && sortedDates[cursor] <= iso) {
      running += netByDay.get(sortedDates[cursor]) ?? 0;
      cursor++;
    }
    const income = incomeByDay.get(iso) ?? 0;
    const expenses = expenseByDay.get(iso) ?? 0;
    points.push({ iso, date, balance: running, income, expenses, hasActivity: income !== 0 || expenses !== 0 });
  }
  return points;
}

/**
 * Expense totals grouped by category (largest first). Income is never an
 * expense category; "Savings" only appears when the app recorded a saving as
 * an expense row (which is the existing app flow). Small categories are rolled
 * up into an "Other" slice so the legend stays legible.
 */
export function buildCategoryData(txs: Transaction[], maxCategories = 6): CategoryDatum[] {
  const totals = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    const amt = toNumber(t.amount);
    if (amt <= 0) continue;
    const cat = t.category?.trim() || 'Other';
    totals.set(cat, (totals.get(cat) ?? 0) + amt);
  }

  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, e) => s + e[1], 0);
  if (total <= 0) return [];

  const leading = entries.slice(0, maxCategories);
  const rest = entries.slice(maxCategories);
  if (rest.length > 0) {
    leading.push(['Other', rest.reduce((s, e) => s + e[1], 0)]);
  }

  return leading.map(([name, value], i) => ({
    name,
    value,
    pct: (value / total) * 100,
    color: REPORT_PALETTE[i % REPORT_PALETTE.length],
  }));
}

/**
 * Whole-number percentage labels for a set of category shares that ALWAYS add up
 * to 100%.
 *
 * `Math.round(pct)` per slice is what makes a heavily skewed month read as
 * nonsense: with Savings ₹10,16,10,100, Other ₹1,25,000 and Freelance ₹5,000
 * (total ₹10,17,40,100) the exact shares are 99.872% / 0.123% / 0.005%, so
 * independent rounding prints "100% / 0% / 0%" and looks like the two smaller
 * categories were free.
 *
 * This uses the largest-remainder method: floor every share, then hand the
 * leftover points to the slices with the biggest fractional part, so the printed
 * integers still total 100. A slice with real money that would floor to 0 is
 * printed as "<1%" rather than a misleading "0%".
 *
 * Only the LABEL is adjusted — `CategoryDatum.pct` and therefore the donut
 * geometry keep the exact values, so the chart and the legend never disagree
 * about the size of a slice.
 */
export function categoryPercentLabels(items: ReadonlyArray<{ value: number }>): string[] {
  if (items.length === 0) return [];

  const total = items.reduce((s, it) => s + (Number.isFinite(it.value) ? it.value : 0), 0);
  if (total <= 0) return items.map(() => '0%');

  const exact = items.map((it) => (Math.max(it.value, 0) / total) * 100);
  const whole = exact.map((pct) => Math.floor(pct));
  const order = exact
    .map((pct, i) => ({ i, remainder: pct - Math.floor(pct) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

  let remaining = 100 - whole.reduce((s, n) => s + n, 0);
  for (let k = 0; k < order.length && remaining > 0; k += 1) {
    whole[order[k].i] += 1;
    remaining -= 1;
  }

  return items.map((it, i) =>
    it.value > 0 && whole[i] === 0 ? '<1%' : `${whole[i]}%`,
  );
}