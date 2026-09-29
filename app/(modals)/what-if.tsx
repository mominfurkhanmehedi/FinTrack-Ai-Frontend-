import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '../../components/ui';
import { useI18n } from '../../i18n';
import {
  calculateDailySafeToSpend,
  calculateForecast,
  simulateFinancialChange,
  SimulationResult,
  SimulationType,
} from '../../services/safeToSpend';
import { useAppStore } from '../../store';
import { useMoney } from '../../hooks';
import { formatDate, toNumber } from '../../utils';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Modal: What If (simulator)
 * Hypothetical scenarios run against the user's REAL data via the pure
 * calculation layer. Nothing is written to the store — this screen is a
 * read-only projection and is labeled as such.
 */
export default function WhatIf() {
  const transactions = useAppStore((s) => s.transactions);
  const goals = useAppStore((s) => s.goals);
  const emergencyBuffer = useAppStore((s) => s.emergencyBuffer);
  const { format } = useMoney();
  const { t, locale } = useI18n();

  const [type, setType] = useState<SimulationType>('spend');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);

  const parsed = parseFloat(amount);
  const hasEntry = amount.trim() !== '';
  const positive = Number.isFinite(parsed) && parsed > 0;
  const valid = hasEntry && positive;

  let error: string | undefined;
  if (hasEntry && !positive) error = t('whatIf.enterPositive');

  const simulate = () => {
    if (!valid) return;
    setResult(
      simulateFinancialChange(
        { transactions, goals, emergencyBuffer },
        { type, amount: toNumber(parsed) },
      ),
    );
  };

  const reset = () => {
    setResult(null);
    setAmount('');
  };

  // Baseline numbers (real, unchanged data).
  const baseline = useMemo(
    () => simulateFinancialChange({ transactions, goals, emergencyBuffer }, { type, amount: 0 }),
    [transactions, goals, emergencyBuffer, type],
  );
  const baselineForecast = useMemo(
    () => calculateForecast(transactions, goals),
    [transactions, goals],
  );

  const current = result ?? {
    base: baseline.base,
    baseDaily: baseline.baseDaily,
    after: baseline.base,
    afterDaily: baseline.baseDaily,
  };

  const options: { type: SimulationType; label: string; icon: IoniconName; hint: string }[] = [
    { type: 'spend', label: t('whatIf.typeSpend'), icon: 'cash-outline', hint: t('whatIf.hintSpend') },
    { type: 'save-more', label: t('whatIf.typeSaveMore'), icon: 'trending-up-outline', hint: t('whatIf.hintSaveMore') },
    { type: 'increase-expenses', label: t('whatIf.typeIncreaseExpenses'), icon: 'remove-circle-outline', hint: t('whatIf.hintIncreaseExpenses') },
    { type: 'add-purchase', label: t('whatIf.typeAddPurchase'), icon: 'pricetag-outline', hint: t('whatIf.hintAddPurchase') },
  ];
  const chosen = options.find((o) => o.type === type)!;

  const afterMonthEnd = result?.forecast.projectedMonthEnd ?? baselineForecast.projectedMonthEnd;
  const activeGoals = goals.filter((g) => (g.target - g.saved) > 0).length;
  const impactText = !result
    ? t('whatIf.preSimulateHint')
    : activeGoals === 0
      ? t('whatIf.verdictNoGoals')
      : result.after.safeToSpend < 0
        ? result.impact.delayMonths > 0
          ? t('whatIf.verdictDelay', { months: result.impact.delayMonths })
          : t('whatIf.verdictReserves')
        : t('whatIf.verdictOnTrack');
  const goalEta = (eta: string | null) => eta ? formatDate(eta, locale) : t('whatIf.notEnoughDataYet');

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-6 pb-10">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('whatIf.title')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text className="text-brand-600 dark:text-brand-400 font-semibold">{t('whatIf.close')}</Text>
          </Pressable>
        </View>

        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {t('whatIf.whatSimulate')}
        </Text>

        {/* Simulation type selector */}
        <View className="flex-row flex-wrap gap-2 mb-4">
          {options.map((o) => {
            const active = o.type === type;
            return (
              <Pressable
                key={o.type}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setType(o.type);
                  reset();
                }}
                className={`flex-row items-center gap-1.5 rounded-xl border px-3.5 py-2.5 ${
                  active
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                }`}
              >
                <Ionicons
                  name={o.icon}
                  size={16}
                  color={active ? '#4f46e5' : '#6b7280'}
                />
                <Text
                  className={`text-sm font-medium ${
                    active ? 'text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-5">{chosen.hint}</Text>

        {/* Amount */}
        <Input
          label={t('whatIf.amount')}
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            if (result) reset();
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={error}
        />

        <Button title={t('whatIf.simulate')} onPress={simulate} disabled={!valid} fullWidth />

        {/* Results */}
        <View className="mt-6">
          <Section title={t('whatIf.current')} tone="brand">
            <Row label={t('whatIf.safeToSpend')} value={format(current.base.safeToSpend)} />
            <Row label={t('whatIf.dailyLimit')} value={t('whatIf.dailyLimitValue', { amount: format(current.baseDaily.daily) })} />
            <Row label={t('whatIf.goalCompletion')} value={goalEta(baselineForecast.nearestGoalEta)} />
            <Row label={t('whatIf.projectedMonthEnd')} value={baselineForecast.projectedMonthEnd == null ? t('whatIf.notEnoughDataYet') : format(baselineForecast.projectedMonthEnd)} />
          </Section>

          <Section title={t('whatIf.after')} tone={result ? (result.after.safeToSpend < 0 ? 'red' : 'purple') : 'muted'}>
            <Row label={t('whatIf.safeToSpend')} value={format(current.after.safeToSpend)} />
            <Row label={t('whatIf.dailyLimit')} value={t('whatIf.dailyLimitValue', { amount: format(current.afterDaily.daily) })} />
            <Row label={t('whatIf.goalCompletion')} value={goalEta(result?.forecast.nearestGoalEta ?? baselineForecast.nearestGoalEta)} />
            <Row label={t('whatIf.projectedMonthEnd')} value={afterMonthEnd == null ? t('whatIf.notEnoughDataYet') : format(afterMonthEnd)} />
          </Section>

          {/* Impact */}
          <Section title={t('whatIf.impact')} tone={result && !result.impact.staysOnTrack ? 'red' : 'green'}>
            <View className="flex-row items-start gap-2">
              <Ionicons
                name={result && !result.impact.staysOnTrack ? 'warning' : 'checkmark-circle'}
                size={18}
                color={result && !result.impact.staysOnTrack ? '#dc2626' : '#16a34a'}
              />
              <Text className="text-sm text-gray-700 dark:text-gray-200 flex-1">{impactText}</Text>
            </View>
            {result && !result.impact.staysOnTrack ? (
              <Text className="text-sm text-red-600 dark:text-red-400 mt-2">
                {result.impact.delayMonths > 0
                  ? t('whatIf.estimatedDelay', { months: result.impact.delayMonths })
                  : t('whatIf.noRecovery')}
              </Text>
            ) : null}
          </Section>

          {/* Reassurance */}
          <View className="flex-row items-center gap-2 mt-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
            <Text className="text-xs text-gray-500 dark:text-gray-400 flex-1">{t('whatIf.simulationOnly')}</Text>
          </View>

          {result ? (
            <Button title={t('whatIf.reset')} variant="ghost" onPress={reset} fullWidth style={{ marginTop: 8 }} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'brand' | 'purple' | 'red' | 'green' | 'muted';
  children: React.ReactNode;
}) {
  const headers: Record<typeof tone, string> = {
    brand: 'border-brand-600 text-brand-700 dark:text-brand-300',
    purple: 'border-brand-500 text-brand-700 dark:text-brand-300',
    red: 'border-red-300 text-red-700 dark:text-red-400',
    green: 'border-green-300 text-green-700 dark:text-green-400',
    muted: 'border-gray-300 text-gray-700 dark:text-gray-300',
  };
  return (
    <View className={`rounded-2xl border p-4 mb-3 ${headers[tone]}`}>
      <Text className="text-xs font-bold uppercase tracking-wide mb-2">{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</Text>
    </View>
  );
}
