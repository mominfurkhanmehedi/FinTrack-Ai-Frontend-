import { useMemo } from 'react';

import {
  BalanceOverTimeChart,
  CashFlowChart,
  CategoryChart,
  ReportPanel,
  ReportsErrorState,
  ReportsLayout,
  ReportsSkeleton,
  ReportSummary,
} from '../../components/reports';
import { ResponsiveContainer, ScreenHeader } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { netBalance, sumByType } from '../../utils';

/**
 * Screen: Reports
 * Tab: Reports
 *
 * Professional fintech reports dashboard. All figures derive from the SAME
 * store transactions the dashboard/settings use, and every amount is rendered
 * through the shared `useMoney` formatter bound to the selected currency — so
 * switching currency in Settings reflects here instantly with no hardcoded
 * symbol anywhere.
 *
 * Layout: Summary spans the full row, Cash flow and Spending by category share
 * the next row (stack below 1024px), and Balance over time spans the full row.
 * Loading, error, and per-chart empty states are all handled explicitly.
 */
export default function Reports() {
  const transactions = useAppStore((s) => s.transactions);
  const { t } = useI18n();
  const isLoading = useAppStore((s) => s.isLoadingData);
  const loadError = useAppStore((s) => s.dataLoadError);
  const hydrate = useAppStore((s) => s.hydrateFromSupabase);

  const summary = useMemo(() => {
    const income = sumByType(transactions, 'income');
    const expenses = sumByType(transactions, 'expense');
    return { income, expenses, balance: netBalance(transactions) };
  }, [transactions]);

  return (
    <ResponsiveContainer>
      <ScreenHeader title={t('reports.screenTitle')} subtitle={t('reports.screenSubtitle')} />

      {isLoading ? (
        <ReportsSkeleton />
      ) : loadError && transactions.length === 0 ? (
        <ReportsErrorState onRetry={() => void hydrate()} />
      ) : (
        <ReportsLayout>
          <ReportPanel span={12}>
            <ReportSummary
              income={summary.income}
              expenses={summary.expenses}
              balance={summary.balance}
            />
          </ReportPanel>

          <ReportPanel span={6}>
            <CashFlowChart transactions={transactions} />
          </ReportPanel>

          <ReportPanel span={6}>
            <CategoryChart transactions={transactions} />
          </ReportPanel>

          <ReportPanel span={12}>
            <BalanceOverTimeChart transactions={transactions} />
          </ReportPanel>
        </ReportsLayout>
      )}
    </ResponsiveContainer>
  );
}