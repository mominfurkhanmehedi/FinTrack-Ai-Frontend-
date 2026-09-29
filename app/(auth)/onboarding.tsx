import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';

/**
 * Screen: Onboarding
 * Shown once to first-time users (hasOnboarded === false) after the landing
 * screen. A short value pitch that, when completed, marks onboarding as done
 * and routes the user into the login flow.
 */
export default function Onboarding() {
  const finishOnboarding = useAppStore((s) => s.finishOnboarding);
  const { t } = useI18n();

  const start = () => {
    finishOnboarding();
    router.replace('/login');
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-10">
        <View className="flex-1 justify-center">
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-3xl bg-brand-600 items-center justify-center mb-4">
              <Ionicons name="logo-electron" size={44} color="#ffffff" />
            </View>
            <Text className="text-3xl font-bold text-gray-900 text-center">
              {t('auth.onboarding.welcome')}
            </Text>
          </View>

          <View className="gap-4">
            <Step
              icon="wallet"
              title={t('auth.onboarding.step1Title')}
              body={t('auth.onboarding.step1Body')}
            />
            <Step
              icon="flag"
              title={t('auth.onboarding.step2Title')}
              body={t('auth.onboarding.step2Body')}
            />
            <Step
              icon="sparkles"
              title={t('auth.onboarding.step3Title')}
              body={t('auth.onboarding.step3Body')}
            />
          </View>
        </View>

        <View className="pt-8 pb-4">
          <Button title={t('auth.onboarding.getStarted')} fullWidth onPress={start} />
          <Pressable className="items-center py-3 mt-2" accessibilityRole="button" onPress={() => router.replace('/login')}>
            <Text className="text-gray-500">{t('auth.onboarding.alreadyHaveAccount')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Step({
  icon,
  title,
  body,
}: {
  icon: 'wallet' | 'flag' | 'sparkles';
  title: string;
  body: string;
}) {
  return (
    <View className="flex-row items-start gap-4">
      <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
        <Ionicons name={icon} size={22} color="#4f46e5" />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-gray-900">{title}</Text>
        <Text className="text-sm text-gray-500 leading-5">{body}</Text>
      </View>
    </View>
  );
}
