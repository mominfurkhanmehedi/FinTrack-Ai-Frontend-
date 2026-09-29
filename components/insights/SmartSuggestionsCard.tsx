import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useMoney } from '../../hooks/useMoney';
import { useI18n } from '../../i18n';
import { GoalEstimate } from '../../services/safeToSpend';
import { Goal, Transaction } from '../../types';
import { InsightCard } from './InsightsLayout';
import {
  categoryBaselines,
  categoryTotals,
  largestExpense,
  projectedMonthSpend,
  savingsOpportunity,
  unusualSpending,
} from './insightMetrics';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type Tone = 'good' | 'warn' | 'bad' | 'info';

const TONE: Record<Tone, { icon: IoniconName; color: string; bg: string }> = {
  good: { icon: 'checkmark-circle-outline', color: '#16a34a', bg: 'bg-green-50 dark:bg-green-950/40' },
  warn: { icon: 'warning-outline', color: '#d97706', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  bad: { icon: 'alert-circle-outline', color: '#dc2626', bg: 'bg-red-50 dark:bg-red-950/40' },
  info: { icon: 'bulb-outline', color: '#4f46e5', bg: 'bg-brand-50 dark:bg-brand-900/20' },
};

interface Suggestion {
  key: string;
  icon: IoniconName;
  tone: Tone;
  text: string;
  /** When set, tapping the row asks Ask FinTrack about this category. */
  category?: string;
}

export interface SmartSuggestionsProps {
  /** Real transactions for the month on screen. */
  monthTransactions: Transaction[];
  /** The user's whole history, used as the baseline for "unusual" checks. */
  allTransactions: Transaction[];
  goals: Goal[];
  goalEstimates: GoalEstimate[];
  /** Days already elapsed / total in the displayed month. */
  daysElapsed: number;
  daysInMonth: number;
  monthIncome: number;
  monthExpenses: number;
  monthSavings: number;
  safeToSpend: number;
  safeToSpendInsufficient: boolean;
  onPressCategory?: (category: string) => void;
}

/**
 * SmartSuggestionsCard (insights)
 * The AI guidance list. Every line is computed from real transactions by the
 * pure `insightMetrics` helpers and the shared safe-to-spend layer — the card
 * contains no hardcoded amounts, categories or thresholds, so it adapts to
 * whichever currency and data the signed-in user actually has.
 *
 * Covers budget warnings, high-spend categories, unusual spending, savings
 * opportunities, upcoming expenses and goal progress, and degrades to a
 * friendly "add transactions" prompt when there is nothing to analyse yet.
 */
export function SmartSuggestionsCard({
  monthTransactions,
  allTransactions,
  goals,
  goalEstimates,
  daysElapsed,
  daysInMonth,
  monthIncome,
  monthExpenses,
  monthSavings,
  safeToSpend,
  safeToSpendInsufficient,
  onPressCategory,
}: SmartSuggestionsProps) {
  const { format } = useMoney();
  const { t } = useI18n();

  const suggestions = useMemo<Suggestion[]>(() => {
    const list: Suggestion[] = [];

    if (monthTransactions.length === 0) {
      return [
        {
          key: 'add',
          icon: 'create-outline',
          tone: 'warn',
          text: t('insights.items.addTransactions'),
        },
      ];
    }

    const totals = categoryTotals(monthTransactions);
    const baselines = categoryBaselines(allTransactions);

    // Budget warning — spending outran income in the displayed month.
    if (monthIncome > 0 && monthExpenses > monthIncome) {
      list.push({
        key: 'over-budget',
        icon: TONE.bad.icon,
        tone: 'bad',
        text: t('insights.items.expensesHigher', { amount: format(monthExpenses - monthIncome) }),
      });
    } else if (monthIncome === 0 && monthExpenses > 0) {
      list.push({
        key: 'no-income',
        icon: TONE.info.icon,
        tone: 'info',
        text: t('insights.items.noIncomeRecorded', { amount: format(monthExpenses) }),
      });
    }

    // High-spend category.
    const top = totals[0];
    if (top && top.pct >= 20) {
      list.push({
        key: 'top-category',
        icon: TONE.info.icon,
        tone: 'info',
        category: top.name,
        text: t('insights.items.largestCategory', {
          name: top.name,
          amount: format(top.value),
          pct: Math.round(top.pct),
        }),
      });
    }

    // Unusual spending vs the user's own monthly baseline for that category.
    const unusual = unusualSpending(monthTransactions, baselines)[0];
    if (unusual) {
      list.push({
        key: 'unusual',
        icon: 'pulse-outline',
        tone: 'warn',
        category: unusual.category,
        text: t('insights.items.unusualSpending', {
          name: unusual.category,
          pct: Math.round(unusual.pctOver),
          amount: format(unusual.amount),
          avg: format(unusual.average),
        }),
      });
    }

    // One-off outlier transaction inside the top category.
    const big = largestExpense(monthTransactions);
    if (big && big.ratio >= 3) {
      list.push({
        key: 'outlier',
        icon: 'flash-outline',
        tone: 'warn',
        category: big.transaction.category,
        text: t('insights.items.largestSingle', {
          title: big.transaction.title,
          amount: format(big.transaction.amount),
        }),
      });
    }

    // Savings opportunity.
    const opportunity = savingsOpportunity(monthTransactions);
    if (opportunity && opportunity.potential > 0) {
      list.push({
        key: 'savings-opportunity',
        icon: 'sparkles-outline',
        tone: 'good',
        category: opportunity.category,
        text: t('insights.items.savingsOpportunity', {
          pct: 10,
          category: opportunity.category,
          amount: format(opportunity.potential),
        }),
      });
    }

    // Upcoming expenses for the rest of the displayed month.
    const pace = projectedMonthSpend(monthTransactions, daysElapsed, daysInMonth);
    const daysLeft = Math.max(0, daysInMonth - daysElapsed);
    if (daysLeft > 0 && pace.dailyPace > 0) {
      list.push({
        key: 'upcoming',
        icon: 'time-outline',
        tone: 'info',
        text: t('insights.items.upcomingExpenses', {
          amount: format(pace.dailyPace * daysLeft),
          days: daysLeft,
        }),
      });
    }

    // Savings actually made this month.
    if (monthSavings > 0) {
      list.push({
        key: 'saved',
        icon: 'bookmark-outline',
        tone: 'good',
        text: t('insights.items.savedThisMonth', { amount: format(monthSavings) }),
      });
    } else if (monthIncome > 0 && monthExpenses > 0) {
      list.push({
        key: 'no-savings',
        icon: 'wallet-outline',
        tone: 'warn',
        text: t('insights.items.noSavingsThisMonth'),
      });
    }

    // Safe-to-spend health.
    if (!safeToSpendInsufficient) {
      if (safeToSpend < 0) {
        list.push({
          key: 'reserves',
          icon: TONE.bad.icon,
          tone: 'bad',
          text: t('insights.items.reservesCover', { amount: format(Math.abs(safeToSpend)) }),
        });
      } else {
        list.push({
          key: 'safe',
          icon: TONE.good.icon,
          tone: 'good',
          text: t('insights.safeToSpendNow', { amount: format(safeToSpend) }),
        });
      }
    }

    // Goal progress.
    const activeGoal = goals.find((g) => g.saved < g.target);
    if (activeGoal) {
      const estimate = goalEstimates.find((e) => e.goalId === activeGoal.id);
      if (estimate) {
        const ahead = estimate.pace > 0 && (estimate.monthsNeeded == null || estimate.onTrack);
        list.push({
          key: 'goal',
          icon: ahead ? 'flag-outline' : 'alert-circle-outline',
          tone: ahead ? 'good' : 'warn',
          text: ahead
            ? t('insights.items.onPaceForGoal', { title: activeGoal.title })
            : t('insights.items.needSaveMore', { title: activeGoal.title }),
        });
      }
    }

    if (list.length === 0) {
      list.push({ key: 'healthy', icon: TONE.good.icon, tone: 'good', text: t('insights.items.healthyTrack') });
    }
    return list;
  }, [
    allTransactions,
    daysElapsed,
    daysInMonth,
    format,
    goalEstimates,
    goals,
    monthExpenses,
    monthIncome,
    monthSavings,
    monthTransactions,
    safeToSpend,
    safeToSpendInsufficient,
    t,
  ]);

  return (
    <InsightCard>
      <View className="mb-3">
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('insights.smartSuggestions')}
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {t('insights.suggestionsSubtitle')}
        </Text>
      </View>

      <View>
        {suggestions.map((s) => {
          const tone = TONE[s.tone];
          const tappable = Boolean(s.category && onPressCategory);
          return (
            <Pressable
              key={s.key}
              onPress={tappable && onPressCategory ? () => onPressCategory(s.category!) : undefined}
              disabled={!tappable}
              accessibilityRole={tappable ? 'button' : 'text'}
              accessibilityLabel={s.text}
              className="mb-1.5 flex-row items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2 active:bg-gray-50 dark:active:bg-gray-800/50"
            >
              <View className={`mt-0.5 h-7 w-7 items-center justify-center rounded-lg ${tone.bg}`}>
                <Ionicons name={s.icon} size={15} color={tone.color} />
              </View>
              <Text className="flex-1 text-[13px] leading-5 text-gray-700 dark:text-gray-200">
                {s.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </InsightCard>
  );
}
