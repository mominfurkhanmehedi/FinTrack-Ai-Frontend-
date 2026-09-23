import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../ui';
import { TransactionType } from '../../types';
import { isoToday } from '../../utils';

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

interface Category {
  label: string;
  description: string;
  icon: IoniconName;
  color: string;
  bg: string;
  border: string;
}

const CATEGORIES: Category[] = [
  {
    label: 'Salary',
    description: 'Monthly or hourly pay',
    icon: 'briefcase',
    color: '#10b981',
    bg: '#d1fae5',
    border: '#6ee7b7',
  },
  {
    label: 'Freelance',
    description: 'Contract & side work',
    icon: 'laptop',
    color: '#6366f1',
    bg: '#ede9fe',
    border: '#c4b5fd',
  },
  {
    label: 'Housing',
    description: 'Rent, mortgage & bills',
    icon: 'home',
    color: '#f59e0b',
    bg: '#fef3c7',
    border: '#fcd34d',
  },
  {
    label: 'Food',
    description: 'Groceries & dining',
    icon: 'fast-food',
    color: '#ef4444',
    bg: '#fee2e2',
    border: '#fca5a5',
  },
  {
    label: 'Transport',
    description: 'Fuel, transit & rides',
    icon: 'car',
    color: '#3b82f6',
    bg: '#dbeafe',
    border: '#93c5fd',
  },
  {
    label: 'Utilities',
    description: 'Power, water & internet',
    icon: 'flash',
    color: '#f97316',
    bg: '#ffedd5',
    border: '#fdba74',
  },
  {
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
  amount: string;
  type: TransactionType;
  category: string;
  date: string;
}

export interface TransactionFormProps {
  initial?: TransactionFormValues;
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
 */
export function TransactionForm({
  initial,
  submitLabel,
  onSubmit,
  submitting = false,
}: TransactionFormProps) {
  // If editing an existing transaction, skip straight to the form
  const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [date, setDate] = useState(initial?.date ?? isoToday());

  const activeCat = CATEGORIES.find((c) => c.label === category);
  const valid = title.trim().length > 0 && parseFloat(amount) > 0;
  const submit = () => onSubmit({ title, amount, type, category, date });

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
              Step 1 of 2
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              hitSlop={12}
            >
              <Text className="text-brand-600 font-semibold text-sm">Cancel</Text>
            </Pressable>
          </View>
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            Choose a Category
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            What type of transaction is this?
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
                  {cat.label}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    lineHeight: 16,
                  }}
                >
                  {cat.description}
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
                Category
              </Text>
            </Pressable>
          ) : (
            <View />
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text
              className="font-semibold text-sm"
              style={{ color: activeCat?.color ?? '#4f46e5' }}
            >
              Close
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
              {activeCat?.label ?? category}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {activeCat?.description ?? 'Selected category'}
            </Text>
          </View>

          {/* Step indicator */}
          {!initial && (
            <View className="items-end">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Step 2 of 2
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
          {(['expense', 'income'] as TransactionType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              className={`flex-1 items-center rounded-xl border py-3.5 ${
                type === t
                  ? t === 'expense'
                    ? 'border-red-400 bg-red-50'
                    : 'border-green-400 bg-green-50'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
              }`}
              accessibilityRole="button"
            >
              <Ionicons
                name={t === 'expense' ? 'arrow-up-circle' : 'arrow-down-circle'}
                size={20}
                color={
                  type === t
                    ? t === 'expense'
                      ? '#ef4444'
                      : '#10b981'
                    : '#9ca3af'
                }
                style={{ marginBottom: 4 }}
              />
              <Text
                className={`text-sm font-bold ${
                  type === t
                    ? t === 'expense'
                      ? 'text-red-600'
                      : 'text-green-600'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {t === 'expense' ? 'Expense' : 'Income'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          leftIcon={
            <Text className="text-gray-400 font-semibold text-base">$</Text>
          }
        />

        <Input
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Groceries"
        />

        <Input
          label="Date (yyyy-mm-dd)"
          value={date}
          onChangeText={setDate}
          placeholder="2026-08-17"
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