import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ACTIONS: { key: string; label: string; icon: IoniconName; color: string }[] = [
  { key: 'add-income', label: 'Add income', icon: 'add-circle', color: '#16a34a' },
  { key: 'add-expense', label: 'Add expense', icon: 'remove-circle', color: '#dc2626' },
  { key: 'add-goal', label: 'Add goal', icon: 'flag', color: '#4f46e5' },
];

export interface QuickActionsProps {
  onAddIncome?: () => void;
  onAddExpense?: () => void;
  onAddGoal?: () => void;
}

/**
 * QuickActions (dashboard)
 * Shortcut buttons for common mutations.
 */
export function QuickActions({ onAddIncome, onAddExpense, onAddGoal }: QuickActionsProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    'add-income': onAddIncome,
    'add-expense': onAddExpense,
    'add-goal': onAddGoal,
  };

  return (
    <View className="flex-row gap-3">
      {ACTIONS.map((a) => (
        <Pressable
          key={a.key}
          onPress={handlers[a.key]}
          className="flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 py-4 active:bg-gray-100"
          accessibilityRole="button"
        >
          <Ionicons name={a.icon} size={26} color={a.color} />
          <Text className="text-sm font-medium text-gray-700 mt-2">{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
