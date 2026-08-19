import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

/**
 * SettingsScreen (settings)
 * Shared scaffold for settings sub-screens: a safe-area wrapper with a title
 * header (back + close), a scrollable centered content column, and optional
 * footer. Keeps the responsive (centered on web, full-width on mobile) layout
 * consistent across all the settings sub-pages.
 */
export function SettingsScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="px-4 pt-2 pb-3 flex-row items-center justify-between bg-gray-50 dark:bg-gray-950">
        <View className="flex-row items-center gap-3 flex-1">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            className="w-11 h-11 items-center justify-center rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
          >
            <Ionicons name="chevron-back" size={22} color="#4f46e5" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</Text>
            {subtitle ? (
              <Text className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</Text>
            ) : null}
          </View>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 pb-10">
        <View className="w-full max-w-3xl self-center">{children}</View>
      </ScrollView>
      {footer ? <View className="px-4 pb-6 bg-gray-50 dark:bg-gray-950">{footer}</View> : null}
    </SafeAreaView>
  );
}