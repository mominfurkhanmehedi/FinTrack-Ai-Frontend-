import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';

import { useI18n } from '../../i18n';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ACTIONS = [
  { key: 'add-income', label: 'dashboard.addIncome', icon: 'add-circle', color: '#16a34a' },
  { key: 'add-expense', label: 'dashboard.addExpense', icon: 'remove-circle', color: '#dc2626' },
  { key: 'add-goal', label: 'dashboard.addGoal', icon: 'flag', color: '#4f46e5' },
] as const;

export interface QuickActionsProps {
  onAddIncome?: () => void;
  onAddExpense?: () => void;
  onAddGoal?: () => void;
}

/**
 * QuickActions (dashboard)
 * Shortcut buttons for common mutations.
 *
 * Responsive: in a wide column (mobile full-width, tablet 2-col) the actions
 * sit side-by-side; in a narrow desktop ~1/4 column they stack as full-width
 * rows so labels stay readable and the buttons keep a comfortable tap target.
 */
export function QuickActions({ onAddIncome, onAddExpense, onAddGoal }: QuickActionsProps) {
  const [width, setWidth] = useState(0);
  const { t } = useI18n();

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  // Default to the side-by-side look until measured; ~280px is the minimum
  // comfortable width for three tappable actions in a row.
  const stacked = width > 0 && width < 280;

  const handlers: Record<string, (() => void) | undefined> = {
    'add-income': onAddIncome,
    'add-expense': onAddExpense,
    'add-goal': onAddGoal,
  };

  return (
    <View onLayout={onLayout}>
      {stacked ? (
        <View className="gap-2">
          {ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              onPress={handlers[a.key]}
              className="flex-row items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 active:bg-gray-100 dark:active:bg-gray-700"
              style={{ minHeight: 48 }}
              accessibilityRole="button"
            >
              <View
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: `${a.color}1a` }}
              >
                <Ionicons name={a.icon} size={20} color={a.color} />
              </View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 ml-3 flex-1" numberOfLines={1}>
                {t(a.label)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View className="flex-row gap-3">
          {ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              onPress={handlers[a.key]}
              className="flex-1 items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-4 active:bg-gray-100 dark:active:bg-gray-700"
              style={{ minHeight: 84 }}
              accessibilityRole="button"
            >
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: `${a.color}1a` }}
              >
                <Ionicons name={a.icon} size={22} color={a.color} />
              </View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mt-2" numberOfLines={1}>
                {t(a.label)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}