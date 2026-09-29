import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Platform, Text, View } from 'react-native';

import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useMoney } from '../../hooks/useMoney';
import { useI18n } from '../../i18n';
import { Card } from '../ui';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * ReportSummary (reports)
 * "Summary" card: Income, Expenses and current Balance. Values are precomputed
 * by the page using the shared financial utils (`sumByType`, `netBalance`) and
 * formatted with the ONE `useMoney` formatter, so the selected currency flows
 * in automatically — there is no hardcoded symbol here.
 */
export function ReportSummary({
  income,
  expenses,
  balance,
}: {
  income: number;
  expenses: number;
  balance: number;
}) {
  const { format } = useMoney();
  const { width } = useBreakpoint();
  const { t } = useI18n();

  // Shrink the numerals on narrow phones so long currency values never wrap
  // badly or clip; jump back up on tablets/desktop where there is room.
  const amountSize = width < 640 ? 'text-[17px]' : 'text-xl';

  // adjustsFontSizeToFit is native-only; on web numberOfLines ellipsizes.
  const shrinkProps =
    Platform.OS === 'web'
      ? { numberOfLines: 1 as const }
      : { adjustsFontSizeToFit: true as const, minimumFontScale: 0.65 };

  return (
    <Card>
      <View className="mb-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('reports.summary')}
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {t('reports.summarySubtitle')}
        </Text>
      </View>

      <View className="flex-row gap-3">
        <StatTile
          icon="arrow-down-circle"
          label={t('reports.income')}
          color="#16a34a"
          tint="bg-green-50 dark:bg-green-950/40"
          value={format(income)}
          valueColor="text-green-700 dark:text-green-400"
          amountSize={amountSize}
          shrinkProps={shrinkProps}
        />
        <StatTile
          icon="arrow-up-circle"
          label={t('reports.expenses')}
          color="#dc2626"
          tint="bg-red-50 dark:bg-red-950/40"
          value={format(expenses)}
          valueColor="text-red-600 dark:text-red-400"
          amountSize={amountSize}
          shrinkProps={shrinkProps}
        />
        <StatTile
          icon="wallet"
          label={t('reports.balance')}
          color="#4f46e5"
          tint="bg-brand-50 dark:bg-brand-900/20"
          value={format(balance)}
          valueColor="text-brand-700 dark:text-brand-300"
          amountSize={amountSize}
          shrinkProps={shrinkProps}
          highlight
        />
      </View>
    </Card>
  );
}

function StatTile({
  icon,
  label,
  color,
  tint,
  value,
  valueColor,
  amountSize,
  shrinkProps,
  highlight,
}: {
  icon: IoniconName;
  label: string;
  color: string;
  tint: string;
  value: string;
  valueColor: string;
  amountSize: string;
  shrinkProps: { numberOfLines?: 1; adjustsFontSizeToFit?: true; minimumFontScale?: number };
  highlight?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className={`flex-1 min-w-0 rounded-xl border px-2.5 py-3 ${tint} ${
        highlight ? 'border-brand-200 dark:border-brand-800' : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={14} color={color} />
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </Text>
      </View>
      <Text
        className={`mt-1 font-bold tracking-tight ${amountSize} ${valueColor}`}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
        {...shrinkProps}
      >
        {value}
      </Text>
    </View>
  );
}