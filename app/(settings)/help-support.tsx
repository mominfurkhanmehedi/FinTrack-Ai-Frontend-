import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { SupportLinkCard } from '../../components/support';
import { Card, ResponsiveGrid } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';

const GUIDES = [
  {
    id: 'transactions',
    icon: 'receipt-outline',
    title: 'Add your first transaction',
    description: 'Record income or an expense and see it reflected in your balance.',
    route: ROUTES.MODALS.ADD_TRANSACTION,
  },
  {
    id: 'insights',
    icon: 'sparkles-outline',
    title: 'Understand AI insights',
    description: 'Learn what each insight means and review the data behind it.',
    route: ROUTES.INSIGHTS,
  },
  {
    id: 'budgets',
    icon: 'wallet-outline',
    title: 'Set up a budget',
    description: 'Create a monthly limit and monitor your progress by category.',
    route: ROUTES.BUDGET,
  },
  {
    id: 'goals',
    icon: 'flag-outline',
    title: 'Track a savings goal',
    description: 'Set a target, add contributions, and follow your estimated pace.',
    route: ROUTES.BUDGET,
  },
  {
    id: 'reports',
    icon: 'bar-chart-outline',
    title: 'Explore reports',
    description: 'Review trends, category breakdowns, and monthly performance.',
    route: ROUTES.REPORTS,
  },
  {
    id: 'export',
    icon: 'download-outline',
    title: 'Export your transactions',
    description: 'Download a CSV copy of your transaction history.',
    route: ROUTES.SETTINGS_SCREENS.EXPORT_DATA,
  },
] as const;

const PRIVACY_TIPS = [
  'Never include your password, one-time codes, or full bank account details.',
  'Describe the issue clearly and include the steps that led to it.',
  'Do not send a screenshot that exposes unrelated financial information.',
] as const;

export default function HelpSupport() {
  const { t } = useI18n();

  return (
    <SettingsScreen title={t('helpSupport.title')} subtitle={t('helpSupport.subtitle')}>
      <Card className="bg-brand-600 dark:bg-brand-700 border-brand-600 dark:border-brand-700">
        <View className="flex-row items-start gap-4">
          <View className="w-12 h-12 rounded-2xl bg-white/15 items-center justify-center">
            <Ionicons name="headset" size={26} color="#ffffff" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-white">How can we help?</Text>
            <Text className="text-sm text-indigo-100 leading-5 mt-1">
              Start with a quick guide, browse common questions, or contact our support team.
            </Text>
          </View>
        </View>
      </Card>

      <View className="h-6" />
      <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Quick options
      </Text>
      <ResponsiveGrid>
        <SupportLinkCard
          icon="chatbubbles-outline"
          title="Browse FAQs"
          description="Find concise answers to common tracking, data, and AI questions."
          onPress={() => router.push(ROUTES.SETTINGS_SCREENS.FAQS)}
        />
        <SupportLinkCard
          icon="mail-outline"
          title="Contact support"
          description="Send us the details and we will help you work through the issue."
          onPress={() => router.push(ROUTES.SETTINGS_SCREENS.CONTACT_US)}
        />
      </ResponsiveGrid>

      <View className="h-6" />
      <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Popular guides
      </Text>
      <ResponsiveGrid>
        {GUIDES.map((guide) => (
          <SupportLinkCard
            key={guide.id}
            icon={guide.icon}
            title={guide.title}
            description={guide.description}
            onPress={() => router.push(guide.route)}
          />
        ))}
      </ResponsiveGrid>

      <View className="h-4" />
      <Card>
        <View className="flex-row items-center gap-3 mb-3">
          <View className="w-10 h-10 rounded-xl bg-green-50 dark:bg-gray-800 items-center justify-center">
            <Ionicons name="shield-checkmark-outline" size={20} color="#16a34a" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Before you contact us
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Keep your personal information safe
            </Text>
          </View>
        </View>
        {PRIVACY_TIPS.map((tip) => (
          <View key={tip} className="flex-row items-start gap-2 mt-2">
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
            <Text className="text-sm text-gray-600 dark:text-gray-300 leading-5 flex-1">
              {tip}
            </Text>
          </View>
        ))}
      </Card>

      <View className="h-4" />
      <Card>
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
          FinTrack AI is a tracking and management tool
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 leading-6 mt-2">
          It does not provide financial, investment, tax, accounting, or legal advice. For advice
          about your circumstances, consult a qualified professional.
        </Text>
      </Card>
    </SettingsScreen>
  );
}
