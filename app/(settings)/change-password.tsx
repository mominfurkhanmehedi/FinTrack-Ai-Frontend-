import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Button, Card, Input } from '../../components/ui';

/**
 * Screen: ChangePassword
 * Change password form with current/new/confirm fields and client-side
 * validation. In production this calls a real auth backend via services.
 */
export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () => {
    if (!current) {
      setError('Enter your current password.');
      return;
    }
    if (next.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setError(null);
    setDone(true);
    setTimeout(() => router.back(), 1200);
  };

  return (
    <SettingsScreen title="Change Password" subtitle="Update your account password">
      <Card>
        <Input
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secure
          placeholder="••••••••"
        />
        <Input
          label="New password"
          value={next}
          onChangeText={setNext}
          secure
          placeholder="At least 6 characters"
        />
        <Input
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secure
          placeholder="Repeat new password"
        />
        {error ? <Text className="text-sm text-red-500 -mt-2 mb-2">{error}</Text> : null}
        {done ? (
          <Text className="text-sm text-green-600 mb-2">Password updated successfully.</Text>
        ) : null}
      </Card>
      <View className="h-4" />
      <Button title="Update password" onPress={submit} fullWidth />
    </SettingsScreen>
  );
}