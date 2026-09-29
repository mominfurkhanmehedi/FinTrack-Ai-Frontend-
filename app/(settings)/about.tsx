import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { SupportLinkCard } from '../../components/support';
import { Card, ResponsiveGrid } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';

const FEATURES = [
  {
    icon: 'receipt-outline',
    title: 'Transaction tracking',
    description: 'Record income and expenses and review a clear, current balance.',
  },
  {
    icon: 'wallet-outline',
    title: 'Budgets and goals',
    description: 'Plan monthly limits, set savings targets, and follow your progress.',
  },
  {
    icon: 'sparkles-outline',
    title: 'AI-assisted insights',
    description: 'Explore trends, safe-to-spend estimates, and what-if scenarios.',
  },
  {
    icon: 'bar-chart-outline',
    title: 'Reports',
    description: 'Understand categories, monthly patterns, and changes over time.',
  },
] as const;

export default function About() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = String(
    Constants.expoConfig?.ios?.buildNumber ??
      Constants.expoConfig?.android?.versionCode ??
      '1',
  );
  const { t } = useI18n();

  return (
    <SettingsScreen title={t('settings.about')} subtitle={t('about.subtitle')}>
      <View className="items-center py-5">
        <View className="w-24 h-24 rounded-3xl bg-brand-600 items-center justify-center mb-4 shadow-sm">
          <Ionicons name="logo-electron" size={52} color="#ffffff" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">FinTrack AI</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('about.version', { version, build })}
        </Text>
        <View className="mt-3 px-3 py-1 rounded-full bg-brand-50 dark:bg-gray-800">
          <Text className="text-xs font-medium text-brand-700 dark:text-indigo-300">
            iOS • Android • Web
          </Text>
        </View>
      </View>

      <Card title="Clearer money management">
        <Text className="text-sm text-gray-600 dark:text-gray-300 leading-6">
          FinTrack AI brings everyday financial tracking into one focused experience. Record what
          comes in and goes out, organize spending, plan for goals, and turn your history into
          information you can act on.
        </Text>
        <Text className="text-sm text-gray-600 dark:text-gray-300 leading-6 mt-3">
          The app is designed to make your financial picture easier to understand while keeping
          you in control of the information you enter.
        </Text>
      </Card>

      <View className="h-6" />
      <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        What you can do
      </Text>
      <ResponsiveGrid>
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="h-full p-4">
            <View className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-gray-800 items-center justify-center mb-3">
              <Ionicons name={feature.icon} size={20} color="#4f46e5" />
            </View>
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {feature.title}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 leading-5 mt-1">
              {feature.description}
            </Text>
          </Card>
        ))}
      </ResponsiveGrid>

      <View className="h-4" />
      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <View className="flex-row items-start gap-3">
          <Ionicons name="information-circle" size={22} color="#d97706" />
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Information, not professional advice
            </Text>
            <Text className="text-sm text-gray-700 dark:text-gray-300 leading-6 mt-1">
              FinTrack AI is a financial tracking and management tool. It does not provide
              financial, investment, tax, accounting, or legal advice.
            </Text>
          </View>
        </View>
      </Card>

      <View className="h-6" />
      <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Legal
      </Text>
      <ResponsiveGrid>
        <SupportLinkCard
          icon="shield-checkmark-outline"
          title="Privacy Policy"
          description="Learn what data is collected, how it is used, and the controls you have."
          onPress={() => router.push(ROUTES.SETTINGS_SCREENS.PRIVACY_POLICY)}
        />
        <SupportLinkCard
          icon="document-text-outline"
          title="Terms & Conditions"
          description="Review the rules that apply when you use FinTrack AI."
          onPress={() => router.push(ROUTES.SETTINGS_SCREENS.TERMS)}
        />
      </ResponsiveGrid>
    </SettingsScreen>
  );
}
