import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, ResponsiveContainer, ResponsiveGrid, ScreenHeader } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { useMoney } from '../../hooks';
import { Transaction, Budget as BudgetType } from '../../types';
import { convertCurrency } from '../../utils/currency';

/**
 * Calculate spent amount for a budget based on matching expense transactions.
 * Matches by category and date range (inclusive).
 * This is the BASE calculation without rollover - used to avoid recursion.
 */
function calculateBaseBudgetSpending(budget: BudgetType, transactions: Transaction[]): {
  spent: number;
  remaining: number;
  overBudget: number;
  progress: number;
} {
  const startDate = budget.startDate;
  const endDate = budget.endDate;

  const matchingExpenses = transactions.filter((tx) => {
    if (tx.type !== 'expense') return false;
    if (tx.category.trim().toLowerCase() !== budget.category.trim().toLowerCase()) return false;
    if (startDate && tx.date < startDate) return false;
    if (endDate && tx.date > endDate) return false;
    return true;
  });

  const spent = matchingExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const remainingRaw = budget.amount - spent;
  const remaining = remainingRaw >= 0 ? remainingRaw : 0;
  const overBudget = remainingRaw < 0 ? -remainingRaw : 0;
  const progress = budget.amount > 0 ? Math.min(spent / budget.amount, 1) : 0;

  return { spent, remaining, overBudget, progress };
}

/**
 * Calculate budget spending with rollover support.
 * If rollover is enabled, finds the most recent previous budget (same category + period)
 * and adds its unused amount to the current budget's available amount.
 */
function calculateBudgetSpending(budget: BudgetType, transactions: Transaction[], allBudgets: BudgetType[]): {
  spent: number;
  remaining: number;
  overBudget: number;
  progress: number;
} {
  const base = calculateBaseBudgetSpending(budget, transactions);

  if (!budget.rollover) {
    return base;
  }

  const currentStartDate = budget.startDate;
  if (!currentStartDate) {
    return base;
  }

  const previousBudgets = allBudgets.filter((b) => {
    if (b.id === budget.id) return false;
    if (b.category.trim().toLowerCase() !== budget.category.trim().toLowerCase()) return false;
    if (b.period !== budget.period) return false;
    if (!b.endDate) return false;
    return b.endDate < currentStartDate;
  });

  if (previousBudgets.length === 0) {
    return base;
  }

  const latestPrevious = previousBudgets.reduce((latest, current) => {
    return current.endDate && latest.endDate && current.endDate > latest.endDate ? current : latest;
  });

  const previousBase = calculateBaseBudgetSpending(latestPrevious, transactions);
  let previousRemaining = previousBase.remaining;

  // Convert previous budget's remaining to current budget's currency if they differ
  if (latestPrevious.currency !== budget.currency) {
    const converted = convertCurrency(previousRemaining, latestPrevious.currency, budget.currency);
    if (converted !== null) {
      previousRemaining = converted;
    }
  }

  const availableAmount = budget.amount + previousRemaining;
  const remainingRaw = availableAmount - base.spent;
  const remaining = remainingRaw >= 0 ? remainingRaw : 0;
  const overBudget = remainingRaw < 0 ? -remainingRaw : 0;
  const progress = availableAmount > 0 ? Math.min(base.spent / availableAmount, 1) : 0;

  return { spent: base.spent, remaining, overBudget, progress };
}

/**
 * Screen: Budget
 * Tab: Budget
 * Budget/goals tracker with per-goal progress bars and budget tracking.
 */
