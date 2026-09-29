import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../../components/ui';
import { useI18n } from '../../i18n';
import { authService } from '../../services';

/**
 * Screen: ForgotPassword
 * Requests a password reset link via the mock authService.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const onSubmit = async () => {
    setLoading(true);
    const result = await authService.sendResetLink(email);
    setLoading(false);
    if (result.ok) {
      Alert.alert(t('auth.forgot.checkEmailTitle'), t('auth.forgot.checkEmailBody'));
      router.back();
    } else {
      Alert.alert(t('auth.forgot.errorTitle'), result.error ?? t('auth.forgot.somethingWentWrong'));
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-10">
        <Text className="text-3xl font-bold text-gray-900 mb-2">{t('auth.forgot.resetPassword')}</Text>
        <Text className="text-base text-gray-500 mb-8">{t('auth.forgot.subtitle')}</Text>

        <Input
          label={t('auth.forgot.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
        />

        <Button title={t('auth.forgot.sendResetLink')} onPress={onSubmit} loading={loading} fullWidth />
        <View className="h-4" />
        <Button title={t('common.backToLogin')} variant="ghost" onPress={() => router.push('/login')} fullWidth />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
