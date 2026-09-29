import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  AskFinTrackCard,
  DateTransactions,
  daysInMonth,
  FinancialCalendar,
  ForecastCard,
  InsightPanel,
  InsightsErrorState,
  InsightsLayout,
  InsightsNoDataState,
  isSameMonth,
  isSavingsRow,
  monthKey,
  MonthlyOverviewCard,
  MonthlySummaryStrip,
  parseLocalIso,
  SmartSuggestionsCard,
  SpendingDonutCard,
  summarizeMonth,
  todayIso,
  useDayIndex,
} from '../../components/insights';
import { Button, ResponsiveContainer, ScreenHeader } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useSafeToSpend } from '../../hooks';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { toNumber, sumByType } from '../../utils';

/** Below this width the day panel becomes a bottom sheet (matches the grid). */
const DESKTOP_MIN_WIDTH = 1024;

/**
 * Screen: Insights
 * Tab: AI Insights
 *
 * The real-data analytics dashboard: forecast, month overview, smart
 * suggestions, an interactive spending donut, the Ask FinTrack gateway, month
 * statistics and a fully functional multi-year financial calendar with
 * per-day transactions.
 *
 * Everything on this screen is derived from the real store transactions:
 * `useDayIndex` builds one shared `yyyy-mm-dd` Map from the in-memory list, so
 * switching month or day is an instant in-memory lookup rather than a database
 * round-trip, and all amounts are rendered through `useMoney` so the selected
 * currency always applies.
 */
