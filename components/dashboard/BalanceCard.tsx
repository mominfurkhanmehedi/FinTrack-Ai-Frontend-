import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useMoney } from '../../hooks';

/**
 * BalanceCard (dashboard)
 * Hero balance stat. Uses a gradient-like brand surface.
 */
export function BalanceCard({ balance }: { balance: number }) {
  const { format } = useMoney();
  const positive = balance >= 0;
  return (
    <View className="bg-brand-600 rounded-2xl p-5">
      <Text className="text-sm text-brand-100">Total balance</Text>
      <Text className="text-4xl font-bold text-white mt-2">
        {format(balance)}
      </Text>
      <View className="flex-row items-center mt-3">
        <Ionicons
          name={positive ? 'trending-up' : 'trending-down'}
          size={16}
          color="#c7d2fe"
        />
        <Text className="text-sm text-brand-100 ml-1">
          {positive ? 'On track' : 'Below target'}
        </Text>
      </View>
    </View>
  );
}
