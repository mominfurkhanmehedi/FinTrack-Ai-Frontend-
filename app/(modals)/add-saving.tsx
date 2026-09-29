import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { useMoney } from '../../hooks';
import { isoToday, netBalance } from '../../utils';

/**
 * Modal: AddSaving
 * Adds an amount to an existing savings goal's `saved` total AND records the
 * saving as an expense transaction so the app's Total Balance (which is
 * derived from income − expenses) decreases by exactly the same amount.
 * Expects `goalId` as a search param: /add-saving?goalId=<id>
 *
 * Validation: amount must be numeric and greater than 0, and it must not
 * exceed the user's available total balance.
 */
export default function AddSaving() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const goals = useAppStore((s) => s.goals);
  const transactions = useAppStore((s) => s.transactions);
  const updateGoal = useAppStore((s) => s.updateGoal);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const { format } = useMoney();
  const { t } = useI18n();

  const goal = goals.find((g) => g.id === goalId);
  const balance = netBalance(transactions);
  const [amount, setAmount] = useState('');

  const parsed = parseFloat(amount);
  const hasEntry = amount.trim() !== '';
  const isNumeric = Number.isFinite(parsed);
  const positive = isNumeric && parsed > 0;
  const withinBalance = isNumeric && parsed <= balance;
  const valid = hasEntry && positive && withinBalance;

  let error: string | undefined;
  if (hasEntry && !valid) {
    if (!isNumeric || parsed <= 0) {
      error = t('addSaving.errPositive');
    } else if (parsed > balance) {
      error = t('addSaving.errExceeds', { amount: format(balance) });
    }
  }

  const submit = () => {
    if (!goal || !valid) return;
    // 1) Increase the goal's saved amount — persisted (Zustand → AsyncStorage
    //    → Supabase) via the existing updateGoal action.
    updateGoal(goal.id, { saved: goal.saved + parsed });
    const savingTitle = t('addSaving.saveTitle', { goal: goal.title });
    // 2) Record the saving as an expense transaction so the Total Balance
    //    (computed as income − expenses from the shared store) decreases by
    //    the same amount. synced through the existing addTransaction action.
    addTransaction({
      title: savingTitle,
      amount: parsed,
      type: 'expense',
      category: 'Savings',
      date: isoToday(),
    });
    router.back();
  };

  if (!goal) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-semibold text-gray-900 mt-4 text-center">
          {t('addSaving.goalNotFound')}
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-6 rounded-xl bg-brand-600 px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">{t('addSaving.goBack')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const pct = goal.target > 0 ? Math.min((goal.saved / goal.target) * 100, 100) : 0;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-6 pb-10">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('addSaving.title')}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text className="text-brand-600 font-semibold">{t('addSaving.close')}</Text>
          </Pressable>
        </View>

        {/* Goal summary card */}
        <View className="rounded-2xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 p-4 mb-6">
          <Text className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{goal.title}</Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {t('addSaving.savedOf', { saved: format(goal.saved), target: format(goal.target) })}
          </Text>

          {/* Progress bar */}
          <View className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <View
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${pct}%` }}
            />
          </View>
          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {t('addSaving.savedPct', { pct: Math.round(pct) })}
          </Text>
        </View>

        {/* Amount input */}
        <Input
          label={t('addSaving.amountToAdd')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={error}
        />

        {/* Available balance */}
        <View className="flex-row items-center gap-1.5 mb-4">
          <Ionicons name="wallet-outline" size={15} color="#6b7280" />
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {t('addSaving.availableBalance', { amount: '' })}
            <Text className="font-semibold text-gray-900 dark:text-gray-100">
              {format(balance)}
            </Text>
          </Text>
        </View>

        {/* Preview */}
        {valid && (
          <View className="flex-row items-center gap-2 mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
            <Ionicons name="trending-up-outline" size={16} color="#16a34a" />
            <Text className="text-sm text-green-700 dark:text-green-400">
              {t('addSaving.newTotal', { amount: '' })}
              <Text className="font-semibold">{format(goal.saved + parsed)}</Text>
            </Text>
          </View>
        )}

        <Button
          title={t('addSaving.addSaving')}
          onPress={submit}
          disabled={!valid}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}
