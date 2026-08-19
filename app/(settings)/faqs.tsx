import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Card } from '../../components/ui';

const FAQS = [
  {
    q: 'How does FinTrack AI track my spending?',
    a: 'Transactions you add are stored locally and used to compute totals, categories, and AI-powered insights. Nothing is shared without your consent.',
  },
  {
    q: 'Is my financial data safe?',
    a: 'Yes. Your data stays on your device (and optionally syncs to your backend). We never sell your personal information.',
  },
  {
    q: 'How are AI insights generated?',
    a: 'Insights are computed from your transaction history — spending predictions, budget suggestions, and savings opportunities.',
  },
  {
    q: 'Can I export my data?',
    a: 'Yes. Go to Settings → Data → Export Data to download your transactions as a CSV file.',
  },
];

/**
 * Screen: FAQs
 * Sample questions and answers with expandable rows.
 */
export default function Faqs() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SettingsScreen title="FAQs" subtitle="Frequently asked questions">
      <Card>
        {FAQS.map((faq, i) => {
          const expanded = open === i;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              onPress={() => setOpen(expanded ? null : i)}
              className={`py-3 ${i < FAQS.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-medium text-gray-900 dark:text-gray-100 flex-1 pr-2">
                  {faq.q}
                </Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#9ca3af"
                />
              </View>
              {expanded ? (
                <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-5">{faq.a}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </Card>
    </SettingsScreen>
  );
}