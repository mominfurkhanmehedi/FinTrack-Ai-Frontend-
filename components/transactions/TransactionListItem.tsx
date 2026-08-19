import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Transaction } from '../../types';
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
  const isIncome = transaction.type === 'income';
  return (
    <Pressable
      onPress={() => onPress?.(transaction)}
      className="flex-row items-center px-4 py-3 border-b border-gray-100 last:border-b-0 active:bg-gray-50"
      accessibilityRole="button"
    >
      <View
        className={`w-9 h-9 rounded-full items-center justify-center ${
          isIncome ? 'bg-green-100' : 'bg-red-100'
        }`}
      >
        <Ionicons name={isIncome ? 'arrow-down' : 'arrow-up'} size={18} color={isIncome ? '#16a34a' : '#dc2626'} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-base font-medium text-gray-900">{transaction.title}</Text>
        <Text className="text-sm text-gray-500">
          {transaction.category} · {formatDate(transaction.date)}
        </Text>
      </View>
      <Text className={`text-base font-semibold ${isIncome ? 'text-green-600' : 'text-gray-900'}`}>
        {isIncome ? '+' : '−'}
        {format(transaction.amount)}
      </Text>
    </Pressable>
  );
}