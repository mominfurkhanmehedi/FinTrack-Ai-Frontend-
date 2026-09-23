import { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * ScreenHeader (ui)
 * Consistent page title area at the top of every screen. May include a
 * right-aligned `action` (e.g. an "Add" button).
 */
export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between mb-6" style={{ paddingRight: action ? 58 : 0 }}>
      <View className="flex-1 pr-3">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</Text>
        {subtitle ? (
          <Text className="text-base text-gray-500 dark:text-gray-400 mt-1">{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}