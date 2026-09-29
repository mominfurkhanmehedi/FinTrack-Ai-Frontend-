import { router } from 'expo-router';
import { useMemo } from 'react';

import { Card, ResponsiveContainer, ScreenHeader } from '../../components/ui';
import {
  BalanceCard,
  DashboardLayout,
  DashboardPanel,
  NetChange,
  QuickActions,
  RecentActivity,
  SafeToSpendCard,
  SpendingOverview,
} from '../../components/dashboard';
import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { Transaction } from '../../types';
import { netBalance, sumByType } from '../../utils';

/**
 * Screen: Dashboard
 * Tab: Dashboard
 *
 * Responsive layout via <DashboardLayout>: the four summary cards sit in a
 * single 4-column row on desktop, 2 columns on tablet, and stack on mobile.
 * Spending Overview and Recent Activity stretch to use the available width
 * (half-row on desktop, full row on tablet/mobile) instead of being squeezed
 * into narrow thirds. All calculations/navigation are unchanged.
 */
export default function Dashboard() {
  const transactions = useAppStore((s) => s.transactions);
  const { t } = useI18n();

  const income = useMemo(() => sumByType(transactions, 'income'), [transactions]);
  const expenses = useMemo(() => sumByType(transactions, 'expense'), [transactions]);
  const balance = useMemo(() => netBalance(transactions), [transactions]);

  const openAdd = (type: Transaction['type']) =>
    router.push(`${ROUTES.MODALS.ADD_TRANSACTION}?type=${type}`);

  return (
    <ResponsiveContainer>
      <ScreenHeader title={t('dashboard.screenTitle')} subtitle={t('dashboard.screenSubtitle')} />
      <DashboardLayout>
        <DashboardPanel>
          <Card className="flex-1">
            <BalanceCard balance={balance} />
          </Card>
        </DashboardPanel>

        <DashboardPanel>
          <Card title={t('dashboard.cardSafeToSpend')} className="flex-1">
            <SafeToSpendCard />
          </Card>
        </DashboardPanel>

        <DashboardPanel>
          <Card title={t('dashboard.cardIncomeVsExpenses')} className="flex-1">
            <NetChange income={income} expenses={expenses} />
          </Card>
        </DashboardPanel>

        <DashboardPanel>
          <Card title={t('dashboard.cardQuickActions')} className="flex-1">
            <QuickActions
              onAddIncome={() => openAdd('income')}
              onAddExpense={() => openAdd('expense')}
              onAddGoal={() => router.push(ROUTES.MODALS.ADD_GOAL)}
            />
          </Card>
        </DashboardPanel>

        <DashboardPanel span={2}>
          <Card title={t('dashboard.cardSpendingOverview')} className="flex-1">
            <SpendingOverview />
          </Card>
        </DashboardPanel>

        <DashboardPanel span={2}>
          <Card title={t('dashboard.cardRecentActivity')} className="flex-1">
            <RecentActivity
              transactions={transactions}
              onPressTransaction={(id) => router.push(`${ROUTES.MODALS.TRANSACTION_DETAIL}?id=${id}`)}
            />
          </Card>
        </DashboardPanel>
      </DashboardLayout>
    </ResponsiveContainer>
  );
}