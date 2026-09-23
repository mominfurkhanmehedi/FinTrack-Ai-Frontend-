import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../../components/ui';
import { authService } from '../../services';
import { useAppStore } from '../../store';

/**
 * Screen: Verify OTP
 * Shown right after signup. The user enters the 6-digit code emailed to them
 * (Supabase's "Confirm signup" template must include {{ .Token }} for this to
 * actually be a code rather than a link). On success this both confirms the
 * account and starts a real session.
 */
export default function VerifyOtp() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const setUser = useAppStore((s) => s.setUser);
  const finishOnboarding = useAppStore((s) => s.finishOnboarding);
  const hydrateFromSupabase = useAppStore((s) => s.hydrateFromSupabase);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onVerify = async () => {
    if (!email) {
      setError('Missing email — please sign up again.');
      return;
    }
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setError(null);
    setLoading(true);
    const result = await authService.verifySignupOtp(email, code.trim());
    setLoading(false);

    if (result.ok && result.user) {
      setUser(result.user);
      finishOnboarding();
      hydrateFromSupabase(result.user.id);
      router.replace('/dashboard');
    } else {
      setError(result.error ?? 'Invalid or expired code.');
    }
  };

  const onResend = async () => {
    if (!email) return;
    setError(null);
    setNotice(null);
    setResending(true);
    const result = await authService.resendSignupOtp(email);
    setResending(false);
    setNotice(result.ok ? 'A new code has been sent to your email.' : null);
    if (!result.ok) setError(result.error ?? 'Could not resend code.');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-10">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Verify your email</Text>
        <Text className="text-base text-gray-500 mb-8">
          {email
            ? `Enter the 6-digit code we sent to ${email}.`
            : 'Enter the 6-digit code we sent to your email.'}
        </Text>

        <Input
          label="Verification code"
          value={code}
          onChangeText={(t) => {
            setCode(t.replace(/[^0-9]/g, '').slice(0, 6));
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          error={error ?? undefined}
        />

        {notice ? <Text className="text-sm text-green-600 mb-2">{notice}</Text> : null}

        <Button title="Verify" onPress={onVerify} loading={loading} fullWidth />

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">Didn't get a code? </Text>
          <Pressable accessibilityRole="button" onPress={onResend} disabled={resending}>
            <Text className="text-brand-600 font-semibold">
              {resending ? 'Sending…' : 'Resend'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}