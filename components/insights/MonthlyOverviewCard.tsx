import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useMoney } from '../../hooks/useMoney';
import { useI18n } from '../../i18n';
import { InsightCard, useCardContentWidth } from './InsightsLayout';
import { shrinkProps, StatTile } from './StatTile';

/**
 * Narrowest a tile can be and still show a value like "₹10,16,10,100.00"
 * legibly (the value is allowed to shrink to 60% before it becomes unreadable).
 */
const MIN_TILE_WIDTH = 116;

export interface MonthlyOverviewProps {
  /** Totals for the month currently displayed by the calendar. */
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  /** Live "safe to spend" figure from the shared safe-to-spend layer. */
  safeToSpend: number;
  /** e.g. "September 2026" — tells the user which month these totals cover. */
  monthLabel: string;
}

/**
 * MonthlyOverviewCard (insights)
 * Income, expenses, savings and savings rate for the month shown in the
 * calendar, plus the live safe-to-spend amount.
 *
 * Values arrive already computed from the real transactions for that month and
 * are rendered through the shared `useMoney` formatter, so switching the
 * currency in Settings updates every number here (₹30,000.00 / $30,000.00 /
 * €30.000,00) with nothing hardcoded and no broken digit grouping.
 */
export function MonthlyOverviewCard({
  income,
  expenses,
  savings,
  savingsRate,
  safeToSpend,
  monthLabel,
}: MonthlyOverviewProps) {
  const { format } = useMoney();
  const { t } = useI18n();
  const [contentWidth, onLayout] = useCardContentWidth();

  // How many tiles fit across the width the card REALLY has, rather than a fixed
  // breakpoint: 2-up on a 360/390px phone (three currency values were being
  // crushed there), 3-up once there is genuinely room. The window width is only
  // a pre-measurement guess, so it is ignored in a multi-column grid.
  const perRow = contentWidth > 0 ? Math.max(1, Math.min(3, Math.floor(contentWidth / MIN_TILE_WIDTH))) : 1;
  const stacks = (items: React.ReactNode[]) => {
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
    return rows;
  };

  const rate = Number.isFinite(savingsRate) ? savingsRate : 0;
  const rateTone =
    rate >= 20
      ? 'text-green-700 dark:text-green-400'
      : rate >= 0
        ? 'text-brand-700 dark:text-brand-300'
        : 'text-red-600 dark:text-red-400';

  return (
    <InsightCard onLayout={onLayout}>
      <View className="mb-3">
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('insights.monthlyOverview')}
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {monthLabel}
        </Text>
      </View>

      <View className="gap-2">
        {stacks([
          <StatTile
            key="income"
            icon="arrow-down-circle"
            label={t('insights.income')}
            value={format(income)}
            color="#16a34a"
            tint="bg-green-50 border-green-100 dark:bg-green-950/40 dark:border-green-800"
            valueClassName="text-green-700 dark:text-green-400"
          />,
          <StatTile
            key="expenses"
            icon="arrow-up-circle"
            label={t('insights.expenses')}
            value={format(expenses)}
            color="#dc2626"
            tint="bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-800"
            valueClassName="text-red-600 dark:text-red-400"
          />,
          <StatTile
            key="savings"
            icon="bookmark"
            label={t('insights.savings')}
            value={format(savings)}
            color="#4f46e5"
            tint="bg-brand-50 border-brand-100 dark:bg-brand-900/20 dark:border-brand-800"
            valueClassName="text-brand-700 dark:text-brand-300"
          />,
        ])}
      </View>

      <View className="mt-2 flex-row items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/50">
        <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
          <Ionicons name="trending-up" size={14} color={rate >= 0 ? '#4f46e5' : '#dc2626'} />
          <Text className="text-[13px] text-gray-500 dark:text-gray-400" numberOfLines={1}>
            {t('insights.savingsRate')}
          </Text>
        </View>
        <Text className={`shrink-0 text-sm font-bold ${rateTone}`} numberOfLines={1}>
          {`${Math.round(rate)}%`}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-gray-800">
        <Ionicons name="shield-checkmark" size={16} color="#4f46e5" />
        <Text className="min-w-0 flex-1 text-[13px] text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {t('insights.safeToSpendNowShort')}
        </Text>
        <Text className="min-w-0 text-sm font-bold text-brand-700 dark:text-brand-300" style={{ flexShrink: 1 }} {...shrinkProps()}>
          {format(safeToSpend)}
        </Text>
      </View>
    </InsightCard>
  );
}
