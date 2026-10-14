import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../ui';
import { useMoney } from '../../hooks';
import { useI18n } from '../../i18n';
import { TransactionType } from '../../types';
import { isoToday } from '../../utils';

/**
 * Convert various date formats to YYYY-MM-DD for consistent storage.
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// `shadow*` style props are deprecated on web — use boxShadow there while
// keeping the native shadow/elevation rendering on iOS/Android.
const categoryCardShadow = Platform.select({
  web: { boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)' },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
});

const iconBadgeShadow = Platform.select({
  web: { boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)' },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
});

export type CategoryKey = 'salary' | 'freelance' | 'housing' | 'food' | 'transport' | 'utilities' | 'other';

export const CATEGORY_KEYS: Record<string, CategoryKey> = {
  Salary: 'salary',
  Freelance: 'freelance',
  Housing: 'housing',
  Food: 'food',
  Transport: 'transport',
  Utilities: 'utilities',
  Other: 'other',
};

/** All category labels in the canonical form used for storage. */
export const CATEGORY_LABELS: CategoryKey[] = ['salary', 'freelance', 'housing', 'food', 'transport', 'utilities', 'other'];

/** Maps canonical key to translated label for display. */
export function getCategoryLabel(key: CategoryKey, t: (key: string, params?: Record<string, string | number>) => string): string {
  return t(`categories.${key}.label` as any);
}

export interface Category {
  key: CategoryKey;
  label: string;
  description: string;
  icon: IoniconName;
  color: string;
  bg: string;
  border: string;
}

export const CATEGORIES: Category[] = [
  {
    key: 'salary',
    label: 'Salary',
    description: 'Monthly or hourly pay',
    icon: 'briefcase',
    color: '#10b981',
    bg: '#d1fae5',
    border: '#6ee7b7',
  },
  {
    key: 'freelance',
    label: 'Freelance',
    description: 'Contract & side work',
    icon: 'laptop',
    color: '#6366f1',
    bg: '#ede9fe',
    border: '#c4b5fd',
  },
  {
    key: 'housing',
    label: 'Housing',
    description: 'Rent, mortgage & bills',
    icon: 'home',
    color: '#f59e0b',
    bg: '#fef3c7',
    border: '#fcd34d',
  },
  {
    key: 'food',
    label: 'Food',
    description: 'Groceries & dining',
    icon: 'fast-food',
    color: '#ef4444',
    bg: '#fee2e2',
    border: '#fca5a5',
  },
  {
    key: 'transport',
    label: 'Transport',
    description: 'Fuel, transit & rides',
    icon: 'car',
    color: '#3b82f6',
    bg: '#dbeafe',
    border: '#93c5fd',
  },
  {
    key: 'utilities',
    label: 'Utilities',
    description: 'Power, water & internet',
    icon: 'flash',
    color: '#f97316',
    bg: '#ffedd5',
    border: '#fdba74',
  },
  {
    key: 'other',
    label: 'Other',
    description: 'Everything else',
    icon: 'ellipsis-horizontal-circle',
    color: '#6b7280',
    bg: '#f3f4f6',
    border: '#d1d5db',
  },
];

export interface TransactionFormValues {
  title: string;
  /**
   * The amount ready to be stored verbatim, in the selected currency. The field
   * is typed in that same currency and the stored amounts are denominated in it
   * too, so the number the user typed is the number that is persisted — no
   * conversion happens on the way in or on the way out.
   */
  amount: string;
  type: TransactionType;
  category: string;
  date: string;
}

export interface TransactionFormProps {
  /**
   * `amount` is what the field shows, i.e. the stored value normalized to the
   * currency's minor unit. `storedAmount`, when present, is the stored value
   * itself: it is submitted verbatim if the user never touches the amount field,
   * so a no-op edit cannot introduce a rounding drift.
   */
  initial?: TransactionFormValues & { storedAmount?: number };
  submitLabel: string;
  onSubmit: (values: TransactionFormValues) => void;
  submitting?: boolean;
}

/**
 * TransactionForm (modals)
 * Two-step wizard:
 *   Step 1 — Full-screen category picker (first page)
 *   Step 2 — Amount / title / date form with selected category in title bar
 *
 * No category section on the form page — category is fixed at step 1.
 *
 * The amount field is expressed in the selected currency and carries that
 * currency's symbol. That is also the currency amounts are stored in, so the
 * value handed to `onSubmit` is stored exactly as entered and nothing outside
 * this component has to know which currency is selected.
 */
