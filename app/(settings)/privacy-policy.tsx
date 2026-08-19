import { Text } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Card } from '../../components/ui';

/**
 * Screen: PrivacyPolicy
 * Sample privacy policy text.
 */
export default function PrivacyPolicy() {
  return (
    <SettingsScreen title="Privacy Policy" subtitle="Last updated: 2026">
      <Card>
        {SECTIONS.map((s) => (
          <Text key={s.title} className="mb-4">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">{s.title}</Text>
            {'\n'}
            <Text className="text-sm text-gray-600 dark:text-gray-300 leading-5">{s.body}</Text>
          </Text>
        ))}
      </Card>
    </SettingsScreen>
  );
}

const SECTIONS = [
  {
    title: '1. Data we collect',
    body: 'FinTrack AI stores the financial information you enter — transactions, budgets, and goals — on your device and any backend you connect. We do not sell your personal data.',
  },
  {
    title: '2. How we use your data',
    body: 'Your data is used solely to power the app: showing balances, computing insights, and generating budgets. AI insights are derived locally from your own records.',
  },
  {
    title: '3. Data security',
    body: 'We take reasonable measures to protect your information. You can clear or export all of your data at any time from Settings.',
  },
  {
    title: '4. Your rights',
    body: 'You may export, correct, or delete your data at any time. Contact us for help with data requests.',
  },
];