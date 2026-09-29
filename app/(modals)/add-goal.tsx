import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';

/**
 * Modal: AddGoal
 * Creates a new savings goal.
 */
export default function AddGoal() {
  const addGoal = useAppStore((s) => s.addGoal);
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');

  const parsedTarget = parseFloat(target);
  const valid =
    title.trim().length > 0 && Number.isFinite(parsedTarget) && parsedTarget > 0;

  let error: string | undefined;
  if (target.trim() !== '' && !valid) {
    error = t('budget.enterTargetError');
  }

  const submit = () => {
    addGoal({ title, target: parsedTarget, saved: 0 });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-6 pb-10">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900">{t('budget.addGoalTitle')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text className="text-brand-600 font-semibold">{t('budget.close')}</Text>
          </Pressable>
        </View>

        <Input
          label={t('budget.goalTitle')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('budget.goalTitlePlaceholder')}
        />
        <Input
          label={t('budget.targetAmount')}
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={error}
        />

        <Button title={t('budget.createGoal')} onPress={submit} disabled={!valid} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}