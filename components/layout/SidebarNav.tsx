import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface NavItem {
  route: string;
  label: string;
  icon: IoniconName;
}

/** The single source of truth for primary navigation. */
export const NAV_ITEMS: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard', icon: 'home-outline' },
  { route: 'transactions', label: 'Transactions', icon: 'swap-horizontal-outline' },
  { route: 'insights', label: 'AI Insights', icon: 'sparkles-outline' },
  { route: 'budget', label: 'Budget & Goals', icon: 'wallet-outline' },
  { route: 'reports', label: 'Reports', icon: 'bar-chart-outline' },
  { route: 'settings', label: 'Settings', icon: 'settings-outline' },
];

export function SidebarNav({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (route: string) => void;
}) {
  return (
    <View className="flex-1">
      {NAV_ITEMS.map((item) => {
        const focused = active === item.route;
        return (
          <Pressable
            key={item.route}
            accessibilityRole="button"
            onPress={() => onSelect(item.route)}
            className={`flex-row items-center gap-3 rounded-xl px-3 py-3 mb-1 ${
              focused ? 'bg-brand-50 dark:bg-brand-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={focused ? '#4f46e5' : '#6b7280'}
            />
            <Text
              className={`text-base ${
                focused ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}