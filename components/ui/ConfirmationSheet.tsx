import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

export interface ConfirmationSheetProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationSheet({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationSheetProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = () => {
    if (busy || loading) return;
    setBusy(true);
    onConfirm();
    setBusy(false);
  };

  const handleCancel = () => {
    if (busy || loading) return;
    onCancel();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View className="flex-1 bg-black/50">
        <Pressable
          className="absolute inset-0"
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelText}
        />
        <View className="flex-1 justify-end">
          <View className="bg-white dark:bg-gray-900 rounded-t-3xl pb-10 pt-2 px-4">
            <View className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700 self-center mb-5" />

            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">{title}</Text>
            <Text className="text-base text-gray-600 dark:text-gray-400 text-center mb-6 px-4">{message}</Text>

            <Pressable
              accessibilityRole="button"
              disabled={busy || loading}
              onPress={handleConfirm}
              className={`flex-row items-center justify-center gap-3 py-3 rounded-xl mb-3 ${
                variant === 'danger' ? 'bg-danger-500 active:bg-red-600' : 'bg-brand-600 active:bg-brand-700'
              }`}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : null}
              <Text className="text-base font-semibold text-white">{confirmText}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={busy || loading}
              onPress={handleCancel}
              className="py-3"
            >
              <Text className="text-base text-center text-gray-500 dark:text-gray-400 font-medium">{cancelText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}