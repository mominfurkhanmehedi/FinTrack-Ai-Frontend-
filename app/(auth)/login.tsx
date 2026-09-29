import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../../components/ui';
import { useI18n } from '../../i18n';
import { authService } from '../../services';
import { useAppStore } from '../../store';
import { isValidEmail } from '../../utils';

/**
 * Screen: Login
 * Email/password auth wired to the mock authService. Validates email format and
 * required password client-side, then routes to the dashboard on success.
 */
export default function Login() {
  const setUser = useAppStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { t } = useI18n();

  const onLogin = async () => {
    const emailValid = isValidEmail(email);
    const passwordValid = password.length > 0;
    setEmailError(emailValid ? null : t('auth.login.errEmail'));
    setPasswordError(passwordValid ? null : t('auth.login.errPassword'));
    setFormError(null);

    if (!emailValid || !passwordValid) {
      return;
    }

    setLoading(true);
    const result = await authService.login(email, password);
    setLoading(false);
    if (result.ok && result.user) {
      setUser(result.user);
      router.replace('/dashboard');
    } else {
      setFormError(result.error ?? t('auth.login.errInvalid'));
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-10">
        <Text className="text-3xl font-bold text-gray-900 mb-2">{t('auth.login.welcomeBack')}</Text>
        <Text className="text-base text-gray-500 mb-8">{t('auth.login.subtitle')}</Text>

        <Input
          label={t('auth.login.email')}
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setEmailError(null);
            setFormError(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@example.com"
          error={emailError ?? undefined}
        />
        <Input
          label={t('auth.login.password')}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setPasswordError(null);
            setFormError(null);
          }}
          secure
          placeholder="••••••••"
          error={passwordError ?? undefined}
        />

        {formError ? <Text className="text-sm text-red-500 mb-2">{formError}</Text> : null}

        <Button title={t('auth.login.logIn')} onPress={onLogin} loading={loading} fullWidth />
        <Pressable
          className="items-center py-3 mt-2"
          accessibilityRole="button"
          onPress={() => router.push('/forgot-password')}
        >
          <Text className="text-brand-600">{t('auth.login.forgotPassword')}</Text>
        </Pressable>
        <View className="flex-row justify-center mt-4">
          <Text className="text-gray-500">{t('auth.login.newHere')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/signup')}>
            <Text className="text-brand-600 font-semibold">{t('auth.signup.createAccount')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
