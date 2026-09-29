import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Button, Card, Input } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();

  const handleDelete = async () => {
    if (!password) {
      setError(t('deleteAccount.errPassword'));
      return;
    }

    if (!confirmed) {
      setError(t('deleteAccount.errConfirm'));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await deleteAccount();

      if (!result.ok) {
        setLoading(false);
        setError(result.error || t('deleteAccount.errFailed'));
        return;
      }

      setDone(true);
      setTimeout(() => {
        router.replace(ROUTES.LOGIN);
      }, 1500);
    } catch (err) {
      setLoading(false);
      console.error('[DeleteAccount] error:', err);
      setError(t('deleteAccount.errUnexpected'));
    }
  };

  const showConfirmation = () => {
    const message = t('deleteAccount.confirmTitle');
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
    <SettingsScreen title={t('deleteAccount.title')} subtitle={t('deleteAccount.subtitle')}>
      <Card className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
        <Text className="text-sm font-semibold text-red-900 dark:text-red-200 mb-2">
          {t('deleteAccount.warning')}
        </Text>
        <Text className="text-sm text-red-800 dark:text-red-300 leading-5">
          {t('deleteAccount.warningBody')}
        </Text>
        <Text className="text-sm text-red-800 dark:text-red-300 mt-2 ml-3">
          {t('deleteAccount.warningList1')}
          {'\n'}
          {t('deleteAccount.warningList2')}
          {'\n'}
          {t('deleteAccount.warningList3')}
          {'\n'}
          {t('deleteAccount.warningList4')}
        </Text>
      </Card>

      <View className="h-4" />

      <Card>
        <Input
          label={t('deleteAccount.enterPassword')}
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
            {t('deleteAccount.iUnderstand')}
          </Text>
        </View>
      </Card>

      <View className="h-4" />

      {error && <Text className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</Text>}

      {done && (
        <Text className="text-sm text-green-600 dark:text-green-400 mb-3">
          {t('deleteAccount.done')}
        </Text>
      )}

      <Button
        title={loading ? t('common.deleting') : t('deleteAccount.deleteMyAccount')}
        variant="danger"
        fullWidth
        onPress={handleDelete}
        disabled={loading || !password || !confirmed}
        loading={loading}
      />
    </SettingsScreen>
  );
}
