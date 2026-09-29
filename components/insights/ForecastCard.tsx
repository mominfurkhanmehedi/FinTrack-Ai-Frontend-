import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { useMoney } from '../../hooks/useMoney';
import { useI18n, type TranslationKey } from '../../i18n';
import { FinanceStatus } from '../../services/safeToSpend';
import { formatDate } from '../../utils';
import { InsightCard } from './InsightsLayout';
import { DetailRow, ProgressBar, shrinkProps } from './StatTile';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const STATUS_STYLE: Record<
  FinanceStatus,
  { labelKey: TranslationKey; icon: IoniconName; color: string; text: string; bg: string }
> = {
  'on-track': {
    labelKey: 'insights.forecast.statusOnTrack',
    icon: 'checkmark-circle',
    color: '#16a34a',
    text: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800',
  },
  attention: {
    labelKey: 'insights.forecast.statusAttention',
    icon: 'alert-circle',
    color: '#d97706',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
  },
  risk: {
    labelKey: 'insights.forecast.statusRisk',
    icon: 'warning',
    color: '#dc2626',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
  },
  'insufficient-data': {
    labelKey: 'insights.forecast.notEnoughDataYet',
    icon: 'help-circle',
    color: '#6b7280',
    text: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-50 border-gray-200 dark:bg-gray-800/60 dark:border-gray-700',
  },
};

export interface ForecastCardProps {
  /** Current net balance (income − expenses across all real transactions). */
  balance: number;
  projectedMonthEnd: number | null;
  monthlySavings: number | null;
  savingsRate: number;
  goalProgressPct: number;
  hasGoals: boolean;
  /** ISO `yyyy-mm-dd` estimate, or null when it cannot be projected. */
  eta: string | null;
  etaTitle: string | null;
  status: FinanceStatus;
}

/**
 * ForecastCard (insights)
 * Financial forecast panel: current balance, projected month-end balance,
 * projected monthly savings, savings rate, goal progress and the estimated
 * completion date, plus the forecast status badge.
 *
 * Every figure is precomputed by the shared `services/safeToSpend.ts` layer
 * from real store data and formatted through the ONE `useMoney` formatter, so
 * the selected currency flows through automatically — no symbol is hardcoded.
 */
export function ForecastCard({
  balance,
  projectedMonthEnd,
  monthlySavings,
  savingsRate,
  goalProgressPct,
  hasGoals,
  eta,
  etaTitle,
  status,
}: ForecastCardProps) {
  const { format } = useMoney();
  const { t, locale } = useI18n();
  const s = STATUS_STYLE[status];
  const insufficient = status === 'insufficient-data';
  const dash = t('insights.forecast.notEnoughDataYet');

  return (
    <InsightCard>
      <View className="mb-3">
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('insights.financialForecast')}
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {t('insights.forecastSubtitle')}
        </Text>
      </View>

      <View className="mb-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 dark:border-brand-800 dark:bg-brand-900/20">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="wallet" size={13} color="#4f46e5" />
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('insights.forecast.currentBalance')}
          </Text>
        </View>
        <Text
          className="mt-1 text-2xl font-bold tracking-tight text-brand-700 dark:text-brand-300"
          {...shrinkProps()}
        >
          {format(balance)}
        </Text>
      </View>

      <DetailRow
        icon="trending-up-outline"
        label={t('insights.forecast.projectedMonthEnd')}
        value={projectedMonthEnd != null ? format(projectedMonthEnd) : dash}
        valueClassName={
          projectedMonthEnd != null && projectedMonthEnd < 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-gray-100'
        }
      />
      <DetailRow
        icon="cash-outline"
        label={t('insights.forecast.projectedMonthlySavings')}
        value={monthlySavings != null ? format(monthlySavings) : dash}
      />
      <DetailRow
        icon="pie-chart-outline"
        label={t('insights.forecast.savingsRate')}
        value={
          insufficient
            ? dash
            : `${Math.round(Number.isFinite(savingsRate) ? savingsRate : 0)}%`
        }
      />

      <View className="mt-2.5">
        <View className="mb-1.5 flex-row items-center justify-between">
          <Text className="text-[13px] text-gray-500 dark:text-gray-400">
            {t('insights.forecast.goalProgress')}
          </Text>
          <Text className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
            {hasGoals ? `${Math.round(goalProgressPct)}%` : t('insights.forecast.noGoalsYet')}
          </Text>
        </View>
        <ProgressBar pct={goalProgressPct} />
      </View>

      <DetailRow
        icon="calendar-outline"
        label={t('insights.forecast.estimatedCompletion')}
        value={
          eta
            ? formatDate(eta, locale)
            : hasGoals
              ? dash
              : t('insights.forecast.noGoalsYet')
        }
      />

      <View className={`mt-3 flex-row items-center rounded-xl border px-3 py-2.5 ${s.bg}`}>
        <Ionicons name={s.icon} size={16} color={s.color} />
        <Text className={`ml-2 flex-1 text-sm font-medium ${s.text}`} numberOfLines={2}>
          {t(s.labelKey)}
        </Text>
      </View>

      {eta && etaTitle ? (
        <Text className="mt-2 text-xs leading-4 text-gray-400 dark:text-gray-500">
          {t('insights.forecast.nearestGoal', { title: etaTitle })}
        </Text>
      ) : null}
    </InsightCard>
  );
}
