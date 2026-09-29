import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';
import { InsightCard } from './InsightsLayout';

const EXAMPLES = [
  'insights.askExample1',
  'insights.askExample2',
  'insights.askExample3',
] as const;

/**
 * AskFinTrackCard (insights)
 * The AI assistant entry point. Opens the existing `ask-fintrack` modal, which
 * runs the shared `services/ai.ts` layer over the user's real transactions and
 * goals — so this card is a redesigned surface for existing functionality, not a
 * duplicate or reimplementation of it.
 *
 * Example chips are tappable and jump straight into the assistant with a real
 * question, and the whole card is keyboard/touch accessible.
 */
export function AskFinTrackCard() {
  const { t } = useI18n();

  return (
    <InsightCard>
      <View className="mb-3 flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-600">
          <Ionicons name="sparkles" size={22} color="#ffffff" />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('insights.askTitle')}
          </Text>
          <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {t('insights.askBody')}
          </Text>
        </View>
      </View>

      <View className="mb-4 gap-2">
        {EXAMPLES.map((key) => (
          <Pressable
            key={key}
            onPress={() => router.push(ROUTES.MODALS.ASK_FINTRACK)}
            accessibilityRole="button"
            accessibilityLabel={t(key)}
            className="flex-row items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 active:bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50 dark:active:bg-gray-800"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#6b7280" />
            <Text className="flex-1 text-[13px] text-gray-600 dark:text-gray-300" numberOfLines={2}>
              {t(key)}
            </Text>
            <Ionicons name="arrow-forward" size={13} color="#9ca3af" />
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('insights.askButton')}
        onPress={() => router.push(ROUTES.MODALS.ASK_FINTRACK)}
        className="flex-row items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 active:bg-brand-700"
      >
        <Ionicons name="sparkles" size={17} color="#ffffff" />
        <Text className="text-base font-semibold text-white">{t('insights.askButton')}</Text>
      </Pressable>
      <Text className="mt-2.5 text-center text-xs text-gray-400 dark:text-gray-500">
        {t('insights.askDisclaimer')}
      </Text>
    </InsightCard>
  );
}
