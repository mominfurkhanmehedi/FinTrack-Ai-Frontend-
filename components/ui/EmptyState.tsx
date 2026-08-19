import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Text, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * EmptyState (ui)
 * Designed empty state (icon + message) for screens with no data, instead of a
 * blank panel or bare text.
 */
export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  action,
}: {
  icon?: IoniconName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="items-center py-10 px-6">
      <View className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mb-4">
        <Ionicons name={icon} size={30} color="#9ca3af" />
      </View>
      <Text className="text-base font-semibold text-gray-700 dark:text-gray-200 text-center">{title}</Text>
      {message ? (
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1 leading-5">{message}</Text>
      ) : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}