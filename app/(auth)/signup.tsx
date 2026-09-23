import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../../components/ui';
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

  const onSignup = async () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Full name is required.';
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (password.length < 6) nextErrors.password = 'Password must be at least 6 characters.';
    if (password !== confirm) nextErrors.confirm = 'Passwords do not match.';
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
      setFormError(result.error ?? 'Unable to create account.');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-10">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Create your account</Text>
        <Text className="text-base text-gray-500 mb-8">Start tracking your finances in minutes.</Text>

        <Input
          label="Full name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setErrors((e) => ({ ...e, name: undefined }));
          }}
          placeholder="Jane Doe"
          error={errors.name}
        />
        <Input
          label="Email"
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
          label="Password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setErrors((e) => ({ ...e, password: undefined, confirm: undefined }));
          }}
          secure
          placeholder="At least 6 characters"
          error={errors.password}
        />
        <Input
          label="Confirm password"
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            setErrors((e) => ({ ...e, confirm: undefined }));
          }}
          secure
          placeholder="Repeat your password"
          error={errors.confirm}
        />

        {formError ? <Text className="text-sm text-red-500 mb-2">{formError}</Text> : null}

        <Button title="Create account" onPress={onSignup} loading={loading} fullWidth />
        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">Already have an account? </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/login')}>
            <Text className="text-brand-600 font-semibold">Log in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}