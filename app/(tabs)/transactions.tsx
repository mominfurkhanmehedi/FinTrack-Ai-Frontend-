import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TransactionListItem } from '../../components/transactions';
import { Card, EmptyState, Input, ResponsiveContainer, ScreenHeader } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { TransactionType } from '../../types';
import { useMoney } from '../../hooks';
import { netBalance } from '../../utils';

const FILTERS = [
  { key: 'all', label: 'transactions.all' },
  { key: 'income', label: 'transactions.income' },
  { key: 'expense', label: 'transactions.expense' },
] as const;

/**
 * Screen: Transactions
 * Tab: Transactions
 * Searchable, filterable list of all transactions with add/edit/delete via modals.
 */
export default function Transactions() {
  const transactions = useAppStore((s) => s.transactions);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | TransactionType>('all');

  const { format } = useMoney();
  const { t } = useI18n();
  const filtered = transactions.filter((transaction) => {
    const matchesQuery =
      !query.trim() ||
      transaction.title.toLowerCase().includes(query.toLowerCase()) ||
      transaction.category.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || transaction.type === filter;
    return matchesQuery && matchesFilter;
  });

  return (
    <ResponsiveContainer>
      <ScreenHeader
        title={t('transactions.screenTitle')}
        subtitle={t('transactions.screenSubtitle', { net: format(netBalance(transactions)) })}
        action={
          <Pressable
            className="flex-row items-center gap-1 rounded-xl bg-brand-600 px-4 py-2.5 active:bg-brand-700"
            accessibilityRole="button"
            onPress={() => router.push(ROUTES.MODALS.ADD_TRANSACTION)}
          >
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text className="text-white font-semibold">{t('transactions.add')}</Text>
          </Pressable>
        }
      />

      <Card>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('transactions.searchPlaceholder')}
          leftIcon={<Ionicons name="search" size={18} color="#9ca3af" />}
        />

        <View className="flex-row gap-2 mb-2">
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className={`rounded-full border px-4 py-1.5 ${
                filter === f.key ? 'border-brand-600 bg-brand-50' : 'border-gray-300 bg-white'
              }`}
              accessibilityRole="button"
            >
              <Text className={filter === f.key ? 'text-brand-700 font-medium' : 'text-gray-600'}>
                {t(f.label)}
              </Text>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            icon={transactions.length === 0 ? 'wallet-outline' : 'search'}
            title={
              transactions.length === 0
                ? t('transactions.noTransactionsTitle')
                : t('transactions.noMatchingTitle')
            }
            message={
              transactions.length === 0
                ? t('transactions.noTransactionsMessage')
                : t('transactions.noMatchingMessage')
            }
          />
        ) : (
          filtered.map((tx) => (
            <TransactionListItem
              key={tx.id}
              transaction={tx}
              onPress={(t) => router.push(`${ROUTES.MODALS.TRANSACTION_DETAIL}?id=${t.id}`)}
            />
          ))
        )}
      </Card>
    </ResponsiveContainer>
  );
}