export function TransactionForm({
  initial,
  submitLabel,
  onSubmit,
  submitting = false,
}: TransactionFormProps) {
  const { symbol, currency, toBase } = useMoney();
  const { t } = useI18n();

  // If editing an existing transaction, skip straight to the form
  const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [date, setDate] = useState(initial?.date ?? isoToday());

  // Whether the user actually edited the amount. Unedited edits reuse the exact
  // stored base value instead of converting the display value back again.
  const [amountTouched, setAmountTouched] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  const activeCat = CATEGORIES.find((c) => c.label === category);
  const activeCategoryLabel =
    category === 'Savings'
      ? t('categories.savings')
      : getCategoryLabel((activeCat?.key ?? 'other') as CategoryKey, t as (key: string) => string);
  const activeCategoryDescription = activeCat
    ? t(`categories.${activeCat.key}.description`)
    : t('categories.selectedCategory');

  /**
   * The number to persist, or `null` when the field does not hold a usable
   * amount. The typed value is already in the currency amounts are stored in, so
   * this only normalizes it to that currency's minor unit.
   */
  const resolveStoredAmount = (): number | null => {
    if (!amountTouched && initial?.storedAmount != null) return initial.storedAmount;
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed)) return null;
    return toBase(parsed);
  };

  const typedAmount = parseFloat(amount);
  const hasTypedAmount = amount.trim().length > 0 && Number.isFinite(typedAmount) && typedAmount > 0;
  const unparseable = hasTypedAmount && resolveStoredAmount() === null;
  const valid = title.trim().length > 0 && hasTypedAmount && !unparseable;

  const submit = () => {
    const stored = resolveStoredAmount();
    if (stored === null) {
      setAmountError(t('transactions.form.invalidAmount'));
      return;
    }
    setAmountError(null);
    const normalizedDate = toIsoDate(date) ?? date;
    onSubmit({ title, amount: String(stored), type, category, date: normalizedDate });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Category Picker
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-950">
        {/* Header */}
        <View className="px-5 pt-6 pb-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              {t('transactions.form.step1of2')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.dismiss();
                }
              }}
              hitSlop={12}
            >
              <Text className="text-brand-600 font-semibold text-sm">
                {t('transactions.form.cancel')}
              </Text>
            </Pressable>
          </View>
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {t('transactions.form.chooseCategory')}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('transactions.form.whatTypeOfTransaction')}
          </Text>
        </View>

        {/* Category grid */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.label}
                onPress={() => {
                  setCategory(cat.label);
                  setStep(2);
                }}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  width: '47%',
                  backgroundColor: pressed ? cat.bg : '#ffffff',
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: '#e5e7eb',
                  padding: 18,
                  elevation: 2,
                  ...categoryCardShadow,
                })}
              >
                {/* Icon badge */}
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: cat.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: cat.border,
                  }}
                >
                  <Ionicons name={cat.icon} size={24} color={cat.color} />
                </View>

                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#111827',
                    marginBottom: 3,
                  }}
                >
                  {getCategoryLabel(cat.key, t as (key: string) => string)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    lineHeight: 16,
                  }}
                >
                  {t(`categories.${cat.key}.description`)}
                </Text>

                {/* Arrow indicator */}
                <View
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                  }}
                >
                  <Ionicons name="chevron-forward" size={16} color={cat.color} />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — Transaction Form (no category section)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      {/* Title bar — shows the selected category */}
      <View
        className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800"
        style={{ backgroundColor: activeCat ? activeCat.bg : '#f9fafb' }}
      >
        {/* Navigation row */}
        <View className="flex-row items-center justify-between mb-4">
          {/* Back to category picker (only for new transactions) */}
          {!initial ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep(1)}
              hitSlop={12}
              className="flex-row items-center gap-1"
            >
              <Ionicons name="chevron-back" size={18} color={activeCat?.color ?? '#4f46e5'} />
              <Text
                className="font-semibold text-sm"
                style={{ color: activeCat?.color ?? '#4f46e5' }}
              >
                {t('transactions.form.category')}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.dismiss();
              }
            }}
            hitSlop={12}
          >
            <Text
              className="font-semibold text-sm"
              style={{ color: activeCat?.color ?? '#4f46e5' }}
            >
              {t('transactions.form.close')}
            </Text>
          </Pressable>
        </View>

        {/* Category display */}
        <View className="flex-row items-center gap-3">
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: activeCat?.border ?? '#e5e7eb',
              elevation: 2,
              ...iconBadgeShadow,
            }}
          >
            <Ionicons
              name={activeCat?.icon ?? 'ellipsis-horizontal-circle'}
              size={26}
              color={activeCat?.color ?? '#6b7280'}
            />
          </View>

          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {activeCategoryLabel}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {activeCategoryDescription}
            </Text>
          </View>

          {/* Step indicator */}
          {!initial && (
            <View className="items-end">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {t('transactions.form.step2of2')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Form */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type toggle */}
        <View className="flex-row gap-3 mb-4">
          {(['expense', 'income'] as TransactionType[]).map((transactionType) => (
            <Pressable
              key={transactionType}
              onPress={() => setType(transactionType)}
              className={`flex-1 items-center rounded-xl border py-3.5 ${
                type === transactionType
                  ? transactionType === 'expense'
                    ? 'border-red-400 bg-red-50'
                    : 'border-green-400 bg-green-50'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
              }`}
              accessibilityRole="button"
            >
              <Ionicons
                name={transactionType === 'expense' ? 'arrow-up-circle' : 'arrow-down-circle'}
                size={20}
                color={
                  type === transactionType
                    ? transactionType === 'expense'
                      ? '#ef4444'
                      : '#10b981'
                    : '#9ca3af'
                }
                style={{ marginBottom: 4 }}
              />
              <Text
                className={`text-sm font-bold ${
                  type === transactionType
                    ? transactionType === 'expense'
                      ? 'text-red-600'
                      : 'text-green-600'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {transactionType === 'expense'
                  ? t('transactions.form.expense')
                  : t('transactions.form.income')}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input
          label={t('transactions.form.amount')}
          value={amount}
          onChangeText={(next) => {
            setAmount(next);
            setAmountTouched(true);
            setAmountError(null);
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={amountError ?? undefined}
          leftIcon={
            <Text className="text-gray-400 font-semibold text-base">{symbol}</Text>
          }
        />

        <Input
          label={t('transactions.form.title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('transactions.form.titlePlaceholder')}
        />

        <Input
          label={t('transactions.form.date')}
          value={date}
          onChangeText={setDate}
          placeholder={t('transactions.form.datePlaceholder')}
        />

        <Button
          title={submitLabel}
          onPress={submit}
          loading={submitting}
          disabled={!valid}
          fullWidth
        />
      </ScrollView>
    </View>
  );
}