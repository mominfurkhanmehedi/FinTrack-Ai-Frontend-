import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { useMoney } from '../../hooks/useMoney';
import { useI18n } from '../../i18n';
import { MonthSummary } from './calendarData';
import { useCardContentWidth, useInsightRowFill } from './InsightsLayout';
import { shrinkProps } from './StatTile';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Narrowest a metric tile can be and still show a currency value legibly. */
const MIN_TILE_WIDTH = 104;
/** The strip is a `p-4` surface, not a `p-5` Card. */
const STRIP_PADDING_X = 16;

interface Metric {
  icon: IoniconName;
  label: string;
  value: string;
  color: string;
  valueClassName: string;
}

export interface MonthlySummaryProps {
  summary: MonthSummary;
  /** e.g. "September 2026" */
  monthLabel: string;
}

/**
 * MonthlySummaryStrip (insights)
 * The month-level statistics band: income, expenses, savings, net cash flow and
 * transaction count for the month currently shown in the calendar. Changing the
 * calendar's month or year re-computes the summary instantly from the same
 * in-memory transaction index, so the numbers always match the grid.
 *
 * `net` is income − expenses − savings, matching the daily panel and the
 * calendar indicators exactly.
 */
export function MonthlySummaryStrip({ summary, monthLabel }: MonthlySummaryProps) {
  const { format } = useMoney();
  const { t } = useI18n();
  const fill = useInsightRowFill();
  const [contentWidth, onLayout] = useCardContentWidth(STRIP_PADDING_X);

  const netTone =
    summary.net > 0
      ? 'text-green-700 dark:text-green-400'
      : summary.net < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-900 dark:text-gray-100';

  const metrics: Metric[] = [
    {
      icon: 'arrow-down-circle',
      label: t('insights.income'),
      value: format(summary.income),
      color: '#16a34a',
      valueClassName: 'text-green-700 dark:text-green-400',
    },
    {
      icon: 'arrow-up-circle',
      label: t('insights.expenses'),
      value: format(summary.expenses),
      color: '#dc2626',
      valueClassName: 'text-red-600 dark:text-red-400',
    },
    {
      icon: 'bookmark',
      label: t('insights.savings'),
      value: format(summary.savings),
      color: '#4f46e5',
      valueClassName: 'text-brand-700 dark:text-brand-300',
    },
    {
      icon: 'swap-horizontal',
      label: t('insights.netCashFlow'),
      value: format(summary.net),
      color: summary.net < 0 ? '#dc2626' : '#16a34a',
      valueClassName: netTone,
    },
    {
      icon: 'receipt-outline',
      label: t('insights.transactionCount'),
      value: String(summary.count),
      color: '#6b7280',
      valueClassName: 'text-gray-900 dark:text-gray-100',
    },
  ];

  // Tiles per row from the width the strip really has: 2 on a 360/390px phone,
  // up to 5 on a wide desktop row. The window width is only a pre-measurement
  // guess, so a multi-column grid falls back to 1 until it has been measured.
  const perRow = contentWidth > 0 ? Math.max(1, Math.min(5, Math.floor(contentWidth / MIN_TILE_WIDTH))) : 1;
  const amountSize = perRow >= 5 ? 'text-lg' : perRow >= 3 ? 'text-[17px]' : 'text-base';

  const rows: Metric[][] = [];
  for (let i = 0; i < metrics.length; i += perRow) rows.push(metrics.slice(i, i + perRow));

  return (
    <View
      onLayout={onLayout}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      style={fill}
    >
      <View className="mb-3 flex-row items-center gap-2">
        <Ionicons name="bar-chart" size={15} color="#4f46e5" />
        <Text className="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100" numberOfLines={1}>
          {t('insights.monthlyStatistics')}
        </Text>
        <View className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 dark:bg-brand-900/20">
          <Text className="text-[11px] font-semibold text-brand-700 dark:text-brand-300" numberOfLines={1}>
            {monthLabel}
          </Text>
        </View>
      </View>

      <View className="gap-2">
        {rows.map((row, i) => (
          // The row is only as wide as the tiles it holds, so a short final row
          // keeps the same tile size as the rows above instead of stretching.
          <View
            key={i}
            className="flex-row gap-2"
            style={{ width: `${(row.length / perRow) * 100}%` }}
          >
            {row.map((m) => (
              <View
                key={m.label}
                accessible
                accessibilityLabel={`${m.label}: ${m.value}`}
                className="min-w-0 flex-1 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/40"
              >
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name={m.icon} size={13} color={m.color} />
                  <Text className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400" numberOfLines={1}>
                    {m.label}
                  </Text>
                </View>
                <Text
                  className={`mt-1 font-bold tracking-tight ${amountSize} ${m.valueClassName}`}
                  style={{ flexShrink: 1 }}
                  {...shrinkProps()}
                >
                  {m.value}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
