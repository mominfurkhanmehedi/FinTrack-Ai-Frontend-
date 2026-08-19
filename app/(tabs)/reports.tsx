import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Card, Chart, ResponsiveContainer, ResponsiveGrid, ScreenHeader } from '../../components/ui';
import { useAppStore } from '../../store';
import { useMoney } from '../../hooks';
import { isoToday, netBalance, sumByType } from '../../utils';
import { Transaction } from '../../types';

/**
 * Screen: Reports
 * Tab: Reports
 * Monthly/annual summaries and breakdown charts derived from the store's
 * transactions. Responsive grid + measured charts work on web and mobile.
 */
export default function Reports() {
  const transactions = useAppStore((s) => s.transactions);
  const { format } = useMoney();

  const summary = useMemo(() => {
    const income = sumByType(transactions, 'income');
    const expenses = sumByType(transactions, 'expense');
    return { income, expenses, balance: netBalance(transactions) };
  }, [transactions]);

  const chartData = useMemo(() => buildChartData(transactions), [transactions]);

  const pieData = useMemo(() => {
    const byCategory = transactions
      .filter((t) => t.type === 'expense')
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] ?? 0) + t.amount;
        return acc;
      }, {});
    return Object.entries(byCategory).map(([name, value], i) => ({
      name,
      value,
      color: PALETTE[i % PALETTE.length],
      legendFontColor: '#6b7280',
      legendFontSize: 12,
    }));
  }, [transactions]);

  return (
    <ResponsiveContainer>
      <ScreenHeader title="Reports" subtitle="Income, expenses & breakdowns" />
      <ResponsiveGrid>
        <Card title="Summary">
          <View className="flex-row gap-4">
            <Stat label="Income" value={format(summary.income)} color="text-green-600" />
            <Stat label="Expenses" value={format(summary.expenses)} color="text-red-600" />
            <Stat label="Balance" value={format(summary.balance)} color="text-brand-600" />
          </View>
        </Card>

        <Card title="Cash flow">
          <Chart
            kind="bar"
            title="Last 7 days"
            labels={chartData.labels}
            datasets={[
              { data: chartData.income, color: '#22c55e', name: 'Income' },
              { data: chartData.expenses, color: '#ef4444', name: 'Expenses' },
            ]}
          />
        </Card>

        <Card title="Spending by category">
          {pieData.length > 0 ? (
            <Chart kind="pie" pieData={pieData} height={220} />
          ) : (
            <Text className="text-sm text-gray-500">No expense data yet.</Text>
          )}
        </Card>

        <Card title="Balance over time">
          {chartData.income.length > 0 || chartData.expenses.length > 0 ? (
            <Chart
              kind="line"
              title="Daily balance trend"
              labels={chartData.labels}
              datasets={[{ data: chartData.balance, color: '#4f46e5', name: 'Balance' }]}
            />
          ) : (
            <Text className="text-sm text-gray-500">No data to chart yet.</Text>
          )}
        </Card>
      </ResponsiveGrid>
    </ResponsiveContainer>
  );
}

const PALETTE = ['#4f46e5', '#ef4444', '#22c55e', '#f59e0b', '#06b6d4', '#8b5cf6'];

/** Aggregate daily income/expenses/balance for the trailing 7 days. */
function buildChartData(txs: Transaction[]) {
  const days: { label: string; income: number; expenses: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const iso = isoToday(i);
    const day = new Date(iso + 'T00:00:00');
    const label = day.toLocaleDateString('en-US', { weekday: 'short' });
    const dayTxs = txs.filter((t) => t.date === iso);
    days.push({
      label,
      income: sumByType(dayTxs, 'income'),
      expenses: sumByType(dayTxs, 'expense'),
    });
  }
  let running = 0;
  const balance = days.map((d) => {
    running += d.income - d.expenses;
    return running;
  });
  return { labels: days.map((d) => d.label), income: days.map((d) => d.income), expenses: days.map((d) => d.expenses), balance };
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="flex-1">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className={`text-lg font-bold ${color}`}>{value}</Text>
    </View>
  );
}