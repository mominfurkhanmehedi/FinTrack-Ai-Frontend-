import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Button, Card, Input } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useAppStore } from '../../store';

/**
 * Screen: DeleteAccount
 * Permanently delete user account and all associated data.
 * Requires password confirmation and explicit acknowledgment.
 * This action is irreversible.
 */
export default function DeleteAccount() {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const deleteAccount = useAppStore((s) => s.deleteAccount);

  const handleDelete = async () => {
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }

    if (!confirmed) {
      setError('Please confirm that you want to delete your account.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await deleteAccount();

      if (!result.ok) {
        setLoading(false);
        setError(result.error || 'Failed to delete account. Please try again.');
        return;
      }

      setDone(true);
      setTimeout(() => {
        router.replace(ROUTES.LOGIN);
      }, 1500);
    } catch (err) {
      setLoading(false);
      console.error('[DeleteAccount] error:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const showConfirmation = () => {
    const message = 'Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(message)) {
        setConfirmed(true);
      }
      return;
    }
    // Mobile - just toggle the checkbox state
    setConfirmed(!confirmed);
  };

  return (
    <SettingsScreen title="Delete Account" subtitle="Permanently delete your account">
      <Card className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
        <Text className="text-sm font-semibold text-red-900 dark:text-red-200 mb-2">⚠️ Warning</Text>
        <Text className="text-sm text-red-800 dark:text-red-300 leading-5">
          Deleting your account is permanent and irreversible. This will:
        </Text>
        <Text className="text-sm text-red-800 dark:text-red-300 mt-2 ml-3">
          • Delete your account and all personal information{'\n'}
          • Remove all transactions and goals{'\n'}
          • Cancel any subscriptions{'\n'}
          • Disable access to your data
        </Text>
      </Card>

      <View className="h-4" />

      <Card>
        <Input
          label="Enter your password"
          value={password}
          onChangeText={setPassword}
          secure
          placeholder="••••••••"
          editable={!loading}
        />
      </Card>

      <View className="h-4" />

      <Card>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={showConfirmation}
            disabled={loading}
            className={`w-6 h-6 rounded border-2 items-center justify-center ${
              confirmed
                ? 'bg-red-500 border-red-600'
                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
            }`}
          >
            {confirmed && <Text className="text-white font-bold text-lg">✓</Text>}
          </Pressable>
          <Text className="flex-1 text-sm text-gray-700 dark:text-gray-300">
            I understand that this action cannot be undone
          </Text>
        </View>
      </Card>

      <View className="h-4" />

      {error && <Text className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</Text>}

      {done && (
        <Text className="text-sm text-green-600 dark:text-green-400 mb-3">Account deleted successfully. Redirecting...</Text>
      )}

      <Button
        title={loading ? 'Deleting...' : 'Delete My Account'}
        variant="danger"
        fullWidth
        onPress={handleDelete}
        disabled={loading || !password || !confirmed}
        loading={loading}
      />
    </SettingsScreen>
  );
}
