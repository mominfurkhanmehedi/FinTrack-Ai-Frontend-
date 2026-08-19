import { Text } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Card } from '../../components/ui';

/**
 * Screen: Terms
 * Sample terms & conditions text.
 */
export default function Terms() {
  return (
    <SettingsScreen title="Terms & Conditions" subtitle="Effective: 2026">
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
    title: '1. Acceptance of terms',
    body: 'By using FinTrack AI you agree to these terms. If you do not agree, please discontinue use of the app.',
  },
  {
    title: '2. Use of the service',
    body: 'FinTrack AI is provided for personal, non-commercial use. You agree not to misuse the service or attempt to disrupt it.',
  },
  {
    title: '3. No financial advice',
    body: 'Insights and suggestions are for informational purposes only and do not constitute professional financial advice.',
  },
  {
    title: '4. Liability',
    body: 'The app is provided "as is" without warranties of any kind. We are not liable for any losses arising from your use of the app.',
  },
];