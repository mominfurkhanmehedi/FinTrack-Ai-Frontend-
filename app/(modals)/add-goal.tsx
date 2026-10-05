import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '../../components/ui';
import { useMoney } from '../../hooks';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';

/**
 * Modal: AddGoal
 * Creates a new savings goal.
 *
 * The target is typed in the selected currency (the field shows that currency's
 * symbol) and stored in it, so a goal created while the app is set to JPY holds
 * the value the user entered. Switching currency later converts the target and
 * the savings together.
 */
export default function AddGoal() {
  const addGoal = useAppStore((s) => s.addGoal);
  const { symbol, toBase } = useMoney();
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');

  const parsedTarget = parseFloat(target);
  const hasTarget = target.trim() !== '' && Number.isFinite(parsedTarget) && parsedTarget > 0;
  const storedTarget = hasTarget ? toBase(parsedTarget) : null;
  const valid = title.trim().length > 0 && hasTarget && storedTarget !== null;

  let error: string | undefined;
  if (target.trim() !== '') {
    if (!hasTarget) error = t('budget.enterTargetError');
    else if (storedTarget === null) error = t('transactions.form.invalidAmount');
  }

  const submit = () => {
    if (storedTarget === null) return;
    addGoal({ title, target: storedTarget, saved: 0 });
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
          leftIcon={<Text className="text-gray-400 font-semibold text-base">{symbol}</Text>}
        />

        <Button title={t('budget.createGoal')} onPress={submit} disabled={!valid} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}