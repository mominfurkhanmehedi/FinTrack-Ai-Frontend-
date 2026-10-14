import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Button, Card, Input } from '../../components/ui';
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();

  const submit = () => {
    if (!current) {
      setError(t('changePassword.errCurrent'));
      return;
    }
    if (next.length < 6) {
      setError(t('changePassword.errNewLength'));
      return;
    }
    if (next !== confirm) {
      setError(t('changePassword.errMismatch'));
      return;
    }
    setError(null);
    setDone(true);
    setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/settings');
      }
    }, 1200);
  };

  return (
    <SettingsScreen title={t('changePassword.title')} subtitle={t('changePassword.subtitle')}>
      <Card>
        <Input
          label={t('changePassword.currentPassword')}
          value={current}
          onChangeText={setCurrent}
          secure
          placeholder="••••••••"
        />
        <Input
          label={t('changePassword.newPassword')}
          value={next}
          onChangeText={setNext}
          secure
          placeholder={t('changePassword.placeholderNew')}
        />
        <Input
          label={t('changePassword.confirmNewPassword')}
          value={confirm}
          onChangeText={setConfirm}
          secure
          placeholder={t('changePassword.placeholderConfirm')}
        />
        {error ? <Text className="text-sm text-red-500 -mt-2 mb-2">{error}</Text> : null}
        {done ? (
          <Text className="text-sm text-green-600 mb-2">{t('changePassword.success')}</Text>
        ) : null}
      </Card>
      <View className="h-4" />
      <Button title={t('changePassword.updatePassword')} onPress={submit} fullWidth />
    </SettingsScreen>
  );
}
