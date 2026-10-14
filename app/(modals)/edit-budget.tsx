import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '../../components/ui';
import { useMoney } from '../../hooks';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { CATEGORIES, getCategoryLabel } from '../../components/transactions/TransactionForm';

/**
 * Modal: EditBudget
 * Loads an existing budget by id, lets the user modify it, then persists.
 *
 * The amount is typed in the selected currency and stored in it.
 * Category uses the same picker as Add Budget.
 * Dates are user-facing DD/MM/YYYY, internally YYYY-MM-DD.
 */
export default function EditBudget() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const budgets = useAppStore((s) => s.budgets);
  const updateBudget = useAppStore((s) => s.updateBudget);
  const { symbol, toBase } = useMoney();
  const { t } = useI18n();

  const budget = budgets.find((b) => b.id === id);
  if (!budget) {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.dismiss();
    }
    return null;
  }

  const [category, setCategory] = useState(budget.category);
  const [amount, setAmount] = useState(String(budget.amount));
  const [period, setPeriod] = useState(budget.period);
  const [rollover, setRollover] = useState(budget.rollover);
  const [duplicateError, setDuplicateError] = useState<string | undefined>(undefined);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Helper to convert ISO date to DD/MM/YYYY for display
  const toDisplayDate = (value: string | undefined | null): string => {
    if (!value) return '';
    // Already DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return value;
    // ISO YYYY-MM-DD -> DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}/${m}/${y}`;
    }
    return value;
  };

  /**
   * Convert various date formats to YYYY-MM-DD for Supabase.
   * Accepts:
   *   - DD/MM/YYYY or D/M/YYYY (user-typed, e.g. "1/3/2026" → "2026-03-01")
   *   - YYYY-MM-DD (already ISO, e.g. "2026-03-01" → "2026-03-01")
   *   - Date objects (from native pickers, converted using LOCAL components)
   * Returns undefined for empty/invalid dates.
   */
  const toIsoDate = (value: string | Date | undefined | null): string | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const trimmed = String(value).trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year)) {
        if (month >= 1 && month <= 12 && year >= 1000 && year <= 9999) {
          const daysInMonth = new Date(year, month, 0).getDate();
          if (day >= 1 && day <= daysInMonth) {
            const mm = String(month).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            return `${year}-${mm}-${dd}`;
          }
        }
      }
    }
    return undefined;
  };

  // Initialize display dates from ISO
  const [displayStartDate, setDisplayStartDate] = useState(toDisplayDate(budget.startDate));
  const [displayEndDate, setDisplayEndDate] = useState(toDisplayDate(budget.endDate));

  const parsedAmount = parseFloat(amount);
  const hasAmount = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const storedAmount = hasAmount ? toBase(parsedAmount) : null;
  const valid = category.trim().length > 0 && hasAmount && storedAmount !== null;

  let error: string | undefined;
  if (amount.trim() !== '') {
    if (!hasAmount) error = t('budget.enterAmountError');
    else if (storedAmount === null) error = t('transactions.form.invalidAmount');
  }

  const submit = () => {
    if (storedAmount === null) return;
    setDuplicateError(undefined);
    const result = updateBudget(id, {
      category,
      amount: storedAmount,
      period,
      startDate: toIsoDate(displayStartDate),
      endDate: toIsoDate(displayEndDate),
      rollover,
    });
    if (result?.error?.message === 'DUPLICATE_BUDGET') {
      const dupCategory = (result.error as any).category;
      const dupPeriod = (result.error as any).period;
      setDuplicateError(t('budget.duplicateBudget', { category: dupCategory, period: dupPeriod }));
      return;
    }
    router.dismiss();
  };

  const periods = [
    { value: 'weekly', label: t('budget.periodWeekly') },
    { value: 'monthly', label: t('budget.periodMonthly') },
    { value: 'yearly', label: t('budget.periodYearly') },
  ];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-6 pb-10">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900">{t('budget.editBudgetTitle')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.dismiss()}>
            <Text className="text-brand-600 font-semibold">{t('budget.close')}</Text>
          </Pressable>
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('budget.category')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((cat: typeof CATEGORIES[0]) => (
              <Pressable
                key={cat.key}
                onPress={() => {
                  setCategory(cat.key);
                  setShowCategoryPicker(false);
                }}
                className={`flex-1 min-w-[45%] items-center rounded-xl border py-3 ${category === cat.key ? 'border-brand-600 bg-brand-50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}
                accessibilityRole="button"
              >
                <Text className={`text-sm font-semibold ${category === cat.key ? 'text-brand-600' : 'text-gray-600 dark:text-gray-400'}`}>
                  {getCategoryLabel(cat.key, t as (key: string) => string)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {duplicateError && (
          <Text className="text-sm text-red-500 mt-1 mb-4" role="alert">
            {duplicateError}
          </Text>
        )}

        <Input
          label={t('budget.amount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={error}
          leftIcon={<Text className="text-gray-400 font-semibold text-base">{symbol}</Text>}
        />

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('budget.period')}</Text>
          <View className="flex-row gap-3">
            {periods.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => setPeriod(p.value)}
                className={`flex-1 items-center rounded-xl border py-3 ${period === p.value ? 'border-brand-600 bg-brand-50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}
                accessibilityRole="button"
              >
                <Text className={`text-sm font-semibold ${period === p.value ? 'text-brand-600' : 'text-gray-600 dark:text-gray-400'}`}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Input
          label={t('budget.startDate')}
          value={displayStartDate}
          onChangeText={setDisplayStartDate}
          placeholder={t('budget.datePlaceholder')}
          keyboardType="numeric"
        />

        <Input
          label={t('budget.endDate')}
          value={displayEndDate}
          onChangeText={setDisplayEndDate}
          placeholder={t('budget.datePlaceholder')}
          keyboardType="numeric"
        />

        <View className="mb-4 flex-row items-center gap-3">
          <Pressable
            onPress={() => setRollover(!rollover)}
            className={`flex-1 items-center rounded-xl border py-3 ${rollover ? 'border-brand-600 bg-brand-50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}
            accessibilityRole="button"
          >
            <Text className={`text-sm font-semibold ${rollover ? 'text-brand-600' : 'text-gray-600 dark:text-gray-400'}`}>
              {t('budget.rolloverOn')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setRollover(!rollover)}
            className={`flex-1 items-center rounded-xl border py-3 ${!rollover ? 'border-brand-600 bg-brand-50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}
            accessibilityRole="button"
          >
            <Text className={`text-sm font-semibold ${!rollover ? 'text-brand-600' : 'text-gray-600 dark:text-gray-400'}`}>
              {t('budget.rolloverOff')}
            </Text>
          </Pressable>
        </View>

        <Button title={t('budget.updateBudget')} onPress={submit} disabled={!valid} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}