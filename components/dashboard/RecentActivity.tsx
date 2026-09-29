import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CATEGORY_KEYS } from '../transactions/TransactionForm';
import { Transaction } from '../../types';
import { formatDate } from '../../utils';
import { useMoney } from '../../hooks';
import { useI18n } from '../../i18n';

/**
 * RecentActivity (dashboard)
 * Compact list of the latest transactions. Clicking one opens its detail.
 * Rows ellipsize long titles and let currency values wrap safely instead of
 * overflowing the card on narrow screens.
 */
export function RecentActivity({
  transactions,
  onPressTransaction,
}: {
  transactions: Transaction[];
  onPressTransaction?: (id: string) => void;
}) {
  const { format } = useMoney();
  const { t, locale } = useI18n();
  const recent = transactions.slice(0, 5);

  if (recent.length === 0) {
    return (
      <View className="items-center py-8 px-4">
        <View className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mb-3">
          <Ionicons name="receipt-outline" size={22} color="#9ca3af" />
        </View>
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {t('dashboard.noRecentActivity')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {recent.map((tx) => {
        const isIncome = tx.type === 'income';
        const categoryLabel =
          tx.category === 'Savings'
            ? t('categories.savings')
            : t(`categories.${CATEGORY_KEYS[tx.category] ?? 'other'}.label`);
        return (
          <Pressable
            key={tx.id}
            onPress={() => onPressTransaction?.(tx.id)}
            className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 active:bg-gray-50 dark:active:bg-gray-900 rounded-lg"
            accessibilityRole="button"
          >
            <View
              className={`w-10 h-10 rounded-full items-center justify-center shrink-0 ${
                isIncome ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              <Ionicons
                name={isIncome ? 'arrow-down' : 'arrow-up'}
                size={18}
                color={isIncome ? '#16a34a' : '#dc2626'}
              />
            </View>
            <View className="flex-1 min-w-0 ml-3">
              <Text className="text-base font-medium text-gray-900 dark:text-gray-100" numberOfLines={1}>
                {tx.title}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5" numberOfLines={1}>
                {categoryLabel} · {formatDate(tx.date, locale)}
              </Text>
            </View>
            <Text
              className={`text-base font-semibold ml-2 text-right ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}
              numberOfLines={1}
              style={{ flexShrink: 0 }}
            >
              {isIncome ? '+' : '−'}
              {format(tx.amount)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
