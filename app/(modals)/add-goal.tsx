import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '../../components/ui';
import { useAppStore } from '../../store';

/**
 * Modal: AddGoal
 * Creates a new savings goal.
 */
export default function AddGoal() {
  const addGoal = useAppStore((s) => s.addGoal);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');

  const valid = title.trim().length > 0 && parseFloat(target) > 0;

  const submit = () => {
    addGoal({ title, target: parseFloat(target), saved: 0 });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-6 pb-10">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900">New goal</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text className="text-brand-600 font-semibold">Close</Text>
          </Pressable>
        </View>

        <Input label="Goal title" value={title} onChangeText={setTitle} placeholder="e.g. Emergency fund" />
        <Input label="Target amount" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" />

        <Button title="Create goal" onPress={submit} disabled={!valid} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}