export default function Budget() {
  const goals = useAppStore((s) => s.goals);
  const budgets = useAppStore((s) => s.budgets);
  const transactions = useAppStore((s) => s.transactions);
  const deleteGoal = useAppStore((s) => s.deleteGoal);
  const deleteBudget = useAppStore((s) => s.deleteBudget);
  const { format } = useMoney();
  const { t } = useI18n();

  return (
    <ResponsiveContainer>
      <ScreenHeader
        title={t('budget.screenTitle')}
        subtitle={t('budget.screenSubtitle')}
        action={
          <View className="flex-row items-center gap-2">
            <Pressable
              className="flex-row items-center gap-1 rounded-xl bg-brand-600 px-4 py-2.5 active:bg-brand-700"
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.MODALS.ADD_BUDGET)}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text className="text-white font-semibold">{t('budget.newBudget')}</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-1 rounded-xl bg-brand-600 px-4 py-2.5 active:bg-brand-700"
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.MODALS.ADD_GOAL)}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text className="text-white font-semibold">{t('budget.newGoal')}</Text>
            </Pressable>
          </View>
        }
      />

      {/* Budgets Section */}
      {budgets.length > 0 && (
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-4 mb-3">
            {t('budget.budgets', { count: budgets.length })}
          </Text>
          <ResponsiveGrid>
            {budgets.map((budget) => {
              const periodKey = budget.period === 'weekly' ? 'budget.periodWeekly' : budget.period === 'monthly' ? 'budget.periodMonthly' : 'budget.periodYearly';
              const { spent, remaining, overBudget, progress } = calculateBudgetSpending(budget, transactions, budgets);
              const isOverBudget = overBudget > 0;
              const progressColor = isOverBudget ? '#ef4444' : '#10b981';
              return (
                <Card
                  key={budget.id}
                  title={budget.category}
                  subtitle={t('budget.period', { period: t(periodKey) })}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">{format(budget.amount)}</Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      {t('budget.amount')}
                    </Text>
                  </View>
                  <View className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-2">
                    <View className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: progressColor }} />
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-gray-500">
                      {t('budget.spent', { value: format(spent) })}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {t('budget.remaining', { value: format(remaining) })}
                    </Text>
                  </View>
                  {isOverBudget && (
                    <View className="flex-row justify-between mb-3">
                      <Text className="text-sm" style={{ color: '#ef4444' }}>
                        {t('budget.overBudget', { value: format(overBudget) })}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row justify-between mb-3">
                    <Pressable accessibilityRole="button" onPress={() => router.push(`${ROUTES.MODALS.EDIT_BUDGET}?id=${budget.id}`)}>
                      <Ionicons name="create-outline" size={18} color="#4f46e5" />
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => deleteBudget(budget.id)}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                  {budget.rollover && (
                    <Text className="text-xs text-brand-600 dark:text-brand-400">
                      {t('budget.rolloverEnabled')}
                    </Text>
                  )}
                </Card>
              );
            })}
          </ResponsiveGrid>
        </View>
      )}

      {/* Goals Section */}
      <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-4 mb-3">
        {t('budget.goals', { count: goals.length })}
      </Text>
      <ResponsiveGrid>
        {goals.map((goal) => {
          const pct = goal.target > 0 ? Math.min((goal.saved / goal.target) * 100, 100) : 0;
          const complete = pct >= 100;
          return (
            <Card
              key={goal.id}
              title={goal.title}
              subtitle={complete ? t('budget.completed') : t('budget.inProgress')}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">{format(goal.saved)}</Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {t('budget.of', { value: format(goal.target) })}
                </Text>
              </View>
              <View className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <View className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
              </View>
              <View className="flex-row justify-between mt-2 mb-3">
                <Text className="text-sm text-gray-500">
                  {t('budget.savedPct', { pct: Math.round(pct) })}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => deleteGoal(goal.id)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </Pressable>
              </View>
              {/* Add Saving button */}
              {!complete && (
                <Pressable
                  accessibilityRole="button"
                  className="flex-row items-center justify-center gap-1.5 rounded-xl border border-brand-600 py-2.5 active:bg-brand-50"
                  onPress={() =>
                    router.push({
                      pathname: ROUTES.MODALS.ADD_SAVING as never,
                      params: { goalId: goal.id },
                    })
                  }
                >
                  <Ionicons name="add-circle-outline" size={18} color="#4f46e5" />
                   <Text className="text-brand-600 font-semibold text-sm">
                    {t('budget.addSaving')}
                  </Text>
                </Pressable>
              )}
            </Card>
          );
        })}

        {goals.length === 0 && budgets.length === 0 ? (
          <Card>
            <EmptyState
              icon="flag-outline"
              title={t('budget.noGoalsTitle')}
              message={t('budget.noGoalsMessage')}
            />
          </Card>
        ) : goals.length === 0 ? null : (
          <Card>
            <EmptyState
              icon="calculator-outline"
              title={t('budget.noBudgetsTitle')}
              message={t('budget.noBudgetsMessage')}
            />
          </Card>
        )}
      </ResponsiveGrid>
    </ResponsiveContainer>
  );
}