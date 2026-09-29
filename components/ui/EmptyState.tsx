import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Text, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * EmptyState (ui)
 * Designed empty state (icon + message) for screens with no data, instead of a
 * blank panel or bare text.
 *
 * `compact` tightens the padding and the icon badge for panels that are already
 * inside a card on a phone, so an empty dashboard doesn't become a wall of
 * vertical space.
 */
export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  action,
  compact = false,
}: {
  icon?: IoniconName;
  title: string;
  message?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <View className={`items-center ${compact ? 'px-4 py-6' : 'px-6 py-10'}`}>
      <View
        className={`rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center ${
          compact ? 'mb-3 h-12 w-12' : 'mb-4 h-16 w-16'
        }`}
      >
        <Ionicons name={icon} size={compact ? 22 : 30} color="#9ca3af" />
      </View>
      <Text className="text-base font-semibold text-gray-700 dark:text-gray-200 text-center">{title}</Text>
      {message ? (
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1 leading-5">{message}</Text>
      ) : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}