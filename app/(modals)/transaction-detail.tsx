import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRef, useState } from 'react';

import { CATEGORY_KEYS } from '../../components/transactions/TransactionForm';
import { Button, ConfirmationSheet } from '../../components/ui';
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
  const hasNavigated = useRef(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tx = transactions.find((t) => t.id === id);
  if (!tx) {
    if (!hasNavigated.current) {
      hasNavigated.current = true;
      router.replace(ROUTES.TRANSACTIONS);
    }
    return null;
  }

  const isIncome = tx.type === 'income';
  const categoryLabel =
    tx.category === 'Savings'
      ? t('categories.savings')
      : t(`categories.${CATEGORY_KEYS[tx.category] ?? 'other'}.label`);

  const handleDeletePress = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    deleteTransaction(tx.id);
    setShowDeleteConfirm(false);
    if (!hasNavigated.current) {
      hasNavigated.current = true;
      router.replace(ROUTES.TRANSACTIONS);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900">{t('transactions.detail.title')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace(ROUTES.TRANSACTIONS)}>
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
        <Button title={t('transactions.detail.delete')} variant="danger" fullWidth onPress={handleDeletePress} />
      </ScrollView>

      <ConfirmationSheet
        visible={showDeleteConfirm}
        title={t('transactions.detail.deleteTitle')}
        message={t('transactions.detail.deleteMessage', { title: tx.title })}
        confirmText={t('transactions.detail.delete')}
        cancelText={t('transactions.detail.cancel')}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
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