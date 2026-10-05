import { useMemo } from 'react';

import {
  calculateDailySafeToSpend,
  calculateForecast,
  calculateSafeToSpend,
  estimateGoalCompletion,
  FinanceStatus,
  Forecast,
  GoalEstimate,
} from '../services/safeToSpend';
import { useAppStore } from '../store';
import { useMoney } from './useMoney';

/**
 * useSafeToSpend
 * Single access point for the Safe-to-Spend feature. Pulls real data from the
 * store, runs the pure calculation layer, and exposes currency-bound
 * formatters plus a status helper for UI coloring.
 */
export function useSafeToSpend() {
  const transactions = useAppStore((s) => s.transactions);
  const goals = useAppStore((s) => s.goals);
  const emergencyBuffer = useAppStore((s) => s.emergencyBuffer);
  const money = useMoney();

  const breakdown = useMemo(
    () => calculateSafeToSpend({ transactions, goals, emergencyBuffer }),
    [transactions, goals, emergencyBuffer],
  );

  // Re-run on every render so "days left in month" always matches today; the
  // heavier aggregates above stay memoized.
  const daily = calculateDailySafeToSpend(breakdown);

  const goalEstimates = useMemo<GoalEstimate[]>(
    () => goals.map((g) => estimateGoalCompletion(g, transactions)),
    [goals, transactions],
  );

  const forecast = useMemo<Forecast>(
    () => calculateForecast(transactions, goals),
    [transactions, goals],
  );

  return {
    transactions,
    goals,
    breakdown,
    daily,
    goalEstimates,
    forecast,
    format: money.format,
    formatCompact: money.formatCompact,
    currency: money.currency,
    /**
     * Display -> base conversion for values the user typed. Falls back to the
     * input when no rate is available, so a rate outage degrades the assistant
     * rather than breaking it.
     */
    toBase: (n: number) => money.toBase(n) ?? n,
    statusTone: statusToneOf(breakdown.safeToSpend, forecast.status),
  };
}

export type StatusTone = 'healthy' | 'attention' | 'risk' | 'neutral';

/** Maps financial state to a UI status tone (green / yellow / red / purple). */
export function statusToneOf(safeToSpend: number, status: FinanceStatus): StatusTone {
  if (status === 'insufficient-data') return 'neutral';
  if (safeToSpend < 0) return 'risk';
  if (status === 'risk') return 'risk';
  if (status === 'attention') return 'attention';
  return 'healthy';
}