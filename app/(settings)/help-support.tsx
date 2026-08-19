import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Card } from '../../components/ui';

const TOPICS = [
  'Getting started with FinTrack AI',
  'Adding and editing transactions',
  'Setting up budgets and goals',
  'Understanding AI insights',
  'Managing notifications',
];

/**
 * Screen: HelpSupport
 * Placeholder help hub with common topics.
 */
export default function HelpSupport() {
  return (
    <SettingsScreen title="Help & Support" subtitle="Common questions and guides">
      <Card>
        {TOPICS.map((topic, i) => (
          <View
            key={topic}
            className={`flex-row items-center gap-3 py-3 ${
              i < TOPICS.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
            }`}
          >
            <Ionicons name="document-text-outline" size={20} color="#4f46e5" />
            <Text className="text-base text-gray-900 dark:text-gray-100 flex-1">{topic}</Text>
          </View>
        ))}
      </Card>
      <View className="h-4" />
      <Card title="Still need help?">
        <Text className="text-sm text-gray-500 dark:text-gray-400 leading-5">
          Our support team typically replies within 24 hours. Use the Contact Us
          screen to reach out directly.
        </Text>
      </Card>
    </SettingsScreen>
  );
}