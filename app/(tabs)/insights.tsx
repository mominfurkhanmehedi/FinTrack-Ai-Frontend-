import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Card, Chart, EmptyState, ResponsiveContainer, ResponsiveGrid, ScreenHeader } from '../../components/ui';
import { useAppStore } from '../../store';
import { useMoney } from '../../hooks';
import { sumByType } from '../../utils';

/**
 * Screen: Insights
 * Tab: Insights
 * AI-flavored overview: spending predictions, budget suggestions, and category
 * breakdown. Derived from real store data (a real model plugs in via services).
 */
export default function Insights() {
  const transactions = useAppStore((s) => s.transactions);
  const goals = useAppStore((s) => s.goals);
  const { format } = useMoney();

  const stats = useMemo(() => {
    const income = sumByType(transactions, 'income');
    const expenses = sumByType(transactions, 'expense');
    const savingRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    const byCategory = transactions
      .filter((t) => t.type === 'expense')
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] ?? 0) + t.amount;
        return acc;
      }, {});
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    return { income, expenses, savingRate, topCategory, byCategory };
  }, [transactions]);

  const pieData = useMemo(
    () =>
      Object.entries(stats.byCategory).map(([name, value], i) => ({
        name,
        value,
        color: PALETTE[i % PALETTE.length],
        legendFontColor: '#6b7280',
        legendFontSize: 12,
      })),
    [stats.byCategory],
  );

  const suggestions = useMemo(() => {
    const list: string[] = [];
    if (stats.expenses > stats.income) {
      list.push('Your expenses exceed income this period. Consider trimming discretionary spending.');
    }
    if (stats.topCategory) {
      list.push(`${stats.topCategory[0]} is your largest category at ${format(stats.topCategory[1])}. Look for ways to reduce it.`);
    }
    const activeGoal = goals.find((g) => g.saved < g.target);
    if (activeGoal) {
      const remaining = activeGoal.target - activeGoal.saved;
      list.push(`Add ${format(remaining)} to reach your "${activeGoal.title}" goal.`);
    }
    if (list.length === 0) {
      list.push('You are on a healthy track. Keep up the good saving habits!');
    }
    return list;
  }, [stats, goals, format]);

  return (
    <ResponsiveContainer>
      <ScreenHeader title="Insights" subtitle="AI-powered guidance for your money" />
      <ResponsiveGrid>
        <Card title="Monthly overview">
          <View className="flex-row gap-4">
            <Stat label="Income" value={format(stats.income)} color="text-green-600" />
            <Stat label="Expenses" value={format(stats.expenses)} color="text-red-600" />
            <Stat label="Savings rate" value={`${Math.round(stats.savingRate)}%`} color="text-brand-600" />
          </View>
          <View className="h-4" />
          <Text className="text-sm text-gray-600">
            Based on your recent transactions, we predict your spending will{' '}
            <Text className="font-semibold">
              {stats.expenses > stats.income ? 'increase' : 'stay steady'}
            </Text>{' '}
            next month.
          </Text>
        </Card>

        <Card title="Spending by category">
          {pieData.length > 0 ? (
            <Chart kind="pie" pieData={pieData} height={220} />
          ) : (
            <EmptyState
              icon="pie-chart-outline"
              title="No expense data yet"
              message="Add some expenses to see your spending breakdown here."
            />
          )}
        </Card>

        <Card title="Budget suggestions">
          <View className="flex-row gap-4">
            <Ionicons name="bulb-outline" size={22} color="#4f46e5" />
            <Text className="text-base text-gray-700">{suggestions[0]}</Text>
          </View>
          {suggestions.slice(1).map((s, i) => (
            <View key={i} className="flex-row gap-4 mt-4">
              <Ionicons name="checkmark-circle-outline" size={22} color="#16a34a" />
              <Text className="text-base text-gray-700 flex-1">{s}</Text>
            </View>
          ))}
        </Card>
      </ResponsiveGrid>
    </ResponsiveContainer>
  );
}

const PALETTE = ['#4f46e5', '#ef4444', '#22c55e', '#f59e0b', '#06b6d4', '#8b5cf6'];

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="flex-1">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className={`text-lg font-bold ${color}`}>{value}</Text>
    </View>
  );
}