import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { SupportLinkCard } from '../../components/support';
import { Button, Card, Input, ResponsiveGrid } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { SUPPORT_EMAIL } from '../../constants/support';
import { useI18n } from '../../i18n';

const SUPPORT_DETAILS = [
  { icon: 'mail-outline', label: 'Support email', value: SUPPORT_EMAIL },
  { icon: 'time-outline', label: 'Typical response', value: 'Within 24 hours' },
  { icon: 'lock-closed-outline', label: 'Safe to share', value: 'Steps, messages, and error details' },
] as const;

function showNotice(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function ContactUs() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState<string>();
  const [launching, setLaunching] = useState(false);
  const { t } = useI18n();

  const openSupportEmail = async () => {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
    } catch {
      showNotice(t('contactUs.title'), SUPPORT_EMAIL);
    }
  };

  const send = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setMessageError('Tell us how we can help.');
      return;
    }

    setMessageError(undefined);
    setLaunching(true);

    const body = encodeURIComponent(`\n\n${trimmedMessage}\n\nSent from FinTrack AI`);
    const resolvedSubject = subject.trim() || t('contactUs.defaultSubject');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(resolvedSubject)}&body=${body}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        showNotice(t('contactUs.title'), SUPPORT_EMAIL);
        return;
      }
      await Linking.openURL(url);
    } catch {
      showNotice(t('contactUs.title'), SUPPORT_EMAIL);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <SettingsScreen
      title={t('contactUs.title')}
      subtitle={t('contactUs.subtitle', { email: SUPPORT_EMAIL })}
    >
      <Card>
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Support information
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 leading-5 mt-1 mb-4">
          Choose a quick option or compose a message in your email app.
        </Text>
        {SUPPORT_DETAILS.map((detail, index) => (
          <View
            key={detail.label}
            className={`flex-row items-center gap-3 py-3 ${
              index < SUPPORT_DETAILS.length - 1
                ? 'border-b border-gray-100 dark:border-gray-800'
                : ''
            }`}
          >
            <View className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-gray-800 items-center justify-center">
              <Ionicons name={detail.icon} size={18} color="#4f46e5" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400">{detail.label}</Text>
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                {detail.value}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <View className="h-6" />
      <ResponsiveGrid>
        <SupportLinkCard
          icon="mail-outline"
          title="Email support"
          description={`Write directly to ${SUPPORT_EMAIL} from your preferred email app.`}
          onPress={openSupportEmail}
        />
        <SupportLinkCard
          icon="chatbubbles-outline"
          title="Read the FAQs"
          description="Check quick answers before sending us a message."
          onPress={() => router.push(ROUTES.SETTINGS_SCREENS.FAQS)}
        />
      </ResponsiveGrid>

      <View className="h-6" />
      <Card title="Send us a message">
        <Text className="text-sm text-gray-500 dark:text-gray-400 leading-5 mb-5">
          The form prepares a draft in your email app. Nothing is sent until you review and send it.
        </Text>
        <Input
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="Briefly describe the issue"
          autoCapitalize="sentences"
          maxLength={120}
          returnKeyType="next"
        />
        <Input
          label="Message"
          value={message}
          onChangeText={(value) => {
            setMessage(value);
            if (messageError && value.trim()) setMessageError(undefined);
          }}
          error={messageError}
          placeholder="Include what you expected, what happened, and any steps you already tried."
          autoCapitalize="sentences"
          autoCorrect
          multiline
          numberOfLines={7}
          maxLength={2000}
          textAlignVertical="top"
        />
        <Button
          title="Open email draft"
          onPress={send}
          loading={launching}
          fullWidth
          leftIcon={<Ionicons name="mail-outline" size={18} color="#ffffff" />}
        />
        <View className="flex-row items-start gap-2 mt-4">
          <Ionicons name="shield-checkmark-outline" size={17} color="#16a34a" />
          <Text className="text-xs text-gray-500 dark:text-gray-400 leading-5 flex-1">
            Never send passwords, one-time codes, or complete bank account numbers.
          </Text>
        </View>
      </Card>
    </SettingsScreen>
  );
}
