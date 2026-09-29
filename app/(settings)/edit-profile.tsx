import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Button, Card, Input } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { AVATARS } from '../../types';

/**
 * Screen: EditProfile
 * Edits the signed-in user's name and avatar emoji.
 */
export default function EditProfile() {
  const user = useAppStore((s) => s.user);
  const updateUser = useAppStore((s) => s.updateUser);
  const { t } = useI18n();

  const [name, setName] = useState(user?.name ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? AVATARS[0]);

  const valid = name.trim().length > 0;

  const save = () => {
    updateUser({ name: name.trim(), avatar });
    router.back();
  };

  return (
    <SettingsScreen title={t('editProfile.title')} subtitle={t('editProfile.subtitle')}>
      <Card>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('editProfile.avatar')}
        </Text>
        <View className="flex-row flex-wrap gap-3 mb-6">
          {AVATARS.map((a) => {
            const selected = a === avatar;
            return (
              <View
                key={a}
                className={`w-14 h-14 items-center justify-center rounded-full border-2 ${
                  selected ? 'border-brand-600 bg-brand-50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                }`}
              >
                <Text
                  className="text-2xl"
                  onPress={() => setAvatar(a)}
                  accessibilityRole="button"
                  accessibilityLabel={t('editProfile.selectAvatar', { avatar: a })}
                >
                  {a}
                </Text>
              </View>
            );
          })}
        </View>

        <Input label={t('editProfile.fullName')} value={name} onChangeText={setName} placeholder={t('editProfile.placeholderName')} />
        <Input label={t('editProfile.email')} value={user?.email ?? ''} editable={false} />
      </Card>

      <View className="h-4" />
      <Button title={t('editProfile.saveChanges')} onPress={save} disabled={!valid} fullWidth />
    </SettingsScreen>
  );
}
