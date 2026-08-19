import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Transaction } from '../../types';
import { formatDate } from '../../utils';
import { useMoney } from '../../hooks';

/**
 * RecentActivity (dashboard)
 * Compact list of the latest transactions. Clicking one opens its detail.
 */
export function RecentActivity({
  transactions,
  onPressTransaction,
}: {
  transactions: Transaction[];
  onPressTransaction?: (id: string) => void;
}) {
  const { format } = useMoney();
  const recent = transactions.slice(0, 5);

  if (recent.length === 0) {
    return <Text className="text-sm text-gray-500">No transactions yet.</Text>;
  }

  return (
    <View>
      {recent.map((tx) => {
        const isIncome = tx.type === 'income';
        return (
          <Pressable
            key={tx.id}
            onPress={() => onPressTransaction?.(tx.id)}
            className="flex-row items-center py-3 border-b border-gray-100 last:border-b-0"
            accessibilityRole="button"
          >
            <View
              className={`w-9 h-9 rounded-full items-center justify-center ${
                isIncome ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              <Ionicons
                name={isIncome ? 'arrow-down' : 'arrow-up'}
                size={18}
                color={isIncome ? '#16a34a' : '#dc2626'}
              />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-base font-medium text-gray-900">{tx.title}</Text>
              <Text className="text-sm text-gray-500">
                {tx.category} · {formatDate(tx.date)}
              </Text>
            </View>
            <Text className={`text-base font-semibold ${isIncome ? 'text-green-600' : 'text-gray-900'}`}>
              {isIncome ? '+' : '−'}
              {format(tx.amount)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
