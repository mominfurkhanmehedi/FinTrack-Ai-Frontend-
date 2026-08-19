import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Card } from '../../components/ui';

/**
 * Screen: About
 * App version, build number, and short description.
 */
export default function About() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = String(Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '1');

  return (
    <SettingsScreen title="About" subtitle="FinTrack AI">
      <View className="items-center py-8">
        <View className="w-20 h-20 rounded-2xl bg-brand-600 items-center justify-center mb-4">
          <Ionicons name="logo-electron" size={44} color="#ffffff" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">FinTrack AI</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">Version {version} ({build})</Text>
      </View>

      <Card>
        <Text className="text-base text-gray-700 dark:text-gray-300 leading-6">
          FinTrack AI is your personal finance companion. Track income and expenses, build budgets
          and savings goals, and get AI-powered insights to help you spend smarter. Available on
          iOS, Android, and the web from a single codebase.
        </Text>
      </Card>
    </SettingsScreen>
  );
}