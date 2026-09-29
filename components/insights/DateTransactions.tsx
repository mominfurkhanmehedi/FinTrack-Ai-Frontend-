import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROUTES } from '../../constants/routes';
import { useMoney } from '../../hooks/useMoney';
import { useI18n } from '../../i18n';
import { Goal, Transaction } from '../../types';
import { Button, EmptyState } from '../ui';
import { InsightCard } from './InsightsLayout';
import { shrinkProps } from './StatTile';
import {
  isSavingsRow,
  matchedGoalTitle,
  summarizeDay,
  transactionsForDate,
} from './calendarData';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const TYPE_STYLE: Record<
  Transaction['type'],
  { icon: IoniconName; color: string; tint: string }
> = {
  income: { icon: 'arrow-down-circle', color: '#16a34a', tint: 'bg-green-50 dark:bg-green-950/40' },
  expense: { icon: 'arrow-up-circle', color: '#dc2626', tint: 'bg-red-50 dark:bg-red-950/40' },
};

export interface DateTransactionsProps {
  /** Local `yyyy-mm-dd` of the selected day. */
  selectedIso: string;
  /** e.g. "Monday, 28 September 2026" */
  selectedLabel: string;
  dayIndex: Map<string, Transaction[]>;
  goals: Goal[];
  onOpenTransaction?: (id: string) => void;
  /** Renders the panel as a bottom sheet instead of an inline card. */
  asSheet?: boolean;
  /** Sheet visibility (only used with `asSheet`). */
  visible?: boolean;
  onCloseSheet?: () => void;
}

interface Group {
  key: string;
  titleKey: 'insights.day.income' | 'insights.day.expenses' | 'insights.day.savings';
  icon: IoniconName;
  color: string;
  rows: Transaction[];
}

function buildGroups(rows: Transaction[], goals: Goal[]): Group[] {
  const income = rows.filter((t) => t.type === 'income');
  const expenses = rows.filter((t) => t.type === 'expense' && !isSavingsRow(t));
  const savings = rows.filter((t) => isSavingsRow(t));

  const groups: Group[] = [
    { key: 'income', titleKey: 'insights.day.income', icon: 'arrow-down-circle', color: '#16a34a', rows: income },
    { key: 'expenses', titleKey: 'insights.day.expenses', icon: 'arrow-up-circle', color: '#dc2626', rows: expenses },
    { key: 'savings', titleKey: 'insights.day.savings', icon: 'bookmark', color: '#4f46e5', rows: savings },
  ];
  // Annotate savings rows with the goal they actually funded (matched against
  // the user's real goals) so the panel can show "Emergency Fund".
  return groups
    .map((g) =>
      g.key === 'savings'
        ? { ...g, rows: g.rows.map((t) => ({ ...t, category: matchedGoalTitle(t, goals) ?? t.category })) }
        : g,
    )
    .filter((g) => g.rows.length > 0);
}

/**
 * DateTransactions (insights)
 * Every transaction recorded on ONE exact local date, grouped into income,
 * expenses and savings, with that day's totals and a shortcut to add a
 * transaction dated to that day.
 *
 * Rows come straight out of the shared in-memory day index, so clicking a date
 * can never surface another day's transactions and never triggers a query. On
 * desktop it renders as an inline panel beside the calendar; on mobile it is
 * presented as a bottom sheet (see `DateTransactionsSheet`) so the calendar
 * stays visible and tappable underneath.
 */
