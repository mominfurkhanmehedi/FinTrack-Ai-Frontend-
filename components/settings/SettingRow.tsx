import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface SettingRowProps {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  /** Optional right-side value shown before the chevron (e.g. "Dark"). */
  value?: string;
  /** Rendered instead of the chevron (e.g. a Switch). */
  right?: React.ReactNode;
  danger?: boolean;
}

/**
 * SettingRow (settings)
 * Consistent row used across every settings card: icon + label on the left, a
 * value / custom control on the right, and a chevron. Subtle divider between
 * rows (border-b, last row without it).
 */
export function SettingRow({ icon, label, onPress, value, right, danger }: SettingRowProps) {
  const iconColor = danger ? '#ef4444' : '#4f46e5';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 active:bg-gray-50 dark:active:bg-gray-800 px-1 -mx-1 rounded-lg"
    >
      <View className="flex-row items-center gap-3 flex-1">
        <Ionicons name={icon} size={20} color={iconColor} />
        <Text className={`text-base ${danger ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
          {label}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {value ? <Text className="text-base text-gray-500 dark:text-gray-400">{value}</Text> : null}
        {right ? right : <Ionicons name="chevron-forward" size={18} color="#9ca3af" />}
      </View>
    </Pressable>
  );
}