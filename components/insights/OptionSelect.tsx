import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../i18n';

export interface Option<T> {
  value: T;
  label: string;
}

/**
 * OptionSelect (insights)
 * A cross-platform dropdown for the calendar's month/year pickers.
 *
 * React Native has no `<select>`, so this uses a `Modal` list: it behaves the
 * same on iOS, Android and react-native-web, is scrollable for long year lists,
 * and is fully keyboard/screen-reader accessible (each row is a labelled
 * button with a check mark on the current value).
 */
export function OptionSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  width,
  accessibilityLabel,
}: {
  /** Visible field label, e.g. "Year". */
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  width?: number;
  accessibilityLabel?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const current = options.find((o) => o.value === value);
  const title = label ? `${label}: ${current?.label ?? ''}` : (current?.label ?? '');

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={t('common.openSelector')}
        style={width ? { width } : undefined}
        className="flex-row items-center justify-between gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:active:bg-gray-800"
      >
        {label ? (
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {label}
          </Text>
        ) : null}
        <Text className="text-[13px] font-semibold text-gray-900 dark:text-gray-100" numberOfLines={1}>
          {current?.label ?? ''}
        </Text>
        <Ionicons name="chevron-down" size={13} color="#9ca3af" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* The backdrop is a SIBLING of the sheet, never its parent, so a tap
            on the sheet can never reach the backdrop's close handler. The sheet
            is a plain View, so it contributes no touch target of its own. */}
        <View className="flex-1 items-center justify-center bg-black/40 px-4">
          <Pressable
            className="absolute inset-0"
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
          <View className="max-h-[70%] w-full max-w-[380px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">{label}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              style={Platform.OS === 'web' ? ({ maxHeight: 320 } as never) : undefined}
              contentContainerStyle={{ paddingVertical: 6, paddingBottom: insets.bottom + 6 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={item.label}
                    className={`flex-row items-center justify-between px-4 py-3 active:bg-gray-100 dark:active:bg-gray-800 ${
                      selected ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                    }`}
                  >
                    <Text
                      className={`text-[15px] ${
                        selected ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={17} color="#4f46e5" /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
