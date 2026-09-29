import { Goal, Transaction } from '../types';
import { netBalance, sumByType, toNumber } from '../utils';

/**
 * SAFE-TO-SPEND CALCULATION LAYER
 * Pure, framework-free financial math shared by the dashboard card, the
 * Safe-to-Spend detail modal, the What-If simulator, the AI Insights screen,
 * and the Ask FinTrack analyzer. Nothing here touches the store, AsyncStorage,
 * or Supabase, so it is fully unit-testable (see tests/) and can never mutate
 * real data.
 *
 * CONCEPT (no double counting):
 *
 *   Safe to Spend = total balance
 *                 − reserved goal amount      (money actually saved toward
 *                                              goals = Σ goal.saved)
 *                 − upcoming expenses         (rest-of-month projection from
 *                                              the user's real spending pace)
 *                 − safety/emergency buffer   (auto: ~N days of spending, or a
 *                                              user-set amount)
 *
 * Saving money records a "Savings" expense in the existing app flow, so the
 * net balance already excludes money moved into goals. If "Goal reserved"
 * were simply subtracted again, every rupee saved would be counted twice.
 * Instead the already-saved goal money is added BACK into the total balance
 * (money parked in a goal is still the user's cash) and then protected as the
 * goal reserve. The two steps offset, so each rupee is counted exactly once
 * and moving money into a goal reduces safe-to-spend by exactly the amount
 * saved — never by the full target, which is what caused inflated red figures.
 *
 * Projected upcoming expenses (and the spending pace) exclude "Savings" rows
 * so goal money is never reserved twice.
 *
 * All amounts are clamped to valid finite numbers (NaN/Infinity can never
 * leak in), and every negative result is handled explicitly rather than
 * silently.
 */

/** Auto-buffer window: how many days of typical spending to hold in reserve. */
export const AUTO_BUFFER_DAYS = 5;

/** Spending-pace lookback window (days). */
const PACE_WINDOW_DAYS = 30;

/** How far back to look for monthly aggregates (surplus, savings pace). */
const MONTH_LOOKBACK = 6;

