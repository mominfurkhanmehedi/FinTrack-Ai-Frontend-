import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Accordion, AccordionItem } from '../../components/support';
import { Button, Card } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';

const FAQS: AccordionItem[] = [
  {
    id: 'what-is-fintrack',
    question: 'What is FinTrack AI?',
    answer:
      'FinTrack AI is a personal financial tracking and management tool. It helps you record transactions, review spending, plan budgets, follow savings goals, and explore reports. It does not act as a bank, investment platform, or professional adviser.',
  },
  {
    id: 'first-transaction',
    question: 'How do I add my first transaction?',
    answer:
      'Open the add-transaction action, choose Income or Expense, enter the amount and date, select a category, and save. FinTrack AI will immediately include it in your balance, category totals, and relevant reports.',
  },
  {
    id: 'data-storage',
    question: 'Where is my data stored?',
    answer:
      'App data is cached on your device for fast access. When you are signed in, transactions and goals are synchronized with your FinTrack AI account so they can be restored on your devices. Your selected profile picture and some preferences are also kept in local app storage.',
  },
  {
    id: 'bank-connection',
    question: 'Does FinTrack AI connect to my bank automatically?',
    answer:
      'No. In the current version, you add transactions manually. FinTrack AI is not a bank, payment service, or account aggregator, so it cannot verify a transaction with your financial institution.',
  },
  {
    id: 'edit-delete',
    question: 'Can I edit or delete a transaction?',
    answer:
      'Yes. Open the relevant transaction from the Transactions screen, choose Edit to change its details, or choose Delete to remove it. If you are signed in, the change is synchronized with your account.',
  },
  {
    id: 'ai-insights',
    question: 'How are insights generated?',
    answer:
      'Balances, categories, trends, safe-to-spend estimates, and many reports are calculated from the data you provide. When an external AI provider is configured for an AI feature, the app sends your question and only the relevant transaction or goal context needed for that response.',
  },
  {
    id: 'ai-accuracy',
    question: 'Can AI-generated insights be wrong?',
    answer:
      'Yes. AI output and projections can be incomplete, outdated, or incorrect because they depend on the information you entered and the model used. Review important calculations against your own records and never rely on generated content as professional advice.',
  },
  {
    id: 'currency',
    question: 'Does the app convert currencies?',
    answer:
      'Yes. The currency setting is the currency your data is stored in. When you choose a different currency, FinTrack AI converts your existing transactions, goals and savings to it and saves the converted amounts, so your data is always in the currency you selected. This conversion cannot be undone, so the app asks you to confirm first. Exchange rates come from a daily rate provider and need a connection the first time they are fetched.',
  },
  {
    id: 'export-data',
    question: 'How do I export my data?',
    answer:
      'Go to Settings, choose Export Data, and select Export CSV. The current export includes the title, amount, currency, type, category, and date of your transactions. You can share or save the file using your device.',
  },
  {
    id: 'delete-data',
    question: 'How can I remove my information?',
    answer:
      'You can clear individual records, clear app data, or use Delete Account from Settings. Local information is also removed when you sign out where applicable or uninstall the app. Contact support if you need help with an account data request.',
  },
];

export default function Faqs() {
  const { t } = useI18n();

  return (
    <SettingsScreen title={t('faqs.title')} subtitle={t('faqs.subtitle')}>
      <Accordion items={FAQS} initialExpandedId={FAQS[0].id} />

      <View className="h-4" />
      <Card>
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-gray-800 items-center justify-center">
            <Ionicons name="help-circle-outline" size={20} color="#4f46e5" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Still need an answer?
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 leading-5 mt-1">
              Tell the support team what you were trying to do and what happened instead.
            </Text>
          </View>
        </View>
        <View className="mt-4">
          <Button
            title="Contact Us"
            variant="secondary"
            fullWidth
            leftIcon={<Ionicons name="mail-outline" size={18} color="#4338ca" />}
            onPress={() => router.push(ROUTES.SETTINGS_SCREENS.CONTACT_US)}
          />
        </View>
      </Card>
    </SettingsScreen>
  );
}
