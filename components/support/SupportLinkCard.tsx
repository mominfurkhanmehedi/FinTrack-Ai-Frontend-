import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '../ui';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface SupportLinkCardProps {
  icon: IoniconName;
  title: string;
  description: string;
  onPress: () => void;
}

export function SupportLinkCard({ icon, title, description, onPress }: SupportLinkCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 rounded-2xl active:opacity-70"
    >
      <Card className="h-full min-h-[148px] p-4">
        <View className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-gray-800 items-center justify-center mb-3">
          <Ionicons name={icon} size={20} color="#4f46e5" />
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">
            {title}
          </Text>
          <Ionicons name="arrow-forward" size={17} color="#9ca3af" />
        </View>
        <Text className="text-sm text-gray-500 dark:text-gray-400 leading-5 mt-1">
          {description}
        </Text>
      </Card>
    </Pressable>
  );
}
