import { useMemo } from 'react';

import { Transaction } from '../../types';
import { buildDayIndex, DayIndex } from './calendarData';

/**
 * useDayIndex
 * The single, shared `yyyy-mm-dd` → transactions index for the Insights
 * calendar.
 *
 * The store already holds the user's whole transaction list in memory (hydrated
 * once from Supabase, then kept in sync optimistically), so building this index
 * once per transaction-list change gives O(1) date lookups for free: selecting
 * a different day re-reads a Map entry instead of hitting the database, and
 * switching months rebuilds nothing at all.
 */
export function useDayIndex(transactions: Transaction[]): DayIndex {
  return useMemo(() => buildDayIndex(transactions), [transactions]);
}
