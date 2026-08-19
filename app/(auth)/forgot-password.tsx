import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button, Input } from '../../components/ui';
import { authService } from '../../services';

/**
 * Screen: ForgotPassword
 * Requests a password reset link via the mock authService.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    const result = await authService.sendResetLink(email);
    setLoading(false);
    if (result.ok) {
      Alert.alert('Check your email', 'If that address is registered, a reset link is on its way.');
      router.back();
    } else {
      Alert.alert('Error', result.error ?? 'Something went wrong.');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-10">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Reset password</Text>
        <Text className="text-base text-gray-500 mb-8">
          Enter your account email and we'll send you a reset link.
        </Text>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
        />

        <Button title="Send reset link" onPress={onSubmit} loading={loading} fullWidth />
        <View className="h-4" />
        <Button title="Back to login" variant="ghost" onPress={() => router.push('/login')} fullWidth />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
