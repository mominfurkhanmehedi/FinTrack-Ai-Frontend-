import { router } from 'expo-router';
import { useMemo } from 'react';

import { Card, Chart, ResponsiveContainer, ResponsiveGrid, ScreenHeader } from '../../components/ui';
import {
  BalanceCard,
  NetChange,
  QuickActions,
  RecentActivity,
} from '../../components/dashboard';
import { ROUTES } from '../../constants/routes';
import { useAppStore } from '../../store';
import { Transaction } from '../../types';
import { formatCurrency, isoToday, netBalance, sumByType } from '../../utils';

/**
 * Screen: Dashboard
 * Tab: Dashboard
 *
 * Responsive layout: <ResponsiveGrid> stacks cards on mobile and forms a
 * multi-column grid on tablet/desktop/web. Includes an income-vs-expenses
 * chart built from the store's transactions.
 */
export default function Dashboard() {
  const transactions = useAppStore((s) => s.transactions);

  const income = useMemo(() => sumByType(transactions, 'income'), [transactions]);
  const expenses = useMemo(() => sumByType(transactions, 'expense'), [transactions]);
  const balance = useMemo(() => netBalance(transactions), [transactions]);

  const chartData = useMemo(() => buildChartData(transactions), [transactions]);

  const openAdd = (type: Transaction['type']) =>
    router.push(`${ROUTES.MODALS.ADD_TRANSACTION}?type=${type}`);

  return (
    <ResponsiveContainer>
      <ScreenHeader title="Dashboard" subtitle="Your finances at a glance" />
      <ResponsiveGrid>
        <Card>
          <BalanceCard balance={balance} />
        </Card>
        <Card title="Income vs expenses">
          <NetChange income={income} expenses={expenses} />
        </Card>
        <Card title="Quick actions">
          <QuickActions
            onAddIncome={() => openAdd('income')}
            onAddExpense={() => openAdd('expense')}
            onAddGoal={() => router.push(ROUTES.MODALS.ADD_GOAL)}
          />
        </Card>
        <Card title="Spending overview">
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
        <Card title="Recent activity">
          <RecentActivity
            transactions={transactions}
            onPressTransaction={(id) => router.push(`${ROUTES.MODALS.TRANSACTION_DETAIL}?id=${id}`)}
          />
        </Card>
      </ResponsiveGrid>
    </ResponsiveContainer>
  );
}

/** Aggregate daily income/expenses for the trailing 7 days for the chart. */
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
  return {
    labels: days.map((d) => d.label),
    income: days.map((d) => d.income),
    expenses: days.map((d) => d.expenses),
  };
}
