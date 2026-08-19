import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../../components/ui';
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

  const onLogin = async () => {
    const emailValid = isValidEmail(email);
    const passwordValid = password.length > 0;
    setEmailError(emailValid ? null : 'Enter a valid email address.');
    setPasswordError(passwordValid ? null : 'Password is required.');
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
      setFormError(result.error ?? 'Unable to log in.');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-10">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Welcome back</Text>
        <Text className="text-base text-gray-500 mb-8">Log in to your FinTrack AI account.</Text>

        <Input
          label="Email"
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
          label="Password"
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

        <Button title="Log in" onPress={onLogin} loading={loading} fullWidth />
        <Pressable
          className="items-center py-3 mt-2"
          accessibilityRole="button"
          onPress={() => router.push('/forgot-password')}
        >
          <Text className="text-brand-600">Forgot password?</Text>
        </Pressable>
        <View className="flex-row justify-center mt-4">
          <Text className="text-gray-500">New here? </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/signup')}>
            <Text className="text-brand-600 font-semibold">Create account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}