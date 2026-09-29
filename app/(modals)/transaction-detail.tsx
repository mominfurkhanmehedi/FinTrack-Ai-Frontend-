import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_KEYS } from '../../components/transactions/TransactionForm';
import { Button } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { useMoney } from '../../hooks';
import { formatDate } from '../../utils';

/**
 * Modal: TransactionDetail
 * Read-only view of a transaction with edit/delete actions.
 */
export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transactions = useAppStore((s) => s.transactions);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const { format } = useMoney();
  const { t, locale } = useI18n();

  const tx = transactions.find((t) => t.id === id);
  if (!tx) {
    router.back();
    return null;
  }

  const isIncome = tx.type === 'income';
  const categoryLabel =
    tx.category === 'Savings'
      ? t('categories.savings')
      : t(`categories.${CATEGORY_KEYS[tx.category] ?? 'other'}.label`);

  const onDelete = () => {
    Alert.alert(
      t('transactions.detail.deleteTitle'),
      t('transactions.detail.deleteMessage', { title: tx.title }),
      [
        { text: t('transactions.detail.cancel'), style: 'cancel' },
        {
          text: t('transactions.detail.delete'),
          style: 'destructive',
          onPress: () => {
            deleteTransaction(tx.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900">{t('transactions.detail.title')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text className="text-brand-600 font-semibold">{t('transactions.detail.close')}</Text>
          </Pressable>
        </View>

        <View className="items-center py-6 mb-6">
          <View
            className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
              isIncome ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <Ionicons name={isIncome ? 'arrow-down' : 'arrow-up'} size={30} color={isIncome ? '#16a34a' : '#dc2626'} />
          </View>
          <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">{format(tx.amount)}</Text>
          <Text className="text-base text-gray-500 mt-1">{tx.title}</Text>
        </View>

        <View className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          <Row label={t('transactions.detail.category')} value={categoryLabel} />
          <Row label={t('transactions.detail.date')} value={formatDate(tx.date, locale)} />
          <Row
            label={t('transactions.detail.type')}
            value={isIncome ? t('transactions.income') : t('transactions.expense')}
          />
        </View>

        <View className="h-8" />
        <Button
          title={t('transactions.detail.edit')}
          variant="secondary"
          fullWidth
          onPress={() => router.push(`${ROUTES.MODALS.EDIT_TRANSACTION}?id=${tx.id}`)}
        />
        <View className="h-3" />
        <Button title={t('transactions.detail.delete')} variant="danger" fullWidth onPress={onDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between px-4 py-3">
      <Text className="text-base text-gray-500">{label}</Text>
      <Text className="text-base font-medium text-gray-900">{value}</Text>
    </View>
  );
}