export function DateTransactions({
  selectedIso,
  selectedLabel,
  dayIndex,
  goals,
  onOpenTransaction,
  asSheet,
  visible = true,
  onCloseSheet,
}: DateTransactionsProps) {
  const { format } = useMoney();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const rows = transactionsForDate(selectedIso, dayIndex);
  const summary = summarizeDay(selectedIso, dayIndex);
  const groups = buildGroups(rows, goals);

  const openAdd = () => {
    // `type=expense` + the exact `date` prefill the existing add-transaction
    // modal, so the new row lands on the day the user tapped.
    router.push(`${ROUTES.MODALS.ADD_TRANSACTION}?type=expense&date=${selectedIso}`);
  };

  const body = (
    <View className="flex-1">
      {/* Header */}
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100" numberOfLines={1}>
            {t('insights.day.transactionsOn', { date: selectedLabel })}
          </Text>
          <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
            {t('insights.day.transactionCountLabel', { count: rows.length })}
          </Text>
        </View>
        {asSheet ? (
          <Pressable
            onPress={onCloseSheet}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            className="h-8 w-8 items-center justify-center rounded-lg bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:active:bg-gray-700"
          >
            <Ionicons name="close" size={18} color="#6b7280" />
          </Pressable>
        ) : (
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
            <Ionicons name="calendar" size={16} color="#4f46e5" />
          </View>
        )}
      </View>

      {rows.length === 0 ? (
        <>
          <View className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <EmptyState
              compact
              icon="file-tray-outline"
              title={t('insights.day.emptyTitle')}
              message={t('insights.day.emptyMessage')}
            />
          </View>
          <Button
            title={t('insights.day.addTransaction')}
            onPress={openAdd}
            fullWidth
            leftIcon={<Ionicons name="add" size={18} color="#ffffff" />}
          />
        </>
      ) : (
        <ScrollView
          className="flex-1"
          style={{ maxHeight: asSheet ? 320 : 420 }}
          contentContainerStyle={{ paddingBottom: 4 }}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((g) => (
            <View key={g.key} className="mb-3">
              <View className="mb-1.5 flex-row items-center gap-1.5">
                <Ionicons name={g.icon} size={13} color={g.color} />
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t(g.titleKey)}
                </Text>
                <Text className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                  {format(g.rows.reduce((s, t) => s + t.amount, 0))}
                </Text>
              </View>
              <View className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                {g.rows.map((t, i) => (
                  <TransactionRow
                    key={`${g.key}-${t.id}`}
                    transaction={t}
                    isLast={i === g.rows.length - 1}
                    onPress={onOpenTransaction ? () => onOpenTransaction(t.id) : undefined}
                  />
                ))}
              </View>
            </View>
          ))}

          <View className="mt-1 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/50">
            <TotalRow label={t('insights.income')} value={format(summary.income)} color="text-green-700 dark:text-green-400" />
            <TotalRow label={t('insights.expenses')} value={format(summary.expenses)} color="text-red-600 dark:text-red-400" />
            <TotalRow label={t('insights.savings')} value={format(summary.savings)} color="text-brand-700 dark:text-brand-300" />
            <View className="mt-1.5 border-t border-gray-200 pt-1.5 dark:border-gray-700">
              <TotalRow
                label={t('insights.netCashFlow')}
                value={format(summary.net)}
                color={summary.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}
                strong
              />
            </View>
          </View>

          <View className="mt-3">
            <Button
              title={t('insights.day.addTransaction')}
              onPress={openAdd}
              variant="secondary"
              fullWidth
              leftIcon={<Ionicons name="add" size={18} color="#4338ca" />}
            />
          </View>
        </ScrollView>
      )}

      {asSheet ? <View style={{ height: insets.bottom }} /> : null}
    </View>
  );

  if (!asSheet) {
    return <InsightCard>{body}</InsightCard>;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCloseSheet}>
      <View className="flex-1 justify-end bg-black/45">
        <Pressable
          className="flex-1"
          onPress={onCloseSheet}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          className="max-h-[82%] rounded-t-3xl border-t border-gray-200 bg-white px-4 pt-3 dark:border-gray-700 dark:bg-gray-900"
          style={Platform.OS === 'web' ? ({ maxHeight: '82vh' } as never) : undefined}
        >
          <View className="mb-2 items-center">
            <View className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
          </View>
          {body}
        </View>
      </View>
    </Modal>
  );
}

function TransactionRow({
  transaction,
  isLast,
  onPress,
}: {
  transaction: Transaction;
  isLast: boolean;
  onPress?: () => void;
}) {
  const { format } = useMoney();
  const { t } = useI18n();
  const style = TYPE_STYLE[transaction.type];
  const isSavings = transaction.type === 'expense' && transaction.category === 'Savings';
  const sign = transaction.type === 'income' ? '+' : '−';
  const amountColor = isSavings
    ? 'text-brand-700 dark:text-brand-300'
    : transaction.type === 'income'
      ? 'text-green-700 dark:text-green-400'
      : 'text-gray-900 dark:text-gray-100';

  const Wrapper: React.ElementType = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${transaction.title}, ${transaction.category}, ${sign}${format(transaction.amount)}`}
      className={`flex-row items-center gap-2.5 bg-white px-3 py-2.5 dark:bg-gray-900 ${
        isLast ? '' : 'border-b border-gray-100 dark:border-gray-800'
      } ${onPress ? 'active:bg-gray-50 dark:active:bg-gray-800/60' : ''}`}
    >
      <View className={`h-7 w-7 items-center justify-center rounded-lg ${isSavings ? 'bg-brand-50 dark:bg-brand-900/20' : style.tint}`}>
        <Ionicons name={isSavings ? 'bookmark' : style.icon} size={14} color={isSavings ? '#4f46e5' : style.color} />
      </View>
      <View className="min-w-0 flex-1" style={{ flexShrink: 3 }}>
        <Text className="text-[13px] font-semibold text-gray-900 dark:text-gray-100" numberOfLines={1}>
          {transaction.title}
        </Text>
        <Text className="text-[11px] text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {`${transaction.category} · ${t(transaction.type === 'income' ? 'insights.day.income' : isSavings ? 'insights.day.savings' : 'insights.day.expense')}`}
        </Text>
      </View>
      <Text className={`min-w-0 text-[13px] font-bold ${amountColor}`} style={{ flexShrink: 1 }} {...shrinkProps()}>
        {`${sign}${format(transaction.amount)}`}
      </Text>
      {onPress ? <Ionicons name="chevron-forward" size={14} color="#d1d5db" /> : null}
    </Wrapper>
  );
}

function TotalRow({
  label,
  value,
  color,
  strong,
}: {
  label: string;
  value: string;
  color: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-2 py-[3px]">
      <Text className={`${strong ? 'text-[13px] font-semibold' : 'text-[12px]'} min-w-0 flex-1 text-gray-500 dark:text-gray-400`} numberOfLines={1}>
        {label}
      </Text>
      <Text className={`${strong ? 'text-[15px] font-bold' : 'text-[12px] font-semibold'} ${color}`} style={{ flexShrink: 1 }} {...shrinkProps()}>
        {value}
      </Text>
    </View>
  );
}