export default function Insights() {
  const transactions = useAppStore((s) => s.transactions);
  const goals = useAppStore((s) => s.goals);
  const isLoadingData = useAppStore((s) => s.isLoadingData);
  const dataLoadError = useAppStore((s) => s.dataLoadError);
  const hydrateFromSupabase = useAppStore((s) => s.hydrateFromSupabase);

  const { t, locale } = useI18n();
  const { width } = useBreakpoint();
  const { breakdown, forecast, goalEstimates } = useSafeToSpend();

  const isDesktop = width >= DESKTOP_MIN_WIDTH;
  const today = todayIso();

  // Displayed month. Kept as (year, month) rather than a key string so the
  // calendar's month/year selectors can drive it directly.
  const [cursor, setCursor] = useState(() => {
    const now = parseLocalIso(today) ?? new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedIso, setSelectedIso] = useState(today);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** Synchronous mirror of `refreshing` — see handleRefresh. */
  const refreshingRef = useRef(false);

  const dayIndex = useDayIndex(transactions);

  const monthTransactions = useMemo(() => {
    const key = monthKey(cursor.year, cursor.month);
    return transactions.filter((t) => typeof t.date === 'string' && t.date.startsWith(key));
  }, [transactions, cursor.year, cursor.month]);

  const monthSummary = useMemo(
    () => summarizeMonth(transactions, cursor.year, cursor.month),
    [transactions, cursor.year, cursor.month],
  );

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        new Date(cursor.year, cursor.month, 1),
      ),
    [locale, cursor.year, cursor.month],
  );

  const selectedLabel = useMemo(() => {
    const date = parseLocalIso(selectedIso);
    if (!date) return selectedIso;
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }, [locale, selectedIso]);

  /**
   * Moving the calendar keeps a sensible day selected: today when the cursor
   * lands on the current month, otherwise the same day-of-month clamped to the
   * new month's length (so 31 Jan → 28/29 Feb stays inside the month).
   */
  const handleMonthChange = useCallback(
    (year: number, month: number) => {
      setCursor({ year, month });
      setSelectedIso((prev) => {
        const now = parseLocalIso(today);
        if (now && year === now.getFullYear() && month === now.getMonth()) return today;
        const day = Number(prev.slice(8, 10));
        const clamped = Math.min(Number.isFinite(day) && day > 0 ? day : 1, daysInMonth(year, month));
        return `${monthKey(year, month)}-${String(clamped).padStart(2, '0')}`;
      });
    },
    [today],
  );

  /** Tapping a day — including the calendar's adjacent-month spill cells. */
  const handleSelectDate = useCallback(
    (iso: string) => {
      setSelectedIso(iso);
      const cell = parseLocalIso(iso);
      if (cell) {
        const year = cell.getFullYear();
        const month = cell.getMonth();
        if (!isSameMonth(year, month, cursor.year, cursor.month)) {
          setCursor({ year, month });
        }
      }
      if (!isDesktop) setSheetOpen(true);
    },
    [cursor.month, cursor.year, isDesktop],
  );

  /**
   * Manual pull-to-refresh.
   *
   * The `refreshing` React state was the only guard, but `setRefreshing(true)`
   * does not take effect until after the current tick — two taps in the same
   * tick both read `refreshing === false` and both fired a `force` hydration.
   * The ref flips synchronously, so a rapid double-tap now collapses into a
   * single request.
   */
  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await hydrateFromSupabase(undefined, true);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [hydrateFromSupabase]);

  const goalProgress = useMemo(() => {
    const target = goals.reduce((s, g) => s + toNumber(g.target), 0);
    const saved = goals.reduce((s, g) => s + toNumber(g.saved), 0);
    return target > 0 ? Math.min((saved / target) * 100, 100) : 0;
  }, [goals]);

  /**
   * All-time savings rate, using the same convention as the calendar and month
   * summary: savings are money moved into goals, so they are excluded from
   * expenses and net = income − expenses − savings. The forecast service does
   * not expose a rate, so it is derived here from the real rows rather than
   * left blank or hardcoded.
   */
  const lifetimeSavingsRate = useMemo(() => {
    const income = sumByType(transactions, 'income');
    if (income <= 0) return 0;
    const expenses = sumByType(transactions, 'expense');
    const savings = transactions
      .filter((t) => t.type === 'expense' && isSavingsRow(t))
      .reduce((s, t) => s + toNumber(t.amount), 0);
    return ((income - expenses - savings) / income) * 100;
  }, [transactions]);

  const daysElapsed = useMemo(() => {
    const now = parseLocalIso(today);
    if (!now) return monthSummary.count > 0 ? 1 : 0;
    if (now.getFullYear() !== cursor.year || now.getMonth() !== cursor.month) {
      // A past month is complete; a future month has not started.
      const isPast =
        now.getFullYear() > cursor.year ||
        (now.getFullYear() === cursor.year && now.getMonth() > cursor.month);
      return isPast ? daysInMonth(cursor.year, cursor.month) : 0;
    }
    return now.getDate();
  }, [today, cursor.year, cursor.month, monthSummary.count]);

  const daysTotal = daysInMonth(cursor.year, cursor.month);

  const openTransaction = useCallback((id: string) => {
    router.push(`${ROUTES.MODALS.TRANSACTION_DETAIL}?id=${id}`);
  }, []);

  const hasData = transactions.length > 0;
  const showError = !hasData && !isLoadingData && !!dataLoadError;

  const headerAction = (
    <Pressable
      onPress={handleRefresh}
      disabled={refreshing || isLoadingData}
      accessibilityRole="button"
      accessibilityLabel={t('common.refresh')}
      accessibilityState={{ busy: refreshing || isLoadingData }}
      className="h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white active:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:active:bg-gray-800"
    >
      {refreshing || isLoadingData ? (
        <ActivityIndicator size="small" color="#4f46e5" />
      ) : (
        <Ionicons name="refresh" size={19} color="#4f46e5" />
      )}
    </Pressable>
  );

  if (showError) {
    return (
      <ResponsiveContainer>
        <ScreenHeader title={t('insights.screenTitle')} subtitle={t('insights.screenSubtitle')} />
        <InsightsErrorState onRetry={handleRefresh} retrying={isLoadingData || refreshing} />
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <ScreenHeader
        title={t('insights.screenTitle')}
        subtitle={t('insights.screenSubtitle')}
        action={headerAction}
      />

      <InsightsLayout>
        <InsightPanel span={4} tabletSpan={1}>
          <ForecastCard
            balance={forecast.balance}
            projectedMonthEnd={forecast.projectedMonthEnd}
            monthlySavings={forecast.monthlySavings}
            savingsRate={lifetimeSavingsRate}
            goalProgressPct={goalProgress}
            hasGoals={goals.length > 0}
            eta={forecast.nearestGoalEta}
            etaTitle={forecast.nearestGoalTitle}
            status={forecast.status}
          />
        </InsightPanel>

        <InsightPanel span={4} tabletSpan={1}>
          <MonthlyOverviewCard
            income={monthSummary.income}
            expenses={monthSummary.expenses}
            savings={monthSummary.savings}
            savingsRate={monthSummary.savingsRate}
            safeToSpend={breakdown.safeToSpend}
            monthLabel={monthLabel}
          />
        </InsightPanel>

        <InsightPanel span={4} tabletSpan={1}>
          <SmartSuggestionsCard
            monthTransactions={monthTransactions}
            allTransactions={transactions}
            goals={goals}
            goalEstimates={goalEstimates}
            daysElapsed={daysElapsed}
            daysInMonth={daysTotal}
            monthIncome={monthSummary.income}
            monthExpenses={monthSummary.expenses}
            monthSavings={monthSummary.savings}
            safeToSpend={breakdown.safeToSpend}
            safeToSpendInsufficient={breakdown.insufficientData}
            onPressCategory={() => router.push(ROUTES.MODALS.ASK_FINTRACK)}
          />
        </InsightPanel>

        <InsightPanel span={7} tabletSpan={1}>
          <SpendingDonutCard
            transactions={monthTransactions}
            monthLabel={monthLabel}
            onAsk={() => router.push(ROUTES.MODALS.ASK_FINTRACK)}
          />
        </InsightPanel>

        <InsightPanel span={5} tabletSpan={2}>
          <AskFinTrackCard />
        </InsightPanel>

        <InsightPanel span={12} tabletSpan={2}>
          <MonthlySummaryStrip summary={monthSummary} monthLabel={monthLabel} />
        </InsightPanel>

        <InsightPanel span={7} tabletSpan={1}>
          <FinancialCalendar
            year={cursor.year}
            month={cursor.month}
            onMonthChange={handleMonthChange}
            selectedIso={selectedIso}
            onSelectDate={handleSelectDate}
            todayIso={today}
            dayIndex={dayIndex}
            monthLabel={monthLabel}
          />
        </InsightPanel>

        {isDesktop ? (
          <InsightPanel span={5} tabletSpan={1}>
            <DateTransactions
              selectedIso={selectedIso}
              selectedLabel={selectedLabel}
              dayIndex={dayIndex}
              goals={goals}
              onOpenTransaction={openTransaction}
            />
          </InsightPanel>
        ) : null}
      </InsightsLayout>

      {hasData ? null : <InsightsNoDataState onAdd={() => router.push(ROUTES.MODALS.ADD_TRANSACTION)} />}

      {/* Mobile: the day detail is a bottom sheet so the calendar stays tappable. */}
      {isDesktop ? null : (
        <DateTransactions
          selectedIso={selectedIso}
          selectedLabel={selectedLabel}
          dayIndex={dayIndex}
          goals={goals}
          onOpenTransaction={openTransaction}
          asSheet
          visible={sheetOpen}
          onCloseSheet={() => setSheetOpen(false)}
        />
      )}

      {hasData && !isDesktop ? (
        <View className="mt-4 flex-row justify-center">
          <Button
            title={t('insights.addTransaction')}
            onPress={() =>
              router.push(`${ROUTES.MODALS.ADD_TRANSACTION}?type=expense&date=${selectedIso}`)
            }
            variant="secondary"
            leftIcon={<Ionicons name="add" size={16} color="#4338ca" />}
          />
        </View>
      ) : null}
    </ResponsiveContainer>
  );
}
