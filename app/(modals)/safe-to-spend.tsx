import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useSafeToSpend } from '../../hooks';
import { useMoney } from '../../hooks/useMoney';
import { useI18n } from '../../i18n';
import {
  AUTO_BUFFER_DAYS,
  calculateDailySafeToSpend,
  calculateSafeToSpend,
} from '../../services/safeToSpend';
import { useAppStore } from '../../store';

/**
 * Modal: Safe to Spend
 * Transparent breakdown of why the safe-to-spend amount is what it is:
 *
 *   Current balance → − Goal reserve → − Upcoming expenses → − Safety buffer
 *   → = Safe to spend
 *
 * Also lets the user configure the emergency buffer (auto ≈ N days of
 * spending, or a custom amount). Nothing here writes transactions/goals.
 */
export default function SafeToSpendDetails() {
  const transactions = useAppStore((s) => s.transactions);
  const goals = useAppStore((s) => s.goals);
  const storeBuffer = useAppStore((s) => s.emergencyBuffer);
  const setEmergencyBuffer = useAppStore((s) => s.setEmergencyBuffer);

  const { daily, forecast, format, statusTone } = useSafeToSpend();
  const { symbol, toBase, toInputValue } = useMoney();
  const { t } = useI18n();

  // The safety buffer is stored in the selected currency, like every other
  // monetary value, so the field shows it as-is and the preview uses it
  // unchanged. Switching currency later converts the buffer with the rest of the
  // data, so it stays worth the same real amount.
  const [mode, setMode] = useState<'auto' | 'custom'>(storeBuffer == null ? 'auto' : 'custom');
  const [bufferInput, setBufferInput] = useState(
    storeBuffer != null ? String(toInputValue(storeBuffer)) : '',
  );
  const parsed = parseFloat(bufferInput);
  // Preview of the buffer choice (persisted only on "Apply").
  const bufferPreview =
    mode === 'custom' && Number.isFinite(parsed) && parsed >= 0 ? toBase(parsed) : null;

  // Live preview of the buffer choice (persisted only on "Apply").
  const preview = calculateSafeToSpend({
    transactions,
    goals,
    emergencyBuffer: mode === 'auto' ? null : bufferPreview ?? storeBuffer,
  });
  const previewDaily = calculateDailySafeToSpend(preview);

  const applyBuffer = () => {
    if (bufferPreview != null) setEmergencyBuffer(bufferPreview);
  };

  const selectAuto = () => {
    setMode('auto');
    setBufferInput('');
    setEmergencyBuffer(null);
  };

  const selectCustom = () => {
    setMode('custom');
    setBufferInput(storeBuffer != null ? String(toInputValue(storeBuffer)) : '');
  };

  const rows: { label: string; amount: number; op: 'plus' | 'minus' | 'equals' }[] = [
    { label: t('safeToSpend.currentBalance'), amount: preview.balance, op: 'plus' },
    { label: t('safeToSpend.goalReserve'), amount: preview.goalReserve, op: 'minus' },
    { label: t('safeToSpend.upcomingExpenses'), amount: preview.upcomingExpenses, op: 'minus' },
    { label: t('safeToSpend.emergencyBuffer'), amount: preview.emergencyBuffer, op: 'minus' },
    { label: t('safeToSpend.safeToSpendRow'), amount: preview.safeToSpend, op: 'equals' },
  ];

  const negative = preview.safeToSpend < 0;
  const forecastStatus = {
    'on-track': t('insights.forecast.statusOnTrack'),
    attention: t('insights.forecast.statusAttention'),
    risk: t('insights.forecast.statusRisk'),
    'insufficient-data': t('insights.forecast.notEnoughDataYet'),
  }[forecast.status];

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-6 pb-10">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('safeToSpend.title')}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.dismiss();
            }
          }}>
            <Text className="text-brand-600 dark:text-brand-400 font-semibold">
              {t('safeToSpend.close')}
            </Text>
          </Pressable>
        </View>

        {/* Hero */}
        <View className="rounded-2xl bg-brand-600 p-5 mb-6">
          <View className="flex-row items-center">
            <Ionicons name="shield-checkmark" size={18} color="#c7d2fe" />
            <Text className="text-sm text-brand-100 ml-2">
              {t('safeToSpend.safeToSpendThisMonth')}
            </Text>
          </View>
          <Text className="text-4xl font-bold text-white mt-2">{format(preview.safeToSpend)}</Text>
          <Text className="text-sm text-brand-100 mt-2">
            {t('safeToSpend.dailyLimitLine', {
              amount: format(previewDaily.daily),
              days: daily.daysRemaining,
            })}
          </Text>
        </View>

        {/* Breakdown flow */}
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {t('safeToSpend.howItsCalculated')}
        </Text>
        <View className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
          {rows.map((r, i) => {
            const isLast = i === rows.length - 1;
            return (
              <View key={r.label}>
                <View className="flex-row items-center justify-between py-2">
                  <View className="flex-row items-center flex-1">
                    {r.op === 'minus' ? (
                      <Ionicons name="remove" size={16} color="#dc2626" />
                    ) : r.op === 'plus' ? (
                      <Ionicons name="add" size={16} color="#16a34a" />
                    ) : (
                      <Ionicons name="arrow-forward" size={16} color="#4f46e5" />
                    )}
                    <Text className="text-sm text-gray-600 dark:text-gray-300 ml-2">{r.label}</Text>
                  </View>
                  <Text
                    className={`text-sm font-semibold ${
                      isLast
                        ? negative
                          ? 'text-red-600 dark:text-red-400 text-lg'
                          : 'text-brand-600 dark:text-brand-400 text-lg'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {isLast ? '=' : r.op === 'minus' ? '− ' : ''}
                    {format(r.amount)}
                  </Text>
                </View>
                {!isLast ? <View className="h-px bg-gray-100 dark:bg-gray-800" /> : null}
              </View>
            );
          })}
        </View>

        <Text className="text-sm text-gray-500 dark:text-gray-400 leading-5 mb-6">
          {t('safeToSpend.explanation')}
        </Text>

        {/* Emergency buffer config */}
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {t('safeToSpend.emergencyBufferTitle')}
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {t('safeToSpend.emergencyBufferDesc', {
            days: AUTO_BUFFER_DAYS,
            amount: format(preview.emergencyBuffer),
          })}
        </Text>
        <View className="flex-row gap-2 mb-2">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'auto' }}
            onPress={selectAuto}
            className={`flex-1 rounded-xl border px-4 py-2.5 items-center ${
              mode === 'auto'
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                mode === 'auto' ? 'text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {t('safeToSpend.autoLabel', { amount: format(preview.emergencyBuffer) })}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'custom' }}
            onPress={selectCustom}
            className={`flex-1 rounded-xl border px-4 py-2.5 items-center ${
              mode === 'custom'
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                mode === 'custom' ? 'text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {t('safeToSpend.custom')}
            </Text>
          </Pressable>
        </View>

        {mode === 'custom' ? (
          <>
            <Input
              label={t('safeToSpend.bufferAmount')}
              value={bufferInput}
              onChangeText={setBufferInput}
              keyboardType="decimal-pad"
              placeholder="0.00"
              error={
                bufferInput.trim() !== '' && parsed >= 0 && bufferPreview == null
                  ? t('transactions.form.invalidAmount')
                  : undefined
              }
              leftIcon={<Text className="text-gray-400 font-semibold text-base">{symbol}</Text>}
            />
            <Button
              title={t('safeToSpend.applyBuffer')}
              onPress={applyBuffer}
              disabled={bufferPreview == null}
              variant="secondary"
              fullWidth
            />
          </>
        ) : (
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {t('safeToSpend.customHint')}
          </Text>
        )}

        {/* Status */}
        <View className="flex-row items-center mt-6 mb-6">
          <Ionicons
            name={statusTone === 'risk' ? 'alert-circle' : statusTone === 'attention' ? 'warning' : 'checkmark-circle'}
            size={18}
            color={statusTone === 'risk' ? '#dc2626' : statusTone === 'attention' ? '#d97706' : statusTone === 'healthy' ? '#16a34a' : '#6b7280'}
          />
          <Text className="text-sm text-gray-700 dark:text-gray-200 ml-2 flex-1">
            {forecastStatus}.{' '}
            {negative
              ? t('safeToSpend.spendingFromReserves')
              : t('safeToSpend.withinReserves')}
          </Text>
        </View>

        {/* Actions */}
        <View className="flex-row gap-3">
          <Button
            title={t('safeToSpend.whatIf')}
            onPress={() => router.push(ROUTES.MODALS.WHAT_IF)}
            variant="secondary"
            leftIcon={<Ionicons name="analytics-outline" size={16} color="#4338ca" />}
            style={{ flex: 1 }}
          />
          <Button
            title={t('safeToSpend.askFinTrack')}
            onPress={() => router.push(ROUTES.MODALS.ASK_FINTRACK)}
            variant="ghost"
            leftIcon={<Ionicons name="chatbubble-ellipses-outline" size={16} color="#4338ca" />}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}