import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, ResponsiveContainer, ResponsiveGrid, ScreenHeader } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useAppStore } from '../../store';
import { useMoney } from '../../hooks';

/**
 * Screen: Budget
 * Tab: Budget
 * Budget/goals tracker with per-goal progress bars.
 */
export default function Budget() {
  const goals = useAppStore((s) => s.goals);
  const deleteGoal = useAppStore((s) => s.deleteGoal);
  const { format } = useMoney();

  return (
    <ResponsiveContainer>
      <ScreenHeader
        title="Budget"
        subtitle="Track your savings goals"
        action={
          <Pressable
            className="flex-row items-center gap-1 rounded-xl bg-brand-600 px-4 py-2.5 active:bg-brand-700"
            accessibilityRole="button"
            onPress={() => router.push(ROUTES.MODALS.ADD_GOAL)}
          >
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text className="text-white font-semibold">New goal</Text>
          </Pressable>
        }
      />

      <ResponsiveGrid>
        {goals.map((goal) => {
          const pct = goal.target > 0 ? Math.min((goal.saved / goal.target) * 100, 100) : 0;
          const complete = pct >= 100;
          return (
            <Card key={goal.id} title={goal.title} subtitle={complete ? 'Completed' : 'In progress'}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">{format(goal.saved)}</Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">of {format(goal.target)}</Text>
              </View>
              <View className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <View className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
              </View>
              <View className="flex-row justify-between mt-2">
                <Text className="text-sm text-gray-500">{Math.round(pct)}% saved</Text>
                <Pressable accessibilityRole="button" onPress={() => deleteGoal(goal.id)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </Pressable>
              </View>
            </Card>
          );
        })}

        {goals.length === 0 ? (
          <Card>
            <EmptyState
              icon="flag-outline"
              title="No goals yet"
              message={`Tap "New goal" to start saving toward something you care about.`}
            />
          </Card>
        ) : null}
      </ResponsiveGrid>
    </ResponsiveContainer>
  );
}