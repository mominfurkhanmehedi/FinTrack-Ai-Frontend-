import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../../components/ui';
import { useI18n } from '../../i18n';
import { authService } from '../../services';
import { useAppStore } from '../../store';
import { isValidEmail } from '../../utils';

/**
 * Screen: Signup
 * Registration wired to the mock authService. Validates name, email format, and
 * password confirmation client-side before submitting.
 */
export default function Signup() {
  const setUser = useAppStore((s) => s.setUser);
  const finishOnboarding = useAppStore((s) => s.finishOnboarding);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { t } = useI18n();

  const onSignup = async () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = t('auth.signup.errName');
    if (!isValidEmail(email)) nextErrors.email = t('auth.signup.errEmail');
    if (password.length < 6) nextErrors.password = t('auth.signup.errPassword');
    if (password !== confirm) nextErrors.confirm = t('auth.signup.errMismatch');
    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);
    const result = await authService.register(name, email, password);
    setLoading(false);
    if (result.ok && result.needsEmailConfirmation) {
      // Email confirmation required — land on the OTP screen and wait for the
      // code before treating the user as signed in.
      router.replace(`/verify-otp?email=${encodeURIComponent(email)}`);
    } else if (result.ok && result.user) {
      setUser(result.user);
      finishOnboarding();
      router.replace('/dashboard');
    } else {
      setFormError(result.error ?? t('auth.signup.errInvalid'));
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-10">
        <Text className="text-3xl font-bold text-gray-900 mb-2">
          {t('auth.signup.createYourAccount')}
        </Text>
        <Text className="text-base text-gray-500 mb-8">{t('auth.signup.subtitle')}</Text>

        <Input
          label={t('auth.signup.fullName')}
          value={name}
          onChangeText={(t) => {
            setName(t);
            setErrors((e) => ({ ...e, name: undefined }));
          }}
          placeholder={t('auth.signup.placeholderName')}
          error={errors.name}
        />
        <Input
          label={t('auth.signup.email')}
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setErrors((e) => ({ ...e, email: undefined }));
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email}
        />
        <Input
          label={t('auth.signup.password')}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setErrors((e) => ({ ...e, password: undefined, confirm: undefined }));
          }}
          secure
          placeholder={t('auth.signup.placeholderPassword')}
          error={errors.password}
        />
        <Input
          label={t('auth.signup.confirmPassword')}
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            setErrors((e) => ({ ...e, confirm: undefined }));
          }}
          secure
          placeholder={t('auth.signup.placeholderConfirm')}
          error={errors.confirm}
        />

        {formError ? <Text className="text-sm text-red-500 mb-2">{formError}</Text> : null}

        <Button title={t('auth.signup.createAccount')} onPress={onSignup} loading={loading} fullWidth />
        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">{t('auth.signup.alreadyHaveAccount')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/login')}>
            <Text className="text-brand-600 font-semibold">{t('auth.login.logIn')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
