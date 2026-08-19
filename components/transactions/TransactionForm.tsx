import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../ui';
import { TransactionType } from '../../types';
import { isoToday } from '../../utils';

const CATEGORIES = [
  'Salary', 'Freelance', 'Housing', 'Food', 'Transport', 'Utilities', 'Other',
] as const;

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
 * Shared add/edit form: amount + type toggle, title, category chips, date.
 */
export function TransactionForm({
  initial,
  submitLabel,
  onSubmit,
  submitting = false,
}: TransactionFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [category, setCategory] = useState(initial?.category ?? 'Other');
  const [date, setDate] = useState(initial?.date ?? isoToday());

  const valid = title.trim().length > 0 && parseFloat(amount) > 0;

  const submit = () => onSubmit({ title, amount, type, category, date });

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 pt-6 pb-10">
      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-2xl font-bold text-gray-900">
          {initial ? 'Edit transaction' : 'Add transaction'}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text className="text-brand-600 font-semibold">Close</Text>
        </Pressable>
      </View>

      <View className="flex-row gap-3 mb-4">
        {(['expense', 'income'] as TransactionType[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setType(t)}
            className={`flex-1 items-center rounded-xl border py-3 ${
              type === t
                ? t === 'expense'
                  ? 'border-red-500 bg-red-50'
                  : 'border-green-500 bg-green-50'
                : 'border-gray-300 bg-white'
            }`}
            accessibilityRole="button"
          >
            <Text className={`text-base font-semibold ${type === t ? (t === 'expense' ? 'text-red-600' : 'text-green-600') : 'text-gray-500'}`}>
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
      />
      <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Groceries" />

      <Text className="text-sm font-medium text-gray-700 mb-1.5">Category</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            className={`rounded-full border px-4 py-1.5 ${
              category === c ? 'border-brand-600 bg-brand-50' : 'border-gray-300 bg-white'
            }`}
            accessibilityRole="button"
          >
            <Text className={category === c ? 'text-brand-700 font-medium' : 'text-gray-600'}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input label="Date (yyyy-mm-dd)" value={date} onChangeText={setDate} placeholder="2026-08-17" />

      <Button title={submitLabel} onPress={submit} loading={submitting} disabled={!valid} fullWidth />
    </ScrollView>
  );
}