/* ------------------------------------------------------------------ */
/* Date helpers (local time; ISO `yyyy-mm-dd`, matching the app utils).*/
/* ------------------------------------------------------------------ */

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysInMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function startOfMonthIso(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function addMonths(start: Date, months: number): Date {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isoDayDiff(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00`);
  const b = new Date(`${bIso}T00:00:00`);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

const toIso = (d: Date): string => isoOf(d);

/* ------------------------------------------------------------------ */
/* Safe-to-spend                                                       */
/* ------------------------------------------------------------------ */

export interface SafeToSpendInput {
  transactions: Transaction[];
  goals: Goal[];
  /**
   * Safety buffer to protect. `null` (default) auto-derives it from the user's
   * observed spending pace (`bufferDays` days of spending).
   */
  emergencyBuffer?: number | null;
  /** Days of spending used for the auto buffer. Defaults to AUTO_BUFFER_DAYS. */
  bufferDays?: number;
  /** Reference date for projections. Defaults to today. Deterministic in tests. */
  now?: Date;
  /** Internal: simulate a different balance without fabricating transactions. */
  balanceOverride?: number;
}

export interface SafeToSpendBreakdown {
  /**
   * Total balance = net balance (income − expenses) PLUS money saved toward
   * goals (Σ goal.saved). Saved money is the user's cash, just earmarked, so
   * it is added back here and then protected again as `goalReserve`. The two
   * offset — each rupee is counted exactly once.
   */
  balance: number;
  /**
   * Money actually saved toward goals: Σ goal.saved (clamped to finite
   * non-negative). NOT the remaining target — reserving the full target made
   * the balance look far more protected than it is.
   */
  goalReserve: number;
  /** Projected spending still expected for the rest of the month. */
  upcomingExpenses: number;
  /** Safety buffer in effect (auto-calculated or user-set). */
  emergencyBuffer: number;
  /** goalReserve + upcomingExpenses + emergencyBuffer. */
  totalReserved: number;
  /** balance − totalReserved. May be negative — callers must render it as such. */
  safeToSpend: number;
  /** True when the data is too thin to be meaningful (no transactions). */
  insufficientData: boolean;
}

export interface DailySafeToSpend {
  /** Full breakdown the daily value is derived from. */
  breakdown: SafeToSpendBreakdown;
  /** Whole days left in the current calendar month, today inclusive. */
  daysRemaining: number;
  /** Safe-to-spend / daysRemaining, floored at 0 (never negative). */
  daily: number;
}

/**
 * Average daily expense for the trailing window, EXCLUDING "Savings" rows
 * (money moved to goals is reserved separately and must not inflate the
 * spending pace). Returns an absolute value.
 */
export function averageDailyExpense(
  txs: Transaction[],
  now: Date,
  windowDays = PACE_WINDOW_DAYS,
): number {
  const fromIso = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (windowDays - 1)));
  const spend = txs.filter(
    (t) => t.type === 'expense' && t.category !== 'Savings' && t.date >= fromIso,
  );
  if (spend.length === 0) return 0;

  // Number of actual calendar days covered by the observed spending (capped at
  // the window) so sparse data doesn't get artificially flattened.
  const earliest = spend.reduce((min, t) => (t.date < min ? t.date : min), spend[0].date);
  const span = Math.max(1, Math.min(windowDays, isoDayDiff(isoOf(now), earliest) + 1));
  return span > 0 ? sumByType(spend, 'expense') / span : 0;
}

/** Money that is safe to spend right now without hurting goals/upcoming needs. */
export function calculateSafeToSpend(input: SafeToSpendInput): SafeToSpendBreakdown {
  const now = input.now ?? new Date();

  // Money already moved into goals. This is the amount actually set aside, not
  // the target still to be reached (which is what previously inflated the
  // reserve). Clamped to finite non-negative so corrupt/negative saved values
  // can never create an unrealistic reserved balance.
  const savedInGoals = input.goals.reduce((sum, g) => {
    const saved = toNumber(g.saved);
    return sum + Math.max(saved, 0);
  }, 0);

  // Total balance = net flow (income − expenses) PLUS goal money. Because a
  // saving is recorded as a "Savings" expense, the net flow already excludes
  // it; adding it back means "Goal reserved" below is its only deduction, so
  // no rupee is ever counted twice. `balanceOverride` (the What-If simulator)
  // is already in this "total" space and replaces the whole amount.
  const balance = toNumber(
    input.balanceOverride != null
      ? input.balanceOverride
      : netBalance(input.transactions) + savedInGoals,
  );

  const goalReserve = savedInGoals;

  const avgDaily = averageDailyExpense(input.transactions, now);
  const daysRemaining = daysInMonth(now) - now.getDate() + 1;
  // Upcoming = money still expected AFTER today (tomorrow → month end). Today's
  // spending stays inside the daily allowance instead.
  const upcomingExpenses = Math.max(avgDaily * Math.max(daysRemaining - 1, 0), 0);

  const autoBuffer = avgDaily * (input.bufferDays ?? AUTO_BUFFER_DAYS);
  const emergencyBuffer = Math.max(toNumber(input.emergencyBuffer ?? autoBuffer), 0);

  const totalReserved = goalReserve + upcomingExpenses + emergencyBuffer;

  return {
    balance,
    goalReserve,
    upcomingExpenses,
    emergencyBuffer,
    totalReserved,
    safeToSpend: balance - totalReserved,
    insufficientData: input.transactions.length === 0,
  };
}

/** Daily slice of safe-to-spend for the rest of the current month. */
export function calculateDailySafeToSpend(
  breakdown: SafeToSpendBreakdown,
  now: Date = new Date(),
): DailySafeToSpend {
  const daysRemaining = daysInMonth(now) - now.getDate() + 1;
  return {
    breakdown,
    daysRemaining,
    daily: daysRemaining > 0 ? Math.max(breakdown.safeToSpend, 0) / daysRemaining : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Goal projections                                                    */
/* ------------------------------------------------------------------ */

export interface GoalEstimate {
  goalId: string;
  title: string;
  target: number;
  saved: number;
  remaining: number;
  /** Percentage 0–100, capped. */
  progressPct: number;
  /** Monthly amount assumed saveable toward goals (real behavior, else surplus). */
  pace: number;
  /** Whole months needed at `pace`, or null when the pace is 0. */
  monthsNeeded: number | null;
  /** Estimated completion ISO date, or null when not calculable. */
  etaIso: string | null;
  /** True when a deadline exists and the current pace still meets it (or goal done). */
  onTrack: boolean;
}

export interface MonthBucket {
  key: string;
  income: number;
  expenses: number;
  savings: number;
}

/** Per-calendar-month aggregates from real transactions (oldest → newest). */
export function monthBuckets(txs: Transaction[], now = new Date()): MonthBucket[] {
  const lookback = new Date(now.getFullYear(), now.getMonth() - (MONTH_LOOKBACK - 1), 1);
  const cutoff = isoOf(lookback);
  const lastDay = isoOf(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const buckets = new Map<string, MonthBucket>();

  for (const t of txs) {
    if (t.date < cutoff || t.date > lastDay) continue; // only current + previous months
    const key = t.date.slice(0, 7);
    const b = buckets.get(key) ?? { key, income: 0, expenses: 0, savings: 0 };
    if (t.type === 'income') b.income += toNumber(t.amount);
    else {
      b.expenses += toNumber(t.amount);
      if (t.category === 'Savings') b.savings += toNumber(t.amount);
    }
    buckets.set(key, b);
  }
  return [...buckets.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** Average monthly surplus (income − expenses) over observed months. */
export function averageMonthlySurplus(txs: Transaction[], now = new Date()): number {
  const months = monthBuckets(txs, now);
  if (months.length === 0) return 0;
  return months.reduce((s, m) => s + (m.income - m.expenses), 0) / months.length;
}

/**
 * Monthly savings "pace": the real amount added to goals per month. Falls back
 * to the average monthly surplus when no savings contributions are recorded so
 * the projection still uses real cash flow.
 */
export function monthlySavingsCapacity(txs: Transaction[], now = new Date()): number {
  const months = monthBuckets(txs, now);
  if (months.length === 0) return 0;

  const savingsPace = months.reduce((sum, m) => sum + m.savings, 0) / months.length;
  if (savingsPace > 0) return savingsPace;

  return months.reduce((sum, m) => sum + Math.max(m.income - m.expenses, 0), 0) / months.length;
}

export function estimateGoalCompletion(
  goal: Goal,
  txs: Transaction[],
  now = new Date(),
  paceOverride?: number,
): GoalEstimate {
  const target = toNumber(goal.target);
  const saved = toNumber(goal.saved);
  const remaining = Math.max(target - saved, 0);
  const progressPct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;

  const pace = paceOverride ?? monthlySavingsCapacity(txs, now);
  const monthsNeeded = remaining > 0 && pace > 0 ? Math.ceil(remaining / pace) : null;
  const etaIso = monthsNeeded != null ? toIso(addMonths(now, monthsNeeded)) : null;

  let onTrack = remaining <= 0;
  if (!onTrack && goal.deadline) {
    const monthsLeft = Math.max(isoDayDiff(goal.deadline, toIso(now)) / 31, 0);
    onTrack = monthsNeeded != null && monthsNeeded <= monthsLeft;
  } else if (!onTrack) {
    onTrack = monthsNeeded != null;
  }

  return {
    goalId: goal.id,
    title: goal.title,
    target,
    saved,
    remaining,
    progressPct,
    pace,
    monthsNeeded,
    etaIso,
    onTrack,
  };
}

/* ------------------------------------------------------------------ */
/* Forecast                                                            */
/* ------------------------------------------------------------------ */

export type FinanceStatus = 'on-track' | 'attention' | 'risk' | 'insufficient-data';

export interface Forecast {
  /** Current net balance. */
  balance: number;
  /** Projected month-end balance, or null when not enough data. */
  projectedMonthEnd: number | null;
  /** Projected net money added/removed between today and month end. */
  projectedChange: number;
  /** Average monthly surplus observed (income − expenses), or null. */
  monthlySurplus: number | null;
  /** Average monthly savings contribution observed, or null. */
  monthlySavings: number | null;
  /** Current-month income. */
  monthIncome: number;
  /** Current-month expenses. */
  monthExpenses: number;
  /** Overall goal progress across all goals (0–100). */
  goalProgressPct: number;
  /** Estimated completion for the nearest active goal, or null. */
  nearestGoalEta: string | null;
  /** Title of the nearest active goal, or null. */
  nearestGoalTitle: string | null;
  status: FinanceStatus;
  label: string;
}

/** Deterministic forecast from real data. Missing pieces report null / '…'. */
export function calculateForecast(
  txs: Transaction[],
  goals: Goal[],
  now = new Date(),
): Forecast {
  const balance = toNumber(netBalance(txs));
  const months = monthBuckets(txs, now);
  const monthStartIso = startOfMonthIso(now);

  const monthIncome = sumByType(txs.filter((t) => t.date >= monthStartIso), 'income');
  const monthExpenses = sumByType(txs.filter((t) => t.date >= monthStartIso), 'expense');

  const surplus = months.length > 0 ? averageMonthlySurplus(txs, now) : null;
  const monthlySavings =
    months.length > 0
      ? months.reduce((s, m) => s + m.savings, 0) / months.length
      : null;

  const daysInM = daysInMonth(now);
  const daysRemaining = Math.max(daysInM - now.getDate() + 1, 0);
  const projectedChange = surplus != null ? surplus * (daysRemaining / daysInM) : 0;
  const projectedMonthEnd = surplus != null ? balance + projectedChange : null;

  const totalTarget = goals.reduce((s, g) => s + toNumber(g.target), 0);
  const totalSaved = goals.reduce((s, g) => s + toNumber(g.saved), 0);
  const goalProgressPct = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  const active = goals
    .map((g) => estimateGoalCompletion(g, txs, now))
    .filter((e) => e.remaining > 0 && e.etaIso != null)
    .sort((a, b) => (a.etaIso! < b.etaIso! ? -1 : 1))[0];

  let status: FinanceStatus;
  let label: string;
  if (txs.length === 0) {
    status = 'insufficient-data';
    label = 'Not enough data yet';
  } else if (projectedMonthEnd != null && projectedMonthEnd < 0) {
    status = 'risk';
    label = 'Projected month-end balance is negative';
  } else if (active && !active.onTrack) {
    status = 'attention';
    label = 'A goal may fall behind its deadline';
  } else {
    status = 'on-track';
    label = 'On track';
  }

  return {
    balance,
    projectedMonthEnd,
    projectedChange,
    monthlySurplus: surplus,
    monthlySavings,
    monthIncome,
    monthExpenses,
    goalProgressPct,
    nearestGoalEta: active?.etaIso ?? null,
    nearestGoalTitle: active?.title ?? null,
    status,
    label,
  };
}

/* ------------------------------------------------------------------ */
/* What-If simulator                                                   */
/* ------------------------------------------------------------------ */

export type SimulationType = 'spend' | 'save-more' | 'increase-expenses' | 'add-purchase';

export interface SimulationRequest {
  type: SimulationType;
  /** Positive amount to simulate. */
  amount: number;
  now?: Date;
}

export interface GoalImpact {
  /** True when every active goal's reserve stays funded after the action. */
  staysOnTrack: boolean;
  /** Estimated delay in whole months (0 = none). */
  delayMonths: number;
  /** Color-coded verdict string for the UI. */
  verdict: string;
}

export interface SimulationResult {
  type: SimulationType;
  amount: number;
  base: SafeToSpendBreakdown;
  baseDaily: DailySafeToSpend;
  after: SafeToSpendBreakdown;
  afterDaily: DailySafeToSpend;
  /** Forecast under the simulated conditions (still a pure estimate). */
  forecast: Forecast;
  impact: GoalImpact;
  /** What the simulation changed (derived only — never written to storage). */
  changes: {
    balanceDelta: number;
    monthlyPaceDelta: number;
    savingsPaceDelta: number;
  };
}

/**
 * Runs a hypothetical scenario WITHOUT touching any real transaction, goal,
 * balance, or setting. Produces a fresh breakdown + forecast for the simulated
 * state and an impact verdict for goal health.
 */
export function simulateFinancialChange(
  input: SafeToSpendInput,
  request: SimulationRequest,
): SimulationResult {
  const now = request.now ?? input.now ?? new Date();
  const amount = Math.max(toNumber(request.amount), 0);

  const base = calculateSafeToSpend(input);
  const baseDaily = calculateDailySafeToSpend(base, now);

  const baseCapacity = monthlySavingsCapacity(input.transactions, now);

  let balanceDelta = 0;
  let savingsPaceDelta = 0;
  let capacityAfter = baseCapacity;

  switch (request.type) {
    case 'spend':
    case 'add-purchase':
      balanceDelta = -amount;
      break;
    case 'save-more':
      savingsPaceDelta = amount;
      capacityAfter = baseCapacity + amount;
      break;
    case 'increase-expenses':
      capacityAfter = Math.max(baseCapacity - amount, 0);
      break;
  }

  const after = calculateSafeToSpend({
    ...input,
    balanceOverride: base.balance + balanceDelta,
  });
  const afterDaily = calculateDailySafeToSpend(after, now);

  // Recurring actions (save-more / increase-expenses) shrink the monthly
  // surplus by the same amount; one-time spends don't.
  const surplusDelta = request.type === 'save-more' || request.type === 'increase-expenses'
    ? amount
    : 0;

  const forecast = simulateForecast(
    input.transactions,
    input.goals,
    after.balance,
    capacityAfter,
    surplusDelta,
    now,
  );

  const activeGoals = input.goals.filter((g) => toNumber(g.target) - toNumber(g.saved) > 0);
  const reserveBreached = after.safeToSpend < 0;
  const savingsPaceDeltaActual = request.type === 'save-more' ? amount : 0;

  let impact: GoalImpact;
  if (activeGoals.length === 0) {
    impact = {
      staysOnTrack: true,
      delayMonths: 0,
      verdict: 'No active goals — this does not affect a goal.',
    };
  } else if (reserveBreached) {
    const monthsToRecover = capacityAfter > 0 ? Math.ceil(-after.safeToSpend / capacityAfter) : 0;
    impact = {
      staysOnTrack: false,
      delayMonths: monthsToRecover,
      verdict:
        monthsToRecover > 0
          ? `⚠️ This may delay your goal by ~${monthsToRecover} month${monthsToRecover === 1 ? '' : 's'}`
          : '⚠️ Reserved amounts exceed your available balance',
    };
  } else {
    impact = {
      staysOnTrack: true,
      delayMonths: 0,
      verdict: '✓ Goals remain on track',
    };
  }

  return {
    type: request.type,
    amount,
    base,
    baseDaily,
    after,
    afterDaily,
    forecast,
    impact,
    changes: {
      balanceDelta,
      monthlyPaceDelta: request.type === 'increase-expenses' ? -amount : 0,
      savingsPaceDelta: savingsPaceDeltaActual,
    },
  };
}

/** Forecast math under a simulated savings capacity + changed balance. */
function simulateForecast(
  txs: Transaction[],
  goals: Goal[],
  balance: number,
  capacity: number,
  surplusDelta: number,
  now: Date,
): Forecast {
  const daysInM = daysInMonth(now);
  const daysRemaining = Math.max(daysInM - now.getDate() + 1, 0);

  const surplus = Math.max(averageMonthlySurplus(txs, now) - surplusDelta, 0);

  const projectedChange = surplus * (daysRemaining / daysInM);
  const projectedMonthEnd = balance + projectedChange;

  const active = goals
    .map((g) => estimateGoalCompletion(g, txs, now, capacity))
    .filter((e) => e.remaining > 0 && e.etaIso != null)
    .sort((a, b) => (a.etaIso! < b.etaIso! ? -1 : 1))[0];

  let status: FinanceStatus;
  let label: string;
  if (txs.length === 0) {
    status = 'insufficient-data';
    label = 'Not enough data yet';
  } else if (projectedMonthEnd < 0) {
    status = 'risk';
    label = 'Projected month-end balance is negative';
  } else if (active && !active.onTrack) {
    status = 'attention';
    label = 'A goal may fall behind its deadline';
  } else {
    status = 'on-track';
    label = 'On track';
  }

  return {
    balance,
    projectedMonthEnd,
    projectedChange,
    monthlySurplus: surplus,
    monthlySavings: null,
    monthIncome: 0,
    monthExpenses: 0,
    goalProgressPct: 0,
    nearestGoalEta: active?.etaIso ?? null,
    nearestGoalTitle: active?.title ?? null,
    status,
    label,
  };
}