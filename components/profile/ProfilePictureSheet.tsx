import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { pickProfilePicture } from '../../services/profilePicture';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';

interface ProfilePictureSheetProps {
  visible: boolean;
  hasPicture: boolean;
  /** Called when the sheet should close (applied, cancelled, or backdrop tap). */
  onClose: () => void;
}

/**
 * ProfilePictureSheet
 * Clean bottom-sheet action sheet for managing the profile picture:
 * "Choose from Gallery", "Remove Profile Picture" (only when a picture is set)
 * and "Cancel". Shows inline error text instead of browser alert boxes.
 */
export function ProfilePictureSheet({
  visible,
  hasPicture,
  onClose,
}: ProfilePictureSheetProps) {
  const setProfilePicture = useAppStore((s) => s.setProfilePicture);
  const [busyAction, setBusyAction] = useState<'gallery' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<'gallery' | 'remove' | null>(null);
  const { t } = useI18n();
  const busy = busyAction !== null;

  const resetState = () => {
    setBusyAction(null);
    setError(null);
    setRetryAction(null);
  };

  const finish = () => {
    resetState();
    onClose();
  };

  const close = () => {
    if (busy) return;
    finish();
  };

  const savePicture = async (getUri: () => Promise<string | null>) => {
    setBusyAction('gallery');
    setError(null);
    setRetryAction(null);
    try {
      const uri = await getUri();
      if (!uri) {
        setBusyAction(null);
        return;
      }
      await setProfilePicture(uri);
      finish();
    } catch (e) {
      console.error('[profilePicture] gallery save failed', e);
      setError(e instanceof Error ? e.message : t('profilePicture.errLoad'));
      setRetryAction('gallery');
      setBusyAction(null);
    }
  };

  const chooseFromGallery = () => {
    void savePicture(pickProfilePicture);
  };

  const removePicture = async () => {
    setBusyAction('remove');
    setError(null);
    setRetryAction(null);
    try {
      await setProfilePicture(null);
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profilePicture.errRemove'));
      setRetryAction('remove');
      setBusyAction(null);
    }
  };

  const retryLastAction = () => {
    if (retryAction === 'gallery') {
      chooseFromGallery();
    } else if (retryAction === 'remove') {
      void removePicture();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      {/* The backdrop is a SIBLING of the sheet rather than its parent, so taps
          on the sheet's own rows can never reach the backdrop's close handler,
          and the sheet wrapper is a plain View that adds no touch target. */}
      <View className="flex-1 bg-black/50">
        <Pressable
          className="absolute inset-0"
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View className="flex-1 justify-end">
          <View className="bg-white dark:bg-gray-900 rounded-t-3xl pb-10 pt-2 px-4">
            <View className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700 self-center mb-5" />

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={chooseFromGallery}
              className="flex flex-row items-center gap-4 py-4 border-b border-gray-100 dark:border-gray-800"
            >
              {busyAction === 'gallery' ? (
                <ActivityIndicator size="small" color="#4f46e5" />
              ) : (
                <Ionicons name="images-outline" size={22} color="#4f46e5" />
              )}
              <Text className="text-base text-gray-900 dark:text-gray-100 font-medium">
                {t('profilePicture.chooseFromGallery')}
              </Text>
            </Pressable>

            {hasPicture ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={removePicture}
                className="flex flex-row items-center gap-4 py-4 border-b border-gray-100 dark:border-gray-800"
              >
                <Ionicons name="trash-outline" size={22} color="#dc2626" />
                <Text className="text-base text-danger-500 font-medium">
                  {t('profilePicture.removeProfilePicture')}
                </Text>
              </Pressable>
            ) : null}

            {error ? (
              <View className="mt-3 mb-1">
                <Text className="text-sm text-danger-500 text-center">{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={retryLastAction}
                  className="flex-row items-center justify-center gap-2 py-3"
                >
                  <Ionicons name="refresh-outline" size={18} color="#4f46e5" />
                  <Text className="text-sm text-brand-600 dark:text-brand-400 font-medium">
                    {t('common.tryAgain')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={close}
              className="py-4"
            >
              <Text className="text-base text-center text-gray-500 dark:text-gray-400 font-medium">
                {t('profilePicture.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
