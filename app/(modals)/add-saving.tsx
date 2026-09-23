import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '../../components/ui';
import { useAppStore } from '../../store';
import { useMoney } from '../../hooks';

/**
 * Modal: AddSaving
 * Adds an amount to an existing savings goal's `saved` total.
 * Expects `goalId` as a search param: /add-saving?goalId=<id>
 */
export default function AddSaving() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const goals = useAppStore((s) => s.goals);
  const updateGoal = useAppStore((s) => s.updateGoal);
  const { format } = useMoney();

  const goal = goals.find((g) => g.id === goalId);
  const [amount, setAmount] = useState('');

  const parsed = parseFloat(amount);
  const valid = !isNaN(parsed) && parsed > 0;

  const submit = () => {
    if (!goal || !valid) return;
    updateGoal(goal.id, { saved: goal.saved + parsed });
    router.back();
  };

  if (!goal) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-semibold text-gray-900 mt-4 text-center">Goal not found</Text>
        <Pressable
          accessibilityRole="button"
          className="mt-6 rounded-xl bg-brand-600 px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go back</Text>
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
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add Saving</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text className="text-brand-600 font-semibold">Close</Text>
          </Pressable>
        </View>

        {/* Goal summary card */}
        <View className="rounded-2xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 p-4 mb-6">
          <Text className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{goal.title}</Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {format(goal.saved)} saved of {format(goal.target)}
          </Text>

          {/* Progress bar */}
          <View className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <View
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${pct}%` }}
            />
          </View>
          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">{Math.round(pct)}% saved</Text>
        </View>

        {/* Amount input */}
        <Input
          label="Amount to add"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        {/* Preview */}
        {valid && (
          <View className="flex-row items-center gap-2 mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
            <Ionicons name="trending-up-outline" size={16} color="#16a34a" />
            <Text className="text-sm text-green-700 dark:text-green-400">
              New total: <Text className="font-semibold">{format(goal.saved + parsed)}</Text>
            </Text>
          </View>
        )}

        <Button
          title="Add Saving"
          onPress={submit}
          disabled={!valid}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}
