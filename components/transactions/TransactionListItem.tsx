import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CATEGORY_KEYS } from './TransactionForm';
import { Transaction } from '../../types';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils';
import { useMoney } from '../../hooks';

/**
 * TransactionListItem (transactions)
 * Row used in the full transaction list (and reusable across lists).
 */
export function TransactionListItem({
  transaction,
  onPress,
}: {
  transaction: Transaction;
  onPress?: (tx: Transaction) => void;
}) {
  const { format } = useMoney();
  const { t, locale } = useI18n();
  const isIncome = transaction.type === 'income';
  const categoryLabel =
    transaction.category === 'Savings'
      ? t('categories.savings')
      : t(`categories.${CATEGORY_KEYS[transaction.category] ?? 'other'}.label`);
  return (
    <Pressable
      onPress={() => onPress?.(transaction)}
      className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 active:bg-gray-50 dark:active:bg-gray-900"
      accessibilityRole="button"
    >
      <View
        className={`w-9 h-9 rounded-full items-center justify-center ${
          isIncome ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
        }`}
      >
        <Ionicons name={isIncome ? 'arrow-down' : 'arrow-up'} size={18} color={isIncome ? '#16a34a' : '#dc2626'} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-base font-medium text-gray-900 dark:text-gray-100">{transaction.title}</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {categoryLabel} · {formatDate(transaction.date, locale)}
        </Text>
      </View>
      <Text className={`text-base font-semibold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {isIncome ? '+' : '−'}
        {format(transaction.amount)}
      </Text>
    </Pressable>
  );
}