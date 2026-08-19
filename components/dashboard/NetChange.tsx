import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useMoney } from '../../hooks';

/**
 * NetChange (dashboard)
 * Income vs. expenses summary row.
 */
export function NetChange({ income, expenses }: { income: number; expenses: number }) {
  const { format } = useMoney();
  return (
    <View className="flex-row gap-4">
      <View className="flex-1 rounded-xl bg-green-50 border border-green-100 p-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Ionicons name="arrow-down-circle" size={18} color="#16a34a" />
          <Text className="text-sm text-green-700">Income</Text>
        </View>
        <Text className="text-xl font-bold text-green-700">{format(income)}</Text>
      </View>
      <View className="flex-1 rounded-xl bg-red-50 border border-red-100 p-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Ionicons name="arrow-up-circle" size={18} color="#dc2626" />
          <Text className="text-sm text-red-700">Expenses</Text>
        </View>
        <Text className="text-xl font-bold text-red-700">{format(expenses)}</Text>
      </View>
    </View>
  );
}
